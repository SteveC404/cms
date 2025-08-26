const express = require("express");
const router = express.Router();

router.get("/", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), now: new Date().toISOString() });
});

module.exports = router;