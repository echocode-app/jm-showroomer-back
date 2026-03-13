import { badRequest } from "../../../core/error.js";
import { parseList, parseType } from "../list/parse/lists.js";
import {
    parseBrandFilter,
    parseCategoryGroups,
    parseSubcategories,
} from "../list/parse/filters.js";

const MIN_ZOOM = 0;
const MAX_ZOOM = 22;

function parseFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseLatitude(value) {
    const parsed = parseFiniteNumber(value);
    if (parsed === null || parsed < -90 || parsed > 90) {
        throw badRequest("QUERY_INVALID");
    }
    return parsed;
}

function parseLongitude(value) {
    const parsed = parseFiniteNumber(value);
    if (parsed === null || parsed < -180 || parsed > 180) {
        throw badRequest("QUERY_INVALID");
    }
    return parsed;
}

function parseZoom(value) {
    const parsed = parseFiniteNumber(value);
    if (parsed === null || parsed < MIN_ZOOM || parsed > MAX_ZOOM) {
        throw badRequest("QUERY_INVALID");
    }
    return parsed;
}

function normalizeCity(value) {
    if (value === undefined || value === null || value === "") return null;
    const normalized = String(value).trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized) throw badRequest("QUERY_INVALID");
    return normalized;
}

export function parseMapFilters(filters = {}) {
    const hasBounds = ["north", "south", "east", "west"].every(
        key => filters[key] !== undefined && filters[key] !== null && filters[key] !== ""
    );
    if (!hasBounds) {
        throw badRequest("QUERY_INVALID");
    }

    const north = parseLatitude(filters.north);
    const south = parseLatitude(filters.south);
    const east = parseLongitude(filters.east);
    const west = parseLongitude(filters.west);
    const zoom = parseZoom(filters.zoom);

    if (south > north) throw badRequest("QUERY_INVALID");
    // Dateline-crossing viewport is intentionally unsupported in MVP map contract.
    if (west > east) throw badRequest("QUERY_INVALID");

    const { brandKey, brandNormalized } = parseBrandFilter(filters);
    const type = parseType(filters.type);
    const categoryGroups = parseCategoryGroups(filters.categoryGroup);
    const subcategories = parseSubcategories(filters.subcategories);
    const categories = parseList(filters.categories);
    const cityNormalized = normalizeCity(filters.city);

    return {
        raw: filters,
        zoom,
        bounds: { north, south, east, west },
        center: {
            lat: (north + south) / 2,
            lng: (east + west) / 2,
        },
        cityNormalized,
        brandKey,
        brandNormalized,
        type,
        categoryGroups,
        subcategories,
        categories,
    };
}

