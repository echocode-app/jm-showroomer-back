import ngeohash from "ngeohash";
import { badRequest } from "../../../../core/error.js";

export const DEFAULT_NEAR_RADIUS_KM = 10;
export const MAX_NEAR_RADIUS_KM = 200;

function hasNearbyParams(filters = {}) {
  return (
    filters.nearLat !== undefined ||
    filters.nearLng !== undefined ||
    filters.nearRadiusKm !== undefined
  );
}

function parseFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNearbyCenter(filters = {}) {
  if (!hasNearbyParams(filters)) return null;

  if (filters.nearLat === undefined || filters.nearLng === undefined) {
    throw badRequest("QUERY_INVALID");
  }

  const lat = parseFiniteNumber(filters.nearLat);
  const lng = parseFiniteNumber(filters.nearLng);
  if (lat === null || lng === null) {
    throw badRequest("QUERY_INVALID");
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw badRequest("QUERY_INVALID");
  }

  let radiusKm = DEFAULT_NEAR_RADIUS_KM;
  if (filters.nearRadiusKm !== undefined && filters.nearRadiusKm !== "") {
    radiusKm = parseFiniteNumber(filters.nearRadiusKm);
    if (radiusKm === null) throw badRequest("QUERY_INVALID");
  }
  if (radiusKm <= 0 || radiusKm > MAX_NEAR_RADIUS_KM) {
    throw badRequest("QUERY_INVALID");
  }

  return { lat, lng, radiusKm };
}

function precisionForRadiusKm(radiusKm) {
  // Coarser precision for larger radius keeps query fan-out bounded (center + 8 neighbors).
  if (radiusKm <= 0.2) return 7;
  if (radiusKm <= 1) return 6;
  if (radiusKm <= 5) return 5;
  if (radiusKm <= 20) return 4;
  if (radiusKm <= 80) return 3;
  return 2;
}

export function buildNearbyGeohashPrefixes(filters = {}) {
  const center = parseNearbyCenter(filters);
  if (!center) return [];

  const precision = precisionForRadiusKm(center.radiusKm);
  const centerHash = ngeohash.encode(center.lat, center.lng, precision);
  const neighbors = ngeohash.neighbors(centerHash);

  // 3x3 geohash bucket around the center gives an approximate "nearby" area without distance sorting.
  return Array.from(new Set([centerHash, ...neighbors].map(v => String(v).toLowerCase())));
}
