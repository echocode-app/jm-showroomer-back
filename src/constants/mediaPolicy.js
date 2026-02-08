// Constants: media policy.

export const MEDIA_POLICY = {
    allowedImageContentTypesNow: ["image/jpeg", "image/png", "image/webp"],
    reservedFutureContentTypes: ["application/pdf"],
    allowedExtensionsNow: [".jpg", ".jpeg", ".png", ".webp"],
    perKindLimits: {
        cover: { maxBytes: 10 * 1024 * 1024, maxCount: 1 },
        page: { maxBytes: 15 * 1024 * 1024, maxCount: 60 },
        gallery: { maxBytes: 15 * 1024 * 1024, maxCount: 30 },
        document: { maxBytes: 25 * 1024 * 1024, maxCount: 10 },
    },
    perEntityTotals: {
        lookbook: { maxBytes: 200 * 1024 * 1024 },
        event: { maxBytes: 50 * 1024 * 1024 },
        showroom: { maxBytes: 50 * 1024 * 1024 },
    },
};
