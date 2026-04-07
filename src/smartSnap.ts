import { ShapeData } from './types';

// ═══════════════════════════════════════════════════════════
//  SMART SNAP ENGINE — Intelligent Block Placement System
// ═══════════════════════════════════════════════════════════

export interface BBox {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  halfSize: [number, number, number];
}

export interface SnapResult {
  position: [number, number, number];
  snappedAxes: ('x' | 'y' | 'z')[];
  guides: SnapGuide[];
  snapType: 'face' | 'edge' | 'center' | 'grid' | 'none';
  targetShapeId?: string;
}

export interface SnapGuide {
  from: [number, number, number];
  to: [number, number, number];
  axis: 'x' | 'y' | 'z';
  type: 'alignment' | 'distance' | 'surface';
  distance?: number;
}

export interface PlacementSuggestion {
  position: [number, number, number];
  face: 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
  targetId: string;
  confidence: number;
}

// ─── Bounding Box Helpers ───

const SHAPE_HALF_SIZES: Record<string, [number, number, number]> = {
  box: [0.5, 0.5, 0.5],
  sphere: [0.5, 0.5, 0.5],
  cylinder: [0.5, 0.5, 0.5],
  cone: [0.5, 0.5, 0.5],
  torus: [0.55, 0.15, 0.55],
  pyramid: [0.5, 0.5, 0.5],
  capsule: [0.3, 0.55, 0.3],
  octahedron: [0.5, 0.5, 0.5],
  dodecahedron: [0.5, 0.5, 0.5],
  prism: [0.5, 0.5, 0.5],
  icosahedron: [0.5, 0.5, 0.5],
  tetrahedron: [0.5, 0.5, 0.5],
  torusKnot: [0.4, 0.4, 0.4],
  ring: [0.5, 0.02, 0.5],
  plane: [0.5, 0.01, 0.5],
  circle: [0.5, 0.01, 0.5],
  star: [0.5, 0.12, 0.5],
  heart: [0.5, 0.5, 0.12],
  arrow: [0.5, 0.5, 0.12],
  cross: [0.5, 0.5, 0.12],
  text: [0.5, 0.25, 0.05],
};

export function getShapeBBox(shape: ShapeData): BBox {
  const base = SHAPE_HALF_SIZES[shape.type] || [0.5, 0.5, 0.5];
  const halfSize: [number, number, number] = [
    base[0] * shape.scale[0],
    base[1] * shape.scale[1],
    base[2] * shape.scale[2],
  ];
  return {
    center: [...shape.position] as [number, number, number],
    halfSize,
    min: [
      shape.position[0] - halfSize[0],
      shape.position[1] - halfSize[1],
      shape.position[2] - halfSize[2],
    ],
    max: [
      shape.position[0] + halfSize[0],
      shape.position[1] + halfSize[1],
      shape.position[2] + halfSize[2],
    ],
  };
}

// ─── Smart Snap Threshold ───
const SNAP_THRESHOLD = 0.4; // How close before snapping activates
const ALIGN_THRESHOLD = 0.3; // Alignment guide threshold

// ─── Core Smart Snap Function ───
export function computeSmartSnap(
  movingShape: ShapeData,
  newPosition: [number, number, number],
  allShapes: ShapeData[],
  enabled: boolean
): SnapResult {
  if (!enabled) {
    return { position: newPosition, snappedAxes: [], guides: [], snapType: 'none' };
  }

  const others = allShapes.filter(s => s.id !== movingShape.id);
  if (others.length === 0) {
    return { position: newPosition, snappedAxes: [], guides: [], snapType: 'none' };
  }

  const movingBBox = getShapeBBox({ ...movingShape, position: newPosition });
  const snapped: [number, number, number] = [...newPosition];
  const snappedAxes: ('x' | 'y' | 'z')[] = [];
  const guides: SnapGuide[] = [];
  let snapType: SnapResult['snapType'] = 'none';
  let closestDist = Infinity;
  let targetShapeId: string | undefined;

  for (const other of others) {
    const otherBBox = getShapeBBox(other);

    // ─── Face Snapping (surface-to-surface) ───
    // Check each axis pair for face alignment

    // Y-axis: top of other → bottom of moving (stacking)
    const topGap = Math.abs(movingBBox.min[1] - otherBBox.max[1]);
    if (topGap < SNAP_THRESHOLD) {
      const ySnap = otherBBox.max[1] + movingBBox.halfSize[1];
      const dist = Math.abs(newPosition[1] - ySnap);
      if (dist < closestDist || !snappedAxes.includes('y')) {
        snapped[1] = ySnap;
        if (!snappedAxes.includes('y')) snappedAxes.push('y');
        snapType = 'face';
        targetShapeId = other.id;
        closestDist = dist;
        guides.push({
          from: [otherBBox.center[0], otherBBox.max[1], otherBBox.center[2]],
          to: [snapped[0], ySnap, snapped[2]],
          axis: 'y', type: 'surface',
        });
      }
    }

    // Y-axis: bottom of other → top of moving (hanging)
    const bottomGap = Math.abs(movingBBox.max[1] - otherBBox.min[1]);
    if (bottomGap < SNAP_THRESHOLD) {
      const ySnap = otherBBox.min[1] - movingBBox.halfSize[1];
      const dist = Math.abs(newPosition[1] - ySnap);
      if (dist < closestDist) {
        snapped[1] = ySnap;
        if (!snappedAxes.includes('y')) snappedAxes.push('y');
        snapType = 'face';
        targetShapeId = other.id;
        closestDist = dist;
      }
    }

    // X-axis: right of other → left of moving
    const rightGapX = Math.abs(movingBBox.min[0] - otherBBox.max[0]);
    if (rightGapX < SNAP_THRESHOLD && isOverlapping1D(movingBBox.min[1], movingBBox.max[1], otherBBox.min[1], otherBBox.max[1])) {
      const xSnap = otherBBox.max[0] + movingBBox.halfSize[0];
      snapped[0] = xSnap;
      if (!snappedAxes.includes('x')) snappedAxes.push('x');
      snapType = 'face';
      targetShapeId = other.id;
      guides.push({
        from: [otherBBox.max[0], otherBBox.center[1], otherBBox.center[2]],
        to: [xSnap, snapped[1], snapped[2]],
        axis: 'x', type: 'surface',
      });
    }

    // X-axis: left of other → right of moving
    const leftGapX = Math.abs(movingBBox.max[0] - otherBBox.min[0]);
    if (leftGapX < SNAP_THRESHOLD && isOverlapping1D(movingBBox.min[1], movingBBox.max[1], otherBBox.min[1], otherBBox.max[1])) {
      const xSnap = otherBBox.min[0] - movingBBox.halfSize[0];
      snapped[0] = xSnap;
      if (!snappedAxes.includes('x')) snappedAxes.push('x');
      snapType = 'face';
      targetShapeId = other.id;
    }

    // Z-axis: front of other → back of moving
    const frontGapZ = Math.abs(movingBBox.min[2] - otherBBox.max[2]);
    if (frontGapZ < SNAP_THRESHOLD && isOverlapping1D(movingBBox.min[1], movingBBox.max[1], otherBBox.min[1], otherBBox.max[1])) {
      const zSnap = otherBBox.max[2] + movingBBox.halfSize[2];
      snapped[2] = zSnap;
      if (!snappedAxes.includes('z')) snappedAxes.push('z');
      snapType = 'face';
      targetShapeId = other.id;
      guides.push({
        from: [otherBBox.center[0], otherBBox.center[1], otherBBox.max[2]],
        to: [snapped[0], snapped[1], zSnap],
        axis: 'z', type: 'surface',
      });
    }

    // Z-axis: back of other → front of moving
    const backGapZ = Math.abs(movingBBox.max[2] - otherBBox.min[2]);
    if (backGapZ < SNAP_THRESHOLD && isOverlapping1D(movingBBox.min[1], movingBBox.max[1], otherBBox.min[1], otherBBox.max[1])) {
      const zSnap = otherBBox.min[2] - movingBBox.halfSize[2];
      snapped[2] = zSnap;
      if (!snappedAxes.includes('z')) snappedAxes.push('z');
      snapType = 'face';
      targetShapeId = other.id;
    }

    // ─── Center Alignment ───
    for (let axis = 0; axis < 3; axis++) {
      const axisName = (['x', 'y', 'z'] as const)[axis];
      const diff = Math.abs(newPosition[axis] - otherBBox.center[axis]);
      if (diff < ALIGN_THRESHOLD && !snappedAxes.includes(axisName)) {
        snapped[axis] = otherBBox.center[axis];
        snappedAxes.push(axisName);
        if (snapType === 'none') snapType = 'center';

        // Build alignment guide
        const from: [number, number, number] = [...otherBBox.center] as [number, number, number];
        const to: [number, number, number] = [...snapped] as [number, number, number];
        // Extend guide line on the aligned axis
        const perpAxis1 = (axis + 1) % 3;
        from[perpAxis1] = Math.min(otherBBox.center[perpAxis1], snapped[perpAxis1]) - 1;
        to[perpAxis1] = Math.max(otherBBox.center[perpAxis1], snapped[perpAxis1]) + 1;
        guides.push({ from, to, axis: axisName, type: 'alignment' });
      }
    }
  }

  // ─── Ground Snap (Y = halfSize for touching ground) ───
  if (Math.abs(newPosition[1] - movingBBox.halfSize[1]) < SNAP_THRESHOLD) {
    snapped[1] = movingBBox.halfSize[1];
    if (!snappedAxes.includes('y')) snappedAxes.push('y');
    if (snapType === 'none') snapType = 'face';
    guides.push({
      from: [snapped[0] - 1, 0, snapped[2]],
      to: [snapped[0] + 1, 0, snapped[2]],
      axis: 'y', type: 'surface',
    });
  }

  return { position: snapped, snappedAxes, guides, snapType, targetShapeId };
}

// ─── Generate placement suggestions for a face click ───
export function generatePlacementSuggestions(
  targetShape: ShapeData,
  newShapeType: string,
  newScale: [number, number, number] = [1, 1, 1]
): PlacementSuggestion[] {
  const targetBBox = getShapeBBox(targetShape);
  const newHalf = SHAPE_HALF_SIZES[newShapeType] || [0.5, 0.5, 0.5];
  const scaledHalf: [number, number, number] = [
    newHalf[0] * newScale[0],
    newHalf[1] * newScale[1],
    newHalf[2] * newScale[2],
  ];

  const suggestions: PlacementSuggestion[] = [
    {
      face: 'top',
      position: [targetBBox.center[0], targetBBox.max[1] + scaledHalf[1], targetBBox.center[2]],
      targetId: targetShape.id,
      confidence: 1.0,
    },
    {
      face: 'bottom',
      position: [targetBBox.center[0], targetBBox.min[1] - scaledHalf[1], targetBBox.center[2]],
      targetId: targetShape.id,
      confidence: 0.3,
    },
    {
      face: 'right',
      position: [targetBBox.max[0] + scaledHalf[0], targetBBox.center[1], targetBBox.center[2]],
      targetId: targetShape.id,
      confidence: 0.7,
    },
    {
      face: 'left',
      position: [targetBBox.min[0] - scaledHalf[0], targetBBox.center[1], targetBBox.center[2]],
      targetId: targetShape.id,
      confidence: 0.7,
    },
    {
      face: 'front',
      position: [targetBBox.center[0], targetBBox.center[1], targetBBox.max[2] + scaledHalf[2]],
      targetId: targetShape.id,
      confidence: 0.6,
    },
    {
      face: 'back',
      position: [targetBBox.center[0], targetBBox.center[1], targetBBox.min[2] - scaledHalf[2]],
      targetId: targetShape.id,
      confidence: 0.6,
    },
  ];

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// ─── Collision detection ───
export function checkCollision(shapeA: ShapeData, shapeB: ShapeData): boolean {
  const a = getShapeBBox(shapeA);
  const b = getShapeBBox(shapeB);
  return (
    a.min[0] < b.max[0] && a.max[0] > b.min[0] &&
    a.min[1] < b.max[1] && a.max[1] > b.min[1] &&
    a.min[2] < b.max[2] && a.max[2] > b.min[2]
  );
}

// Find the nearest non-colliding position
export function resolveCollision(
  movingShape: ShapeData,
  allShapes: ShapeData[]
): [number, number, number] {
  const others = allShapes.filter(s => s.id !== movingShape.id);
  let pos = [...movingShape.position] as [number, number, number];

  for (const other of others) {
    const test = { ...movingShape, position: pos };
    if (checkCollision(test, other)) {
      // Push up
      const otherBBox = getShapeBBox(other);
      const movingBBox = getShapeBBox(test);
      pos[1] = otherBBox.max[1] + movingBBox.halfSize[1];
    }
  }

  return pos;
}

// ─── Utility ───
function isOverlapping1D(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax && aMax > bMin;
}

// ─── Compute all alignment guides for overlay ───
export function computeAlignmentGuides(
  movingShape: ShapeData,
  allShapes: ShapeData[]
): SnapGuide[] {
  const guides: SnapGuide[] = [];
  const movingBBox = getShapeBBox(movingShape);
  const others = allShapes.filter(s => s.id !== movingShape.id);

  for (const other of others) {
    const otherBBox = getShapeBBox(other);

    // Check center alignment on each axis
    const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
    const axisIdx = { x: 0, y: 1, z: 2 } as const;

    for (const axis of axes) {
      const i = axisIdx[axis];
      const diff = Math.abs(movingBBox.center[i] - otherBBox.center[i]);
      if (diff < 0.05) {
        // Perfectly aligned
        const from: [number, number, number] = [...movingBBox.center] as [number, number, number];
        const to: [number, number, number] = [...otherBBox.center] as [number, number, number];
        guides.push({ from, to, axis, type: 'alignment' });
      }
    }

    // Edge alignment
    for (let i = 0; i < 3; i++) {
      const axis = axes[i];
      // Min-to-min
      if (Math.abs(movingBBox.min[i] - otherBBox.min[i]) < 0.05) {
        const from: [number, number, number] = [...movingBBox.center] as [number, number, number];
        const to: [number, number, number] = [...otherBBox.center] as [number, number, number];
        from[i] = movingBBox.min[i];
        to[i] = otherBBox.min[i];
        guides.push({ from, to, axis, type: 'alignment' });
      }
      // Max-to-max
      if (Math.abs(movingBBox.max[i] - otherBBox.max[i]) < 0.05) {
        const from: [number, number, number] = [...movingBBox.center] as [number, number, number];
        const to: [number, number, number] = [...otherBBox.center] as [number, number, number];
        from[i] = movingBBox.max[i];
        to[i] = otherBBox.max[i];
        guides.push({ from, to, axis, type: 'alignment' });
      }
    }
  }

  return guides;
}
