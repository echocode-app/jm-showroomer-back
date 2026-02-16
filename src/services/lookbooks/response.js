import { assertAllowedPathForResource } from "../../utils/mediaValidation.js";
import { normalizeCountry } from "../../constants/countries.js";
import { getSignedReadUrl } from "../mediaService.js";
import { toIsoString } from "./firestoreQuery.js";

export function normalizeLookbook(doc = {}) {
    const title = firstNonEmpty(doc.title, doc.name);
    const description = firstNonEmpty(doc.description);
    const seasonKey = firstNonEmpty(doc.seasonKey)?.toLowerCase() ?? null;
    const country = firstNonEmpty(doc.country);
    const countryNormalized = firstNonEmpty(doc.countryNormalized)?.toLowerCase()
        ?? (country ? normalizeCountry(country) : null);

    const coverPath = firstNonEmpty(doc.coverPath, findLegacyCoverPath(doc));
    const images = normalizeImages(doc);
    const author = normalizeAuthor(doc);
    const items = normalizeItems(doc);

    return {
        ...doc,
        title,
        // Backward compatibility for existing clients that still read `name`.
        name: firstNonEmpty(doc.name, title),
        description,
        country,
        countryNormalized,
        city: firstNonEmpty(doc.city),
        cityNormalized: firstNonEmpty(doc.cityNormalized),
        seasonLabel: firstNonEmpty(doc.seasonLabel),
        seasonKey,
        author,
        items,
        coverPath,
        images,
        sortRank: Number.isFinite(doc.sortRank) ? Number(doc.sortRank) : null,
        publishedAt: toIsoString(doc.publishedAt)
            ?? toIsoString(doc.updatedAt)
            ?? toIsoString(doc.createdAt),
        createdAt: toIsoString(doc.createdAt),
        updatedAt: toIsoString(doc.updatedAt),
        published: doc.published === true,
    };
}

export async function attachCoverUrl(lookbook) {
    const safeCoverPath = getSafePath(lookbook.id, lookbook.coverPath);
    const coverUrl = safeCoverPath ? await getSignedReadUrl(safeCoverPath) : null;

    return {
        ...lookbook,
        coverUrl,
    };
}

export async function attachSignedImages(lookbook) {
    const withCover = await attachCoverUrl(lookbook);

    const images = await Promise.all(
        (withCover.images || []).map(async image => {
            const safePath = getSafePath(withCover.id, image.storagePath);
            return {
                ...image,
                url: safePath ? await getSignedReadUrl(safePath) : null,
            };
        })
    );

    return {
        ...withCover,
        images,
    };
}

function normalizeImages(doc) {
    // Priority: modern images[] schema, then legacy assets/pages fallback.
    const primary = Array.isArray(doc.images)
        ? doc.images
            .map((image, index) => ({
                storagePath: firstNonEmpty(image?.storagePath, image?.path),
                order: Number.isFinite(image?.order) ? Number(image.order) : index + 1,
            }))
            .filter(image => Boolean(image.storagePath))
        : [];

    const legacyAssets = primary.length > 0
        ? []
        : Array.isArray(doc.assets)
            ? doc.assets
                .filter(asset => asset?.kind !== "cover")
                .map((asset, index) => ({
                    storagePath: firstNonEmpty(asset?.storagePath, asset?.path),
                    order: Number.isFinite(asset?.order) ? Number(asset.order) : index + 1,
                }))
            : [];

    const legacyPages = primary.length > 0 || legacyAssets.length > 0
        ? []
        : Array.isArray(doc.pages)
            ? doc.pages.map((path, index) => ({
                storagePath: firstNonEmpty(path),
                order: index + 1,
            }))
            : [];

    const merged = [...primary, ...legacyAssets, ...legacyPages].filter(image => image.storagePath);
    merged.sort((a, b) => {
        if (a.order === b.order) return a.storagePath.localeCompare(b.storagePath);
        return a.order - b.order;
    });

    // Keep a single image per order slot for deterministic UI rendering.
    const seenOrders = new Set();
    return merged.filter(image => {
        if (seenOrders.has(image.order)) return false;
        seenOrders.add(image.order);
        return true;
    });
}

function findLegacyCoverPath(doc) {
    if (!Array.isArray(doc.assets)) return null;
    const cover = doc.assets.find(asset => asset?.kind === "cover" && asset?.path);
    return cover?.path ?? null;
}

function getSafePath(lookbookId, storagePath) {
    if (!storagePath) return null;
    return assertAllowedPathForResource("lookbooks", lookbookId, storagePath)
        ? storagePath
        : null;
}

function firstNonEmpty(...values) {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        const str = String(value).trim();
        if (str) return value;
    }
    return null;
}

function normalizeAuthor(doc) {
    const fromObject = doc?.author && typeof doc.author === "object"
        ? {
            name: firstNonEmpty(doc.author.name),
            position: firstNonEmpty(doc.author.position),
            instagram: firstNonEmpty(doc.author.instagram),
        }
        : null;

    const fallback = {
        name: firstNonEmpty(doc.authorName, doc.creatorName),
        position: firstNonEmpty(doc.authorPosition, doc.creatorPosition),
        instagram: firstNonEmpty(doc.authorInstagram, doc.creatorInstagram),
    };

    const candidate = fromObject?.name ? fromObject : fallback;
    if (!candidate.name) return null;

    return {
        name: candidate.name,
        position: candidate.position ?? null,
        instagram: candidate.instagram ?? null,
    };
}

function normalizeItems(doc) {
    if (!Array.isArray(doc?.items)) return [];

    return doc.items
        .map(item => ({
            name: firstNonEmpty(item?.name),
            link: firstNonEmpty(item?.link, item?.url),
        }))
        .filter(item => Boolean(item.name && item.link));
}
