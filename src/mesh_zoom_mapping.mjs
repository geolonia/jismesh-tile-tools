const EARTH_CIRCUMFERENCE = 40075016.686;
const DEFAULT_TILE_SIZE = 256;

function calculateZoomLevel(resolution, tileSize = DEFAULT_TILE_SIZE, scalingFactor = 1.0) {
  return Math.log2(EARTH_CIRCUMFERENCE / (resolution * tileSize * scalingFactor));
}

function mapResolutionsToZoomLevels(resolutions, tileSize = DEFAULT_TILE_SIZE, scalingFactor = 1.0) {
  const zoomLevels = new Map();
  resolutions.forEach(res => {
    const zoomLevel = Math.round(calculateZoomLevel(res, tileSize, scalingFactor));
    zoomLevels.set(res, zoomLevel);
  });
  return zoomLevels;
}

function assignMinMaxZoomLevels(zoomLevels) {
  const minMaxZoom = new Map();
  const sortedRes = Array.from(zoomLevels.entries()).sort((a, b) => b[1] - a[1]);
  sortedRes.forEach((item, index) => {
    const [res, zoom] = item;
    if (index === 0) {
      minMaxZoom.set(res, { minzoom: zoom, maxzoom: zoom });
    } else {
      minMaxZoom.set(res, { minzoom: zoom, maxzoom: sortedRes[index - 1][1] - 1 });
    }
  });
  // Ensure the least detailed data has a minzoom of 0
  const leastDetailedRes = sortedRes[sortedRes.length - 1][0];
  minMaxZoom.get(leastDetailedRes).minzoom = 0;
  return minMaxZoom;
}

export function resolutionsToMinMaxZoomLevels(resolutions, tileSize = DEFAULT_TILE_SIZE, scalingFactor = 1.0) {
  const zoomLevels = mapResolutionsToZoomLevels(resolutions, tileSize, scalingFactor);
  return assignMinMaxZoomLevels(zoomLevels);
}
