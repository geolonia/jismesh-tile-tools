import assert from "node:assert";
import { describe, test } from "node:test";

import {
  MeshcodeSubmesh,
  MESHCODE_13_100M_10M,
  MESHCODE_15_5M_1M,
} from "./meshcode_submesh.mjs";

describe('MeshcodeSubmesh', () => {
  test('#fromString (15-character code)', () => {
    const meshcode = '544050242150057';
    const mesh = MeshcodeSubmesh.fromString(meshcode);

    assert.strictEqual(mesh.kind, MESHCODE_15_5M_1M);
    assert.strictEqual(mesh.mesh3, '54405024');
    assert.strictEqual(mesh.submeshFlag, '2');
    assert.strictEqual(mesh.submeshCodeX, 57);
    assert.strictEqual(mesh.submeshCodeY, 150);

    assert.strictEqual(mesh.submeshSubdivision.name, '1/200');

    assert.strictEqual(mesh.toString(), meshcode);
  });

  test('#fromString (13-character code)', () => {
    const meshcode = '5439373731833';
    const mesh = MeshcodeSubmesh.fromString(meshcode);

    assert.strictEqual(mesh.kind, MESHCODE_13_100M_10M);
    assert.strictEqual(mesh.mesh3, '54393737');
    assert.strictEqual(mesh.submeshFlag, '3');
    assert.strictEqual(mesh.submeshCodeX, 33);
    assert.strictEqual(mesh.submeshCodeY, 18);

    assert.strictEqual(mesh.submeshSubdivision.name, '1/40');

    assert.strictEqual(mesh.toString(), meshcode);
  });

  test('.toParent() 544050242150057', () => {
    const mesh = MeshcodeSubmesh.fromString('544050242150057');
    let lastMesh = mesh;
    const meshStrs = [];
    const names = [];
    while (lastMesh) {
      meshStrs.push(lastMesh.toString());
      names.push(lastMesh.submeshSubdivision.name);
      lastMesh = lastMesh.toParent();
    }
    assert.deepStrictEqual(meshStrs, [
      '544050242150057',
      '5440502477528',
      '5440502463714',
      '5440502451807',
      '54405024323',
      '5440502432',
      '544050243',
      '54405024',
    ]);
    assert.deepStrictEqual(names, [
      '1/200',
      '1/100',
      '1/50',
      '1/25',
      '1/8',
      '1/4',
      '1/2',
      '1/1',
    ]);
  });

  test('.toParent() 5439373731833', () => {
    const mesh = MeshcodeSubmesh.fromString('5439373731833');
    let lastMesh = mesh;
    const meshStrs = [];
    const names = [];
    while (lastMesh) {
      meshStrs.push(lastMesh.toString());
      names.push(lastMesh.submeshSubdivision.name);
      lastMesh = lastMesh.toParent();
    }
    assert.deepStrictEqual(meshStrs, [
      '5439373731833',
      '5439373720916',
      '5439373710408',
    ]);
    assert.deepStrictEqual(names, [
      '1/40',
      '1/20',
      '1/10',
    ]);
  });

});
