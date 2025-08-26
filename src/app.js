// app.js (Tenant-safe)
"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const cfg = require("./config");

// middleware & controllers
const rateLimiter = require("./middleware/rateLimiter");
const requireAuth = require("./middleware/requireAuth"); // has company->tenant compat shim
const asyncHandler = require("./middleware/asyncHandler");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const errorAudit = require("./middleware/errorAudit"); // audits thrown errors with TenantUserId
const httpStatusAudit = require("./middleware/httpStatusAudit"); // audits all >=500 responses w/ TenantUserId
const { login, logout } = require("./controllers/authController"); // sets session { tenantId, tenantUserId }

const app = express();

// Ensure upload dir exists at startup
const uploadsAbs = path.resolve(process.cwd(), cfg.uploadsDir || "uploads");
if (!fs.existsSync(uploadsAbs)) fs.mkdirSync(uploadsAbs, { recursive: true });

// Trust proxy when running behind a proxy (needed for secure cookies under TLS terminators)
if (cfg.trustProxy) app.set("trust proxy", 1);

// Core middleware
app.use(helmet());
app.use(cors());
app.use(rateLimiter);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Sessions (make sure cfg.session.secure=false for local HTTP dev)
app.use(
  session({
    name: cfg.session.name,
    secret: cfg.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: cfg.session.secure,
      maxAge: cfg.session.maxAgeMs,
    },
  }),
);

// Post-response HTTP status auditing (captures 5xx even if next(err) isn't called)
app.use(httpStatusAudit({ minStatus: 500 }));

// Static assets & uploads
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/uploads", express.static(uploadsAbs));

// ---------- Auth endpoints ----------
app.post("/api/auth/login", asyncHandler(login)); // fetch() target, returns JSON {redirectUrl}
app.post("/login", asyncHandler(login)); // legacy form compatibility
app.all("/api/auth/logout", asyncHandler(logout)); // GET/POST compatible
app.get("/logout", (_req, res) => res.redirect(307, "/api/auth/logout"));

// ---------- Pages ----------
app.get("/", (_req, res) =>
  res.sendFile(path.join(process.cwd(), "public", "login.html")),
);
app.get("/home", requireAuth, (_req, res) =>
  res.sendFile(path.join(process.cwd(), "public", "home.html")),
);

// ---------- API routers ----------
app.use("/api", require("./routes"));
const clientsRouter = require("./routes/clients"); // keep if you expose a dedicated clients router
app.use("/api/clients", clientsRouter);

// ---------- Error handling pipeline ----------
app.use(notFound); // turns unmatched routes into a 404 error
app.use(errorAudit()); // audits errors with TenantId/TenantUserId when available
app.use(errorHandler); // final renderer

module.exports = app;
