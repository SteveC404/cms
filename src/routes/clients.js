const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const cfg = require("../config");
const requireAuth = require("../middleware/requireAuth");
const asyncHandler = require("../middleware/asyncHandler");

const {
  listClients,
  getClient,
  createClient, // <-- make sure this is exported by the controller
  updateClient,
} = require("../controllers/clientsController");

// Multer: save uploads to configured folder
const uploadsAbs = path.resolve(process.cwd(), cfg.uploadsDir || "uploads");
if (!fs.existsSync(uploadsAbs)) fs.mkdirSync(uploadsAbs, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsAbs),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = Math.random().toString(16).slice(2) + Date.now().toString(16);
    cb(null, base + ext);
  },
});
const upload = multer({ storage });

const router = express.Router();
router.use(requireAuth);

// List + read
router.get("/", asyncHandler(listClients));
router.get("/:id", asyncHandler(getClient));

// Create (supports photo via multipart FormData)
router.post("/", upload.single("photo"), asyncHandler(createClient));

// Update (supports photo)
router.put("/:id", upload.single("photo"), asyncHandler(updateClient));

// (optional) POST alias for update if your UI ever uses POST for edits
// router.post("/:id", upload.single("photo"), asyncHandler(updateClient));

module.exports = router;
