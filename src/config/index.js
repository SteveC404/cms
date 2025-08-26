require("dotenv").config();

const cfg = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || "0.0.0.0",
  trustProxy: process.env.TRUST_PROXY === "1",
  session: {
    name: process.env.SESSION_NAME || "sid",
    secret: process.env.SESSION_SECRET || "change-me",
    secure: process.env.SESSION_SECURE === "1",
    maxAgeMs: Number(process.env.SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 8),
  },
  uploadsDir: process.env.UPLOAD_DIR || "uploads",
  db: {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 1433,
    options: {
      encrypt: process.env.DB_ENCRYPT === "1",
      trustServerCertificate: process.env.DB_TRUST_CERT === "1",
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },
};

module.exports = cfg;