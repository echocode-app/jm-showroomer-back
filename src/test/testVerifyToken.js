import dotenv from "dotenv";
dotenv.config({ path: ".env.prod" }); // .env.dev 

import { getAuthInstance } from "./src/config/firebase.js";

async function testToken(idToken) {
    try {
        const auth = getAuthInstance();
        const decoded = await auth.verifyIdToken(idToken);
        console.log("✅ Token decoded:", decoded);
    } catch (err) {
        console.error("❌ Token verification failed:", err.message);
    }
}

const PROD_ID_TOKEN = "<YOUR_FIREBASE_ID_TOKEN>";
testToken(PROD_ID_TOKEN);
