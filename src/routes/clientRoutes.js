const express = require("express");
const router = express.Router();
const clientController = require("../controllers/clientController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/",          authorize("admin", "manager"), clientController.createClient);
router.get("/",           clientController.getAllClients);
router.put("/:id",        authorize("admin", "manager"), clientController.updateClient);
router.delete("/:id",     authorize("admin"), clientController.deleteClient);
router.post("/invoices",  authorize("admin", "manager"), clientController.createInvoice);
router.get("/invoices",   clientController.getAllInvoices);

module.exports = router;