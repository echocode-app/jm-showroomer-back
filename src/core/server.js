import app from "./app.js";
import { CONFIG } from "../config/index.js";
import { log } from "../config/logger.js";
import { initFirebase, getFirestoreInstance } from "../config/firebase.js";

// console.log("PORT used:", CONFIG.port);

function isIndexNotReadyError(err) {
    const msg = String(err?.message || "");
    return err?.code === 9 && msg.includes("requires an index");
}

async function probeFirestoreIndexes() {
    if (process.env.FIRESTORE_EMULATOR_HOST) return;
    try {
        const db = getFirestoreInstance();
        await db
            .collection("showrooms")
            .where("status", "==", "approved")
            .where("geo.cityNormalized", "==", "kyiv")
            .orderBy("updatedAt", "desc")
            .limit(1)
            .get();
    } catch (err) {
        if (isIndexNotReadyError(err)) {
            log.info(
                "Firestore index not ready for status+geo.cityNormalized ⚠️"
            );
        }
    }
}

async function startServer() {
    initFirebase();
    app.listen(CONFIG.port, () => {
        log.success(`Server running in ${CONFIG.env} mode on port ${CONFIG.port}`);
        // Non-blocking index probe: startup must not wait on Firestore network conditions.
        probeFirestoreIndexes().catch(err =>
            log.error(`Firestore index probe skipped: ${err?.message || err}`)
        );
    });
}

startServer().catch(err => {
    log.error(`Failed to start server: ${err?.message || err}`);
});
