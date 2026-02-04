import path from "path";
import { MEDIA_POLICY } from "../constants/mediaPolicy.js";
import { log } from "../config/logger.js";

const CONTROL_CHARS = /[\x00-\x1F\x7F]/;

export function isSafeStoragePath(storagePath) {
    if (!storagePath || typeof storagePath !== "string") return false;
    if (storagePath.includes("://")) return false;
    if (storagePath.includes("\\")) return false;
    if (storagePath.includes("..")) return false;
    if (storagePath.includes("//")) return false;
    if (CONTROL_CHARS.test(storagePath)) return false;
    return true;
}

function hasAllowedExtension(storagePath) {
    const ext = path.extname(storagePath).toLowerCase();
    return MEDIA_POLICY.allowedExtensionsNow.includes(ext);
}

export function assertAllowedPathForResource(resourceType, resourceId, storagePath) {
    if (!isSafeStoragePath(storagePath)) return false;
    if (!hasAllowedExtension(storagePath)) return false;

    const prefix = `${resourceType}/${resourceId}/`;
    if (!storagePath.startsWith(prefix)) return false;

    return true;
}

export function normalizeLookbookAssets(doc = {}) {
    if (Array.isArray(doc.assets) && doc.assets.length > 0) {
        const mapped = doc.assets
            .map((asset, index) => ({
                kind: asset.kind ?? asset.type ?? "page",
                path: asset.path,
                order: asset.order ?? index + 1,
                meta: asset.meta ?? null,
            }))
            .filter(a => !!a.path);

        const hasCover = mapped.some(a => a.kind === "cover");
        if (doc.coverPath && !hasCover) {
            mapped.unshift({ kind: "cover", path: doc.coverPath, order: 0, meta: null });
        }

        return mapped;
    }

    const assets = [];
    if (doc.coverPath) {
        assets.push({ kind: "cover", path: doc.coverPath, order: 0, meta: null });
    }

    const pages = doc.pages || [];
    const gallery = doc.galleryPaths || [];
    if (Array.isArray(pages)) {
        pages.forEach((p, idx) => {
            if (p) assets.push({ kind: "page", path: p, order: idx + 1, meta: null });
        });
    }
    if (Array.isArray(gallery)) {
        gallery.forEach((p, idx) => {
            if (p) assets.push({ kind: "gallery", path: p, order: idx + 1, meta: null });
        });
    }

    return assets;
}

export function filterValidAssets(resourceType, resourceId, assets = []) {
    const valid = [];
    for (const asset of assets) {
        if (!asset?.path) continue;
        if (!assertAllowedPathForResource(resourceType, resourceId, asset.path)) {
            log.error(`Invalid media path for ${resourceType}/${resourceId}: ${asset.path}`);
            continue;
        }
        valid.push(asset);
    }
    return valid;
}
