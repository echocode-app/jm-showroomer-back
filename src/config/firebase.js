import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { CONFIG, log } from "./index.js";

let auth, db, storage;

export function initFirebase() {
    if (!getApps().length) {
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
        log.success("Firebase initialized");
    }

    auth = getAuth();
    db = getFirestore();
    storage = getStorage();
}

export const getAuthInstance = () => auth;
export const getFirestoreInstance = () => db;
export const getStorageInstance = () => storage;
