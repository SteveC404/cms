const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cfg = require("../config");
const requireAuth = require("../middleware/requireAuth");
const asyncHandler = require("../middleware/asyncHandler");
const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changePassword,
  removeUser,
  me,
} = require("../controllers/usersController");

// --- Multer storage (saves to /uploads and keeps extension) ---
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

// all user endpoints require auth
router.use(requireAuth);

// List / me / get by id
router.get("/", asyncHandler(listUsers));
router.get("/me", asyncHandler(me));
router.get("/:id", asyncHandler(getUser));

// Create (JSON or form). If you want to allow photo on create, add upload.single("photo") here too.
// router.post("/", upload.single("photo"), asyncHandler(createUser));
router.post("/", upload.single("photo"), asyncHandler(createUser));

// UPDATE: parse FormData (photo + fields)
router.put("/:id", upload.single("photo"), asyncHandler(updateUser));
router.post("/:id", upload.single("photo"), asyncHandler(updateUser)); // if you kept POST alias

// Change password & delete
router.patch("/:id/password", asyncHandler(changePassword));
router.delete("/:id", asyncHandler(removeUser));

module.exports = router;
