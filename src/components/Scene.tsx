import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, Environment, ContactShadows, TransformControls, Text } from '@react-three/drei';
import { ShapeData } from '../types';
import * as THREE from 'three';
import { TransformMode } from '../App';
import { Download, Upload, ChevronLeft, ChevronRight } from 'lucide-react';

interface SceneProps {
  shapes: ShapeData[];
  selectedIds: Set<string>;
  transformMode: TransformMode;
  snapToGrid: boolean;
  resetCameraFlag: number;
  historyLength: number;
  historyIndex: number;
  onSelect: (id: string | null, additive?: boolean) => void;
  onUpdate: (id: string, updates: Partial<ShapeData>) => void;
  onGroupTransform: (id: string, updates: Partial<ShapeData>) => void;
  onMultiSelect: (ids: string[], additive: boolean) => void;
  onSave: () => void;
  onLoad: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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

// ═══ Shape component ═══
const Shape = ({ shape, isSelected, onSelect }: { shape: ShapeData; isSelected: boolean; onSelect: (e: any) => void }) => {
  const meshRef = useRef<THREE.Mesh>(null);

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
      case 'circle': return <circleGeometry args={[0.5, 32]} />;
      case 'star': return <extrudeGeometry args={[starShape, extrudeSettings]} />;
      case 'heart': return <extrudeGeometry args={[heartShape, extrudeSettings]} />;
      case 'arrow': return <extrudeGeometry args={[arrowShape, extrudeSettings]} />;
      case 'cross': return <extrudeGeometry args={[crossShape, extrudeSettings]} />;
      default: return <boxGeometry />;
    }
  };

  return (
    <mesh ref={meshRef} position={shape.position} rotation={shape.rotation} scale={shape.scale}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}>
      {renderGeometry()}
      <meshStandardMaterial color={shape.color} roughness={0.2} metalness={0.8}
        emissive={isSelected ? shape.color : '#000000'} emissiveIntensity={isSelected ? 0.5 : 0}
        side={THREE.DoubleSide} />
      {isSelected && (
        <mesh scale={[1.1, 1.1, 1.1]}>
          {renderGeometry()}
          <meshBasicMaterial color="#E4E3E0" wireframe transparent opacity={0.3} />
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

// ═══ Main Scene ═══
export default function Scene({ shapes, selectedIds, transformMode, snapToGrid, resetCameraFlag, historyLength, historyIndex, onSelect, onUpdate, onGroupTransform, onMultiSelect, onSave, onLoad, onUndo, onRedo, canUndo, canRedo }: SceneProps) {
  const orbitRef = useRef<any>(null);
  const transformRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const marqueeDidDrag = useRef(false);

  // Marquee state
  const [marquee, setMarquee] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);

  // Disable orbit left-click in select mode
  useEffect(() => {
    if (orbitRef.current) {
      if (transformMode === 'select') {
        orbitRef.current.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
      } else {
        orbitRef.current.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
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

  // ═══ Primary selected ID (single shape or group) ═══
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
  };

  // ═══ Marquee selection handlers ═══
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (transformMode !== 'select' || e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    setMarquee({ sx: x, sy: y, ex: x, ey: y });
    marqueeDidDrag.current = false;
  }, [transformMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!marquee) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ex = e.clientX - rect.left, ey = e.clientY - rect.top;
    const dx = Math.abs(ex - marquee.sx), dy = Math.abs(ey - marquee.sy);
    if (dx > 5 || dy > 5) marqueeDidDrag.current = true;
    setMarquee(prev => prev ? { ...prev, ex, ey } : null);
  }, [marquee]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!marquee) return;
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
    // If not dragged, the Three.js mesh click handler will fire naturally
    setMarquee(null);
  }, [marquee, shapes, onMultiSelect, onSelect]);

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
    <div ref={containerRef} className="flex-1 h-full bg-[#0a0a0a] relative overflow-hidden"
      style={{ cursor: transformMode === 'select' ? 'crosshair' : 'default' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[5, 5, 5]} />
        <OrbitControls ref={orbitRef} makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
        <CameraController resetFlag={resetCameraFlag} />
        <CameraExposer cameraRef={cameraRef} />

        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <Environment preset="city" />

        <group>
          {shapes.map((shape) => {
            if (shape.id === primarySelectedId && showGizmo) return null;
            const isSelected = selectedIds.has(shape.id);
            return (
              <Shape key={shape.id} shape={shape} isSelected={isSelected}
                onSelect={(e) => {
                  const additive = e?.nativeEvent?.shiftKey || false;
                  onSelect(shape.id, additive);
                }} />
            );
          })}
        </group>

        {showGizmo && selectedShape && (
          <TransformControls ref={transformRef}
            mode={transformMode === 'select' ? 'translate' : transformMode}
            translationSnap={snapToGrid ? 0.5 : null}
            rotationSnap={snapToGrid ? Math.PI / 4 : null}
            scaleSnap={snapToGrid ? 0.5 : null}
            onMouseUp={handleTransformChange}
            position={selectedShape.position}
            rotation={selectedShape.rotation}
            scale={selectedShape.scale}>
            <Shape
              shape={{...selectedShape, position: [0,0,0], rotation: [0,0,0], scale: [1,1,1]}}
              isSelected={true} onSelect={() => {}} />
          </TransformControls>
        )}

        <Grid infiniteGrid fadeDistance={50} fadeStrength={5} cellSize={1} sectionSize={5}
          sectionColor="#E4E3E0" cellColor="#E4E3E0" sectionThickness={1.5} cellThickness={0.5} />

        <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow
          onClick={() => { if (!marqueeDidDrag.current) onSelect(null); }}>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#0a0a0a" transparent opacity={0.5} />
        </mesh>
      </Canvas>

      {/* Marquee rectangle */}
      {marqueeStyle && <div style={marqueeStyle} />}

      {/* Select mode indicator */}
      {transformMode === 'select' && (
        <div className="absolute top-6 left-6 pointer-events-none z-10">
          <div className="bg-cyan-500/15 backdrop-blur border border-cyan-500/40 px-4 py-2 rounded font-mono text-[10px] text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Select_Mode — Click or drag to select
          </div>
        </div>
      )}

      {/* Overlay UI — top right */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-3 z-10">
        {/* Save / Load buttons */}
        <div className="flex items-center gap-2">
          <button onClick={onSave}
            className="flex items-center gap-2 px-3 py-2 bg-[#141414]/80 backdrop-blur border border-[#E4E3E0]/10 rounded font-mono text-[10px] text-[#E4E3E0] uppercase tracking-widest hover:bg-[#E4E3E0] hover:text-[#141414] transition-all active:scale-95"
            title="Save project (.3dstudio)">
            <Download size={12} /><span>Save</span>
          </button>
          <button onClick={onLoad}
            className="flex items-center gap-2 px-3 py-2 bg-[#141414]/80 backdrop-blur border border-[#E4E3E0]/10 rounded font-mono text-[10px] text-[#E4E3E0] uppercase tracking-widest hover:bg-[#E4E3E0] hover:text-[#141414] transition-all active:scale-95"
            title="Load project (.3dstudio)">
            <Upload size={12} /><span>Load</span>
          </button>
        </div>

        {/* History step navigator */}
        <div className="flex items-center gap-2 bg-[#141414]/80 backdrop-blur border border-[#E4E3E0]/10 rounded px-3 py-1.5 font-mono text-[10px] text-[#E4E3E0] uppercase tracking-widest">
          <button onClick={onUndo} disabled={!canUndo}
            className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-[#E4E3E0]/20 disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-90">
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[60px] text-center">
            <span className="text-cyan-400">{(historyIndex + 1).toString().padStart(2, '0')}</span>
            <span className="opacity-40"> / {historyLength.toString().padStart(2, '0')}</span>
          </span>
          <button onClick={onRedo} disabled={!canRedo}
            className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-[#E4E3E0]/20 disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-90">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Stats */}
        <div className="bg-[#141414]/80 backdrop-blur border border-[#E4E3E0]/10 p-4 rounded font-mono text-[10px] text-[#E4E3E0] uppercase tracking-widest pointer-events-none">
          <div className="flex justify-between gap-8 mb-1"><span className="opacity-50">Entities</span><span>{shapes.length.toString().padStart(2, '0')}</span></div>
          <div className="flex justify-between gap-8 mb-1"><span className="opacity-50">Selected</span><span className={selectedIds.size > 0 ? 'text-cyan-400' : ''}>{selectedIds.size.toString().padStart(2, '0')}</span></div>
          <div className="flex justify-between gap-8"><span className="opacity-50">Status</span><span className="text-green-500">Online</span></div>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 pointer-events-none">
        <div className="bg-[#141414]/80 backdrop-blur border border-[#E4E3E0]/10 p-4 rounded font-mono text-[10px] text-[#E4E3E0] uppercase tracking-widest">
          <div className="opacity-50 mb-2">Shortcuts</div>
          <div className="space-y-1">
            <div>Q: Select_Tool</div>
            <div>G/R/S: Move/Rotate/Scale</div>
            <div>Ctrl+Z: Undo</div>
            <div>Ctrl+Shift+Z: Redo</div>
            <div>Ctrl+C/V: Copy/Paste</div>
            <div>Ctrl+D: Duplicate</div>
            <div>Ctrl+G: Group</div>
            <div>Del: Delete · H: Reset_Cam</div>
          </div>
        </div>
      </div>
    </div>
  );
}
