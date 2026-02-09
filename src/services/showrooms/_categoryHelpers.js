// Showroom category helpers.

import { badRequest } from "../../core/error.js";
import {
    normalizeKey,
    normalizeSubcategories,
} from "../../utils/showroomNormalization.js";
import {
    CATEGORY_GROUP_SET,
    CLOTHING_SUBCATEGORY_SET,
} from "./_categoryConstants.js";

export function normalizeCategoryGroup(value) {
    if (value === undefined) return undefined;
    if (value === null || String(value).trim() === "") return null;
    const key = normalizeKey(value);
    if (!key) return null;
    if (!CATEGORY_GROUP_SET.has(key)) {
        throw badRequest("SHOWROOM_CATEGORY_GROUP_INVALID");
    }
    return key;
}

export function normalizeSubcategoryList(value) {
    if (value === undefined) return undefined;
    return normalizeSubcategories(value);
}

export function applyCategoryPayload(data, existing = null) {
    let categoryGroup = normalizeCategoryGroup(data.categoryGroup);
    let subcategories = normalizeSubcategoryList(data.subcategories);

    if (subcategories !== undefined) {
        if (subcategories.length > 0) {
            const invalid = subcategories.filter(
                key => !CLOTHING_SUBCATEGORY_SET.has(key)
            );
            if (invalid.length > 0) {
                throw badRequest("SHOWROOM_SUBCATEGORY_INVALID");
            }
            if (categoryGroup !== undefined && categoryGroup && categoryGroup !== "clothing") {
                throw badRequest("SHOWROOM_SUBCATEGORY_GROUP_MISMATCH");
            }
            if (!categoryGroup) categoryGroup = "clothing";
        }
    }

    if (categoryGroup !== undefined && categoryGroup !== "clothing") {
        const existingSubcats = existing?.subcategories ?? [];
        if (existingSubcats.length > 0 && subcategories === undefined) {
            throw badRequest("SHOWROOM_SUBCATEGORY_GROUP_MISMATCH");
        }
    }

    return {
        categoryGroup,
        subcategories,
    };
}
