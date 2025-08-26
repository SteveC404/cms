const cfg = require("./config");
const logger = require("./config/logger");
const app = require("./app");

const server = app.listen(cfg.port, cfg.host, () => {
  logger.info(`Server listening at http://${cfg.host}:${cfg.port}`);
});

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection", err);
  server.close(() => process.exit(1));
});