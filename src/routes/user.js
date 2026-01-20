import { Router } from "express";

const router = Router();

// GET /users
router.get("/", (req, res) => {
  res.json({ message: "User route works ✅" });
});

export default router;
