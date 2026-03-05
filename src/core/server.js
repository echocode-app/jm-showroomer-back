import app from "./app.js";
import { CONFIG } from "../config/index.js";
import { log } from "../config/logger.js";
import { initFirebase, getFirestoreInstance } from "../config/firebase.js";

let server = null;
let shuttingDown = false;

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
    server = app.listen(CONFIG.port, () => {
        log.success(`Server running in ${CONFIG.env} mode on port ${CONFIG.port}`);
        // Non-blocking index probe: startup must not wait on Firestore network conditions.
        probeFirestoreIndexes().catch(err =>
            log.error(`Firestore index probe skipped: ${err?.message || err}`)
        );
    });

    server.requestTimeout = CONFIG.serverRequestTimeoutMs;
    server.headersTimeout = CONFIG.serverHeadersTimeoutMs;
    server.keepAliveTimeout = CONFIG.serverKeepAliveTimeoutMs;
}

function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    log.warn(`Received ${signal}. Starting graceful shutdown...`);

    const forceExitTimer = setTimeout(() => {
        log.error("Force shutdown timeout reached");
        process.exit(1);
    }, CONFIG.shutdownGraceMs);
    forceExitTimer.unref();

    if (!server) {
        process.exit(0);
        return;
    }

    if (!server.listening) {
        log.info("HTTP server already stopped");
        process.exit(0);
        return;
    }

    server.close(err => {
        clearTimeout(forceExitTimer);
        if (err) {
            if (String(err?.message || "").includes("Server is not running")) {
                log.info("HTTP server already stopped");
                process.exit(0);
                return;
            }
            log.error(`Shutdown failed: ${err?.message || err}`);
            process.exit(1);
            return;
        }
        log.info("HTTP server closed");
        process.exit(0);
    });
}

startServer().catch(err => {
    log.error(`Failed to start server: ${err?.message || err}`);
    process.exit(1);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", reason => {
    log.error(`Unhandled rejection: ${reason?.message || reason}`);
});

process.on("uncaughtException", err => {
    log.error(`Uncaught exception: ${err?.message || err}`);
    shutdown("uncaughtException");
});
