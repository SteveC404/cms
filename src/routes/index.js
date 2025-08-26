const express = require("express");
const router = express.Router();

router.use("/health", require("./health"));
router.use("/auth", require("./auth"));
router.use("/clients", require("./clients"));
router.use("/users", require("./users"));
router.use("/profile", require("./profile"));

module.exports = router;
