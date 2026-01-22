import { Router } from "express";
import { registerTestUser } from "../controllers/userController.js";

const router = Router();


// GET /users
router.get("/", (req, res) => {
  // throw new Error("Test critical error");
  res.json({ message: "User route works ✅" });
});


// POST /users/dev/register-test
router.post("/dev/register-test", registerTestUser);

export default router;

// NODE_ENV=prod node src/core/server.js
// curl -X POST https://jm-showroomer-back.onrender.com/api/v1/users/dev/register-test
