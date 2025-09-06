// Middleware to ensure TenantId is present for uploads (for update)
const { getPool } = require("../config/db");
const mssql = require("mssql");

async function ensureTenantId(req, res, next) {
  let tenantId =
    req.body.TenantId || req.params.TenantId || (req.user && req.user.TenantId);
  if (!tenantId && req.params.id) {
    // Fetch TenantId from DB for the user being updated
    try {
      const pool = await getPool();
      const rs = await pool
        .request()
        .input("Id", mssql.Int, req.params.id)
        .query("SELECT TenantId FROM Users WHERE Id=@Id");
      tenantId = rs.recordset[0]?.TenantId;
    } catch (err) {
      return next(err);
    }
  }
  if (!tenantId)
    return res.status(400).json({ error: "TenantId is required for uploads" });
  req.body.TenantId = tenantId; // Attach for multer
  next();
}
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
  destination: async (req, _file, cb) => {
    let tenantId =
      req.body.TenantId ||
      req.params.TenantId ||
      (req.user && req.user.TenantId);
    if (!tenantId && req.params.id) {
      try {
        const pool = await getPool();
        const rs = await pool
          .request()
          .input("Id", mssql.Int, req.params.id)
          .query("SELECT TenantId FROM Users WHERE Id=@Id");
        tenantId = rs.recordset[0]?.TenantId;
      } catch (err) {
        return cb(err);
      }
    }
    if (!tenantId) {
      return cb(new Error("TenantId is required for uploads"));
    }
    const tenantDir = path.join(uploadsAbs, tenantId);
    if (!fs.existsSync(tenantDir)) fs.mkdirSync(tenantDir, { recursive: true });
    cb(null, tenantDir);
  },
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
router.put(
  "/:id",
  ensureTenantId,
  upload.single("photo"),
  asyncHandler(updateUser),
);
router.post(
  "/:id",
  ensureTenantId,
  upload.single("photo"),
  asyncHandler(updateUser),
); // if you kept POST alias

// Change password & delete
router.patch("/:id/password", asyncHandler(changePassword));
router.delete("/:id", asyncHandler(removeUser));

module.exports = router;
