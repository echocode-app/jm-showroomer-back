import { getFirestoreInstance } from "../../config/firebase.js";
import { badRequest, forbidden } from "../../core/error.js";
import { isCountryBlocked } from "../../constants/countries.js";
import {
    normalizeAddress,
    normalizeAddressForCompare,
    normalizeInstagramUrl,
    normalizeShowroomName,
    validateInstagramUrl,
    validatePhone,
    validateShowroomName,
} from "../../utils/showroomValidation.js";
import { createDraftShowroom } from "./createDraftShowroom.js";
import { isSameCountry } from "./_helpers.js";
import { DEV_STORE, generateId, useDevMock } from "./_store.js";

export async function createShowroom(data, ownerUid, options = {}) {
    if (options.draft === true) {
        return createDraftShowroom(ownerUid);
    }

    if (!data.name) throw badRequest("SHOWROOM_NAME_REQUIRED");
    if (!data.type) throw badRequest("SHOWROOM_TYPE_REQUIRED");
    if (!data.country) throw badRequest("COUNTRY_REQUIRED");

    if (isCountryBlocked(data.country)) {
        throw badRequest("COUNTRY_BLOCKED");
    }

    if (
        options.userCountry &&
        !isSameCountry(data.country, options.userCountry)
    ) {
        throw forbidden("ACCESS_DENIED");
    }

    validateShowroomName(data.name);
    const nameNormalized = normalizeShowroomName(data.name);

    const address = data.address ? normalizeAddress(data.address) : null;
    const addressNormalized = address ? normalizeAddressForCompare(address) : null;

    const contacts = {
        phone: null,
        instagram: null,
    };

    if (data.contacts?.instagram) {
        const normalizedInstagram = normalizeInstagramUrl(data.contacts.instagram);
        validateInstagramUrl(normalizedInstagram);
        contacts.instagram = normalizedInstagram;
    } else if (data.contacts?.instagram === "") {
        contacts.instagram = null;
    }

    if (data.contacts?.phone) {
        const { e164 } = validatePhone(
            data.contacts.phone,
            options.userCountry ?? data.country ?? null
        );
        contacts.phone = e164;
    } else if (data.contacts?.phone === "") {
        contacts.phone = null;
    }

    if (useDevMock) {
        const id = generateId();
        const now = new Date().toISOString();

        const showroom = {
            id,
            ownerUid,
            status: "draft",
            editCount: 0,
            editHistory: [],
            createdAt: now,
            updatedAt: now,
            ...data,
            nameNormalized,
            address,
            addressNormalized,
            contacts,
        };

        DEV_STORE.showrooms.push(showroom);
        return showroom;
    }

    const db = getFirestoreInstance();
    const ref = db.collection("showrooms");

    const existingSnapshot = await ref
        .where("ownerUid", "==", ownerUid)
        .where("name", "==", data.name)
        .get();

    const existing = existingSnapshot.docs.filter(
        d => d.data().status !== "deleted"
    );

    if (existing.length > 0) {
        throw badRequest("SHOWROOM_NAME_ALREADY_EXISTS");
    }

    const now = new Date().toISOString();

    const showroom = {
        ownerUid,
        name: data.name,
        nameNormalized,
        type: data.type,
        availability: data.availability ?? null,
        category: data.category ?? null,
        brands: data.brands ?? [],
        address,
        addressNormalized,
        country: data.country,
        city: data.city ?? null,
        contacts: {
            phone: contacts?.phone ?? null,
            instagram: contacts?.instagram ?? null,
        },
        location: data.location ?? null,
        status: "draft",
        editCount: 0,
        editHistory: [],
        createdAt: now,
        updatedAt: now,
    };

    const doc = await ref.add(showroom);
    return { id: doc.id, ...showroom };
}
