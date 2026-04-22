const express = require("express");
const router  = express.Router();
const payrollController = require("../controllers/payrollController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/",           authorize("admin"), payrollController.createPayroll);
router.post("/bulk",       authorize("admin"), payrollController.bulkGeneratePayroll);
router.get("/all",         authorize("admin", "hr"), payrollController.getAllPayroll);
router.get("/my",          payrollController.getMyPayroll);
router.post("/process",    authorize("admin"), payrollController.processPayroll);
router.put("/:id",         authorize("admin"), payrollController.updatePayroll);
router.delete("/:id",      authorize("admin"), payrollController.deletePayroll);

module.exports = router;
