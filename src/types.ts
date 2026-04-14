export type ShapeType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'pyramid' | 'capsule' | 'octahedron' | 'dodecahedron' | 'prism' | 'icosahedron' | 'tetrahedron' | 'torusKnot' | 'ring' | 'plane' | 'circle' | 'star' | 'heart' | 'arrow' | 'cross' | 'text' | 'image' | 'hemisphere' | 'pipe' | 'roundRoof' | 'paraboloid' | 'roundedStairs' | 'drawing';

export interface ShapeData {
  id: string;
  type: ShapeType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  opacity?: number;
  text?: string;
  imageUrl?: string;
  groupId?: string;
  drawPoints?: [number, number][];
}

export interface GroupData {
  id: string;
  name: string;
  collapsed: boolean;
}
