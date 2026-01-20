import app from "./app.js";
import { CONFIG } from "../config/index.js";
import { log } from "../config/logger.js"; import { initFirebase } from "../config/firebase.js";

initFirebase();

app.listen(CONFIG.port, () => {
    log.success(`Server running in ${CONFIG.env} mode on port ${CONFIG.port}`);
});
