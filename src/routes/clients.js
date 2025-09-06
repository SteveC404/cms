// Middleware to ensure TenantId is present for uploads (for update)
const { getPool } = require("../config/db");
const mssql = require("mssql");

async function ensureTenantId(req, res, next) {
  let tenantId =
    req.body.TenantId || req.params.TenantId || (req.user && req.user.TenantId);
  if (!tenantId && req.params.id) {
    // Fetch TenantId from DB for the client being updated
    try {
      const pool = await getPool();
      const rs = await pool
        .request()
        .input("Id", mssql.Int, req.params.id)
        .query("SELECT TenantId FROM Clients WHERE Id=@Id");
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
  listClients,
  getClient,
  createClient, // <-- make sure this is exported by the controller
  updateClient,
} = require("../controllers/clientsController");

// Multer: save uploads to configured folder
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
          .query("SELECT TenantId FROM Clients WHERE Id=@Id");
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
router.use(requireAuth);

// List + read
router.get("/", asyncHandler(listClients));
router.get("/:id", asyncHandler(getClient));

// Create (supports photo via multipart FormData)
router.post("/", upload.single("photo"), asyncHandler(createClient));

// Update (supports photo)
router.put(
  "/:id",
  ensureTenantId,
  upload.single("photo"),
  asyncHandler(updateClient),
);

// (optional) POST alias for update if your UI ever uses POST for edits
// router.post("/:id", upload.single("photo"), asyncHandler(updateClient));

module.exports = router;
