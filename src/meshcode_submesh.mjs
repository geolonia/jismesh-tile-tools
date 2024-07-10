import { japanmesh } from 'japanmesh';
import { center as turfCenter } from '@turf/center';

export const MESHCODE_13_100M_10M = Symbol.for('MESHCODE_13_100M_10M');
export const MESHCODE_15_5M_1M = Symbol.for('MESHCODE_15_5M_1M');

const _submeshToMeshcode = (targetResolution) => (submesh) => {
  const center = turfCenter(submesh.toGeoJSON());
  const [lng, lat] = center.geometry.coordinates;
  return Meshcode.fromLatLng(lat, lng, targetResolution);
};

const MESHCODE_FLAG_MAPS = new Map([
  [
    MESHCODE_13_100M_10M,
    new Map([
      ['1', { name: '1/10',  size: '100',  y: 3.0,   x: 4.5    , parent: null}],
      ['2', { name: '1/20',  size: '50',   y: 1.5,   x: 2.25   , parent: '1' }],
      ['5', { name: '1/25',  size: '40',   y: 1.2,   x: 1.8    , parent: _submeshToMeshcode(125) }],
      ['3', { name: '1/40',  size: '25',   y: 0.75,  x: 1.125  , parent: '2' }],
      ['6', { name: '1/50',  size: '20',   y: 0.6,   x: 0.9    , parent: '5' }],
      ['4', { name: '1/80',  size: '12.5', y: 0.375, x: 0.5625 , parent: '3' }],
      ['7', { name: '1/100', size: '10',   y: 0.3,   x: 0.45   , parent: '6' }],
    ]),
  ],
  [
    MESHCODE_15_5M_1M,
    new Map([
      ['2', { name: '1/200', size: '5',   y: 0.15,  x: 0.225   , parent: '7' , parentKind: MESHCODE_13_100M_10M }],
      ['5', { name: '1/250', size: '4',   y: 0.12,  x: 0.18    , parent: null}],
      ['3', { name: '1/400', size: '2.5', y: 0.075, x: 0.1125  , parent: '2' }],
      ['6', { name: '1/500', size: '2',   y: 0.06,  x: 0.09    , parent: '5' }],
      ['4', { name: '1/800', size: '1.25',y: 0.0375,x: 0.05625 , parent: '3' }],
      ['7', { name: '1/1000',size: '1',   y: 0.03,  x: 0.045   , parent: '6' }],
    ]),
  ],
]);

// 浸水想定区域図データ電子化ガイドライン
// https://www.mlit.go.jp/common/001097667.pdf
function detectMeshcodeKind(meshcode) {
  if (meshcode.length === 13) {
    return MESHCODE_13_100M_10M;
  } else if (meshcode.length === 15) {
    return MESHCODE_15_5M_1M;
  } else {
    throw new Error('Invalid meshcode length');
  }
}

export class Meshcode {
  constructor(input) {
    this.meshcode = input;
    this.level = japanmesh.getLevel(input);
    this.submeshSubdivision = {
      name: `1/${1000 / this.level}`,
      size: this.level.toFixed(0),
    }
  }

  static fromString(meshcode) {
    return new Meshcode(meshcode);
  }

  static fromLatLng(lat, lng, precision = 125) {
    return new Meshcode(japanmesh.toCode(lat, lng, precision));
  }

  toString() {
    return this.meshcode;
  }

  toParent() {
    const c = this.meshcode;
    if (c.length <= 8) return null; // 3次メッシュより上位のメッシュは対象外
    if (c.length > 11) throw new Error('Invalid meshcode length');
    // 最後の1桁を削除
    const parentMeshcode = c.slice(0, -1);
    return new Meshcode(parentMeshcode);
  }

  toGeoJSON() {
    return japanmesh.toGeoJSON(this.meshcode).geometry;
  }
}

export class MeshcodeSubmesh {
  constructor(input) {
    this.kind = input.kind;
    this.mesh3 = input.mesh3;
    this.submeshFlag = input.submeshFlag;
    this.submeshCodeX = parseInt(input.submeshCodeX, 10);
    this.submeshCodeY = parseInt(input.submeshCodeY, 10);
  }

  static fromString(meshcode) {
    const kind = detectMeshcodeKind(meshcode);
    const submeshCode = meshcode.slice(9);
    return new MeshcodeSubmesh({
      kind,
      mesh3: meshcode.slice(0, 8),
      submeshFlag: meshcode.slice(8, 9),
      submeshCodeY: submeshCode.slice(0, submeshCode.length / 2),
      submeshCodeX: submeshCode.slice(submeshCode.length / 2),
    });
  }

  toString() {
    const xyLen = this.kind === MESHCODE_13_100M_10M ? 2 : 3;
    return (
      this.mesh3 +
      this.submeshFlag +
      this.submeshCodeY.toFixed(0).padStart(xyLen, "0") +
      this.submeshCodeX.toFixed(0).padStart(xyLen, "0")
    );
  }

  get submeshSubdivision() {
    const flagMap = MESHCODE_FLAG_MAPS.get(this.kind);
    const subdivisionSettings = flagMap.get(this.submeshFlag);
    if (!subdivisionSettings) {
      throw new Error('Invalid submeshFlag');
    }
    return subdivisionSettings;
  }

  toParent() {
    const s = this.submeshSubdivision;
    if (!s.parent) {
      return null;
    }
    if (typeof s.parent === 'function') {
      return s.parent(this);
    }
    return new MeshcodeSubmesh({
      kind: s.parentKind || this.kind,
      mesh3: this.mesh3,
      submeshFlag: s.parent,
      submeshCodeX: Math.floor(this.submeshCodeX / 2),
      submeshCodeY: Math.floor(this.submeshCodeY / 2),
    });
  }

  toGeoJSON() {
    const bounds = japanmesh.toLatLngBounds(this.mesh3);
    const submesh = this.submeshSubdivision;
    const yDiff = submesh.y / 3600;
    const xDiff = submesh.x / 3600;
    const southBound = bounds.getSouthWest().lat + yDiff * this.submeshCodeY;
    const westBound = bounds.getSouthWest().lng + xDiff * this.submeshCodeX;
    const northBound = bounds.getSouthWest().lat + yDiff * (this.submeshCodeY + 1);
    const eastBound = bounds.getSouthWest().lng + xDiff * (this.submeshCodeX + 1);

    return {
      "type": "Polygon",
      "coordinates": [[
        [westBound, southBound],
        [eastBound, southBound],
        [eastBound, northBound],
        [westBound, northBound],
        [westBound, southBound]
      ]]
    };
  }
}
