"use strict";
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/payrollController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/",              authorize("admin"),        ctrl.createPayroll);
router.post("/bulk",          authorize("admin"),        ctrl.bulkGeneratePayroll);
router.post("/backfill",      authorize("admin"),        ctrl.backfillPayroll);
router.get("/all",            authorize("admin", "hr"),  ctrl.getAllPayroll);
router.get("/my",                                        ctrl.getMyPayroll);
router.post("/process",       authorize("admin"),        ctrl.processPayroll);
router.patch("/:id/paid",     authorize("admin"),        ctrl.markAsPaid);
router.post("/:id/resend",    authorize("admin"),        ctrl.resendPayslip);
router.put("/:id",            authorize("admin"),        ctrl.updatePayroll);
router.delete("/:id",         authorize("admin"),        ctrl.deletePayroll);

module.exports = router;
