const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cfg = require("./config");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const rateLimiter = require("./middleware/rateLimiter");
const requireAuth = require("./middleware/requireAuth");
const asyncHandler = require("./middleware/asyncHandler");
const { login } = require("./controllers/authController");
const fs = require("fs");

// Ensure upload dir exists at startup
const uploadsAbs = path.resolve(process.cwd(), cfg.uploadsDir || "uploads");
if (!fs.existsSync(uploadsAbs)) fs.mkdirSync(uploadsAbs, { recursive: true });

const app = express();

if (cfg.trustProxy) app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());
app.use(rateLimiter);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

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

// static
app.use(express.static(path.join(process.cwd(), "public")));

// routes
app.use("/api", require("./routes"));
app.get("/", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "login.html"));
});

app.get("/home", requireAuth, (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "home.html"));
});

app.get("/logout", (_req, res) => {
  // forward to the real handler mounted under /api
  res.redirect(307, "/api/auth/logout");
});

app.post("/login", asyncHandler(login));

// Serve uploaded files
app.use("/uploads", express.static(uploadsAbs));

const clientsRouter = require("./routes/clients");
app.use("/api/clients", clientsRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
