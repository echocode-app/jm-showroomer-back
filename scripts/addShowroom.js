import dotenv from "dotenv";
dotenv.config({ path: `.env.dev` });

import { initFirebase } from "../src/config/firebase.js";
import { createShowroom } from "../src/services/showroomService.js";
import { log } from "../src/config/logger.js";

async function main() {
    try {
        initFirebase();
        log.success("Firebase initialized");

        const showroomData = {
            name: `TestShowroom-${Date.now()}`,
            type: "Мультибренд шоурум",
            availability: "вільний доступ",
            address: "Kyiv, Ukraine",
            country: "Ukraine",
            contacts: {
                phone: "+380999999999",
                instagram: "https://www.instagram.com/myshowroom/",
            },
            location: {
                lat: 50.4501,
                lng: 30.5234,
            },
            status: "draft",
        };

        const ownerUid = "dev-test-user-123";

        const showroom = await createShowroom(showroomData, ownerUid);

        log.success("Showroom created successfully:");
        console.log(showroom);
    } catch (err) {
        log.fatal("Failed to create showroom:");
        console.error(err);
    }
}

main();
