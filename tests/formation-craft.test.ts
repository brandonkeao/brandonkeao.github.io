import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

type FakeGradient = { addColorStop(): void };
type FakeContext = {
  createRadialGradient(): FakeGradient;
  fillStyle: string;
  fillRect(): void;
};

const context: FakeContext = {
  createRadialGradient: () => ({ addColorStop() {} }),
  fillStyle: '',
  fillRect() {},
};

Object.assign(globalThis, {
  document: {
    createElement(tag: string) {
      assert.equal(tag, 'canvas');
      return { width: 0, height: 0, getContext: () => context };
    },
  },
});

const { makeCraftKit } = await import('../src/lib/orbit/formation-craft.ts');

function point(x: number, y: number, z: number) {
  return new THREE.Vector3(x, y, z);
}

function bufferData(line: THREE.Object3D & { geometry: THREE.BufferGeometry }) {
  const start = line.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
  const color = line.geometry.getAttribute('instanceColorStart') as THREE.InterleavedBufferAttribute;
  return { positions: start.data, colors: color.data };
}

function closeTo(actual: ArrayLike<number>, expected: number[]) {
  assert.equal(actual.length, expected.length);
  expected.forEach((value, index) => {
    assert.ok(Math.abs(actual[index] - value) < 1e-6, `index ${index}: ${actual[index]} != ${value}`);
  });
}

test('dynamic trails reuse geometry and same-size buffers while preserving Line2 segments', () => {
  const parent = new THREE.Group();
  const kit = makeCraftKit(parent, new THREE.PerspectiveCamera());
  const line = kit.trail();
  const color = new THREE.Color(1, 0.5, 0.25);
  const first = [point(1, 2, 3), point(4, 5, 6), point(7, 8, 9)];

  kit.setTrail(line, first, color, 1, 1);
  const geometry = line.geometry;
  const initial = bufferData(line);
  const initialPositionVersion = initial.positions.version;
  const initialColorVersion = initial.colors.version;
  let disposeCount = 0;
  geometry.addEventListener('dispose', () => disposeCount++);

  assert.equal(line.visible, true);
  assert.equal(geometry.instanceCount, 2);
  closeTo(initial.positions.array, [1, 2, 3, 4, 5, 6, 4, 5, 6, 7, 8, 9]);
  closeTo(initial.colors.array, [1, 0.5, 0.25, 0.5, 0.25, 0.125, 0.5, 0.25, 0.125, 0, 0, 0]);

  const second = [point(-1, -2, -3), point(10, 11, 12), point(13, 14, 15)];
  kit.setTrail(line, second, color, 0.8, 1);
  const repeated = bufferData(line);

  assert.equal(line.geometry, geometry);
  assert.equal(repeated.positions, initial.positions);
  assert.equal(repeated.colors, initial.colors);
  assert.ok(repeated.positions.version > initialPositionVersion);
  assert.ok(repeated.colors.version > initialColorVersion);
  assert.equal(disposeCount, 0);
  closeTo(repeated.positions.array, [-1, -2, -3, 10, 11, 12, 10, 11, 12, 13, 14, 15]);
  closeTo(repeated.colors.array, [0.8, 0.4, 0.2, 0.4, 0.2, 0.1, 0.4, 0.2, 0.1, 0, 0, 0]);

  kit.setTrail(line, [], color, 1);
  assert.equal(line.visible, false);
  assert.equal(line.geometry, geometry);
  assert.equal(bufferData(line).positions, initial.positions);

  kit.setTrail(line, second, color, 0);
  assert.equal(line.visible, false);
  assert.equal(bufferData(line).positions, initial.positions);

  kit.setTrail(line, second, color, 0.6, 1);
  assert.equal(line.visible, true);
  assert.equal(bufferData(line).positions, initial.positions);

  kit.setTrail(line, [...second, point(16, 17, 18)], color, 0.5, 1);
  const grownGeometry = line.geometry;
  const grown = bufferData(line);
  let grownDisposeCount = 0;
  grownGeometry.addEventListener('dispose', () => grownDisposeCount++);
  assert.notEqual(grownGeometry, geometry);
  assert.equal(disposeCount, 1);
  assert.notEqual(grown.positions, initial.positions);
  assert.notEqual(grown.colors, initial.colors);
  assert.equal(grownGeometry.instanceCount, 3);
  closeTo(grown.positions.array, [
    -1, -2, -3, 10, 11, 12,
    10, 11, 12, 13, 14, 15,
    13, 14, 15, 16, 17, 18,
  ]);

  kit.setTrail(line, [point(2, 3, 4), point(5, 6, 7)], color, 0.25, 1);
  const shrunkGeometry = line.geometry;
  const shrunk = bufferData(line);
  let shrunkDisposeCount = 0;
  shrunkGeometry.addEventListener('dispose', () => shrunkDisposeCount++);
  assert.notEqual(shrunkGeometry, grownGeometry);
  assert.equal(grownDisposeCount, 1);
  assert.notEqual(shrunk.positions, grown.positions);
  assert.equal(shrunkGeometry.instanceCount, 1);
  closeTo(shrunk.positions.array, [2, 3, 4, 5, 6, 7]);
  closeTo(shrunk.colors.array, [0.25, 0.125, 0.0625, 0, 0, 0]);

  kit.dispose();
  assert.equal(disposeCount, 1);
  assert.equal(grownDisposeCount, 1);
  assert.equal(shrunkDisposeCount, 1);
  assert.equal(line.parent, null);
});
