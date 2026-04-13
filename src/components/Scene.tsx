import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, Environment, ContactShadows, TransformControls, Text, Line, PointerLockControls } from '@react-three/drei';
import { ShapeData } from '../types';
import { SnapGuide } from '../smartSnap';
import * as THREE from 'three';
import { TransformMode } from '../App';
import { Download, Upload, ChevronLeft, ChevronRight, Eye, EyeOff, Settings, Sun, Moon, Wand2 } from 'lucide-react';

import { ShapeType } from '../types';
import { Geometry, Base, Subtraction, Addition } from '@react-three/csg';

interface SceneProps {
  shapes: ShapeData[];
  selectedIds: Set<string>;
  transformMode: TransformMode;
  snapToGrid: boolean;
  smartSnap: boolean;
  activeGuides: SnapGuide[];
  resetCameraFlag: number;
  historyLength: number;
  historyIndex: number;
  isMobile: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  useShaders: boolean;
  onToggleShaders: () => void;
  onSelect: (id: string | null, additive?: boolean) => void;
  onUpdate: (id: string, updates: Partial<ShapeData>) => void;
  onGroupTransform: (id: string, updates: Partial<ShapeData>) => void;
  onMultiSelect: (ids: string[], additive: boolean) => void;
  onAdd: (type: ShapeType, position?: [number, number, number]) => void;
  onSave: () => void;
  onLoad: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClearGuides: () => void;
}

// ═══ Custom shapes ═══
const starShape = new THREE.Shape();
const outerRadius = 0.5, innerRadius = 0.25, spikes = 5;
for (let i = 0; i < spikes * 2; i++) {
  const radius = i % 2 === 0 ? outerRadius : innerRadius;
  const angle = (i / (spikes * 2)) * Math.PI * 2;
  if (i === 0) starShape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  else starShape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
}
starShape.closePath();

const heartShape = new THREE.Shape();
heartShape.moveTo(0, 0.25);
heartShape.quadraticCurveTo(0.25, 0.5, 0.5, 0.25);
heartShape.quadraticCurveTo(0.5, 0, 0, -0.5);
heartShape.quadraticCurveTo(-0.5, 0, -0.5, 0.25);
heartShape.quadraticCurveTo(-0.25, 0.5, 0, 0.25);

const arrowShape = new THREE.Shape();
arrowShape.moveTo(0, 0.5); arrowShape.lineTo(0.5, 0); arrowShape.lineTo(0.2, 0);
arrowShape.lineTo(0.2, -0.5); arrowShape.lineTo(-0.2, -0.5); arrowShape.lineTo(-0.2, 0);
arrowShape.lineTo(-0.5, 0); arrowShape.closePath();

const crossShape = new THREE.Shape();
crossShape.moveTo(0.15, 0.5); crossShape.lineTo(0.15, 0.15); crossShape.lineTo(0.5, 0.15);
crossShape.lineTo(0.5, -0.15); crossShape.lineTo(0.15, -0.15); crossShape.lineTo(0.15, -0.5);
crossShape.lineTo(-0.15, -0.5); crossShape.lineTo(-0.15, -0.15); crossShape.lineTo(-0.5, -0.15);
crossShape.lineTo(-0.5, 0.15); crossShape.lineTo(-0.15, 0.15); crossShape.lineTo(-0.15, 0.5);
crossShape.closePath();

const extrudeSettings = { depth: 0.2, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };

// ═══ Striped material for holes ═══
const holeTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#666666'; ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#999999'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(64, 64); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-32, 32); ctx.lineTo(32, 96); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(32, -32); ctx.lineTo(96, 32); ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
})();

// ═══ Shape component ═══
const Shape = ({ shape, isSelected, useShaders, onSelect }: { shape: ShapeData; isSelected: boolean; useShaders: boolean; onSelect: (e: any) => void }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const texture = useMemo(() => {
    if (shape.type === 'image' && shape.imageUrl) {
      return new THREE.TextureLoader().load(shape.imageUrl);
    }
    return null;
  }, [shape.type, shape.imageUrl]);

  if (shape.type === 'text') {
    return (
      <group position={shape.position} rotation={shape.rotation} scale={shape.scale}>
        <Text ref={meshRef as any}
          font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf"
          fontSize={0.5} color={shape.color} anchorX="center" anchorY="middle"
          outlineWidth={isSelected ? 0.02 : 0} outlineColor="#E4E3E0"
          onClick={(e) => { e.stopPropagation(); onSelect(e); }}
        >{shape.text || 'ТЕКСТ'}</Text>
      </group>
    );
  }

  const renderGeometry = () => {
    switch (shape.type) {
      case 'box': return <boxGeometry />;
      case 'sphere': return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'cylinder': return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case 'cone': return <coneGeometry args={[0.5, 1, 32]} />;
      case 'torus': return <torusGeometry args={[0.4, 0.15, 16, 100]} />;
      case 'pyramid': return <coneGeometry args={[0.5, 1, 4]} />;
      case 'capsule': return <capsuleGeometry args={[0.3, 0.5, 4, 16]} />;
      case 'octahedron': return <octahedronGeometry args={[0.5]} />;
      case 'dodecahedron': return <dodecahedronGeometry args={[0.5]} />;
      case 'prism': return <cylinderGeometry args={[0.5, 0.5, 1, 3]} />;
      case 'icosahedron': return <icosahedronGeometry args={[0.5, 0]} />;
      case 'tetrahedron': return <tetrahedronGeometry args={[0.5, 0]} />;
      case 'torusKnot': return <torusKnotGeometry args={[0.3, 0.1, 64, 16]} />;
      case 'ring': return <ringGeometry args={[0.2, 0.5, 32]} />;
      case 'plane': return <planeGeometry args={[1, 1]} />;
      case 'image': return <planeGeometry args={[1, 1]} />;
      case 'circle': return <circleGeometry args={[0.5, 32]} />;
      case 'star': return <extrudeGeometry args={[starShape, extrudeSettings]} />;
      case 'heart': return <extrudeGeometry args={[heartShape, extrudeSettings]} />;
      case 'arrow': return <extrudeGeometry args={[arrowShape, extrudeSettings]} />;
      case 'cross': return <extrudeGeometry args={[crossShape, extrudeSettings]} />;
      case 'hemisphere': return <sphereGeometry args={[0.5, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />;
      case 'pipe': return (
        <extrudeGeometry args={[
          (() => {
            const s = new THREE.Shape();
            s.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
            const hole = new THREE.Path();
            hole.absarc(0, 0, 0.35, 0, Math.PI * 2, true);
            s.holes.push(hole);
            return s;
          })(),
          { depth: 1, bevelEnabled: false }
        ]} />
      );
      case 'roundRoof': return <cylinderGeometry args={[0.5, 0.5, 1, 32, 1, false, 0, Math.PI]} />;
      case 'paraboloid': return (
        <latheGeometry args={[
          (() => {
            const points = [];
            for (let i = 0; i <= 10; i++) {
              const x = i / 10 * 0.5;
              const y = (x * x) * 2;
              points.push(new THREE.Vector2(x, y));
            }
            return points;
          })(),
          32
        ]} />
      );
      default: return <boxGeometry />;
    }
  };

  const isTransparent = (shape.opacity !== undefined && shape.opacity < 1) || shape.isHole;

  return (
    <mesh ref={meshRef} position={shape.position} rotation={shape.type === 'roundRoof' ? [shape.rotation[0], shape.rotation[1], shape.rotation[2] + Math.PI / 2] : shape.rotation} scale={shape.scale}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}>
      {renderGeometry()}
      <meshStandardMaterial 
        color={shape.isHole ? '#888888' : (shape.type === 'image' && shape.imageUrl ? '#ffffff' : shape.color)}
        map={shape.isHole ? holeTexture : (texture || undefined)}
        roughness={useShaders ? 0.2 : 1.0} 
        metalness={useShaders ? 0.8 : 0.0}
        emissive={isSelected ? shape.color : '#000000'} emissiveIntensity={isSelected ? 0.5 : 0}
        side={THREE.DoubleSide}
        transparent={isTransparent}
        opacity={shape.isHole ? 0.4 : (shape.opacity ?? 1)} />
      {isSelected && (
        <mesh scale={[1.1, 1.1, 1.1]} rotation={shape.type === 'roundRoof' ? [0, 0, Math.PI / 2] : [0,0,0]}>
          {renderGeometry()}
          <meshBasicMaterial color="#E4E3E0" wireframe transparent opacity={0.3} />
        </mesh>
      )}
    </mesh>
  );
};

// ═══ CSG Group component ═══
const GroupedCSG = ({ shapes, isSelected, useShaders, onSelect }: { shapes: ShapeData[]; isSelected: boolean; useShaders: boolean; onSelect: (id: string, e: any) => void }) => {
  const solids = shapes.filter(s => !s.isHole);
  const holes = shapes.filter(s => s.isHole);

  const renderShapeGeometry = (shape: ShapeData) => {
    switch (shape.type) {
      case 'box': return <boxGeometry />;
      case 'sphere': return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'cylinder': return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case 'cone': return <coneGeometry args={[0.5, 1, 32]} />;
      case 'roundRoof': return <cylinderGeometry args={[0.5, 0.5, 1, 32, 1, false, 0, Math.PI]} />;
      default: return <boxGeometry />;
    }
  };

  if (solids.length === 0) {
    return (
      <group>
        {shapes.map(s => <Shape key={s.id} shape={s} isSelected={isSelected} useShaders={useShaders} onSelect={(e) => onSelect(s.id, e)} />)}
      </group>
    );
  }

  const baseShape = solids[0];
  const remainingSolids = solids.slice(1);

  return (
    <mesh onClick={(e) => { e.stopPropagation(); onSelect(baseShape.id, e); }}>
      <Geometry>
        <Base position={baseShape.position} 
              rotation={baseShape.type === 'roundRoof' ? [baseShape.rotation[0], baseShape.rotation[1], baseShape.rotation[2] + Math.PI / 2] : baseShape.rotation} 
              scale={baseShape.scale}>
          {renderShapeGeometry(baseShape)}
        </Base>
        
        {remainingSolids.map(s => (
          <Addition key={s.id} position={s.position} 
                    rotation={s.type === 'roundRoof' ? [s.rotation[0], s.rotation[1], s.rotation[2] + Math.PI / 2] : s.rotation} 
                    scale={s.scale}>
            {renderShapeGeometry(s)}
          </Addition>
        ))}

        {holes.map(h => (
          <Subtraction key={h.id} position={h.position} 
                       rotation={h.type === 'roundRoof' ? [h.rotation[0], h.rotation[1], h.rotation[2] + Math.PI / 2] : h.rotation} 
                       scale={h.scale}>
            {renderShapeGeometry(h)}
          </Subtraction>
        ))}
      </Geometry>
      <meshStandardMaterial 
        color={solids[0].color} 
        roughness={useShaders ? 0.2 : 0.8} 
        metalness={useShaders ? 0.5 : 0} 
        emissive={isSelected ? solids[0].color : '#000000'} emissiveIntensity={isSelected ? 0.3 : 0}
      />
    </mesh>
  );
};

// ═══ Camera controller ═══
function CameraController({ resetFlag }: { resetFlag: number }) {
  const { camera } = useThree();
  const initialRef = useRef(true);
  useEffect(() => {
    if (initialRef.current) { initialRef.current = false; return; }
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
  }, [resetFlag, camera]);
  return null;
}

// ═══ Exposes camera ref to parent ═══
function CameraExposer({ cameraRef }: { cameraRef: React.MutableRefObject<THREE.Camera | null> }) {
  const { camera } = useThree();
  useEffect(() => { cameraRef.current = camera; }, [camera, cameraRef]);
  return null;
}

// ═══ Minecraft-like First Person Controller ═══
const PLAYER_HEIGHT = 1.7;
const GRAVITY = 0.015;
const JUMP_FORCE = 0.18;
const WALK_SPEED = 0.08;

function FirstPersonController() {
  const { camera } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false, jump: false });
  const velocityY = useRef(0);
  const isGrounded = useRef(true);
  const direction = useRef(new THREE.Vector3());
  const frontVector = useRef(new THREE.Vector3());
  const sideVector = useRef(new THREE.Vector3());

  useEffect(() => {
    camera.position.set(3, PLAYER_HEIGHT, 3);
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = true; break;
        case 'KeyS': moveState.current.backward = true; break;
        case 'KeyA': moveState.current.left = true; break;
        case 'KeyD': moveState.current.right = true; break;
        case 'Space': 
          if (isGrounded.current) {
            velocityY.current = JUMP_FORCE;
            isGrounded.current = false;
          }
          break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = false; break;
        case 'KeyS': moveState.current.backward = false; break;
        case 'KeyA': moveState.current.left = false; break;
        case 'KeyD': moveState.current.right = false; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [camera]);

  useFrame(() => {
    // Horizontal movement (walk on ground plane)
    frontVector.current.set(0, 0, Number(moveState.current.backward) - Number(moveState.current.forward));
    sideVector.current.set(Number(moveState.current.left) - Number(moveState.current.right), 0, 0);
    direction.current.subVectors(frontVector.current, sideVector.current).normalize().multiplyScalar(WALK_SPEED);
    direction.current.applyEuler(new THREE.Euler(0, camera.rotation.y, 0, 'YXZ'));

    camera.position.x += direction.current.x;
    camera.position.z += direction.current.z;

    // Gravity
    velocityY.current -= GRAVITY;
    camera.position.y += velocityY.current;

    // Ground collision
    if (camera.position.y <= PLAYER_HEIGHT) {
      camera.position.y = PLAYER_HEIGHT;
      velocityY.current = 0;
      isGrounded.current = true;
    }
  });

  return <PointerLockControls />;
}

// ═══ Minecraft Hand (visible in FPS mode) ═══
function MinecraftHand({ activeBlock, useShaders }: { activeBlock: ShapeType; useShaders: boolean }) {
  const handRef = useRef<THREE.Group>(null);
  const swingRef = useRef(0);
  const isSwinging = useRef(false);
  const { camera } = useThree();

  useEffect(() => {
    const handleClick = () => { isSwinging.current = true; swingRef.current = 0; };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, []);

  useFrame(() => {
    if (!handRef.current) return;
    // Follow camera
    handRef.current.position.copy(camera.position);
    handRef.current.rotation.copy(camera.rotation);
    handRef.current.updateMatrix();
    handRef.current.translateX(0.35);
    handRef.current.translateY(-0.3);
    handRef.current.translateZ(-0.5);

    // Swing animation
    if (isSwinging.current) {
      swingRef.current += 0.15;
      const swingAngle = Math.sin(swingRef.current * Math.PI) * 0.8;
      handRef.current.rotateX(-swingAngle);
      if (swingRef.current >= 1) { isSwinging.current = false; swingRef.current = 0; }
    } else {
      // Idle bob
      const bob = Math.sin(Date.now() * 0.003) * 0.015;
      handRef.current.translateY(bob);
    }
  });

  const blockColor = useMemo(() => {
    const colors: Record<string, string> = {
      box: '#8B6914', sphere: '#aaaaaa', cylinder: '#888888', cone: '#666666',
      pyramid: '#C2B280', torus: '#cc4444', capsule: '#44cc44',
    };
    return colors[activeBlock] || '#8B6914';
  }, [activeBlock]);

  return (
    <group ref={handRef}>
      {/* Arm */}
      <mesh position={[0, -0.05, 0.1]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.08, 0.08, 0.25]} />
        <meshStandardMaterial color="#D2A06C" roughness={0.8} />
      </mesh>
      {/* Block in hand */}
      <mesh position={[0, 0.05, -0.05]} rotation={[0.3, 0.5, 0]}>
        <boxGeometry args={[0.12, 0.12, 0.12]} />
        <meshStandardMaterial color={blockColor} roughness={useShaders ? 0.2 : 0.8} metalness={useShaders ? 0.5 : 0} />
      </mesh>
    </group>
  );
}

// ═══ Block placer (raycasts from camera for FPS placement) ═══
function MinecraftBlockPlacer({ onPlace, activeBlock }: { onPlace: (type: ShapeType, pos: [number,number,number]) => void; activeBlock: ShapeType }) {
  const { camera, scene } = useThree();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return; // left click only
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      if (intersects.length > 0) {
        const hit = intersects[0];
        const normal = hit.face?.normal || new THREE.Vector3(0, 1, 0);
        const worldNormal = normal.clone().transformDirection(hit.object.matrixWorld);
        const pos: [number, number, number] = [
          Math.round((hit.point.x + worldNormal.x * 0.5) * 2) / 2,
          Math.round((hit.point.y + worldNormal.y * 0.5) * 2) / 2,
          Math.round((hit.point.z + worldNormal.z * 0.5) * 2) / 2,
        ];
        if (pos[1] < 0.5) pos[1] = 0.5;
        onPlace(activeBlock, pos);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [camera, scene, onPlace, activeBlock]);

  return null;
}

// ═══ Main Scene ═══
// ═══ Hotbar block types for Minecraft mode ═══
const HOTBAR_BLOCKS: { type: ShapeType; label: string; color: string }[] = [
  { type: 'box', label: 'Куб', color: '#8B6914' },
  { type: 'sphere', label: 'Сфера', color: '#aaaaaa' },
  { type: 'cylinder', label: 'Цилиндр', color: '#888888' },
  { type: 'cone', label: 'Конус', color: '#666666' },
  { type: 'pyramid', label: 'Пирамида', color: '#C2B280' },
  { type: 'torus', label: 'Тор', color: '#cc4444' },
  { type: 'capsule', label: 'Капсула', color: '#44cc44' },
  { type: 'octahedron', label: 'Октаэдр', color: '#4488cc' },
  { type: 'star', label: 'Звезда', color: '#cccc44' },
];

export default function Scene({ shapes, selectedIds, transformMode, snapToGrid, smartSnap, activeGuides, resetCameraFlag, historyLength, historyIndex, isMobile, theme, onToggleTheme, useShaders, onToggleShaders, onSelect, onUpdate, onGroupTransform, onMultiSelect, onAdd, onSave, onLoad, onUndo, onRedo, canUndo, canRedo, onClearGuides }: SceneProps) {
  const orbitRef = useRef<any>(null);
  const transformRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const marqueeDidDrag = useRef(false);

  // FPS Mode (desktop only)
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const [fpsActiveSlot, setFpsActiveSlot] = useState(0);
  // Settings Mode
  const [showSettings, setShowSettings] = useState(false);

  // Marquee state (desktop only)
  const [marquee, setMarquee] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);

  // FPS hotbar scroll + number keys
  useEffect(() => {
    if (!isFirstPerson) return;
    const handleWheel = (e: WheelEvent) => {
      setFpsActiveSlot(prev => {
        const next = prev + (e.deltaY > 0 ? 1 : -1);
        return ((next % HOTBAR_BLOCKS.length) + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
      });
    };
    const handleKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key);
      if (n >= 1 && n <= HOTBAR_BLOCKS.length) setFpsActiveSlot(n - 1);
    };
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isFirstPerson]);

  const handleFpsPlace = useCallback((type: ShapeType, pos: [number, number, number]) => {
    onAdd(type, pos);
  }, [onAdd]);

  // Configure interaction modes based on transformMode
  useEffect(() => {
    if (orbitRef.current) {
      if (transformMode === 'select') {
        // Disable primary rotation so selection works without moving camera
        orbitRef.current.mouseButtons = { LEFT: 99, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
        orbitRef.current.touches = { ONE: 99, TWO: THREE.TOUCH.DOLLY_PAN };
      } else {
        // Restore standard orbit interaction
        orbitRef.current.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        orbitRef.current.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
      }
    }
  }, [transformMode]);

  // Reset orbit target on camera reset
  useEffect(() => {
    if (resetCameraFlag > 0 && orbitRef.current) {
      orbitRef.current.target.set(0, 0, 0);
      orbitRef.current.update();
    }
  }, [resetCameraFlag]);

  // Disable orbit while dragging transform gizmo
  useEffect(() => {
    if (transformRef.current) {
      const controls = transformRef.current;
      const cb = (e: any) => { if (orbitRef.current) orbitRef.current.enabled = !e.value; };
      controls.addEventListener('dragging-changed', cb);
      return () => controls.removeEventListener('dragging-changed', cb);
    }
  }, [selectedIds]);

  // ═══ Primary selected ID ═══
  let primarySelectedId: string | null = null;
  if (selectedIds.size === 1) {
    primarySelectedId = [...selectedIds][0];
  } else if (selectedIds.size > 1) {
    const selected = shapes.filter(s => selectedIds.has(s.id));
    const gid = selected[0]?.groupId;
    if (gid && selected.every(s => s.groupId === gid)) {
      primarySelectedId = selected[0].id;
    }
  }

  const selectedShape = primarySelectedId ? shapes.find(s => s.id === primarySelectedId) : null;
  const showGizmo = selectedShape && transformMode !== 'select';

  const handleTransformChange = () => {
    if (transformRef.current?.object && primarySelectedId) {
      const obj = transformRef.current.object;
      onGroupTransform(primarySelectedId, {
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      });
    }
    setTimeout(() => onClearGuides(), 300);
  };

  // ═══ Marquee selection handlers (desktop only) ═══
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isMobile || transformMode !== 'select' || e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    setMarquee({ sx: x, sy: y, ex: x, ey: y });
    marqueeDidDrag.current = false;
  }, [transformMode, isMobile]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!marquee || isMobile) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ex = e.clientX - rect.left, ey = e.clientY - rect.top;
    const dx = Math.abs(ex - marquee.sx), dy = Math.abs(ey - marquee.sy);
    if (dx > 5 || dy > 5) marqueeDidDrag.current = true;
    setMarquee(prev => prev ? { ...prev, ex, ey } : null);
  }, [marquee, isMobile]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!marquee || isMobile) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (marqueeDidDrag.current && cameraRef.current) {
      const minX = Math.min(marquee.sx, marquee.ex);
      const maxX = Math.max(marquee.sx, marquee.ex);
      const minY = Math.min(marquee.sy, marquee.ey);
      const maxY = Math.max(marquee.sy, marquee.ey);
      const cam = cameraRef.current;
      const w = rect.width, h = rect.height;
      const hits: string[] = [];

      shapes.forEach(shape => {
        const v = new THREE.Vector3(...shape.position);
        v.project(cam);
        const sx = (v.x + 1) / 2 * w;
        const sy = (-v.y + 1) / 2 * h;
        if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY && v.z > 0 && v.z < 1) {
          hits.push(shape.id);
        }
      });

      if (hits.length > 0) {
        onMultiSelect(hits, e.shiftKey);
      } else if (!e.shiftKey) {
        onSelect(null);
      }
    }
    setMarquee(null);
  }, [marquee, shapes, onMultiSelect, onSelect, isMobile]);

  // Marquee style
  const marqueeStyle = marquee && marqueeDidDrag.current ? {
    position: 'absolute' as const,
    left: Math.min(marquee.sx, marquee.ex),
    top: Math.min(marquee.sy, marquee.ey),
    width: Math.abs(marquee.ex - marquee.sx),
    height: Math.abs(marquee.ey - marquee.sy),
    border: '1.5px dashed rgba(0, 200, 255, 0.7)',
    backgroundColor: 'rgba(0, 200, 255, 0.08)',
    pointerEvents: 'none' as const,
    zIndex: 20,
  } : null;

  return (
    <div ref={containerRef} className="flex-1 h-full bg-[#f4f4f5] dark:bg-[#0a0a0a] relative overflow-hidden"
      style={{ cursor: !isMobile && transformMode === 'select' ? 'crosshair' : 'default' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Canvas shadows dpr={isMobile ? [1, 1.5] : [1, 2]}>
        <PerspectiveCamera makeDefault position={[5, 5, 5]} />
        {!isMobile && isFirstPerson ? (
          <>
            <FirstPersonController />
            <MinecraftHand activeBlock={HOTBAR_BLOCKS[fpsActiveSlot].type} useShaders={useShaders} />
            <MinecraftBlockPlacer onPlace={handleFpsPlace} activeBlock={HOTBAR_BLOCKS[fpsActiveSlot].type} />
          </>
        ) : (
          <OrbitControls
            ref={orbitRef}
            makeDefault
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 1.75}
            // Mobile: touch controls — one finger rotate, two finger pan/zoom
            enableDamping={isMobile}
            dampingFactor={isMobile ? 0.1 : 0.05}
          />
        )}
        <CameraController resetFlag={resetCameraFlag} />
        <CameraExposer cameraRef={cameraRef} />

        <ambientLight intensity={useShaders ? 0.5 : 0.9} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={useShaders ? 1 : 1.8} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={useShaders ? 0.5 : 1.0} />
        {useShaders && <Environment preset="city" />}

        <group>
          {(() => {
            const ungrouped = shapes.filter(s => !s.groupId);
            const groups = new Map<string, ShapeData[]>();
            shapes.forEach(s => { if (s.groupId) { const list = groups.get(s.groupId) || []; list.push(s); groups.set(s.groupId, list); } });

            const groupElements = Array.from(groups.entries()).map(([gid, members]) => {
              const hasHoles = members.some(m => m.isHole);
              const isSelected = members.some(m => selectedIds.has(m.id));
              
              if (hasHoles) {
                return (
                  <GroupedCSG key={gid} shapes={members} isSelected={isSelected} useShaders={useShaders}
                    onSelect={(sid, e) => {
                      const additive = e?.nativeEvent?.shiftKey || false;
                      onSelect(sid, additive);
                    }} />
                );
              }

              return members.map(shape => {
                if (shape.id === primarySelectedId && showGizmo) return null;
                const isSelected = selectedIds.has(shape.id);
                return (
                  <Shape key={shape.id} shape={shape} isSelected={isSelected} useShaders={useShaders}
                    onSelect={(e) => {
                      const additive = e?.nativeEvent?.shiftKey || false;
                      onSelect(shape.id, additive);
                    }} />
                );
              });
            });

            const ungroupedElements = ungrouped.map(shape => {
              if (shape.id === primarySelectedId && showGizmo) return null;
              const isSelected = selectedIds.has(shape.id);
              return (
                <Shape key={shape.id} shape={shape} isSelected={isSelected} useShaders={useShaders}
                  onSelect={(e) => {
                    const additive = e?.nativeEvent?.shiftKey || false;
                    onSelect(shape.id, additive);
                  }} />
              );
            });

            return [...groupElements, ...ungroupedElements];
          })()}
        </group>

        {showGizmo && selectedShape && (
          <TransformControls ref={transformRef}
            mode={transformMode as 'translate' | 'rotate' | 'scale'}
            translationSnap={snapToGrid ? 0.5 : null}
            rotationSnap={snapToGrid ? Math.PI / 4 : null}
            scaleSnap={snapToGrid ? 0.5 : null}
            onMouseUp={handleTransformChange}
            position={selectedShape.position}
            rotation={selectedShape.rotation}
            scale={selectedShape.scale}
            size={isMobile ? 1.2 : 1}
          >
            <Shape
              shape={{...selectedShape, position: [0,0,0], rotation: [0,0,0], scale: [1,1,1]}}
              isSelected={true} useShaders={useShaders} onSelect={() => {}} />
          </TransformControls>
        )}

        <Grid infiniteGrid fadeDistance={50} fadeStrength={5} cellSize={1} sectionSize={5}
          sectionColor="#E4E3E0" cellColor="#E4E3E0" sectionThickness={1.5} cellThickness={0.5} />

        <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />

        {/* ═══ Smart Snap Guide Lines ═══ */}
        {smartSnap && activeGuides.map((guide, i) => {
          const color = guide.type === 'surface' ? '#a855f7' : guide.type === 'alignment' ? '#06b6d4' : '#22c55e';
          return (
            <Line
              key={`guide-${i}`}
              points={[guide.from, guide.to]}
              color={color}
              lineWidth={2}
              dashed
              dashSize={0.15}
              gapSize={0.1}
            />
          );
        })}

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow
          onClick={() => { if (!marqueeDidDrag.current) onSelect(null); }}>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color={theme === 'dark' ? '#0a0a0a' : '#d4d4d8'} transparent opacity={theme === 'dark' ? 0.5 : 0.6} />
        </mesh>
      </Canvas>

      {/* Marquee rectangle (desktop only) */}
      {!isMobile && marqueeStyle && <div style={marqueeStyle} />}

      {/* ═══ FPS Mode Overlays ═══ */}
      {!isMobile && isFirstPerson && (
        <>
          {/* Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="relative w-6 h-6">
              <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/70 -translate-y-1/2" />
              <div className="absolute left-1/2 top-0 h-full w-[2px] bg-white/70 -translate-x-1/2" />
            </div>
          </div>

          {/* Hotbar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-end gap-1">
            {HOTBAR_BLOCKS.map((block, i) => (
              <button
                key={block.type}
                onClick={() => setFpsActiveSlot(i)}
                className={`relative flex flex-col items-center justify-center w-12 h-12 rounded transition-all pointer-events-auto ${
                  i === fpsActiveSlot
                    ? 'bg-white/30 border-2 border-white scale-110 shadow-lg shadow-white/20'
                    : 'bg-black/40 border border-white/20 hover:bg-black/60'
                }`}
              >
                <div
                  className="w-6 h-6 rounded-sm"
                  style={{ backgroundColor: block.color }}
                />
                <span className="absolute -bottom-5 text-[8px] font-mono text-white/60 uppercase tracking-wider whitespace-nowrap">
                  {i === fpsActiveSlot ? block.label : (i + 1)}
                </span>
              </button>
            ))}
          </div>

          {/* FPS hint */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="bg-black/50 backdrop-blur px-4 py-1.5 rounded font-mono text-[10px] text-white/60 uppercase tracking-widest">
              WASD — ходить · Пробел — прыгать · ЛКМ — поставить блок · 1-9 — слот · ESC — выйти
            </div>
          </div>
        </>
      )}

      {/* ═══ Desktop-only overlay UI ═══ */}
      {!isMobile && (
        <>
          {/* Overlay UI — top right */}
          <div className="absolute top-6 right-6 flex flex-col items-end gap-3 z-10">
            <div className="flex items-center gap-2">
              {/* FPS Mode */}
              <button onClick={() => setIsFirstPerson(!isFirstPerson)}
                className={`flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-[#141414]/80 backdrop-blur border rounded font-mono text-[10px] uppercase tracking-widest transition-all active:scale-95 ${isFirstPerson ? 'border-cyan-500 text-cyan-400' : 'border-black/5 dark:border-[#E4E3E0]/10 text-gray-800 dark:text-[#E4E3E0] hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414]'}`}
                title="First Person Flying Mode (WASD + Mouse)">
                {isFirstPerson ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>FPS</span>
              </button>
              
              {/* Settings Menu Button */}
              <div className="relative">
                <button onClick={() => setShowSettings(!showSettings)}
                  className={`flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-[#141414]/80 backdrop-blur border rounded font-mono text-[10px] uppercase tracking-widest transition-all active:scale-95 ${showSettings ? 'border-gray-800 dark:border-[#E4E3E0] text-gray-800 dark:text-[#E4E3E0]' : 'border-black/5 dark:border-[#E4E3E0]/10 text-gray-800 dark:text-[#E4E3E0] hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414]'}`}
                  title="Настройки">
                  <Settings size={12} /><span>Настройки</span>
                </button>
                
                {showSettings && (
                  <div className="absolute top-full right-0 mt-2 bg-white/90 dark:bg-[#141414]/90 backdrop-blur-md border border-black/10 dark:border-[#E4E3E0]/20 rounded p-2 min-w-[200px] shadow-2xl flex flex-col gap-2 z-50">
                    <div className="text-gray-500 dark:text-[#E4E3E0]/50 text-[10px] uppercase tracking-widest mb-1 px-2">Параметры</div>
                    <button
                      onClick={onToggleTheme}
                      className="w-full text-left px-3 py-2 rounded text-gray-800 dark:text-[#E4E3E0] hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414] font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2"
                    >
                      {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
                      <span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
                    </button>
                    <button
                      onClick={onToggleShaders}
                      className="w-full text-left px-3 py-2 rounded text-gray-800 dark:text-[#E4E3E0] hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414] font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2"
                    >
                      <Wand2 size={12} className={useShaders ? 'text-purple-500' : ''} />
                      <span>{useShaders ? 'Отключить шейдеры' : 'Включить шейдеры'}</span>
                    </button>
                    <a 
                      href="https://vk.com/moii.unlim" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full text-left px-3 py-2 rounded text-gray-800 dark:text-[#E4E3E0] hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414] font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2"
                    >
                       <span>Написать разработчику</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* History step navigator */}
            <div className="flex items-center gap-2 bg-white/80 dark:bg-[#141414]/80 backdrop-blur border border-black/5 dark:border-[#E4E3E0]/10 rounded px-3 py-1.5 font-mono text-[10px] text-gray-800 dark:text-[#E4E3E0] uppercase tracking-widest">
              <button onClick={onUndo} disabled={!canUndo}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-[#E4E3E0]/20 disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-90">
                <ChevronLeft size={14} />
              </button>
              <span className="min-w-[60px] text-center">
                <span className="text-cyan-400">{(historyIndex + 1).toString().padStart(2, '0')}</span>
                <span className="opacity-40"> / {historyLength.toString().padStart(2, '0')}</span>
              </span>
              <button onClick={onRedo} disabled={!canRedo}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-[#E4E3E0]/20 disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-90">
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Stats */}
            <div className="bg-white/80 dark:bg-[#141414]/80 backdrop-blur border border-black/5 dark:border-[#E4E3E0]/10 p-4 rounded font-mono text-[10px] text-gray-800 dark:text-[#E4E3E0] uppercase tracking-widest pointer-events-none">
              <div className="flex justify-between gap-8 mb-1"><span className="opacity-50">Entities</span><span>{shapes.length.toString().padStart(2, '0')}</span></div>
              <div className="flex justify-between gap-8 mb-1"><span className="opacity-50">Selected</span><span className={selectedIds.size > 0 ? 'text-cyan-400' : ''}>{selectedIds.size.toString().padStart(2, '0')}</span></div>
              <div className="flex justify-between gap-8"><span className="opacity-50">Status</span><span className="text-green-500">Online</span></div>
            </div>
          </div>

          {/* Overlay UI — bottom right */}
          <div className="absolute bottom-6 right-6 flex items-center gap-2 z-10">
            <button onClick={onSave}
              className="flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-[#141414]/80 backdrop-blur border border-black/5 dark:border-[#E4E3E0]/10 rounded font-mono text-[10px] text-gray-800 dark:text-[#E4E3E0] uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414] transition-all active:scale-95"
              title="Save project (.3dstudio)">
              <Download size={12} /><span>Сохранить</span>
            </button>
            <button onClick={onLoad}
              className="flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-[#141414]/80 backdrop-blur border border-black/5 dark:border-[#E4E3E0]/10 rounded font-mono text-[10px] text-gray-800 dark:text-[#E4E3E0] uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414] transition-all active:scale-95"
              title="Load project (.3dstudio)">
              <Upload size={12} /><span>Загрузить</span>
            </button>
          </div>
        </>
      )}

      {/* ═══ Mobile-only mini stats overlay ═══ */}
      {isMobile && (
        <div className="absolute top-14 right-3 z-10 bg-white/60 dark:bg-[#141414]/60 backdrop-blur-sm border border-black/5 dark:border-[#E4E3E0]/10 rounded-xl px-2.5 py-1.5 font-mono text-[9px] text-gray-800 dark:text-[#E4E3E0] uppercase tracking-widest pointer-events-none">
          <span className="opacity-40">OBJ </span>
          <span className="text-cyan-400">{shapes.length.toString().padStart(2, '0')}</span>
          {selectedIds.size > 0 && (
            <>
              <span className="opacity-20 mx-1">|</span>
              <span className="opacity-40">SEL </span>
              <span className="text-purple-400">{selectedIds.size.toString().padStart(2, '0')}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
