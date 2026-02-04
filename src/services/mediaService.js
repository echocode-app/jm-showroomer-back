import { getStorageInstance } from "../config/firebase.js";

const DEFAULT_TTL_SECONDS = 6 * 60 * 60; // 6 hours

// getSignedReadUrl
export async function getSignedReadUrl(storagePath, ttlSeconds = DEFAULT_TTL_SECONDS) {
    if (!storagePath) return null;

    try {
        const storage = getStorageInstance();
        const bucket = storage.bucket();
        const file = bucket.file(storagePath);
        const expires = Date.now() + ttlSeconds * 1000;

        const [url] = await file.getSignedUrl({
            action: "read",
            expires,
        });

        return url || null;
    } catch {
        return null;
    }
}

export { DEFAULT_TTL_SECONDS };
