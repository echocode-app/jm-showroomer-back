import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { log } from "./logger.js";

let auth, db, storage;

// initFirebase
export function initFirebase() {
    if (!getApps().length) {
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
        log.success("Firebase initialized");
        console.log("⚙️ ", process.env.FIREBASE_PROJECT_ID);
    }

    auth = getAuth();
    db = getFirestore();
    storage = getStorage();
}

// getAuthInstance
export const getAuthInstance = () => {
    if (!auth) initFirebase();
    return auth;
};

// getFirestoreInstance
export const getFirestoreInstance = () => {
    if (!db) initFirebase();
    return db;
};

// getStorageInstance
export const getStorageInstance = () => {
    if (!storage) initFirebase();
    return storage;
};
