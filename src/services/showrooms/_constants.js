// Showroom service: constants.

export const EDITABLE_FIELDS = [
    "name",
    "nameNormalized",
    "type",
    "availability",
    "category",
    "categoryGroup",
    "subcategories",
    "brands",
    "brandsNormalized",
    "brandsMap",
    "address",
    "addressNormalized",
    "country",
    "city",
    "contacts",
    "location",
    "geo",
];

// Soft cap to prevent unbounded editHistory growth in long-lived documents.
export const HISTORY_LIMIT = 50;
