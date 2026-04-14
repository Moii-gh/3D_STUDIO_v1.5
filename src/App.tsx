import React, { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Scene from './components/Scene';
import MobileToolbar from './components/MobileToolbar';
import { ShapeData, ShapeType, GroupData } from './types';
import { computeSmartSnap, SnapResult, SnapGuide, getShapeBBox } from './smartSnap';
import { useIsMobile } from './hooks/useMobile';
import { useTheme } from './hooks/useTheme';
import * as THREE from 'three';

export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';

export interface HistoryEntry {
  shapes: ShapeData[];
  groups: GroupData[];
}

export interface ProjectFile {
  version: string;
  name: string;
  timestamp: string;
  history: HistoryEntry[];
  historyIndex: number;
}

const MAX_HISTORY = 50;
const LOCAL_STORAGE_KEY = '3d-studio-autosave';

function loadAutosave(): { shapes: ShapeData[], groups: GroupData[], history: HistoryEntry[], historyIndex: number } | null {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.history && parsed.history.length > 0) {
        const hIndex = parsed.historyIndex || 0;
        const entry = parsed.history[hIndex];
        return {
          shapes: entry.shapes,
          groups: entry.groups,
          history: parsed.history,
          historyIndex: hIndex,
        };
      }
    }
  } catch (e) {
    console.error("Autosave load failed", e);
  }
  return null;
}

export default function App() {
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();

  const [initialState] = useState(loadAutosave);

  const [shapes, setShapes] = useState<ShapeData[]>(
    initialState?.shapes || [
      {
        id: 'initial-box',
        type: 'box',
        position: [0, 0.5, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#3b82f6',
      },
    ]
  );
  const [groups, setGroups] = useState<GroupData[]>(initialState?.groups || []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [smartSnapEnabled, setSmartSnapEnabled] = useState(true);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);
  const [transformMode, setTransformMode] = useState<TransformMode>('select');
  const [clipboard, setClipboard] = useState<{ shapes: ShapeData[]; groups: GroupData[] } | null>(null);
  const [resetCameraFlag, setResetCameraFlag] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [useShaders, setUseShaders] = useState(() => localStorage.getItem('3d-studio-shaders') !== 'false');

  useEffect(() => {
    localStorage.setItem('3d-studio-shaders', String(useShaders));
  }, [useShaders]);

  // ─── Toast ───
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 2000);
  }, []);

  // ─── Undo / Redo history ───
  const defaultHistory: HistoryEntry[] = [{ shapes: [{ id: 'initial-box', type: 'box', position: [0,0.5,0], rotation: [0,0,0], scale: [1,1,1], color: '#3b82f6' }], groups: [] }];
  const historyRef = useRef<HistoryEntry[]>(initialState?.history || defaultHistory);
  const historyIndexRef = useRef(initialState?.historyIndex || 0);
  const skipHistoryRef = useRef(false);

  const saveToLocalStorage = useCallback(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        history: historyRef.current,
        historyIndex: historyIndexRef.current
      }));
    } catch (e) {
      console.error('Failed to autosave', e);
    }
  }, []);

  const pushHistory = useCallback((newShapes: ShapeData[], newGroups: GroupData[]) => {
    if (skipHistoryRef.current) return;
    const idx = historyIndexRef.current;
    historyRef.current = historyRef.current.slice(0, idx + 1);
    historyRef.current.push({ shapes: JSON.parse(JSON.stringify(newShapes)), groups: JSON.parse(JSON.stringify(newGroups)) });
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    saveToLocalStorage();
  }, [saveToLocalStorage]);

  const prevShapesRef = useRef(shapes);
  const prevGroupsRef = useRef(groups);
  useEffect(() => {
    const shapesChanged = shapes !== prevShapesRef.current;
    const groupsChanged = groups !== prevGroupsRef.current;
    if (shapesChanged || groupsChanged) {
      pushHistory(shapes, groups);
      prevShapesRef.current = shapes;
      prevGroupsRef.current = groups;
    }
  }, [shapes, groups, pushHistory]);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  useEffect(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, [shapes, groups]);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const entry = historyRef.current[historyIndexRef.current];
    skipHistoryRef.current = true;
    setShapes(JSON.parse(JSON.stringify(entry.shapes)));
    setGroups(JSON.parse(JSON.stringify(entry.groups)));
    prevShapesRef.current = entry.shapes;
    prevGroupsRef.current = entry.groups;
    setTimeout(() => { skipHistoryRef.current = false; }, 0);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
    saveToLocalStorage();
    showToast('Undo');
  }, [saveToLocalStorage, showToast]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const entry = historyRef.current[historyIndexRef.current];
    skipHistoryRef.current = true;
    setShapes(JSON.parse(JSON.stringify(entry.shapes)));
    setGroups(JSON.parse(JSON.stringify(entry.groups)));
    prevShapesRef.current = entry.shapes;
    prevGroupsRef.current = entry.groups;
    setTimeout(() => { skipHistoryRef.current = false; }, 0);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    saveToLocalStorage();
    showToast('Redo');
  }, [saveToLocalStorage, showToast]);

  // ─── Save / Load project ───
  const handleSaveProject = useCallback(async () => {
    const date = new Date();
    const ts = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}-${String(date.getMinutes()).padStart(2,'0')}`;
    const name = `project_${ts}`;
    const project: ProjectFile = {
      version: '1.0',
      name,
      timestamp: date.toISOString(),
      history: JSON.parse(JSON.stringify(historyRef.current)),
      historyIndex: historyIndexRef.current,
    };
    const jsonStr = JSON.stringify(project);

    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${name}.json`,
        types: [{
          description: '3D Studio Project',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
      showToast(`Сохранено: ${handle.name}`);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showToast('Ошибка сохранения');
      }
    }
  }, [showToast]);

  const handleLoadProject = useCallback(async () => {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{
          description: '3D Studio Project',
          accept: { 'application/json': ['.json'] },
        }],
        multiple: false,
      });
      const file = await handle.getFile();
      const text = await file.text();
      const project: ProjectFile = JSON.parse(text);

      if (!project.version || !project.history?.length) {
        showToast('Неверный файл проекта');
        return;
      }
      skipHistoryRef.current = true;
      historyRef.current = project.history;
      historyIndexRef.current = project.historyIndex;
      const entry = project.history[project.historyIndex];
      setShapes(JSON.parse(JSON.stringify(entry.shapes)));
      setGroups(JSON.parse(JSON.stringify(entry.groups)));
      prevShapesRef.current = entry.shapes;
      prevGroupsRef.current = entry.groups;
      setSelectedIds(new Set());
      setTimeout(() => { skipHistoryRef.current = false; }, 0);
      setCanUndo(project.historyIndex > 0);
      setCanRedo(project.historyIndex < project.history.length - 1);
      saveToLocalStorage();
      showToast(`Загружено: ${project.name} (${project.history.length} шагов)`);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showToast('Ошибка загрузки');
      }
    }
  }, [showToast]);

  // ─── Selection (group-aware) ───
  const handleSelect = useCallback((id: string | null, additive?: boolean) => {
    if (id === null) { setSelectedIds(new Set()); return; }
    setSelectedIds(prev => {
      const shape = shapes.find(s => s.id === id);
      const groupId = shape?.groupId;
      const idsToToggle = groupId ? shapes.filter(s => s.groupId === groupId).map(s => s.id) : [id];
      if (additive) {
        const next = new Set(prev);
        const allSelected = idsToToggle.every(i => next.has(i));
        if (allSelected) idsToToggle.forEach(i => next.delete(i));
        else idsToToggle.forEach(i => next.add(i));
        return next;
      }
      return new Set(idsToToggle);
    });
  }, [shapes]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(shapes.map(s => s.id)));
    showToast('All entities selected');
  }, [shapes, showToast]);

  const handleDeselectAll = useCallback(() => { setSelectedIds(new Set()); }, []);

  const computePrimaryId = useCallback((): string | null => {
    if (selectedIds.size === 0) return null;
    if (selectedIds.size === 1) return [...selectedIds][0];
    const selected = shapes.filter(s => selectedIds.has(s.id));
    const gid = selected[0]?.groupId;
    if (gid && selected.every(s => s.groupId === gid)) return selected[0].id;
    return null;
  }, [selectedIds, shapes]);

  const primarySelectedId = computePrimaryId();

  const handleAddShape = useCallback((type: ShapeType, fpsPosition?: [number, number, number]) => {
    let position: [number, number, number] = fpsPosition || [0, 0.5, 0];
    if (!fpsPosition && primarySelectedId) {
      const sel = shapes.find(s => s.id === primarySelectedId);
      if (sel) {
        const selBBox = getShapeBBox(sel);
        const newHalf = getShapeBBox({ ...sel, type, scale: [1,1,1], position: [0,0,0], rotation: [0,0,0], color: '', id: '' }).halfSize;
        position = [selBBox.center[0], selBBox.max[1] + newHalf[1], selBBox.center[2]];
      }
    }
    const newShape: ShapeData = {
      id: Math.random().toString(36).substr(2, 9), type, position,
      rotation: [0,0,0], scale: [1,1,1],
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      text: type === 'text' ? 'ТЕКСТ' : undefined,
    };
    setShapes(prev => [...prev, newShape]);
    setSelectedIds(new Set([newShape.id]));
  }, [primarySelectedId, shapes]);

  const handleUpdateShape = useCallback((id: string, updates: Partial<ShapeData>) => {
    setShapes(prev => {
      const newShapes = prev.map(shape => {
        if (shape.id !== id) return shape;
        const ns = { ...shape, ...updates };
        if (snapToGrid && updates.position) {
          ns.position = [Math.round(ns.position[0]*2)/2, Math.round(ns.position[1]*2)/2, Math.round(ns.position[2]*2)/2];
        }
        if (smartSnapEnabled && updates.position) {
          const result = computeSmartSnap(ns, ns.position, prev, true);
          ns.position = result.position;
          setActiveGuides(result.guides);
        } else if (updates.position) {
          setActiveGuides([]);
        }
        return ns;
      });
      return newShapes;
    });
  }, [snapToGrid, smartSnapEnabled]);

  const handleGroupTransform = useCallback((id: string, updates: Partial<ShapeData>) => {
    setShapes(prev => {
      const primary = prev.find(s => s.id === id);
      if (!primary) return prev;

      const groupMembers = primary.groupId ? prev.filter(s => s.groupId === primary.groupId) : [primary];
      
      // ─── Proper Group Transformation ───
      // If ONLY ONE object is selected (even if in a group), transform ONLY that object.
      // This allows interactive "scaling of the cutter" inside the group.
      // If more than 1 object is selected, we assume group movement.
      if (selectedIds.size <= 1) {
        return prev.map(s => s.id === id ? { ...s, ...updates } : s);
      }

      if (groupMembers.length <= 1) {
        return prev.map(s => s.id === id ? { ...s, ...updates } : s);
      }
      // 1. Compute group center (pivot)
      const pivot = new THREE.Vector3(0, 0, 0);
      groupMembers.forEach(m => { pivot.x += m.position[0]; pivot.y += m.position[1]; pivot.z += m.position[2]; });
      pivot.divideScalar(groupMembers.length);

      // 2. Identify Deltas from Primary
      // We use the change in primary relative to its OLD state to define the group transform
      const oldPos = new THREE.Vector3(...primary.position);
      const newPos = updates.position ? new THREE.Vector3(...updates.position) : oldPos.clone();
      
      const oldRot = new THREE.Euler(...primary.rotation);
      const newRot = updates.rotation ? new THREE.Euler(...updates.rotation) : oldRot.clone();
      
      const oldQuat = new THREE.Quaternion().setFromEuler(oldRot);
      const newQuat = new THREE.Quaternion().setFromEuler(newRot);
      const deltaQuat = new THREE.Quaternion().multiplyQuaternions(newQuat, oldQuat.clone().invert());

      const oldScale = new THREE.Vector3(...primary.scale);
      const newScale = updates.scale ? new THREE.Vector3(...updates.scale) : oldScale.clone();
      const scaleFactor = new THREE.Vector3(newScale.x / oldScale.x, newScale.y / oldScale.y, newScale.z / oldScale.z);

      return prev.map(shape => {
        if (!primary.groupId || shape.groupId !== primary.groupId) return shape;

        const ns = { ...shape };
        const shapePos = new THREE.Vector3(...shape.position);
        
        // --- Apply Transform ---
        
        // Scaling around pivot
        if (updates.scale) {
          shapePos.sub(pivot).multiply(scaleFactor).add(pivot);
          ns.scale = [shape.scale[0] * scaleFactor.x, shape.scale[1] * scaleFactor.y, shape.scale[2] * scaleFactor.z];
        }

        // Rotation around pivot
        if (updates.rotation) {
          shapePos.sub(pivot).applyQuaternion(deltaQuat).add(pivot);
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation));
          q.premultiply(deltaQuat);
          const e = new THREE.Euler().setFromQuaternion(q);
          ns.rotation = [e.x, e.y, e.z];
        }

        // Translation
        if (updates.position) {
          const posDelta = new THREE.Vector3().subVectors(newPos, oldPos);
          shapePos.add(posDelta);
        }

        ns.position = [shapePos.x, shapePos.y, shapePos.z];

        // Grid Snap (if enabled)
        if (snapToGrid && updates.position) {
          ns.position = [Math.round(ns.position[0]*2)/2, Math.round(ns.position[1]*2)/2, Math.round(ns.position[2]*2)/2];
        }

        return ns;
      });
    });
  }, [snapToGrid, smartSnapEnabled]);

  const handleDeleteShape = useCallback((id: string) => {
    setShapes(prev => prev.filter(s => s.id !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setShapes(prev => prev.filter(s => !selectedIds.has(s.id)));
    setGroups(prev => prev.filter(g => shapes.some(s => s.groupId === g.id && !selectedIds.has(s.id))));
    setSelectedIds(new Set());
    showToast(`Deleted ${selectedIds.size} entities`);
  }, [selectedIds, shapes, showToast]);

  const handleCreateGroup = useCallback(() => {
    if (selectedIds.size < 2) { showToast('Select 2+ entities to group'); return; }
    const groupId = 'grp_' + Math.random().toString(36).substr(2, 6);
    const newGroup: GroupData = { id: groupId, name: `GROUP_${groupId.slice(4,8).toUpperCase()}`, collapsed: false };
    setGroups(prev => [...prev, newGroup]);
    setShapes(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, groupId } : s));
    showToast(`Created group "${newGroup.name}"`);
  }, [selectedIds, showToast]);



  const handleUngroup = useCallback((groupId: string) => {
    setShapes(prev => prev.map(s => s.groupId === groupId ? { ...s, groupId: undefined } : s));
    setGroups(prev => prev.filter(g => g.id !== groupId));
    showToast('Group dissolved');
  }, [showToast]);

  const handleToggleGroupCollapse = useCallback((groupId: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, collapsed: !g.collapsed } : g));
  }, []);

  const handleSelectGroup = useCallback((groupId: string) => {
    setSelectedIds(new Set(shapes.filter(s => s.groupId === groupId).map(s => s.id)));
  }, [shapes]);

  const handleRenameGroup = useCallback((groupId: string, name: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g));
  }, []);

  const handleMultiSelect = useCallback((ids: string[], additive: boolean) => {
    const allIds = new Set<string>();
    ids.forEach(id => {
      const s = shapes.find(sh => sh.id === id);
      if (s?.groupId) shapes.filter(sh => sh.groupId === s.groupId).forEach(sh => allIds.add(sh.id));
      else allIds.add(id);
    });
    if (additive) setSelectedIds(prev => { const n = new Set(prev); allIds.forEach(i => n.add(i)); return n; });
    else setSelectedIds(allIds);
  }, [shapes]);

  const handleCopy = useCallback(() => {
    if (selectedIds.size === 0) { showToast('Nothing to copy'); return; }
    const copied = shapes.filter(s => selectedIds.has(s.id));
    const gids = new Set(copied.map(s => s.groupId).filter(Boolean));
    setClipboard({ shapes: copied, groups: groups.filter(g => gids.has(g.id)) });
    showToast(`Copied ${copied.length} entities`);
  }, [selectedIds, shapes, groups, showToast]);

  const handlePaste = useCallback(() => {
    if (!clipboard?.shapes.length) { showToast('Nothing to paste'); return; }
    const gmap = new Map<string, string>();
    const newGroups = clipboard.groups.map(g => { const nid = 'grp_'+Math.random().toString(36).substr(2,6); gmap.set(g.id,nid); return {...g,id:nid,name:g.name+'_copy'}; });
    const newShapes = clipboard.shapes.map(s => ({ ...s, id: Math.random().toString(36).substr(2,9), position: [s.position[0]+1,s.position[1],s.position[2]+1] as [number,number,number], groupId: s.groupId ? gmap.get(s.groupId) : undefined }));
    setGroups(prev => [...prev, ...newGroups]);
    setShapes(prev => [...prev, ...newShapes]);
    setSelectedIds(new Set(newShapes.map(s => s.id)));
    showToast(`Pasted ${newShapes.length} entities`);
  }, [clipboard, showToast]);

  const handleDuplicate = useCallback(() => {
    if (selectedIds.size === 0) return;
    const toDup = shapes.filter(s => selectedIds.has(s.id));
    const gmap = new Map<string, string>();
    const gids = new Set(toDup.map(s => s.groupId).filter(Boolean));
    const newGroups = groups.filter(g => gids.has(g.id)).map(g => { const nid='grp_'+Math.random().toString(36).substr(2,6); gmap.set(g.id,nid); return {...g,id:nid,name:g.name+'_dup'}; });
    const newShapes = toDup.map(s => ({ ...s, id: Math.random().toString(36).substr(2,9), position: [s.position[0]+1,s.position[1],s.position[2]+1] as [number,number,number], groupId: s.groupId ? gmap.get(s.groupId) : undefined }));
    setGroups(prev => [...prev, ...newGroups]);
    setShapes(prev => [...prev, ...newShapes]);
    setSelectedIds(new Set(newShapes.map(s => s.id)));
    showToast(`Duplicated ${newShapes.length} entities`);
  }, [selectedIds, shapes, groups, showToast]);

  const handleResetCamera = useCallback(() => { setResetCameraFlag(f => f+1); showToast('Camera reset'); }, [showToast]);

  // ─── Keyboard shortcuts (desktop only) ───
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return; }
        if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); return; }
        if (!e.shiftKey) {
          switch (e.key.toLowerCase()) {
            case 'c': e.preventDefault(); handleCopy(); return;
            case 'v': e.preventDefault(); handlePaste(); return;
            case 'a': if (!isInput) { e.preventDefault(); handleSelectAll(); } return;
            case 'd': e.preventDefault(); handleDuplicate(); return;
            case 'g': e.preventDefault(); handleCreateGroup(); return;
          }
        }
      }
      if (isInput) return;
      switch (e.key) {
        case 'Delete': case 'Backspace': handleDeleteSelected(); break;
        case 'Escape': handleDeselectAll(); break;
        case 'q': setTransformMode('select'); showToast('Mode: SELECT'); break;
        case 'g': setTransformMode('translate'); showToast('Mode: MOVE'); break;
        case 'r': setTransformMode('rotate'); showToast('Mode: ROTATE'); break;
        case 's': setTransformMode('scale'); showToast('Mode: SCALE'); break;
        case 'Home': case 'h': handleResetCamera(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile, handleCopy, handlePaste, handleSelectAll, handleDuplicate, handleCreateGroup, handleDeleteSelected, handleDeselectAll, handleResetCamera, handleUndo, handleRedo, showToast]);

  return (
    <div className="flex h-screen w-screen bg-[#f4f4f5] dark:bg-[#0a0a0a] overflow-hidden text-gray-800 dark:text-[#E4E3E0]">
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sidebar
          shapes={shapes} groups={groups} selectedIds={selectedIds}
          snapToGrid={snapToGrid} smartSnap={smartSnapEnabled} transformMode={transformMode} clipboard={clipboard}
          canUndo={canUndo} canRedo={canRedo}
          onUndo={handleUndo} onRedo={handleRedo}
          onToggleSnap={() => setSnapToGrid(!snapToGrid)}
          onToggleSmartSnap={() => { setSmartSnapEnabled(!smartSnapEnabled); showToast(smartSnapEnabled ? 'Smart Snap OFF' : 'Smart Snap ON'); }}
          onChangeTransformMode={setTransformMode}
          onSelect={handleSelect} onSelectAll={handleSelectAll}
          onAdd={handleAddShape} onUpdate={handleUpdateShape}
          onDelete={handleDeleteShape} onDeleteSelected={handleDeleteSelected}
          onCopy={handleCopy} onPaste={handlePaste} onDuplicate={handleDuplicate}
          onCreateGroup={handleCreateGroup} onUngroup={handleUngroup}
          onToggleGroupCollapse={handleToggleGroupCollapse}
          onSelectGroup={handleSelectGroup} onRenameGroup={handleRenameGroup}
          onResetCamera={handleResetCamera}
        />
      )}

      {/* 3D Scene — full screen on mobile */}
      <main className="flex-1 relative">
        <Scene
          shapes={shapes} selectedIds={selectedIds}
          transformMode={transformMode} snapToGrid={snapToGrid}
          smartSnap={smartSnapEnabled} activeGuides={activeGuides}
          resetCameraFlag={resetCameraFlag}
          historyLength={historyRef.current.length}
          historyIndex={historyIndexRef.current}
          isMobile={isMobile}
          theme={theme} onToggleTheme={toggleTheme}
          useShaders={useShaders} onToggleShaders={() => setUseShaders(!useShaders)}
          onSelect={handleSelect} onUpdate={handleUpdateShape}
          onGroupTransform={handleGroupTransform} onMultiSelect={handleMultiSelect}
          onAdd={handleAddShape}
          onSave={handleSaveProject} onLoad={handleLoadProject}
          onUndo={handleUndo} onRedo={handleRedo}
          canUndo={canUndo} canRedo={canRedo}
          onClearGuides={() => setActiveGuides([])}
        />

        {/* Mobile toolbar overlay */}
        {isMobile && (
          <MobileToolbar
            shapes={shapes} groups={groups} selectedIds={selectedIds}
            snapToGrid={snapToGrid} smartSnap={smartSnapEnabled} transformMode={transformMode} clipboard={clipboard}
            canUndo={canUndo} canRedo={canRedo}
            theme={theme} onToggleTheme={toggleTheme}
            onUndo={handleUndo} onRedo={handleRedo}
            onToggleSnap={() => setSnapToGrid(!snapToGrid)}
            onToggleSmartSnap={() => { setSmartSnapEnabled(!smartSnapEnabled); showToast(smartSnapEnabled ? 'Smart Snap OFF' : 'Smart Snap ON'); }}
            onChangeTransformMode={setTransformMode}
            onSelect={handleSelect} onSelectAll={handleSelectAll}
            onAdd={handleAddShape} onUpdate={handleUpdateShape}
            onDelete={handleDeleteShape} onDeleteSelected={handleDeleteSelected}
            onCopy={handleCopy} onPaste={handlePaste} onDuplicate={handleDuplicate}
            onCreateGroup={handleCreateGroup} onUngroup={handleUngroup}
            onToggleGroupCollapse={handleToggleGroupCollapse}
            onSelectGroup={handleSelectGroup} onRenameGroup={handleRenameGroup}
            onResetCamera={handleResetCamera}
            onSave={handleSaveProject} onLoad={handleLoadProject}
          />
        )}

        {/* Toast */}
        {toast && (
          <div className={`absolute ${isMobile ? 'top-16' : 'top-6'} left-1/2 -translate-x-1/2 z-50 pointer-events-none`}>
            <div className="bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-md border border-black/10 dark:border-[#E4E3E0]/20 px-6 py-2.5 rounded-xl font-mono text-xs uppercase tracking-widest text-gray-800 dark:text-[#E4E3E0] shadow-xl"
              style={{ animation: 'toastIn 0.25s ease-out' }}>
              {toast}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
