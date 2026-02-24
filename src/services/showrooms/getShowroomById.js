import { getFirestoreInstance } from "../../config/firebase.js";
import { forbidden, notFound } from "../../core/error.js";
import { DEV_STORE, useDevMock } from "./_store.js";
import { normalizeShowroomForResponse } from "./response.js";

function isPrivilegedViewer(showroom, user) {
    return Boolean(
        showroom &&
        user &&
        (user.role === "admin" || user.uid === showroom.ownerUid)
    );
}

// getShowroomByIdService
export async function getShowroomByIdService(id, user = null) {
    if (useDevMock) {
        const showroom = DEV_STORE.showrooms.find(s => s.id === id);
        if (!showroom) throw notFound("SHOWROOM_NOT_FOUND");

        if (
            showroom.status === "deleted" &&
            (!user || (user.uid !== showroom.ownerUid && user.role !== "admin"))
        ) {
            throw forbidden("ACCESS_DENIED");
        }

        if (
            showroom.status !== "approved" &&
            (!user || (user.uid !== showroom.ownerUid && user.role !== "admin"))
        ) {
            throw forbidden("ACCESS_DENIED");
        }

        return normalizeShowroomForResponse(showroom, {
            includeInternal: isPrivilegedViewer(showroom, user),
            includeGeoCoords: isPrivilegedViewer(showroom, user),
            includePhone: isPrivilegedViewer(showroom, user),
        });
    }

    const db = getFirestoreInstance();
    const doc = await db.collection("showrooms").doc(id).get();
    if (!doc.exists) throw notFound("SHOWROOM_NOT_FOUND");

    const showroom = doc.data();

    if (
        showroom.status === "deleted" &&
        (!user || (user.uid !== showroom.ownerUid && user.role !== "admin"))
    ) {
        throw forbidden("ACCESS_DENIED");
    }

    if (
        showroom.status !== "approved" &&
        (!user || (user.uid !== showroom.ownerUid && user.role !== "admin"))
    ) {
        throw forbidden("ACCESS_DENIED");
    }

    const payload = { id: doc.id, ...showroom };
    const privileged = isPrivilegedViewer(payload, user);
    return normalizeShowroomForResponse(payload, {
        includeInternal: privileged,
        includeGeoCoords: privileged,
        includePhone: privileged,
    });
}
