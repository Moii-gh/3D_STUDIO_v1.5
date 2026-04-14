import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Undo2, Redo2, Pen, Eraser, Trash2, Check, X } from 'lucide-react';

interface DrawingCanvasProps {
  onDone: (points: [number, number][]) => void;
  onCancel: () => void;
  theme: 'light' | 'dark';
}

interface Stroke {
  points: [number, number][];
  tool: 'pen' | 'eraser';
}

export default function DrawingCanvas({ onDone, onCancel, theme }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<[number, number][]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);

  const isDark = theme === 'dark';

  // ─── Draw grid + all strokes ───
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    // Background
    ctx.fillStyle = isDark ? '#141414' : '#f0f4ff';
    ctx.fillRect(0, 0, w, h);

    // Grid
    const gridSize = 30;
    ctx.strokeStyle = isDark ? 'rgba(228,227,224,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Stronger grid lines every 5
    ctx.strokeStyle = isDark ? 'rgba(228,227,224,0.12)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += gridSize * 5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += gridSize * 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Completed strokes
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
      }
      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = 20;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = isDark ? '#E4E3E0' : '#1a1a2e';
        ctx.lineWidth = 3;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
    ctx.globalCompositeOperation = 'source-over';

    // Active stroke
    if (currentStroke.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(currentStroke[0][0], currentStroke[0][1]);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i][0], currentStroke[i][1]);
      }
      if (tool === 'eraser') {
        ctx.strokeStyle = isDark ? 'rgba(255,100,100,0.5)' : 'rgba(255,0,0,0.3)';
        ctx.lineWidth = 20;
      } else {
        ctx.strokeStyle = isDark ? '#06b6d4' : '#3b82f6';
        ctx.lineWidth = 3;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }, [strokes, currentStroke, tool, isDark]);

  // ─── Resize canvas to fill screen ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redraw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [redraw]);

  useEffect(() => { redraw(); }, [redraw]);

  // ─── Mouse events ───
  const getPos = (e: React.MouseEvent | React.TouchEvent): [number, number] => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return [e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top];
    }
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentStroke([pos]);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    setCurrentStroke(prev => [...prev, pos]);
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length >= 2) {
      setStrokes(prev => [...prev, { points: currentStroke, tool }]);
      setUndoneStrokes([]);
    }
    setCurrentStroke([]);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes(prev => prev.slice(0, -1));
    setUndoneStrokes(prev => [...prev, last]);
  };

  const handleRedo = () => {
    if (undoneStrokes.length === 0) return;
    const last = undoneStrokes[undoneStrokes.length - 1];
    setUndoneStrokes(prev => prev.slice(0, -1));
    setStrokes(prev => [...prev, last]);
  };

  const handleClear = () => {
    setStrokes([]);
    setUndoneStrokes([]);
    setCurrentStroke([]);
  };

  // ─── Extract outline from drawing ───
  const handleDone = () => {
    // Collect all pen stroke points
    const allPoints: [number, number][] = [];
    strokes.forEach(s => {
      if (s.tool === 'pen') {
        allPoints.push(...s.points);
      }
    });

    if (allPoints.length < 3) return;

    // Find bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allPoints.forEach(([x, y]) => {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    });

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const size = Math.max(maxX - minX, maxY - minY);
    if (size < 10) return; // too small

    // Normalize points to [-0.5..0.5] range
    const normalized: [number, number][] = allPoints.map(([x, y]) => [
      (x - cx) / size,
      -(y - cy) / size  // flip Y for 3D
    ]);

    // Simplify: keep every Nth point for a cleaner shape
    const simplified: [number, number][] = [];
    const step = Math.max(1, Math.floor(normalized.length / 200));
    for (let i = 0; i < normalized.length; i += step) {
      simplified.push(normalized[i]);
    }

    // Close the shape: connect last point back to first
    if (simplified.length >= 3) {
      simplified.push(simplified[0]);
    }

    onDone(simplified);
  };

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [strokes, undoneStrokes]);

  const penStrokeCount = strokes.filter(s => s.tool === 'pen').length;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ touchAction: 'none' }}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />

      {/* Toolbar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur-xl border shadow-2xl ${
          isDark
            ? 'bg-[#1a1a1a]/90 border-[#E4E3E0]/15'
            : 'bg-white/90 border-black/10'
        }`}>
          {/* Undo */}
          <button onClick={handleUndo} disabled={strokes.length === 0}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-20 ${
              isDark ? 'hover:bg-[#E4E3E0]/10' : 'hover:bg-gray-100'
            }`}>
            <Undo2 size={18} />
          </button>
          {/* Redo */}
          <button onClick={handleRedo} disabled={undoneStrokes.length === 0}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-20 ${
              isDark ? 'hover:bg-[#E4E3E0]/10' : 'hover:bg-gray-100'
            }`}>
            <Redo2 size={18} />
          </button>

          <div className={`w-px h-6 mx-1 ${isDark ? 'bg-[#E4E3E0]/15' : 'bg-black/10'}`} />

          {/* Pen */}
          <button onClick={() => setTool('pen')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
              tool === 'pen'
                ? 'bg-blue-500/20 border-2 border-blue-400 text-blue-400'
                : isDark ? 'hover:bg-[#E4E3E0]/10' : 'hover:bg-gray-100'
            }`}>
            <Pen size={18} />
          </button>
          {/* Eraser */}
          <button onClick={() => setTool('eraser')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
              tool === 'eraser'
                ? 'bg-red-500/20 border-2 border-red-400 text-red-400'
                : isDark ? 'hover:bg-[#E4E3E0]/10' : 'hover:bg-gray-100'
            }`}>
            <Eraser size={18} />
          </button>

          <div className={`w-px h-6 mx-1 ${isDark ? 'bg-[#E4E3E0]/15' : 'bg-black/10'}`} />

          {/* Clear */}
          <button onClick={handleClear} disabled={strokes.length === 0}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-20 text-red-400 ${
              isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
            }`}>
            <Trash2 size={18} />
          </button>
        </div>

        {/* Done / Cancel */}
        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur-xl border shadow-2xl ${
          isDark
            ? 'bg-[#1a1a1a]/90 border-[#E4E3E0]/15'
            : 'bg-white/90 border-black/10'
        }`}>
          <button onClick={handleDone} disabled={penStrokeCount === 0}
            className="px-4 h-10 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-30 bg-emerald-500/20 border border-emerald-400 text-emerald-400 font-mono text-xs uppercase tracking-wider hover:bg-emerald-500/30">
            <Check size={16} />
            <span>Готово</span>
          </button>
          <button onClick={onCancel}
            className={`px-4 h-10 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 font-mono text-xs uppercase tracking-wider ${
              isDark
                ? 'border border-[#E4E3E0]/15 hover:bg-[#E4E3E0]/10 text-[#E4E3E0]/60'
                : 'border border-black/10 hover:bg-gray-100 text-gray-500'
            }`}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Hint */}
      <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-10 px-5 py-2.5 rounded-xl backdrop-blur-xl border font-mono text-xs uppercase tracking-widest ${
        isDark
          ? 'bg-[#1a1a1a]/80 border-[#E4E3E0]/15 text-[#E4E3E0]/60'
          : 'bg-white/80 border-black/10 text-gray-500'
      }`}>
        Нарисуйте контур фигуры
      </div>
    </div>
  );
}
