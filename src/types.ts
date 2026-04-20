export type ShapeType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'pyramid' | 'capsule' | 'octahedron' | 'dodecahedron' | 'prism' | 'hexPrism' | 'icosahedron' | 'tetrahedron' | 'torusKnot' | 'ring' | 'plane' | 'circle' | 'star' | 'heart' | 'arrow' | 'cross' | 'text' | 'image' | 'hemisphere' | 'pipe' | 'elbowPipe' | 'roundRoof' | 'paraboloid' | 'roundedStairs' | 'drawing' | 'customMesh';

export interface GeometryData {
  positions: number[];
  normals?: number[];
  uvs?: number[];
  indices?: number[];
}

export interface GeometryBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface ShapeData {
  id: string;
  type: ShapeType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  opacity?: number;
  cutEnabled?: boolean;
  cutAxis?: 'x' | 'y' | 'z';
  cutOffset?: number;
  cutInvert?: boolean;
  isHole?: boolean;
  text?: string;
  imageUrl?: string;
  groupId?: string;
  drawPoints?: [number, number][];
  geometryData?: GeometryData;
  geometryBounds?: GeometryBounds;
}

export interface GroupData {
  id: string;
  name: string;
  collapsed: boolean;
}
