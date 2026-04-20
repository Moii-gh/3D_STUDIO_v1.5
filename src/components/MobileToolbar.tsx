import React, { useState, useRef, useCallback } from 'react';
import {
  Box, Circle, Cylinder, Cone, Trash2, RotateCw, Move, Maximize,
  Pill, Diamond, Hexagon, Triangle, Globe, Command, CircleDashed, Square, Star,
  Heart, ArrowUp, Plus, MousePointer, Undo2, Redo2, Menu, X,
  Download, Upload, Home, Grid, Magnet, Copy, Clipboard,
  Scissors, FolderPlus, Type, Layers, ChevronDown, ChevronRight, Ungroup, Palette,
  Sun, Moon, Settings, Image as ImageIcon, Upload as UploadIcon, AlignEndHorizontal, Pen, Minus
} from 'lucide-react';
import { ShapeData, ShapeType, GroupData } from '../types';
import { TransformMode } from '../App';
import { motion, AnimatePresence } from 'motion/react';

interface MobileToolbarProps {
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
  onRenameGroup: (groupId: string, name: string) => void;
  onResetCamera: () => void;
  onSave: () => void;
  onLoad: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onDraw: () => void;
}

const SHAPE_ICONS: Record<ShapeType, React.ReactNode> = {
  box: <Box size={20} />,
  sphere: <Circle size={20} />,
  cylinder: <Cylinder size={20} />,
  cone: <Cone size={20} />,
  torus: <RotateCw size={20} />,
  pyramid: <Triangle size={20} />,
  capsule: <Pill size={20} />,
  octahedron: <Diamond size={20} />,
  dodecahedron: <Hexagon size={18} />,
  prism: <Triangle size={18} className="rotate-90" />,
  hexPrism: <Hexagon size={18} />,
  icosahedron: <Globe size={20} />,
  tetrahedron: <Triangle size={20} />,
  torusKnot: <Command size={20} />,
  ring: <CircleDashed size={20} />,
  plane: <Square size={20} />,
  circle: <Circle size={20} />,
  star: <Star size={20} />,
  heart: <Heart size={20} />,
  arrow: <ArrowUp size={20} />,
  cross: <Plus size={20} />,
  text: <Type size={20} />,
  image: <ImageIcon size={20} />,
  hemisphere: <Circle size={20} className="clip-path-half" />,
  pipe: <CircleDashed size={20} style={{ strokeWidth: 3 }} />,
  elbowPipe: <RotateCw size={20} />,
  roundRoof: <Square size={20} className="rounded-t-full" />,
  paraboloid: <Triangle size={20} className="scale-y-125" />,
  roundedStairs: <AlignEndHorizontal size={20} />,
  drawing: <Pen size={20} />,
  customMesh: <Box size={20} />,
};

const SHAPE_LABELS: Record<ShapeType, string> = {
  box: 'box',
  sphere: 'sphere',
  cylinder: 'cyl',
  cone: 'cone',
  torus: 'torus',
  pyramid: 'pyr',
  capsule: 'cap',
  octahedron: 'octa',
  dodecahedron: 'DODE',
  prism: 'PRISM',
  hexPrism: '6-УГОЛ',
  icosahedron: 'icosa',
  tetrahedron: 'tetra',
  torusKnot: 'knot',
  ring: 'ring',
  plane: 'plane',
  circle: 'circle',
  star: 'star',
  heart: 'heart',
  arrow: 'arrow',
  cross: 'cross',
  text: 'text',
  image: 'image',
  hemisphere: 'hemi',
  pipe: 'pipe',
  elbowPipe: 'elbow',
  roundRoof: 'roof',
  paraboloid: 'para',
  roundedStairs: 'stair',
  drawing: 'draw',
  customMesh: 'mesh',
};

const ALL_SHAPES: ShapeType[] = [
  'box', 'sphere', 'cylinder', 'cone', 'torus', 'pyramid', 'capsule', 'octahedron', 'dodecahedron', 'prism', 'hexPrism',
  'icosahedron', 'tetrahedron', 'torusKnot', 'ring', 'plane', 'circle', 'star', 'heart', 'arrow', 'cross', 'text', 'image',
  'hemisphere', 'pipe', 'elbowPipe', 'roundRoof', 'paraboloid', 'roundedStairs'
];

type MobilePanel = 'none' | 'shapes' | 'hierarchy' | 'properties';

export default function MobileToolbar({
  shapes, groups, selectedIds, snapToGrid, smartSnap, transformMode, clipboard,
  canUndo, canRedo, onUndo, onRedo,
  onToggleSnap, onToggleSmartSnap, onChangeTransformMode, onSelect, onSelectAll, onAdd, onUpdate, onDelete,
  onDeleteSelected, onCopy, onPaste, onDuplicate, onToggleHole, onBooleanSubtract,
  onCreateGroup, onUngroup, onToggleGroupCollapse, onSelectGroup, onRenameGroup, onResetCamera,
  onSave, onLoad, theme, onToggleTheme, onDraw
}: MobileToolbarProps) {
  const [activePanel, setActivePanel] = useState<MobilePanel>('none');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);

  const primarySelectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const selectedShape = primarySelectedId ? shapes.find(s => s.id === primarySelectedId) : null;
  const selectedShapes = shapes.filter(shape => selectedIds.has(shape.id));
  const hasHoleSelection = selectedShapes.some(shape => shape.isHole);
  const canBooleanSubtract = hasHoleSelection && selectedShapes.some(shape => !shape.isHole);

  const togglePanel = (panel: MobilePanel) => {
    setActivePanel(prev => prev === panel ? 'none' : panel);
  };

  // ═══ Bottom sheet drag-to-dismiss ═══
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    dragCurrentY.current = e.touches[0].clientY;
    const delta = dragCurrentY.current - dragStartY.current;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${Math.min(delta, 300)}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const delta = dragCurrentY.current - dragStartY.current;
    if (delta > 100) {
      setActivePanel('none');
    }
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
  }, []);

  // ═══ Group helpers ═══
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

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          TOP BAR — Logo, Undo/Redo, Save/Load
          ═══════════════════════════════════════════════════════ */}
      <div className="absolute top-0 left-0 right-0 z-30 safe-area-top">
        <div className="flex items-center justify-between px-3 py-2 bg-[#f4f4f5] dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-black/5 dark:border-[#E4E3E0]/10">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <img src="/favicon.png" className="w-7 h-7 object-contain" alt="Logo" />
            <span className="font-mono text-[10px] font-bold tracking-tighter uppercase italic text-gray-800 dark:text-[#E4E3E0]">3D_STUDIO</span>
          </div>

          {/* Center: Undo/Redo */}
          <div className="flex items-center gap-1">
            <button onClick={onUndo} disabled={!canUndo}
              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 disabled:opacity-20 transition-all bg-gray-50 dark:bg-[#1a1a1a]/80 border border-black/5 dark:border-[#E4E3E0]/10">
              <Undo2 size={16} className="text-gray-800 dark:text-[#E4E3E0]" />
            </button>
            <button onClick={onRedo} disabled={!canRedo}
              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 disabled:opacity-20 transition-all bg-gray-50 dark:bg-[#1a1a1a]/80 border border-black/5 dark:border-[#E4E3E0]/10">
              <Redo2 size={16} className="text-gray-800 dark:text-[#E4E3E0]" />
            </button>
          </div>

          {/* Right: Save/Load/Home */}
          <div className="flex items-center gap-1">
            <button onClick={onSave}
              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all bg-gray-50 dark:bg-[#1a1a1a]/80 border border-black/5 dark:border-[#E4E3E0]/10">
              <Download size={16} className="text-gray-800 dark:text-[#E4E3E0]" />
            </button>
            <button onClick={onLoad}
              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all bg-gray-50 dark:bg-[#1a1a1a]/80 border border-black/5 dark:border-[#E4E3E0]/10">
              <Upload size={16} className="text-gray-800 dark:text-[#E4E3E0]" />
            </button>
            <button onClick={onResetCamera}
              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all bg-gray-50 dark:bg-[#1a1a1a]/80 border border-black/5 dark:border-[#E4E3E0]/10">
              <Home size={16} className="text-gray-800 dark:text-[#E4E3E0]" />
            </button>
            <button onClick={onToggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all bg-gray-50 dark:bg-[#1a1a1a]/80 border border-black/5 dark:border-[#E4E3E0]/10">
              {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-500" />}
            </button>
          </div>
        </div>

        {/* Selection bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-500/10 backdrop-blur-xl border-b border-cyan-500/30">
                <div className="flex items-center gap-2">
                  <MousePointer size={12} className="text-cyan-400" />
                  <span className="text-cyan-400 font-mono text-[10px] uppercase tracking-wider">{selectedIds.size} выбрано</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={onCopy} className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 text-cyan-400">
                    <Copy size={14} />
                  </button>
                  <button onClick={onPaste} disabled={!clipboard}
                    className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 text-cyan-400 disabled:opacity-20">
                    <Clipboard size={14} />
                  </button>
                  <button onClick={onDuplicate}
                    className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 text-purple-400">
                    <Scissors size={14} />
                  </button>
                  <button
                    onClick={onToggleHole}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 ${
                      hasHoleSelection ? 'text-orange-400' : 'text-cyan-400'
                    }`}
                  >
                    <CircleDashed size={14} />
                  </button>
                  <button
                    onClick={onBooleanSubtract}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 ${
                      canBooleanSubtract ? 'text-amber-300' : 'text-white/50'
                    }`}
                  >
                    <Minus size={14} />
                  </button>
                  {selectedIds.size >= 2 && (
                    <button onClick={onCreateGroup}
                      className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 text-amber-400">
                      <FolderPlus size={14} />
                    </button>
                  )}
                  <button onClick={onDeleteSelected}
                    className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 text-red-400">
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => onSelect(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 text-gray-500 dark:text-[#E4E3E0]/50">
                    <X size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════════════════════════════════════
          LEFT SIDE — Transform Mode (Floating)
          ═══════════════════════════════════════════════════════ */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5">
        {([
          { mode: 'select' as TransformMode, icon: <MousePointer size={18} />, label: 'SEL', color: 'cyan' },
          { mode: 'translate' as TransformMode, icon: <Move size={18} />, label: 'MOV', color: 'white' },
          { mode: 'rotate' as TransformMode, icon: <RotateCw size={18} />, label: 'ROT', color: 'white' },
          { mode: 'scale' as TransformMode, icon: <Maximize size={18} />, label: 'SCL', color: 'white' },
        ]).map(({ mode, icon, color }) => (
          <button
            key={mode}
            onClick={() => onChangeTransformMode(mode)}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 backdrop-blur-md ${
              transformMode === mode
                ? color === 'cyan'
                  ? 'bg-cyan-500/30 border-2 border-cyan-400 text-cyan-400 shadow-lg shadow-cyan-500/20'
                  : 'bg-[#E4E3E0] text-gray-100 dark:text-[#141414] border-2 border-gray-800 dark:border-[#E4E3E0] shadow-lg'
                : 'bg-white dark:bg-[#141414]/70 border border-gray-800 dark:border-[#E4E3E0]/15 text-gray-800 dark:text-[#E4E3E0]/70'
            }`}
          >
            {icon}
          </button>
        ))}

        {/* Snap toggles */}
        <div className="h-1" />
        <button onClick={onToggleSmartSnap}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 backdrop-blur-md ${
            smartSnap ? 'bg-purple-500/30 border-2 border-purple-400 text-purple-400' : 'bg-white dark:bg-[#141414]/70 border border-gray-800 dark:border-[#E4E3E0]/15 text-gray-800 dark:text-[#E4E3E0]/40'
          }`}>
          <Magnet size={16} />
        </button>
        <button onClick={onToggleSnap}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 backdrop-blur-md ${
            snapToGrid ? 'bg-green-500/30 border-2 border-green-400 text-green-400' : 'bg-white dark:bg-[#141414]/70 border border-gray-800 dark:border-[#E4E3E0]/15 text-gray-800 dark:text-[#E4E3E0]/40'
          }`}>
          <Grid size={16} />
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════
          BOTTOM BAR — Main Navigation
          ═══════════════════════════════════════════════════════ */}
      <div className="absolute bottom-0 left-0 right-0 z-30 safe-area-bottom">
        <div className="flex items-stretch justify-around bg-[#f4f4f5] dark:bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-black/5 dark:border-[#E4E3E0]/10 px-2 py-1">
          {/* Add Shapes */}
          <button
            onClick={() => togglePanel('shapes')}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all active:scale-95 min-w-[72px] ${
              activePanel === 'shapes' ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-800 dark:text-[#E4E3E0]/60'
            }`}
          >
            <Plus size={22} />
            <span className="font-mono text-[8px] uppercase tracking-wider">Добавить</span>
          </button>

          {/* Scene Hierarchy */}
          <button
            onClick={() => togglePanel('hierarchy')}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all active:scale-95 min-w-[72px] ${
              activePanel === 'hierarchy' ? 'text-amber-400 bg-amber-500/10' : 'text-gray-800 dark:text-[#E4E3E0]/60'
            }`}
          >
            <Layers size={22} />
            <span className="font-mono text-[8px] uppercase tracking-wider">Сцена</span>
          </button>

          {/* Properties (only when something selected) */}
          <button
            onClick={() => togglePanel('properties')}
            disabled={!selectedShape}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-20 min-w-[72px] ${
              activePanel === 'properties' ? 'text-purple-400 bg-purple-500/10' : 'text-gray-800 dark:text-[#E4E3E0]/60'
            }`}
          >
            <Palette size={22} />
            <span className="font-mono text-[8px] uppercase tracking-wider">Свойства</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          BOTTOM SHEET PANELS
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {activePanel !== 'none' && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 z-25"
              style={{ zIndex: 25 }}
              onClick={() => setActivePanel('none')}
            />

            {/* Sheet */}
            <motion.div
              ref={sheetRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 z-28 bg-white dark:bg-[#141414]/95 backdrop-blur-2xl border-t border-gray-800 dark:border-[#E4E3E0]/15 rounded-t-3xl overflow-hidden"
              style={{ zIndex: 28, maxHeight: '65vh' }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-[#E4E3E0]/20" />
              </div>

              {/* ─── Shapes Panel ─── */}
              {activePanel === 'shapes' && (
                <div className="px-4 pb-20 overflow-y-auto" style={{ maxHeight: 'calc(65vh - 40px)' }}>
                  <div className="text-[10px] uppercase opacity-50 tracking-widest mb-3 font-mono">Библиотека примитивов</div>
                  <div className="grid grid-cols-4 gap-2">
                    {ALL_SHAPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => { onAdd(type); setActivePanel('none'); }}
                        className="flex flex-col items-center justify-center p-3 border border-gray-800 dark:border-[#E4E3E0]/15 rounded-xl active:scale-90 active:bg-cyan-500/20 active:border-cyan-500 transition-all"
                      >
                        {SHAPE_ICONS[type]}
                        <span className="text-[7px] font-mono uppercase mt-1.5 opacity-50">{SHAPE_LABELS[type]}</span>
                      </button>
                    ))}
                    {/* Draw custom shape */}
                    <button
                      onClick={() => { onDraw(); setActivePanel('none'); }}
                      className="flex flex-col items-center justify-center p-3 border border-cyan-500/30 bg-cyan-500/10 rounded-xl active:scale-90 active:bg-cyan-500/20 transition-all col-span-2"
                    >
                      <Pen size={20} className="text-cyan-400" />
                      <span className="text-[7px] font-mono uppercase mt-1.5 text-cyan-400">Рисовать</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Hierarchy Panel ─── */}
              {activePanel === 'hierarchy' && (
                <div className="px-4 pb-20 overflow-y-auto" style={{ maxHeight: 'calc(65vh - 40px)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] uppercase opacity-50 tracking-widest font-mono">Иерархия ({shapes.length})</div>
                    <button onClick={onSelectAll} className="text-[10px] font-mono text-cyan-400 uppercase">
                      Выбрать все
                    </button>
                  </div>

                  {/* Groups */}
                  {groups.map(group => {
                    const groupShapes = groupedShapes.get(group.id) || [];
                    const allGroupSelected = groupShapes.length > 0 && groupShapes.every(s => selectedIds.has(s.id));
                    return (
                      <div key={group.id} className="border border-amber-500/20 rounded-xl overflow-hidden mb-2">
                        <div
                          className={`flex items-center justify-between p-3 transition-all ${
                            allGroupSelected ? 'bg-amber-500/20 text-amber-300' : ''
                          }`}
                          onClick={() => onSelectGroup(group.id)}
                        >
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); onToggleGroupCollapse(group.id); }}>
                              {group.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <Layers size={14} className="text-amber-500" />
                            {editingGroupId === group.id ? (
                              <input autoFocus value={editingGroupName}
                                onChange={e => setEditingGroupName(e.target.value)}
                                onBlur={commitGroupRename}
                                onKeyDown={e => { if (e.key === 'Enter') commitGroupRename(); }}
                                onClick={e => e.stopPropagation()}
                                className="bg-transparent border-b border-amber-500 outline-none text-xs w-24 uppercase font-mono" />
                            ) : (
                              <span className="uppercase text-[10px] font-mono"
                                onDoubleClick={(e) => { e.stopPropagation(); startGroupRename(group); }}>
                                {group.name}
                              </span>
                            )}
                            <span className="text-[9px] opacity-40">({groupShapes.length})</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); onUngroup(group.id); }}
                            className="opacity-40 active:opacity-100 text-red-400 p-1">
                            <Ungroup size={14} />
                          </button>
                        </div>
                        <AnimatePresence>
                          {!group.collapsed && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                              {groupShapes.map(shape => (
                                <div key={shape.id}
                                  onClick={() => { onSelect(shape.id); setActivePanel('none'); }}
                                  className={`flex items-center justify-between p-3 pl-10 border-t border-black/5 dark:border-[#E4E3E0]/5 transition-all ${
                                    selectedIds.has(shape.id) ? 'bg-[#E4E3E0] text-gray-100 dark:text-[#141414]' : ''
                                  }`}>
                                  <div className="flex items-center gap-2">
                                    {SHAPE_ICONS[shape.type]}
                                    <span className="uppercase text-[10px] font-mono">
                                      {shape.type === 'text' ? `"${shape.text?.slice(0,4)}"` : `${shape.type}_${shape.id.slice(0, 4)}`}{shape.isHole ? '_hole' : ''}
                                    </span>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); onDelete(shape.id); }}
                                    className="opacity-50 active:opacity-100 text-red-500 p-1">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {/* Ungrouped */}
                  {ungroupedShapes.map((shape) => (
                    <div key={shape.id}
                      onClick={() => { onSelect(shape.id); setActivePanel('none'); }}
                      className={`flex items-center justify-between p-3 border rounded-xl mb-1.5 transition-all ${
                        selectedIds.has(shape.id) ? 'bg-[#E4E3E0] text-gray-100 dark:text-[#141414] border-gray-800 dark:border-[#E4E3E0]' : 'border-black/5 dark:border-[#E4E3E0]/10'
                      }`}>
                      <div className="flex items-center gap-3">
                        {SHAPE_ICONS[shape.type]}
                        <span className="uppercase text-[10px] font-mono">
                          {shape.type === 'text' ? `"${shape.text?.slice(0,4)}"` : `${shape.type}_${shape.id.slice(0, 4)}`}{shape.isHole ? '_hole' : ''}
                        </span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(shape.id); }}
                        className="opacity-50 active:opacity-100 text-red-500 p-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  {shapes.length === 0 && (
                    <div className="text-center py-10 opacity-30 italic font-mono text-sm">Нет объектов</div>
                  )}
                </div>
              )}

              {/* ─── Properties Panel ─── */}
              {activePanel === 'properties' && selectedShape && (
                <div className="px-4 pb-20 overflow-y-auto" style={{ maxHeight: 'calc(65vh - 40px)' }}>
                  <div className="text-[10px] uppercase opacity-50 tracking-widest mb-3 font-mono">
                    Свойства: {selectedShape.type}_{selectedShape.id.slice(0,4)}
                  </div>

                  {/* Text Content */}
                  {selectedShape.type === 'text' && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2 opacity-70 font-mono text-[10px]">
                        <Type size={12} /><span>ТЕКСТ</span>
                      </div>
                      <input type="text" value={selectedShape.text || ''}
                        onChange={(e) => onUpdate(selectedShape.id, { text: e.target.value })}
                        className="w-full bg-gray-100 dark:bg-[#1e1e1e] border border-black/10 dark:border-[#E4E3E0]/20 p-3 rounded-xl focus:border-gray-800 dark:border-[#E4E3E0] outline-none font-mono text-sm" />
                    </div>
                  )}

                  {/* Image Content */}
                  {selectedShape.type === 'image' && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2 opacity-70 font-mono text-[10px]">
                        <ImageIcon size={12} /><span>ИЗОБРАЖЕНИЕ</span>
                      </div>
                      <label className="flex items-center justify-center gap-2 w-full bg-gray-100 dark:bg-[#1e1e1e] hover:bg-gray-200 dark:hover:bg-[#E4E3E0] hover:text-[#141414] border border-black/10 dark:border-[#E4E3E0]/20 p-3 rounded-xl transition-colors cursor-pointer text-sm font-mono uppercase tracking-widest">
                        <UploadIcon size={14} />
                        <span>Загрузить</span>
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

                  {/* Position */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2 opacity-70 font-mono text-[10px]">
                      <Move size={12} /><span>ПОЗИЦИЯ XYZ</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['X', 'Y', 'Z'] as const).map((label, i) => (
                        <div key={i} className="relative">
                          <span className="absolute top-1 left-2 text-[8px] font-mono opacity-30">{label}</span>
                          <input type="number" step="0.1" value={selectedShape.position[i]}
                            onChange={(e) => {
                              const p = [...selectedShape.position] as [number,number,number];
                              p[i] = parseFloat(e.target.value) || 0;
                              onUpdate(selectedShape.id, { position: p });
                            }}
                            className="w-full bg-gray-100 dark:bg-[#1e1e1e] border border-black/10 dark:border-[#E4E3E0]/20 p-3 pt-4 rounded-xl text-center focus:border-gray-800 dark:border-[#E4E3E0] outline-none font-mono text-sm" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rotation */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2 opacity-70 font-mono text-[10px]">
                      <RotateCw size={12} /><span>ВРАЩЕНИЕ XYZ</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['X', 'Y', 'Z'] as const).map((label, i) => (
                        <div key={i} className="relative">
                          <span className="absolute top-1 left-2 text-[8px] font-mono opacity-30">{label}</span>
                          <input type="number" step="0.1" value={selectedShape.rotation[i]}
                            onChange={(e) => {
                              const r = [...selectedShape.rotation] as [number,number,number];
                              r[i] = parseFloat(e.target.value) || 0;
                              onUpdate(selectedShape.id, { rotation: r });
                            }}
                            className="w-full bg-gray-100 dark:bg-[#1e1e1e] border border-black/10 dark:border-[#E4E3E0]/20 p-3 pt-4 rounded-xl text-center focus:border-gray-800 dark:border-[#E4E3E0] outline-none font-mono text-sm" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Scale */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2 opacity-70 font-mono text-[10px]">
                      <Maximize size={12} /><span>МАСШТАБ XYZ</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {(['X', 'Y', 'Z'] as const).map((label, i) => (
                        <div key={i} className="relative">
                          <span className="absolute top-1 left-2 text-[8px] font-mono opacity-30">{label}</span>
                          <input type="number" step="0.1" value={selectedShape.scale[i]}
                            onChange={(e) => {
                              const s = [...selectedShape.scale] as [number,number,number];
                              s[i] = parseFloat(e.target.value) || 0.1;
                              onUpdate(selectedShape.id, { scale: s });
                            }}
                            className="w-full bg-gray-100 dark:bg-[#1e1e1e] border border-black/10 dark:border-[#E4E3E0]/20 p-3 pt-4 rounded-xl text-center focus:border-gray-800 dark:border-[#E4E3E0] outline-none font-mono text-sm" />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onUpdate(selectedShape.id, {
                        scale: [selectedShape.scale[0]*0.5, selectedShape.scale[1]*0.5, selectedShape.scale[2]*0.5]
                      })}
                        className="flex-1 border border-black/10 dark:border-[#E4E3E0]/20 p-2.5 rounded-xl active:bg-[#E4E3E0] active:text-gray-100 dark:text-[#141414] font-mono text-xs transition-all">
                        -50%
                      </button>
                      <button onClick={() => onUpdate(selectedShape.id, {
                        scale: [selectedShape.scale[0]*2, selectedShape.scale[1]*2, selectedShape.scale[2]*2]
                      })}
                        className="flex-1 border border-black/10 dark:border-[#E4E3E0]/20 p-2.5 rounded-xl active:bg-[#E4E3E0] active:text-gray-100 dark:text-[#141414] font-mono text-xs transition-all">
                        +100%
                      </button>
                    </div>
                  </div>

                  {/* Color */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2 opacity-70 font-mono text-[10px]">
                      <Palette size={12} /><span>ЦВЕТ</span>
                    </div>
                    <div className="flex gap-2">
                      <input type="color" value={selectedShape.color}
                        onChange={(e) => onUpdate(selectedShape.id, { color: e.target.value })}
                        className="w-14 h-12 bg-transparent border border-black/10 dark:border-[#E4E3E0]/20 cursor-pointer rounded-xl" />
                      <input type="text" value={selectedShape.color}
                        onChange={(e) => onUpdate(selectedShape.id, { color: e.target.value })}
                        className="flex-1 bg-gray-100 dark:bg-[#1e1e1e] border border-black/10 dark:border-[#E4E3E0]/20 p-3 rounded-xl focus:border-gray-800 dark:border-[#E4E3E0] outline-none uppercase font-mono text-sm" />
                    </div>
                  </div>

                  {/* Quick color palette */}
                  <div className="flex gap-1.5 flex-wrap mb-4">
                    {['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f8fafc', '#1e293b'].map(c => (
                      <button key={c} onClick={() => onUpdate(selectedShape.id, { color: c })}
                        className={`w-9 h-9 rounded-xl border-2 transition-all active:scale-90 ${
                          selectedShape.color === c ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2 opacity-70 font-mono text-[10px]">
                      <CircleDashed size={12} /><span>ROLE</span>
                    </div>
                    <button
                      onClick={() => onUpdate(selectedShape.id, { isHole: !selectedShape.isHole })}
                      className={`w-full p-3 rounded-xl border transition-all font-mono text-xs uppercase tracking-wider ${
                        selectedShape.isHole
                          ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                          : 'border-black/10 dark:border-[#E4E3E0]/20'
                      }`}
                    >
                      {selectedShape.isHole ? 'Hole shape' : 'Solid shape'}
                    </button>
                  </div>
                </div>
              )}

              {activePanel === 'properties' && !selectedShape && (
                <div className="px-4 pb-20 text-center py-10 opacity-30 italic font-mono text-sm">
                  Выберите объект
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
