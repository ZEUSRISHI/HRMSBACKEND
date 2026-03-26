const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendorController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/",      authorize("admin"), vendorController.createVendor);
router.get("/",       authorize("admin", "manager", "hr"), vendorController.getAllVendors);
router.put("/:id",    authorize("admin"), vendorController.updateVendor);
router.delete("/:id", authorize("admin"), vendorController.deleteVendor);

module.exports = router;