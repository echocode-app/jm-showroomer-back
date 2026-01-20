import { Router } from "express";
import { registerTestUser } from "../controllers/userController.js";

const router = Router();


// GET /users
router.get("/", (req, res) => {
  res.json({ message: "User route works ✅" });
  // throw new Error("Test critical error");
});


// POST /users/dev/register-test
router.post("/dev/register-test", registerTestUser);

export default router;
