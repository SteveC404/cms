const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireAuth = require("../middleware/requireAuth");
const {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
} = require("../controllers/tenantsController");

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(listTenants));
router.get("/:id", asyncHandler(getTenant));
router.post("/", asyncHandler(createTenant));
router.put("/:id", asyncHandler(updateTenant));

module.exports = router;
