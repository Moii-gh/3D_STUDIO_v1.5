import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, Environment, ContactShadows, TransformControls, Text, Line, PointerLockControls } from '@react-three/drei';
import { ShapeData } from '../types';
import { SnapGuide } from '../smartSnap';
import * as THREE from 'three';
import { TransformMode } from '../App';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Download, Upload, ChevronLeft, ChevronRight, Eye, EyeOff, Settings, Sun, Moon, Wand2, Box, MousePointer, Move, RotateCw, Maximize, Package } from 'lucide-react';
import { geometryFromData } from '../geometryUtils';

import { ShapeType } from '../types';

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
  onGroupTransform: (id: string, updates: Partial<ShapeData>, isDeltaGroup?: boolean) => void;
  onMultiSelect: (ids: string[], additive: boolean) => void;
  onAdd: (type: ShapeType, position?: [number, number, number]) => void;
  onSave: () => void;
  onLoad: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onFirstPersonChange?: (active: boolean) => void;
  onClearGuides: () => void;
}

type FpsTool = 'build' | 'select' | 'move' | 'rotate' | 'scale';

interface FpsBlockDefinition {
  type: ShapeType;
  label: string;
  color: string;
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

const roundedStairsGeometry = (() => {
  const geometries = [];
  const steps = 16;
  const innerR = 0.15;
  const outerR = 0.5;
  const totalHeight = 1;
  const stepHeight = totalHeight / steps;
  const angleStep = (Math.PI * 2 * 0.8) / steps;
  
  for (let i = 0; i < steps; i++) {
    const stepShape = new THREE.Shape();
    const overlapAngle = (angleStep * 1.5) / 2;
    stepShape.absarc(0, 0, outerR, -overlapAngle, overlapAngle, false);
    stepShape.absarc(0, 0, innerR, overlapAngle, -overlapAngle, true);
    
    const stepGeo = new THREE.ExtrudeGeometry(stepShape, {
      depth: stepHeight * 1.2,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.005,
      bevelThickness: 0.005
    });
    
    stepGeo.rotateX(-Math.PI / 2);
    stepGeo.rotateY(-(i * angleStep)); // curve downwards / upwards correctly
    stepGeo.translate(0, (i * stepHeight) - (totalHeight / 2) + (stepHeight / 2), 0);
    geometries.push(stepGeo);
  }
  
  const merged = BufferGeometryUtils.mergeGeometries(geometries);
  merged.computeVertexNormals();
  return merged;
})();

const extrudeSettings = { depth: 0.2, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };

function getEffectiveRotation(shape: ShapeData): [number, number, number] {
  if (shape.type === 'roundRoof') {
    return [shape.rotation[0], shape.rotation[1], shape.rotation[2] + Math.PI / 2];
  }
  return shape.rotation;
}



// ═══ Shape component ═══
const Shape = ({ shape, isSelected, useShaders, onSelect }: { shape: ShapeData; isSelected: boolean; useShaders: boolean; onSelect: (e: any) => void }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const texture = useMemo(() => {
    if (shape.type === 'image' && shape.imageUrl) {
      return new THREE.TextureLoader().load(shape.imageUrl);
    }
    return null;
  }, [shape.type, shape.imageUrl]);

  const customGeometry = useMemo(() => {
    if (shape.type !== 'customMesh' || !shape.geometryData) return null;
    return geometryFromData(shape.geometryData);
  }, [shape.geometryData, shape.type]);

  if (shape.type === 'text') {
    return (
      <group position={shape.position} rotation={shape.rotation} scale={shape.scale}>
        <Text ref={meshRef as any}
          userData={{ shapeId: shape.id, isSceneShape: true }}
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
      case 'hexPrism': return <cylinderGeometry args={[0.5, 0.5, 1, 6, 1, false, Math.PI / 6]} />;
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
      case 'elbowPipe': return <torusGeometry args={[0.35, 0.15, 16, 64, Math.PI / 2]} />;
      case 'roundRoof': return <cylinderGeometry args={[0.5, 0.5, 1, 32, 1, false, 0, Math.PI]} />;
      case 'roundedStairs': return <primitive object={roundedStairsGeometry} attach="geometry" />;
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
      case 'drawing': {
        if (!shape.drawPoints || shape.drawPoints.length < 3) return <boxGeometry />;
        const drawShape = new THREE.Shape();
        drawShape.moveTo(shape.drawPoints[0][0], shape.drawPoints[0][1]);
        for (let i = 1; i < shape.drawPoints.length; i++) {
          drawShape.lineTo(shape.drawPoints[i][0], shape.drawPoints[i][1]);
        }
        drawShape.closePath();
        return <extrudeGeometry args={[drawShape, { depth: 0.3, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.015, bevelThickness: 0.015 }]} />;
      }
      case 'customMesh':
        return customGeometry ? <primitive object={customGeometry} attach="geometry" /> : <boxGeometry />;
      default: return <boxGeometry />;
    }
  };

  const isHole = Boolean(shape.isHole);
  const isTransparent = isHole || (shape.opacity !== undefined && shape.opacity < 1);
  const displayOpacity = isHole ? Math.min(shape.opacity ?? 1, 0.35) : (shape.opacity ?? 1);
  const displayColor = isHole ? '#f97316' : (shape.type === 'image' && shape.imageUrl ? '#ffffff' : shape.color);

  return (
    <mesh ref={meshRef} userData={{ shapeId: shape.id, isSceneShape: true }} position={shape.position} rotation={getEffectiveRotation(shape)} scale={shape.scale}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}>
      {renderGeometry()}
      <meshStandardMaterial 
        color={displayColor}
        map={texture || undefined}
        roughness={useShaders ? 0.2 : 1.0} 
        metalness={useShaders ? 0.8 : 0.0}
        emissive={isHole ? '#f97316' : (isSelected ? shape.color : '#000000')} emissiveIntensity={isHole ? 0.2 : (isSelected ? 0.5 : 0)}
        side={THREE.DoubleSide}
        wireframe={isHole}
        transparent={isTransparent}
        opacity={displayOpacity} />
      {isSelected && (
        <mesh scale={[1.1, 1.1, 1.1]} rotation={[0,0,0]}>
          {renderGeometry()}
          <meshBasicMaterial color={isHole ? '#fb923c' : '#E4E3E0'} wireframe transparent opacity={0.3} />
        </mesh>
      )}
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
const GRAVITY = 24;
const JUMP_FORCE = 7.5;
const WALK_SPEED = 4.8;
const SPRINT_SPEED = 7.8;
const FLY_SPEED = 6.5;
const FLY_SPRINT_SPEED = 10;
const MAX_DELTA = 0.05;

function FirstPersonController({
  inventoryOpen,
  onFlyingChange,
}: {
  inventoryOpen: boolean;
  onFlyingChange: (flying: boolean) => void;
}) {
  const { camera } = useThree();
  const moveState = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    ascend: false,
    descend: false,
  });
  const velocityY = useRef(0);
  const isGrounded = useRef(true);
  const isFlying = useRef(false);
  const lastSpacePress = useRef(0);
  const direction = useRef(new THREE.Vector3());
  const forwardVector = useRef(new THREE.Vector3());
  const rightVector = useRef(new THREE.Vector3());
  const worldUp = useRef(new THREE.Vector3(0, 1, 0));

  const setFlying = useCallback((next: boolean) => {
    isFlying.current = next;
    velocityY.current = 0;
    if (!next && camera.position.y <= PLAYER_HEIGHT) {
      camera.position.y = PLAYER_HEIGHT;
      isGrounded.current = true;
    }
    onFlyingChange(next);
  }, [camera, onFlyingChange]);

  useEffect(() => {
    camera.position.set(3, PLAYER_HEIGHT, 3);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (inventoryOpen) return;
      switch (e.code) {
        case 'KeyW': moveState.current.forward = true; break;
        case 'KeyS': moveState.current.backward = true; break;
        case 'KeyA': moveState.current.left = true; break;
        case 'KeyD': moveState.current.right = true; break;
        case 'ControlLeft':
        case 'ControlRight':
          moveState.current.descend = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.current.sprint = true;
          break;
        case 'Space': {
          const now = performance.now();
          const isDoubleTap = now - lastSpacePress.current < 280;
          lastSpacePress.current = now;
          if (isDoubleTap) {
            setFlying(!isFlying.current);
            moveState.current.ascend = !isFlying.current;
            break;
          }
          if (isFlying.current) {
            moveState.current.ascend = true;
          } else if (isGrounded.current) {
            velocityY.current = JUMP_FORCE;
            isGrounded.current = false;
          }
          break;
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = false; break;
        case 'KeyS': moveState.current.backward = false; break;
        case 'KeyA': moveState.current.left = false; break;
        case 'KeyD': moveState.current.right = false; break;
        case 'ControlLeft':
        case 'ControlRight':
          moveState.current.descend = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.current.sprint = false;
          break;
        case 'Space':
          moveState.current.ascend = false;
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      onFlyingChange(false);
    };
  }, [camera, inventoryOpen, onFlyingChange, setFlying]);

  useEffect(() => {
    if (!inventoryOpen) return;
    moveState.current.forward = false;
    moveState.current.backward = false;
    moveState.current.left = false;
    moveState.current.right = false;
    moveState.current.sprint = false;
    moveState.current.ascend = false;
    moveState.current.descend = false;
  }, [inventoryOpen]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_DELTA);
    if (inventoryOpen) return;

    camera.getWorldDirection(forwardVector.current);
    if (isFlying.current) {
      if (forwardVector.current.lengthSq() < 1e-6) {
        forwardVector.current.set(0, 0, -1);
      } else {
        forwardVector.current.normalize();
      }
    } else {
      forwardVector.current.y = 0;
      if (forwardVector.current.lengthSq() < 1e-6) {
        forwardVector.current.set(0, 0, -1);
      } else {
        forwardVector.current.normalize();
      }
    }

    rightVector.current.crossVectors(forwardVector.current, worldUp.current);
    if (rightVector.current.lengthSq() < 1e-6) {
      rightVector.current.set(1, 0, 0);
    } else {
      rightVector.current.normalize();
    }
    direction.current.set(0, 0, 0);

    if (moveState.current.forward) direction.current.add(forwardVector.current);
    if (moveState.current.backward) direction.current.sub(forwardVector.current);
    if (moveState.current.right) direction.current.add(rightVector.current);
    if (moveState.current.left) direction.current.sub(rightVector.current);
    if (isFlying.current && moveState.current.ascend) direction.current.y += 1;
    if (isFlying.current && moveState.current.descend) direction.current.y -= 1;

    if (direction.current.lengthSq() > 0) {
      const speed = isFlying.current
        ? (moveState.current.sprint ? FLY_SPRINT_SPEED : FLY_SPEED)
        : (moveState.current.sprint ? SPRINT_SPEED : WALK_SPEED);
      direction.current.normalize().multiplyScalar(speed * dt);
      camera.position.add(direction.current);
    }

    if (isFlying.current) {
      if (camera.position.y < PLAYER_HEIGHT) {
        camera.position.y = PLAYER_HEIGHT;
      }
      return;
    }

    velocityY.current -= GRAVITY * dt;
    camera.position.y += velocityY.current * dt;

    if (camera.position.y <= PLAYER_HEIGHT) {
      camera.position.y = PLAYER_HEIGHT;
      velocityY.current = 0;
      isGrounded.current = true;
    }
  });

  return <PointerLockControls />;
}

// ═══ Minecraft Hand (visible in FPS mode) ═══
function MinecraftHand({
  activeTool,
  activeBlock,
  useShaders,
}: {
  activeTool: FpsTool;
  activeBlock: ShapeType | null;
  useShaders: boolean;
}) {
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
    return activeBlock ? (colors[activeBlock] || '#8B6914') : '#8B6914';
  }, [activeBlock]);

  return (
    <group ref={handRef}>
      {/* Arm */}
      <mesh position={[0, -0.05, 0.1]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.08, 0.08, 0.25]} />
        <meshStandardMaterial color="#D2A06C" roughness={0.8} />
      </mesh>
      {activeTool === 'build' ? (
        <mesh position={[0, 0.05, -0.05]} rotation={[0.3, 0.5, 0]}>
          <boxGeometry args={[0.12, 0.12, 0.12]} />
          <meshStandardMaterial color={blockColor} roughness={useShaders ? 0.2 : 0.8} metalness={useShaders ? 0.5 : 0} />
        </mesh>
      ) : activeTool === 'select' ? (
        <group position={[0.02, 0.05, -0.04]} rotation={[0.6, 0.35, 0]}>
          <mesh position={[0, 0, 0.03]}>
            <cylinderGeometry args={[0.018, 0.024, 0.18, 10]} />
            <meshStandardMaterial color="#d1d5db" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.06, -0.02]}>
            <coneGeometry args={[0.03, 0.08, 10]} />
            <meshStandardMaterial color="#38bdf8" roughness={0.2} metalness={0.6} />
          </mesh>
        </group>
      ) : activeTool === 'move' ? (
        <group position={[0.02, 0.06, -0.04]} rotation={[0.3, 0.5, 0]}>
          <mesh>
            <cylinderGeometry args={[0.02, 0.02, 0.18, 10]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.45} />
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <coneGeometry args={[0.035, 0.08, 10]} />
            <meshStandardMaterial color="#22c55e" roughness={0.2} metalness={0.5} />
          </mesh>
        </group>
      ) : activeTool === 'rotate' ? (
        <group position={[0.03, 0.04, -0.04]} rotation={[0.8, 0.2, 0.3]}>
          <mesh>
            <torusGeometry args={[0.07, 0.018, 10, 24]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.25} metalness={0.55} />
          </mesh>
          <mesh position={[0.07, 0.02, 0]}>
            <coneGeometry args={[0.025, 0.06, 10]} />
            <meshStandardMaterial color="#f97316" roughness={0.2} metalness={0.55} />
          </mesh>
        </group>
      ) : (
        <group position={[0.02, 0.03, -0.03]} rotation={[0.4, 0.55, 0.1]}>
          <mesh>
            <boxGeometry args={[0.16, 0.02, 0.02]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.35} metalness={0.55} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.16, 0.02, 0.02]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.35} metalness={0.55} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function findShapeIdInObject(object: THREE.Object3D | null): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (typeof current.userData?.shapeId === 'string') {
      return current.userData.shapeId as string;
    }
    current = current.parent;
  }
  return null;
}

// ═══ Block placer (raycasts from camera for FPS placement) ═══
function MinecraftBlockPlacer({
  onPlace,
  activeTool,
  activeBlock,
  inventoryOpen,
  onSelectShape,
}: {
  onPlace: (type: ShapeType, pos: [number,number,number]) => void;
  activeTool: FpsTool;
  activeBlock: ShapeType | null;
  inventoryOpen: boolean;
  onSelectShape: (id: string | null) => void;
}) {
  const { camera, scene } = useThree();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (inventoryOpen) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, textarea, select, a')) return;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      const shapeHit = intersects.find((hit) => findShapeIdInObject(hit.object));

      if (e.button === 2) {
        e.preventDefault();
        onSelectShape(shapeHit ? findShapeIdInObject(shapeHit.object) : null);
        return;
      }

      if (e.button !== 0 || !document.pointerLockElement) return;

      if (activeTool !== 'build') {
        onSelectShape(shapeHit ? findShapeIdInObject(shapeHit.object) : null);
        return;
      }

      if (!activeBlock) return;

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

    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('contextmenu', preventContextMenu);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [camera, scene, onPlace, activeTool, activeBlock, inventoryOpen, onSelectShape]);

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

const FPS_TOOLS: { id: FpsTool; label: string; hotkey: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'build', label: 'Build', hotkey: '1', icon: Box },
  { id: 'select', label: 'Select', hotkey: '2', icon: MousePointer },
  { id: 'move', label: 'Move', hotkey: '3', icon: Move },
  { id: 'rotate', label: 'Rotate', hotkey: '4', icon: RotateCw },
  { id: 'scale', label: 'Scale', hotkey: '5', icon: Maximize },
];

const FPS_BLOCK_LIBRARY: FpsBlockDefinition[] = [
  { type: 'box', label: 'Box', color: '#8B6914' },
  { type: 'sphere', label: 'Sphere', color: '#b4b4b4' },
  { type: 'cylinder', label: 'Cylinder', color: '#8b8b8b' },
  { type: 'cone', label: 'Cone', color: '#676767' },
  { type: 'torus', label: 'Torus', color: '#cc4444' },
  { type: 'pyramid', label: 'Pyramid', color: '#c2b280' },
  { type: 'capsule', label: 'Capsule', color: '#44cc44' },
  { type: 'octahedron', label: 'Octa', color: '#4488cc' },
  { type: 'dodecahedron', label: 'Dodeca', color: '#8b5cf6' },
  { type: 'prism', label: 'Prism', color: '#f97316' },
  { type: 'icosahedron', label: 'Icosa', color: '#14b8a6' },
  { type: 'tetrahedron', label: 'Tetra', color: '#ef4444' },
  { type: 'torusKnot', label: 'Knot', color: '#ec4899' },
  { type: 'ring', label: 'Ring', color: '#f59e0b' },
  { type: 'plane', label: 'Plane', color: '#94a3b8' },
  { type: 'circle', label: 'Circle', color: '#cbd5e1' },
  { type: 'star', label: 'Star', color: '#fde047' },
  { type: 'heart', label: 'Heart', color: '#fb7185' },
  { type: 'arrow', label: 'Arrow', color: '#38bdf8' },
  { type: 'cross', label: 'Cross', color: '#f87171' },
  { type: 'hemisphere', label: 'Hemi', color: '#60a5fa' },
  { type: 'pipe', label: 'Pipe', color: '#22c55e' },
  { type: 'elbowPipe', label: 'Elbow', color: '#10b981' },
  { type: 'roundRoof', label: 'Roof', color: '#d97706' },
  { type: 'paraboloid', label: 'Parab', color: '#a855f7' },
  { type: 'roundedStairs', label: 'Stairs', color: '#f97316' },
];

const FPS_DEFAULT_BLOCK_SLOTS: ShapeType[] = ['box', 'sphere', 'cylinder', 'cone'];

export default function Scene({ shapes, selectedIds, transformMode, snapToGrid, smartSnap, activeGuides, resetCameraFlag, historyLength, historyIndex, isMobile, theme, onToggleTheme, useShaders, onToggleShaders, onSelect, onUpdate, onGroupTransform, onMultiSelect, onAdd, onSave, onLoad, onUndo, onRedo, canUndo, canRedo, onFirstPersonChange, onClearGuides }: SceneProps) {
  const orbitRef = useRef<any>(null);
  const transformRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const marqueeDidDrag = useRef(false);

  // FPS Mode (desktop only)
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const [fpsActiveTool, setFpsActiveTool] = useState<FpsTool>('build');
  const [fpsBlockSlots, setFpsBlockSlots] = useState<ShapeType[]>(FPS_DEFAULT_BLOCK_SLOTS);
  const [fpsActiveBlockSlot, setFpsActiveBlockSlot] = useState(0);
  const [fpsInventoryOpen, setFpsInventoryOpen] = useState(false);
  const [fpsFlying, setFpsFlying] = useState(false);
  // Settings Mode
  const [showSettings, setShowSettings] = useState(false);

  // Marquee state (desktop only)
  const [marquee, setMarquee] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);

  const activeBlockType = fpsBlockSlots[fpsActiveBlockSlot] ?? null;
  const activeBlockMeta = activeBlockType
    ? (FPS_BLOCK_LIBRARY.find((block) => block.type === activeBlockType) ?? null)
    : null;

  // FPS tools + hotbar + inventory
  useEffect(() => {
    if (!isFirstPerson) return;
    const handleWheel = (e: WheelEvent) => {
      if (fpsInventoryOpen) return;
      setFpsActiveBlockSlot((prev) => {
        const next = prev + (e.deltaY > 0 ? 1 : -1);
        return ((next % fpsBlockSlots.length) + fpsBlockSlots.length) % fpsBlockSlots.length;
      });
      setFpsActiveTool('build');
    };
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;

      if (e.code === 'KeyE') {
        e.preventDefault();
        setFpsInventoryOpen((prev) => {
          const next = !prev;
          if (next) {
            document.exitPointerLock?.();
          }
          return next;
        });
        return;
      }

      if (e.key === 'Escape') {
        setFpsInventoryOpen(false);
        return;
      }

      const n = parseInt(e.key);
      if (Number.isNaN(n)) return;
      if (n >= 1 && n <= FPS_TOOLS.length) {
        setFpsActiveTool(FPS_TOOLS[n - 1].id);
        return;
      }
      const blockIndex = n - FPS_TOOLS.length - 1;
      if (blockIndex >= 0 && blockIndex < fpsBlockSlots.length) {
        setFpsActiveBlockSlot(blockIndex);
        setFpsActiveTool('build');
      }
    };
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isFirstPerson, fpsInventoryOpen, fpsBlockSlots.length]);

  useEffect(() => {
    if (isFirstPerson) return;
    setFpsInventoryOpen(false);
    setFpsFlying(false);
  }, [isFirstPerson]);

  useEffect(() => {
    onFirstPersonChange?.(isFirstPerson);
  }, [isFirstPerson, onFirstPersonChange]);

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
  const activeToolMeta = FPS_TOOLS.find((tool) => tool.id === fpsActiveTool) ?? FPS_TOOLS[0];

  const groupPivot = useMemo(() => {
    if (selectedIds.size <= 1) return new THREE.Vector3();
    const selectedObj = shapes.filter(s => selectedIds.has(s.id));
    const p = new THREE.Vector3();
    selectedObj.forEach(s => p.add(new THREE.Vector3(...s.position)));
    p.divideScalar(selectedObj.length);
    return p;
  }, [selectedIds, shapes]);

  const handleFpsObjectTransform = useCallback((code: string, boost: boolean) => {
    if (!isFirstPerson || isMobile || fpsInventoryOpen || !selectedShape || !primarySelectedId || !cameraRef.current) {
      return false;
    }

    const camera = cameraRef.current;
    const moveStep = boost ? (snapToGrid ? 1 : 0.75) : (snapToGrid ? 0.5 : 0.25);
    const verticalStep = moveStep;
    const rotationStep = boost ? Math.PI / 4 : (snapToGrid ? Math.PI / 8 : Math.PI / 18);
    const scaleFactor = boost ? 1.25 : 1.1;
    const minScale = 0.1;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const nextPosition = new THREE.Vector3(...selectedShape.position);

    switch (code) {
      case 'ArrowUp':
        if (fpsActiveTool !== 'move') return false;
        nextPosition.add(forward.multiplyScalar(moveStep));
        onGroupTransform(primarySelectedId, { position: [nextPosition.x, nextPosition.y, nextPosition.z] });
        return true;
      case 'ArrowDown':
        if (fpsActiveTool !== 'move') return false;
        nextPosition.add(forward.multiplyScalar(-moveStep));
        onGroupTransform(primarySelectedId, { position: [nextPosition.x, nextPosition.y, nextPosition.z] });
        return true;
      case 'ArrowRight':
        if (fpsActiveTool !== 'move') return false;
        nextPosition.add(right.multiplyScalar(moveStep));
        onGroupTransform(primarySelectedId, { position: [nextPosition.x, nextPosition.y, nextPosition.z] });
        return true;
      case 'ArrowLeft':
        if (fpsActiveTool !== 'move') return false;
        nextPosition.add(right.multiplyScalar(-moveStep));
        onGroupTransform(primarySelectedId, { position: [nextPosition.x, nextPosition.y, nextPosition.z] });
        return true;
      case 'PageUp':
        if (fpsActiveTool !== 'move') return false;
        nextPosition.y += verticalStep;
        onGroupTransform(primarySelectedId, { position: [nextPosition.x, nextPosition.y, nextPosition.z] });
        return true;
      case 'PageDown':
        if (fpsActiveTool !== 'move') return false;
        nextPosition.y -= verticalStep;
        onGroupTransform(primarySelectedId, { position: [nextPosition.x, nextPosition.y, nextPosition.z] });
        return true;
      case 'BracketLeft':
        if (fpsActiveTool !== 'rotate') return false;
        onGroupTransform(primarySelectedId, {
          rotation: [selectedShape.rotation[0], selectedShape.rotation[1] - rotationStep, selectedShape.rotation[2]],
        });
        return true;
      case 'BracketRight':
        if (fpsActiveTool !== 'rotate') return false;
        onGroupTransform(primarySelectedId, {
          rotation: [selectedShape.rotation[0], selectedShape.rotation[1] + rotationStep, selectedShape.rotation[2]],
        });
        return true;
      case 'Minus':
      case 'NumpadSubtract':
        if (fpsActiveTool !== 'scale') return false;
        onGroupTransform(primarySelectedId, {
          scale: selectedShape.scale.map((value) => Math.max(minScale, value / scaleFactor)) as [number, number, number],
        });
        return true;
      case 'Equal':
      case 'NumpadAdd':
        if (fpsActiveTool !== 'scale') return false;
        onGroupTransform(primarySelectedId, {
          scale: selectedShape.scale.map((value) => value * scaleFactor) as [number, number, number],
        });
        return true;
      default:
        return false;
    }
  }, [isFirstPerson, isMobile, fpsInventoryOpen, selectedShape, primarySelectedId, snapToGrid, fpsActiveTool, onGroupTransform]);

  const handleTransformChange = () => {
    if (transformRef.current?.object && primarySelectedId) {
      const obj = transformRef.current.object;
      onGroupTransform(primarySelectedId, {
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      }, selectedIds.size > 1);
    }
    setTimeout(() => onClearGuides(), 300);
  };

  useEffect(() => {
    if (!isFirstPerson || isMobile || fpsInventoryOpen) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;
      if (handleFpsObjectTransform(e.code, e.shiftKey)) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFirstPerson, isMobile, fpsInventoryOpen, handleFpsObjectTransform]);

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
            <FirstPersonController inventoryOpen={fpsInventoryOpen} onFlyingChange={setFpsFlying} />
            <MinecraftHand activeTool={fpsActiveTool} activeBlock={activeBlockType} useShaders={useShaders} />
            <MinecraftBlockPlacer
              onPlace={handleFpsPlace}
              activeTool={fpsActiveTool}
              activeBlock={activeBlockType}
              inventoryOpen={fpsInventoryOpen}
              onSelectShape={(id) => onSelect(id)}
            />
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
              return members.map(shape => {
                if (selectedIds.has(shape.id) && showGizmo) return null;
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
              if (selectedIds.has(shape.id) && showGizmo) return null;
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
            position={selectedIds.size > 1 ? groupPivot.toArray() : selectedShape.position}
            rotation={selectedIds.size > 1 ? [0,0,0] : selectedShape.rotation}
            scale={selectedIds.size > 1 ? [1,1,1] : selectedShape.scale}
            size={isMobile ? 1.2 : 1}
          >
            <group>
              {selectedIds.size > 1 ? (
                shapes.filter(s => selectedIds.has(s.id)).map(shape => {
                  const relPos = new THREE.Vector3(...shape.position).sub(groupPivot).toArray();
                  return <Shape key={shape.id} shape={{...shape, position: relPos}} isSelected={true} useShaders={useShaders} onSelect={() => {}} />
                })
              ) : (
                <Shape
                  shape={{...selectedShape, position: [0,0,0], rotation: [0,0,0], scale: [1,1,1]}}
                  isSelected={true} useShaders={useShaders} onSelect={() => {}} />
              )}
            </group>
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
                onClick={() => setFpsActiveBlockSlot(i)}
                className={`relative flex flex-col items-center justify-center w-12 h-12 rounded transition-all pointer-events-auto ${
                  i === fpsActiveBlockSlot
                    ? 'bg-white/30 border-2 border-white scale-110 shadow-lg shadow-white/20'
                    : 'bg-black/40 border border-white/20 hover:bg-black/60'
                }`}
              >
                <div
                  className="w-6 h-6 rounded-sm"
                  style={{ backgroundColor: block.color }}
                />
                <span className="absolute -bottom-5 text-[8px] font-mono text-white/60 uppercase tracking-wider whitespace-nowrap">
                  {i === fpsActiveBlockSlot ? block.label : (i + 1)}
                </span>
              </button>
            ))}
          </div>

          {/* FPS hint */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="bg-black/50 backdrop-blur px-4 py-1.5 rounded font-mono text-[10px] text-white/60 uppercase tracking-widest">
              WASD/SHIFT — ходить · ПРОБЕЛ — прыгать · ЛКМ — блок · ПКМ — выбрать · СТРЕЛКИ/PGUP/PGDN — двигать · +/- — размер · [ ] — поворот
            </div>
          </div>

          {selectedShape && (
            <div className="absolute top-20 left-6 z-20 pointer-events-none">
              <div className="bg-black/55 backdrop-blur px-4 py-2 rounded font-mono text-[10px] text-white/70 uppercase tracking-widest">
                <div className="mb-1 opacity-50">FPS Edit Target</div>
                <div className="text-cyan-300">{selectedShape.type}_{selectedShape.id.slice(0, 4)}</div>
              </div>
            </div>
          )}
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
