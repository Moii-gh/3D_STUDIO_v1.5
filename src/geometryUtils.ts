import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeometryBounds, GeometryData, ShapeData } from './types';

const starShape = new THREE.Shape();
const outerRadius = 0.5;
const innerRadius = 0.25;
const spikes = 5;
for (let i = 0; i < spikes * 2; i++) {
  const radius = i % 2 === 0 ? outerRadius : innerRadius;
  const angle = (i / (spikes * 2)) * Math.PI * 2;
  if (i === 0) {
    starShape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  } else {
    starShape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
}
starShape.closePath();

const heartShape = new THREE.Shape();
heartShape.moveTo(0, 0.25);
heartShape.quadraticCurveTo(0.25, 0.5, 0.5, 0.25);
heartShape.quadraticCurveTo(0.5, 0, 0, -0.5);
heartShape.quadraticCurveTo(-0.5, 0, -0.5, 0.25);
heartShape.quadraticCurveTo(-0.25, 0.5, 0, 0.25);

const arrowShape = new THREE.Shape();
arrowShape.moveTo(0, 0.5);
arrowShape.lineTo(0.5, 0);
arrowShape.lineTo(0.2, 0);
arrowShape.lineTo(0.2, -0.5);
arrowShape.lineTo(-0.2, -0.5);
arrowShape.lineTo(-0.2, 0);
arrowShape.lineTo(-0.5, 0);
arrowShape.closePath();

const crossShape = new THREE.Shape();
crossShape.moveTo(0.15, 0.5);
crossShape.lineTo(0.15, 0.15);
crossShape.lineTo(0.5, 0.15);
crossShape.lineTo(0.5, -0.15);
crossShape.lineTo(0.15, -0.15);
crossShape.lineTo(0.15, -0.5);
crossShape.lineTo(-0.15, -0.5);
crossShape.lineTo(-0.15, -0.15);
crossShape.lineTo(-0.5, -0.15);
crossShape.lineTo(-0.5, 0.15);
crossShape.lineTo(-0.15, 0.15);
crossShape.lineTo(-0.15, 0.5);
crossShape.closePath();

const extrudeSettings = {
  depth: 0.2,
  bevelEnabled: true,
  bevelSegments: 2,
  steps: 1,
  bevelSize: 0.02,
  bevelThickness: 0.02,
};

const roundedStairsGeometry = (() => {
  const geometries: THREE.BufferGeometry[] = [];
  const steps = 16;
  const innerR = 0.15;
  const outerR = 0.5;
  const totalHeight = 1;
  const stepHeight = totalHeight / steps;
  const angleStep = (Math.PI * 2 * 0.8) / steps;

  for (let i = 0; i < steps; i++) {
    const stepShape = new THREE.Shape();
    const overlapAngle = (angleStep * 1.5) / 2;
    stepShape.absarc(0, 0, outerR, -overlapAngle, overlapAngle, false);
    stepShape.absarc(0, 0, innerR, overlapAngle, -overlapAngle, true);

    const stepGeo = new THREE.ExtrudeGeometry(stepShape, {
      depth: stepHeight * 1.2,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.005,
      bevelThickness: 0.005,
    });

    stepGeo.rotateX(-Math.PI / 2);
    stepGeo.rotateY(-(i * angleStep));
    stepGeo.translate(0, (i * stepHeight) - (totalHeight / 2) + (stepHeight / 2), 0);
    geometries.push(stepGeo);
  }

  const merged = BufferGeometryUtils.mergeGeometries(geometries);
  merged.computeVertexNormals();
  return merged;
})();

export function getEffectiveRotation(shape: ShapeData): [number, number, number] {
  if (shape.type === 'roundRoof') {
    return [shape.rotation[0], shape.rotation[1], shape.rotation[2] + Math.PI / 2];
  }
  return shape.rotation;
}

export function geometryFromData(data: GeometryData) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));

  if (data.normals?.length) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  }

  if (data.uvs?.length) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
  }

  if (data.indices?.length) {
    geometry.setIndex(data.indices);
  }

  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox();
  return geometry;
}

export function createShapeGeometry(shape: ShapeData) {
  switch (shape.type) {
    case 'box':
      return new THREE.BoxGeometry();
    case 'sphere':
      return new THREE.SphereGeometry(0.5, 32, 32);
    case 'cylinder':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    case 'cone':
      return new THREE.ConeGeometry(0.5, 1, 32);
    case 'torus':
      return new THREE.TorusGeometry(0.4, 0.15, 16, 100);
    case 'pyramid':
      return new THREE.ConeGeometry(0.5, 1, 4);
    case 'capsule':
      return new THREE.CapsuleGeometry(0.3, 0.5, 4, 16);
    case 'octahedron':
      return new THREE.OctahedronGeometry(0.5);
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(0.5);
    case 'prism':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 3);
    case 'hexPrism':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, false, Math.PI / 6);
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(0.5, 0);
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(0.5, 0);
    case 'torusKnot':
      return new THREE.TorusKnotGeometry(0.3, 0.1, 64, 16);
    case 'ring':
      return new THREE.RingGeometry(0.2, 0.5, 32);
    case 'plane':
    case 'image':
      return new THREE.PlaneGeometry(1, 1);
    case 'circle':
      return new THREE.CircleGeometry(0.5, 32);
    case 'star':
      return new THREE.ExtrudeGeometry(starShape, extrudeSettings);
    case 'heart':
      return new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
    case 'arrow':
      return new THREE.ExtrudeGeometry(arrowShape, extrudeSettings);
    case 'cross':
      return new THREE.ExtrudeGeometry(crossShape, extrudeSettings);
    case 'hemisphere':
      return new THREE.SphereGeometry(0.5, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    case 'pipe': {
      const outer = new THREE.Shape();
      outer.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, 0.35, 0, Math.PI * 2, true);
      outer.holes.push(hole);
      return new THREE.ExtrudeGeometry(outer, { depth: 1, bevelEnabled: false });
    }
    case 'elbowPipe':
      return new THREE.TorusGeometry(0.35, 0.15, 16, 64, Math.PI / 2);
    case 'roundRoof':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 1, false, 0, Math.PI);
    case 'roundedStairs':
      return roundedStairsGeometry.clone();
    case 'paraboloid': {
      const points: THREE.Vector2[] = [];
      for (let i = 0; i <= 10; i++) {
        const x = (i / 10) * 0.5;
        const y = (x * x) * 2;
        points.push(new THREE.Vector2(x, y));
      }
      return new THREE.LatheGeometry(points, 32);
    }
    case 'drawing': {
      if (!shape.drawPoints || shape.drawPoints.length < 3) {
        return new THREE.BoxGeometry();
      }
      const drawShape = new THREE.Shape();
      drawShape.moveTo(shape.drawPoints[0][0], shape.drawPoints[0][1]);
      for (let i = 1; i < shape.drawPoints.length; i++) {
        drawShape.lineTo(shape.drawPoints[i][0], shape.drawPoints[i][1]);
      }
      drawShape.closePath();
      return new THREE.ExtrudeGeometry(drawShape, {
        depth: 0.3,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.015,
        bevelThickness: 0.015,
      });
    }
    case 'customMesh':
      return shape.geometryData ? geometryFromData(shape.geometryData) : new THREE.BoxGeometry();
    case 'text':
      return new THREE.BoxGeometry(1, 0.5, 0.1);
    default:
      return new THREE.BoxGeometry();
  }
}

function toVec3Tuple(vector: THREE.Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

export function serializeGeometry(geometry: THREE.BufferGeometry): { geometryData: GeometryData; geometryBounds: GeometryBounds } {
  const cloned = geometry.clone();
  cloned.computeBoundingBox();
  if (!cloned.getAttribute('normal')) {
    cloned.computeVertexNormals();
  }

  const position = cloned.getAttribute('position');
  const normal = cloned.getAttribute('normal');
  const uv = cloned.getAttribute('uv');
  const bbox = cloned.boundingBox ?? new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));

  return {
    geometryData: {
      positions: Array.from(position.array as Iterable<number>),
      normals: normal ? Array.from(normal.array as Iterable<number>) : undefined,
      uvs: uv ? Array.from(uv.array as Iterable<number>) : undefined,
      indices: cloned.index ? Array.from(cloned.index.array as Iterable<number>) : undefined,
    },
    geometryBounds: {
      min: toVec3Tuple(bbox.min),
      max: toVec3Tuple(bbox.max),
    },
  };
}
