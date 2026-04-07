export type ShapeType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'pyramid' | 'capsule' | 'octahedron' | 'dodecahedron' | 'prism' | 'icosahedron' | 'tetrahedron' | 'torusKnot' | 'ring' | 'plane' | 'circle' | 'star' | 'heart' | 'arrow' | 'cross' | 'text';

export interface ShapeData {
  id: string;
  type: ShapeType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  text?: string;
  groupId?: string;
}

export interface GroupData {
  id: string;
  name: string;
  collapsed: boolean;
}
