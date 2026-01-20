import app from "./app.js";
import { CONFIG } from "../config/index.js";
import { log } from "../config/logger.js";

app.listen(CONFIG.port, () => {
    log.success(`Server running in ${CONFIG.env} mode on port ${CONFIG.port}`);
});
