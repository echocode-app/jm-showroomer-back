import admin from "firebase-admin";
import { CONFIG } from "./index.js";

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: CONFIG.firebaseProjectId,
            clientEmail: CONFIG.firebaseClientEmail,
            privateKey: CONFIG.firebasePrivateKey.replace(/\\n/g, "\n"),
        }),
    });
    console.log("Firebase initialized ✅");
}

export default admin;
