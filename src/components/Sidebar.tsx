import React, { useState } from 'react';
import { Box, Circle, Cylinder, Cone, Trash2, RotateCw, Move, Maximize, Palette, Pill, Diamond, Hexagon, Triangle, Layers, Grid, Type, Globe, Command, CircleDashed, Square, Star, Heart, ArrowUp, Plus, Copy, Clipboard, FolderPlus, Ungroup, ChevronDown, ChevronRight, MousePointer, Home, Scissors, Undo2, Redo2, ChevronsDown, ChevronsUp, Magnet, Image as ImageIcon, Upload as UploadIcon, AlignEndHorizontal, Pen, Minus } from 'lucide-react';
import { ShapeData, ShapeType, GroupData } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TransformMode } from '../App';

interface SidebarProps {
  shapes: ShapeData[];
  groups: GroupData[];
  selectedIds: Set<string>;
  snapToGrid: boolean;
  smartSnap: boolean;
  transformMode: TransformMode;
  clipboard: { shapes: ShapeData[]; groups: GroupData[] } | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSnap: () => void;
  onToggleSmartSnap: () => void;
  onChangeTransformMode: (mode: TransformMode) => void;
  onSelect: (id: string | null, additive?: boolean) => void;
  onSelectAll: () => void;
  onAdd: (type: ShapeType) => void;
  onUpdate: (id: string, updates: Partial<ShapeData>) => void;
  onDelete: (id: string) => void;
  onDeleteSelected: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onToggleHole: () => void;
  onBooleanSubtract: () => void;
  onCreateGroup: () => void;
  onUngroup: (groupId: string) => void;
  onToggleGroupCollapse: (groupId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onResetCamera: () => void;
  onDraw: () => void;
}

const SHAPE_ICONS: Record<ShapeType, React.ReactNode> = {
  box: <Box size={18} />,
  sphere: <Circle size={18} />,
  cylinder: <Cylinder size={18} />,
  cone: <Cone size={18} />,
  torus: <RotateCw size={18} />,
  pyramid: <Triangle size={18} />,
  capsule: <Pill size={18} />,
  octahedron: <Diamond size={18} />,
  dodecahedron: <Hexagon size={18} />,
  prism: <Triangle size={18} className="rotate-90" />,
  hexPrism: <Hexagon size={18} />,
  icosahedron: <Globe size={18} />,
  tetrahedron: <Triangle size={18} />,
  torusKnot: <Command size={18} />,
  ring: <CircleDashed size={18} />,
  plane: <Square size={18} />,
  circle: <Circle size={18} />,
  star: <Star size={18} />,
  heart: <Heart size={18} />,
  arrow: <ArrowUp size={18} />,
  cross: <Plus size={18} />,
  text: <Type size={18} />,
  image: <ImageIcon size={18} />,
  hemisphere: <Circle size={18} className="clip-path-half" />,
  pipe: <CircleDashed size={18} style={{ strokeWidth: 3 }} />,
  elbowPipe: <RotateCw size={18} />,
  roundRoof: <Square size={18} className="rounded-t-full" />,
  paraboloid: <Triangle size={18} className="scale-y-125" />,
  roundedStairs: <AlignEndHorizontal size={18} />,
  drawing: <Pen size={18} />,
  customMesh: <Box size={18} />,
};

const SHAPE_LABELS: Record<ShapeType, string> = {
  box: 'BOX',
  sphere: 'SPHERE',
  cylinder: 'CYL',
  cone: 'CONE',
  torus: 'TORUS',
  pyramid: 'PYR',
  capsule: 'CAP',
  octahedron: 'OCTA',
  dodecahedron: 'DODE',
  prism: 'PRISM',
  hexPrism: '6-УГОЛ',
  icosahedron: 'ICOSA',
  tetrahedron: 'TETRA',
  torusKnot: 'KNOT',
  ring: 'RING',
  plane: 'PLANE',
  circle: 'CIRCLE',
  star: 'STAR',
  heart: 'HEART',
  arrow: 'ARROW',
  cross: 'CROSS',
  text: 'TEXT',
  image: 'IMAGE',
  hemisphere: 'HEMI',
  pipe: 'PIPE',
  elbowPipe: 'ELBOW',
  roundRoof: 'ROOF',
  paraboloid: 'PARA',
  roundedStairs: 'STAIR',
  drawing: 'DRAW',
  customMesh: 'MESH',
};

const ALL_SHAPES: ShapeType[] = [
  'box', 'sphere', 'cylinder', 'cone', 'torus', 'pyramid', 'capsule', 'octahedron', 'dodecahedron', 'prism', 'hexPrism',
  'icosahedron', 'tetrahedron', 'torusKnot', 'ring', 'plane', 'circle', 'star', 'heart', 'arrow', 'cross', 'text', 'image',
  'hemisphere', 'pipe', 'elbowPipe', 'roundRoof', 'paraboloid', 'roundedStairs'
];

export default function Sidebar({
  shapes, groups, selectedIds, snapToGrid, smartSnap, transformMode, clipboard,
  canUndo, canRedo, onUndo, onRedo,
  onToggleSnap, onToggleSmartSnap, onChangeTransformMode, onSelect, onSelectAll, onAdd, onUpdate, onDelete,
  onDeleteSelected, onCopy, onPaste, onDuplicate, onToggleHole, onBooleanSubtract,
  onCreateGroup, onUngroup, onToggleGroupCollapse, onSelectGroup, onRenameGroup, onResetCamera, onDraw
}: SidebarProps) {
  const primarySelectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const selectedShape = primarySelectedId ? shapes.find(s => s.id === primarySelectedId) : null;
  const selectedShapes = shapes.filter(shape => selectedIds.has(shape.id));
  const hasHoleSelection = selectedShapes.some(shape => shape.isHole);
  const canBooleanSubtract = hasHoleSelection && selectedShapes.some(shape => !shape.isHole);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [propsCollapsed, setPropsCollapsed] = useState(false);

  const groupedShapes = new Map<string, ShapeData[]>();
  const ungroupedShapes: ShapeData[] = [];
  shapes.forEach(shape => {
    if (shape.groupId) {
      const list = groupedShapes.get(shape.groupId) || [];
      list.push(shape);
      groupedShapes.set(shape.groupId, list);
    } else {
      ungroupedShapes.push(shape);
    }
  });

  const startGroupRename = (group: GroupData) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  };
  const commitGroupRename = () => {
    if (editingGroupId && editingGroupName.trim()) onRenameGroup(editingGroupId, editingGroupName.trim());
    setEditingGroupId(null);
  };

  const ActionButton = ({ icon, label, onClick, tooltip, highlight }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 border rounded transition-colors ${highlight ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'border-black/10 dark:border-[#E4E3E0]/20 hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414]'}`} title={tooltip}>
      {icon}<span className="text-[8px] mt-0.5">{label}</span>
    </button>
  );

  return (
    <div className="w-80 shrink-0 h-full bg-white dark:bg-[#141414] text-gray-800 dark:text-[#E4E3E0] border-r border-black/10 dark:border-[#E4E3E0]/20 flex flex-col overflow-hidden font-mono text-xs">
      <div className="p-6 border-bottom border-black/10 dark:border-[#E4E3E0]/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" className="w-8 h-8 object-contain" alt="Logo" />
            <h1 className="text-lg font-bold tracking-tighter uppercase italic">3D_STUDIO_v1.5</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="w-8 h-8 rounded-full border border-black/10 dark:border-[#E4E3E0]/20 flex items-center justify-center transition-all hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414] disabled:opacity-20 disabled:pointer-events-none active:scale-90"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="w-8 h-8 rounded-full border border-black/10 dark:border-[#E4E3E0]/20 flex items-center justify-center transition-all hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414] disabled:opacity-20 disabled:pointer-events-none active:scale-90"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 size={14} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] uppercase opacity-50 tracking-widest">Library_Primitives</div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={onToggleSmartSnap}
              className={`flex items-center gap-1.5 px-2 py-1 border rounded transition-colors ${
                smartSnap ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'border-black/10 dark:border-[#E4E3E0]/20 opacity-50'
              }`}
              title="Smart Snap: intelligent surface/edge snapping"
            >
              <Magnet size={12} />
              <span>SMART</span>
            </button>
            <button 
              onClick={onToggleSnap}
              className={`flex items-center gap-1.5 px-2 py-1 border rounded transition-colors ${
                snapToGrid ? 'bg-green-500/20 border-green-500 text-green-400' : 'border-black/10 dark:border-[#E4E3E0]/20 opacity-50'
              }`}
              title="Grid Snap: snap to 0.5 grid"
            >
              <Grid size={12} />
              <span>GRID</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4 max-h-40 overflow-y-auto pr-2">
          {ALL_SHAPES.map((type) => (
            <button
              key={type}
              onClick={() => onAdd(type)}
              className="flex flex-col items-center justify-center p-2 border border-black/10 dark:border-[#E4E3E0]/20 hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414] transition-colors rounded"
              title={`Add ${type}`}
            >
              {SHAPE_ICONS[type]}
              <span className="mt-1 text-[7px] uppercase opacity-60 leading-none">{SHAPE_LABELS[type]}</span>
            </button>
          ))}
          {/* Special: Draw custom shape */}
          <button
            onClick={onDraw}
            className="flex flex-col items-center justify-center p-2 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors rounded col-span-2"
            title="Draw custom shape"
          >
            <Pen size={18} />
            <span className="text-[7px] mt-0.5 uppercase">Рисовать</span>
          </button>
        </div>

        <div className="text-[10px] uppercase opacity-50 mb-2 tracking-widest">Actions</div>
        <div className="grid grid-cols-6 gap-1.5 mb-4">
          <ActionButton icon={<Copy size={14} />} label="COPY" onClick={onCopy} tooltip="Copy (Ctrl+C)" />
          <ActionButton icon={<Clipboard size={14} />} label="PASTE" onClick={onPaste} tooltip="Paste (Ctrl+V)" />
          <ActionButton icon={<Scissors size={14} />} label="DUP" onClick={onDuplicate} tooltip="Duplicate (Ctrl+D)" />
          <ActionButton icon={<CircleDashed size={14} />} label="HOLE" onClick={onToggleHole} tooltip="Toggle hole mode for selection" highlight={hasHoleSelection} />
          <ActionButton icon={<Minus size={14} />} label="BOOL" onClick={onBooleanSubtract} tooltip="Subtract holes from solids" highlight={canBooleanSubtract} />
          <ActionButton icon={<FolderPlus size={14} />} label="GROUP" onClick={onCreateGroup} tooltip="Create Group (Ctrl+G)" />
          <ActionButton icon={<Home size={14} />} label="HOME" onClick={onResetCamera} tooltip="Reset Camera (H)" />
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 p-2 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400 text-[10px] mb-4">
            <MousePointer size={12} />
            <span>{selectedIds.size} selected</span>
            <div className="flex-1" />
            <button onClick={onSelectAll} className="hover:text-white px-1">ALL</button>
            <span className="opacity-30">|</span>
            <button onClick={() => onSelect(null)} className="hover:text-white px-1">NONE</button>
            <span className="opacity-30">|</span>
            <button onClick={onDeleteSelected} className="hover:text-red-400 px-1">DEL</button>
          </div>
        )}

        <div className="text-[10px] uppercase opacity-50 mb-2 tracking-widest">Tool_Mode</div>
        <div className="grid grid-cols-4 gap-1.5">
          <button onClick={() => onChangeTransformMode('select')}
            className={`flex items-center justify-center gap-1.5 p-2 border rounded transition-colors ${
              transformMode === 'select' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500' : 'border-black/10 dark:border-[#E4E3E0]/20 hover:border-black/20 dark:hover:border-[#E4E3E0]/40'
            }`} title="Select Tool (Q)">
            <MousePointer size={14} /><span>SEL</span>
          </button>
          <button onClick={() => onChangeTransformMode('translate')}
            className={`flex items-center justify-center gap-1.5 p-2 border rounded transition-colors ${
              transformMode === 'translate' ? 'bg-[#E4E3E0] text-gray-100 dark:text-[#141414] border-gray-800 dark:border-[#E4E3E0]' : 'border-black/10 dark:border-[#E4E3E0]/20 hover:border-black/20 dark:hover:border-[#E4E3E0]/40'
            }`} title="Move (G)">
            <Move size={14} /><span>MOV</span>
          </button>
          <button onClick={() => onChangeTransformMode('rotate')}
            className={`flex items-center justify-center gap-1.5 p-2 border rounded transition-colors ${
              transformMode === 'rotate' ? 'bg-[#E4E3E0] text-gray-100 dark:text-[#141414] border-gray-800 dark:border-[#E4E3E0]' : 'border-black/10 dark:border-[#E4E3E0]/20 hover:border-black/20 dark:hover:border-[#E4E3E0]/40'
            }`} title="Rotate (R)">
            <RotateCw size={14} /><span>ROT</span>
          </button>
          <button onClick={() => onChangeTransformMode('scale')}
            className={`flex items-center justify-center gap-1.5 p-2 border rounded transition-colors ${
              transformMode === 'scale' ? 'bg-[#E4E3E0] text-gray-100 dark:text-[#141414] border-gray-800 dark:border-[#E4E3E0]' : 'border-black/10 dark:border-[#E4E3E0]/20 hover:border-black/20 dark:hover:border-[#E4E3E0]/40'
            }`} title="Scale (S)">
            <Maximize size={14} /><span>SCL</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="text-[10px] uppercase opacity-50 mb-2 tracking-widest">Scene_Hierarchy</div>
        
        {groups.map(group => {
          const groupShapes = groupedShapes.get(group.id) || [];
          const allGroupSelected = groupShapes.length > 0 && groupShapes.every(s => selectedIds.has(s.id));
          const someGroupSelected = groupShapes.some(s => selectedIds.has(s.id));
          return (
            <div key={group.id} className="border border-amber-500/20 rounded overflow-hidden">
              <div className={`flex items-center justify-between p-2 cursor-pointer transition-all ${
                  allGroupSelected ? 'bg-amber-500/20 text-amber-300' : someGroupSelected ? 'bg-amber-500/10 text-amber-400/70' : 'hover:bg-gray-100 dark:bg-[#1e1e1e]'
                }`} onClick={() => onSelectGroup(group.id)}>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); onToggleGroupCollapse(group.id); }} className="opacity-50 hover:opacity-100">
                    {group.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <Layers size={14} className="text-amber-500" />
                  {editingGroupId === group.id ? (
                    <input autoFocus value={editingGroupName} onChange={e => setEditingGroupName(e.target.value)}
                      onBlur={commitGroupRename} onKeyDown={e => { if (e.key === 'Enter') commitGroupRename(); }}
                      onClick={e => e.stopPropagation()}
                      className="bg-transparent border-b border-amber-500 outline-none text-xs w-24 uppercase" />
                  ) : (
                    <span className="uppercase text-[10px]" onDoubleClick={(e) => { e.stopPropagation(); startGroupRename(group); }}>
                      {group.name}
                    </span>
                  )}
                  <span className="text-[9px] opacity-40">({groupShapes.length})</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onUngroup(group.id); }}
                  className="opacity-40 hover:opacity-100 hover:text-red-400 transition-opacity" title="Ungroup">
                  <Ungroup size={13} />
                </button>
              </div>
              <AnimatePresence>
                {!group.collapsed && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {groupShapes.map(shape => (
                      <div key={shape.id} onClick={(e) => onSelect(shape.id, e.shiftKey)}
                        className={`flex items-center justify-between p-2 pl-8 border-t border-black/5 dark:border-[#E4E3E0]/5 cursor-pointer transition-all ${
                          selectedIds.has(shape.id) ? 'bg-[#E4E3E0] text-gray-100 dark:text-[#141414]' : 'hover:bg-gray-100 dark:bg-[#1e1e1e]'
                        }`}>
                        <div className="flex items-center gap-2">
                          {SHAPE_ICONS[shape.type]}
                          <span className="uppercase text-[10px]">{shape.type === 'text' ? `"${shape.text?.slice(0,4)}"` : `${shape.type}_${shape.id.slice(0, 4)}`}{shape.isHole ? '_HOLE' : ''}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(shape.id); }}
                          className="opacity-50 hover:opacity-100 hover:text-red-500 transition-opacity">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {ungroupedShapes.map((shape) => (
          <div key={shape.id} onClick={(e) => onSelect(shape.id, e.shiftKey)}
            className={`flex items-center justify-between p-3 border cursor-pointer transition-all ${
              selectedIds.has(shape.id) ? 'bg-[#E4E3E0] text-gray-100 dark:text-[#141414] border-gray-800 dark:border-[#E4E3E0]' : 'border-black/5 dark:border-[#E4E3E0]/10 hover:border-black/20 dark:hover:border-[#E4E3E0]/40'
            }`}>
            <div className="flex items-center gap-3">
              {SHAPE_ICONS[shape.type]}
              <span className="uppercase">{shape.type === 'text' ? `"${shape.text?.slice(0,4)}"` : `${shape.type}_${shape.id.slice(0, 4)}`}{shape.isHole ? '_HOLE' : ''}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(shape.id); }}
              className="opacity-50 hover:opacity-100 hover:text-red-500 transition-opacity">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {shapes.length === 0 && (
          <div className="text-center py-10 opacity-30 italic">No entities detected.</div>
        )}
      </div>

      <AnimatePresence>
        {selectedShape && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="border-t border-black/10 dark:border-[#E4E3E0]/20 bg-gray-50 dark:bg-[#1a1a1a]"
          >
            <div
              className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-transparent dark:bg-[#222] transition-colors select-none"
              onClick={() => setPropsCollapsed(p => !p)}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase opacity-60 tracking-widest">
                {propsCollapsed ? <ChevronsUp size={12} /> : <ChevronsDown size={12} />}
                <span>Entity_Properties</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onSelect(null); }}
                className="text-[10px] uppercase opacity-50 hover:opacity-100 tracking-widest">CLOSE</button>
            </div>

            <AnimatePresence>
              {!propsCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="max-h-[45vh] overflow-y-auto px-6 pb-6 pr-4 space-y-5 overscroll-contain">

                    {selectedShape.type === 'text' && (
                      <div>
                        <div className="flex items-center gap-2 mb-2 opacity-70"><Type size={12} /><span>TEXT_CONTENT</span></div>
                        <input type="text" value={selectedShape.text || ''}
                          onChange={(e) => onUpdate(selectedShape.id, { text: e.target.value })}
                          className="w-full bg-transparent border border-black/10 dark:border-[#E4E3E0]/20 p-2 focus:border-gray-800 dark:border-[#E4E3E0] outline-none" />
                      </div>
                    )}

                    {selectedShape.type === 'image' && (
                      <div>
                        <div className="flex items-center gap-2 mb-2 opacity-70"><ImageIcon size={12} /><span>IMAGE_SOURCE</span></div>
                        <label className="w-full flex items-center justify-center gap-2 bg-transparent border border-black/10 dark:border-[#E4E3E0]/20 p-2 hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414] transition-colors cursor-pointer rounded">
                          <UploadIcon size={14} />
                          <span>UPLOAD IMAGE</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                if (ev.target?.result) {
                                  onUpdate(selectedShape.id, { imageUrl: ev.target.result as string });
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </label>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 mb-2 opacity-70"><Move size={12} /><span>POSITION_XYZ</span></div>
                      <div className="grid grid-cols-3 gap-2">
                        {([0, 1, 2] as const).map((i) => (
                          <input key={i} type="number" step="0.1" value={selectedShape.position[i]}
                            onChange={(e) => {
                              const p = [...selectedShape.position] as [number,number,number];
                              p[i] = parseFloat(e.target.value) || 0;
                              onUpdate(selectedShape.id, { position: p });
                            }}
                            className="bg-transparent border border-black/10 dark:border-[#E4E3E0]/20 p-1 text-center focus:border-gray-800 dark:border-[#E4E3E0] outline-none" />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2 opacity-70"><RotateCw size={12} /><span>ROTATION_XYZ</span></div>
                      <div className="grid grid-cols-3 gap-2">
                        {([0, 1, 2] as const).map((i) => (
                          <input key={i} type="number" step="0.1" value={selectedShape.rotation[i]}
                            onChange={(e) => {
                              const r = [...selectedShape.rotation] as [number,number,number];
                              r[i] = parseFloat(e.target.value) || 0;
                              onUpdate(selectedShape.id, { rotation: r });
                            }}
                            className="bg-transparent border border-black/10 dark:border-[#E4E3E0]/20 p-1 text-center focus:border-gray-800 dark:border-[#E4E3E0] outline-none" />
                        ))}
                      </div>
                    </div>

                    {/* Scale */}
                    <div>
                      <div className="flex items-center gap-2 mb-2 opacity-70"><Maximize size={12} /><span>SCALE_XYZ</span></div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {([0, 1, 2] as const).map((i) => (
                          <input key={i} type="number" step="0.1" value={selectedShape.scale[i]}
                            onChange={(e) => {
                              const s = [...selectedShape.scale] as [number,number,number];
                              s[i] = parseFloat(e.target.value) || 0.1;
                              onUpdate(selectedShape.id, { scale: s });
                            }}
                            className="bg-transparent border border-black/10 dark:border-[#E4E3E0]/20 p-1 text-center focus:border-gray-800 dark:border-[#E4E3E0] outline-none" />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => onUpdate(selectedShape.id, { scale: [selectedShape.scale[0]*0.5, selectedShape.scale[1]*0.5, selectedShape.scale[2]*0.5] })}
                          className="flex-1 border border-black/10 dark:border-[#E4E3E0]/20 p-1 hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414] rounded transition-colors">
                          -50% SIZE
                        </button>
                        <button onClick={() => onUpdate(selectedShape.id, { scale: [selectedShape.scale[0]*2, selectedShape.scale[1]*2, selectedShape.scale[2]*2] })}
                          className="flex-1 border border-black/10 dark:border-[#E4E3E0]/20 p-1 hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414] rounded transition-colors">
                          +100% SIZE
                        </button>
                      </div>
                    </div>

                    {/* Color */}
                    <div>
                      <div className="flex items-center gap-2 mb-2 opacity-70"><Palette size={12} /><span>COLOR_HEX</span></div>
                      <div className="flex gap-2">
                        <input type="color" value={selectedShape.color}
                          onChange={(e) => onUpdate(selectedShape.id, { color: e.target.value })}
                          className="w-10 h-8 bg-transparent border border-black/10 dark:border-[#E4E3E0]/20 cursor-pointer" />
                        <input type="text" value={selectedShape.color}
                          onChange={(e) => onUpdate(selectedShape.id, { color: e.target.value })}
                          className="flex-1 bg-transparent border border-black/10 dark:border-[#E4E3E0]/20 p-1 px-2 focus:border-gray-800 dark:border-[#E4E3E0] outline-none uppercase" />
                      </div>
                    </div>

                    {/* Opacity */}
                    <div>
                      <div className="flex items-center gap-2 mb-2 opacity-70"><Circle size={12} className="opacity-50" /><span>OPACITY</span></div>
                      <div className="flex items-center gap-4">
                        <input type="range" min="0" max="1" step="0.01" value={selectedShape.opacity ?? 1}
                          onChange={(e) => onUpdate(selectedShape.id, { opacity: parseFloat(e.target.value) })}
                          className="flex-1 accent-cyan-500" />
                        <span className="w-12 text-right">{Math.round((selectedShape.opacity ?? 1) * 100)}%</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2 opacity-70"><CircleDashed size={12} /><span>BOOLEAN_ROLE</span></div>
                      <button
                        onClick={() => onUpdate(selectedShape.id, { isHole: !selectedShape.isHole })}
                        className={`w-full p-2 rounded border transition-colors ${
                          selectedShape.isHole
                            ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                            : 'border-black/10 dark:border-[#E4E3E0]/20 hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-black dark:hover:text-[#141414]'
                        }`}
                        >
                          {selectedShape.isHole ? 'HOLE SHAPE' : 'SOLID SHAPE'}
                        </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
