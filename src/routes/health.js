import { Router } from "express";

const router = Router();

// ROUTE GET /
router.get("/", (req, res) => {
  res.json({
    status: "ok ✅",
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

export default router;
