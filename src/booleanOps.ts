import * as THREE from 'three';
import { CSG } from 'three-csg-ts';
import { createShapeGeometry, getEffectiveRotation, serializeGeometry } from './geometryUtils';
import { ShapeData, ShapeType } from './types';

const BOOLEAN_SUPPORTED_TYPES = new Set<ShapeType>([
  'box',
  'sphere',
  'cylinder',
  'cone',
  'torus',
  'pyramid',
  'capsule',
  'octahedron',
  'dodecahedron',
  'prism',
  'icosahedron',
  'tetrahedron',
  'torusKnot',
  'star',
  'heart',
  'arrow',
  'cross',
  'pipe',
  'elbowPipe',
  'roundRoof',
  'paraboloid',
  'roundedStairs',
  'drawing',
  'customMesh',
]);

const WORK_MATERIAL = new THREE.MeshStandardMaterial({ color: '#ffffff' });

function randomId() {
  return Math.random().toString(36).slice(2, 11);
}

export function isBooleanShapeSupported(shape: ShapeData) {
  return BOOLEAN_SUPPORTED_TYPES.has(shape.type);
}

function shapeToMesh(shape: ShapeData) {
  const geometry = createShapeGeometry(shape);
  const mesh = new THREE.Mesh(geometry, WORK_MATERIAL);
  mesh.position.set(...shape.position);
  mesh.rotation.set(...getEffectiveRotation(shape));
  mesh.scale.set(...shape.scale);
  mesh.updateMatrix();
  mesh.updateMatrixWorld(true);
  return mesh;
}

function toTuple(vector: THREE.Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

export function subtractShapes(solids: ShapeData[], holes: ShapeData[]) {
  return solids.map((solid) => {
    let currentMesh: THREE.Mesh = shapeToMesh(solid);

    holes.forEach((hole) => {
      const holeMesh = shapeToMesh(hole);
      currentMesh = CSG.subtract(currentMesh, holeMesh);
      currentMesh.updateMatrix();
      currentMesh.updateMatrixWorld(true);
    });

    const geometry = currentMesh.geometry.clone();
    geometry.applyMatrix4(currentMesh.matrix);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    const bbox = geometry.boundingBox;
    const positionAttr = geometry.getAttribute('position');
    if (!bbox || !positionAttr || positionAttr.count === 0) {
      return null;
    }

    const center = bbox.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeBoundingBox();

    const serialized = serializeGeometry(geometry);

    return {
      ...solid,
      id: randomId(),
      type: 'customMesh' as const,
      position: toTuple(center),
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      isHole: false,
      cutEnabled: false,
      cutAxis: 'x' as const,
      cutOffset: 0,
      cutInvert: false,
      drawPoints: undefined,
      text: undefined,
      imageUrl: undefined,
      geometryData: serialized.geometryData,
      geometryBounds: serialized.geometryBounds,
    };
  }).filter(Boolean) as ShapeData[];
}
