import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { parse } from 'csv-parse';
import iconv from 'iconv-lite';
import { BigMap } from 'big-associative';

import { Meshcode, MeshcodeSubmesh } from './meshcode_submesh.mjs';
import { resolutionsToMinMaxZoomLevels } from './mesh_zoom_mapping.mjs';

(async () => {
  const argv = process.argv.slice(2);
  const inputs = argv.slice(0, -1);
  const output = argv.slice(-1)[0];

  const outputBasename = path.basename(output, path.extname(output));
  const outputDirname = path.dirname(output);

  const meshIndex = new Map();

  // const outF = await fs.promises.open(output, 'w+');

  let baseMeshResolution;
  const parseOneFile = async (input) => {
    const parser = fs.createReadStream(input)
      .pipe(iconv.decodeStream('Shift_JIS'))
      .pipe(parse({
        from_line: 3,
        columns: true
      }));
    console.log('Processing', input);
    console.time(input);

    for await (const record of parser) {
      const meshcode = record['メッシュコード'].trim();

      const mesh = MeshcodeSubmesh.fromString(meshcode);
      if (!baseMeshResolution) {
        baseMeshResolution = mesh.submeshSubdivision.size;
      }
      const idxKeys = [];
      // because we are going to be merging multiple files, it could be that different files have the same
      // meshcode but different data, so we need to aggregate them.
      let lastMesh = mesh;
      while (lastMesh) {
        const idxKey = lastMesh.submeshSubdivision.size;
        idxKeys.push([idxKey, lastMesh.toString()]);
        lastMesh = lastMesh.toParent();
      }
      for (const [idxKey, aggKey] of idxKeys) {
        let idx = meshIndex.get(idxKey);
        if (!idx) {
          idx = new BigMap();
          meshIndex.set(idxKey, idx);
        }
        let aggItems = idx.get(aggKey);
        if (!aggItems) {
          aggItems = [];
          idx.set(aggKey, aggItems);
        }
        aggItems.push([
          record['標高'],
          record['浸水深'],
        ]);
      }
    }
    console.timeEnd(input);
  }

  for (const input of inputs) {
    await parseOneFile(input);
  }

  const meshIndexGeoJSONs = new Map();

  const intermediateMBTilesFiles = [];

  for (const [idxKey, idx] of meshIndex.entries()) {
    const meshgeojson = path.join(outputDirname, `${outputBasename}.${idxKey}.ndgeojson`);
    const meshF = await fs.promises.open(meshgeojson, 'w+');
    console.log('Creating aggregated mesh geojson for', idxKey);
    console.time(`${idxKey} aggregation`);
    for (const [meshcode, entries] of idx.entries()) {
      const mesh = ( meshcode.length <= 11 ?
        Meshcode.fromString(meshcode) :
        MeshcodeSubmesh.fromString(meshcode)
      );
      const properties = {
        "メッシュ": mesh.submeshSubdivision.size,
        "標高": entries.reduce((acc, entry) => Math.max(acc, parseFloat(entry[0])), -Infinity),
        "浸水深": entries.reduce((acc, entry) => Math.max(acc, parseFloat(entry[1])), -Infinity),
        // "流速": entries.reduce((acc, entry) => Math.max(acc, parseFloat(entry["流速"])), -Infinity),
      };
      await meshF.write(JSON.stringify({
        "id": parseInt(meshcode, 10),
        "type": "Feature",
        "geometry": mesh.toGeoJSON(),
        "properties": properties,
      }) + '\n');
    }
    await meshF.sync();
    await meshF.close();
    console.timeEnd(`${idxKey} aggregation`);

    meshIndexGeoJSONs.set(idxKey, meshgeojson);
  }

  const resolutions = Array.from(meshIndexGeoJSONs.keys());
  const minMaxZoomLevels = resolutionsToMinMaxZoomLevels(resolutions, 128);

  for (const [idxKey, meshgeojson] of meshIndexGeoJSONs.entries()) {
    const meshMBTiles = path.join(outputDirname, `${outputBasename}.${idxKey}.mbtiles`);
    await fs.promises.rm(meshMBTiles, { force: true });
    const mmZ = minMaxZoomLevels.get(idxKey);
    execSync(`tippecanoe -Z${mmZ.minzoom} -z${mmZ.maxzoom} --no-tile-size-limit --no-feature-limit -ai -o ${meshMBTiles} -l bousaimap -P ${meshgeojson}`);
    intermediateMBTilesFiles.push(meshMBTiles);
  }

  console.time('join');
  const mainOutputMBTiles = path.join(outputDirname, `${outputBasename}.mbtiles`);
  await fs.promises.rm(mainOutputMBTiles, { force: true });
  execSync(`tile-join --no-tile-size-limit -o ${mainOutputMBTiles} ${intermediateMBTilesFiles.join(' ')}`);
  console.timeEnd('join');

  const mainOutputPMTiles = path.join(outputDirname, `${outputBasename}.pmtiles`);
  await fs.promises.rm(mainOutputPMTiles, { force: true });
  execSync(`pmtiles convert ${mainOutputMBTiles} ${mainOutputPMTiles}`)
})();
