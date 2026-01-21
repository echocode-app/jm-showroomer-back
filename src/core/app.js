import express from "express";
import cors from "cors";
import morgan from "morgan";

import routes from "../routes/index.js";
import { errorHandler } from "../middlewares/error.js";
import { requestLogger } from "../middlewares/requestLogger.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use(requestLogger);

app.get("/", (req, res) => {
  res.json({ service: "JM Showroomer API", status: "🚀running" });
});
app.use("/", routes);
app.use(errorHandler);

export default app;
