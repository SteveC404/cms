const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { login, logout } = require("../controllers/authController");

const router = express.Router();

router.post("/login", asyncHandler(login));
router.post("/login", (req, res) => {
  // Redirect real form submits to the API login
  res.redirect(307, "/api/auth/login");
});
router.post("/logout", asyncHandler(logout));
router.get("/logout", asyncHandler(logout)); // convenience

module.exports = router;
