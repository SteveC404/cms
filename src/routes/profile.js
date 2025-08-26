const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const asyncHandler = require("../middleware/asyncHandler");
const { getProfile } = require("../controllers/profileController");

const router = express.Router();
router.get("/", requireAuth, asyncHandler(getProfile));

module.exports = router;
