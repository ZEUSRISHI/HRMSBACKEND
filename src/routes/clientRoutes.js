const express = require("express");
const router = express.Router();
const multer = require("multer");
const c = require("../controllers/clientController");
const { protect, authorize } = require("../middleware/auth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"), false);
  },
});

router.use(protect);

// ── Static client routes (MUST be before /:id routes) ──
router.post("/", authorize("admin", "manager"), c.createClient);
router.get("/", c.getAllClients);

// ── Invoice routes (static paths before /:id) ──
router.post("/invoices", authorize("admin", "manager"), c.createInvoice);
router.get("/invoices", c.getAllInvoices);
router.get("/invoices/:id", c.getInvoiceById);
router.get("/invoices/:id/view", c.viewInvoicePDF);
router.get("/invoices/:id/download", c.downloadInvoicePDF);
router.post("/invoices/:id/resend", authorize("admin", "manager"), c.resendInvoiceEmail);
router.put("/invoices/:id", authorize("admin", "manager"), c.updateInvoice);
router.delete("/invoices/:id", authorize("admin"), c.deleteInvoice);

// ── Parameterized client routes (MUST be after all static routes) ──
router.put("/:id", authorize("admin", "manager"), c.updateClient);
router.delete("/:id", authorize("admin"), c.deleteClient);

// ── Client document routes ──
router.post("/:id/documents", authorize("admin", "manager"), upload.single("document"), c.uploadDocument);
router.get("/:id/documents", c.getDocuments);
router.get("/:id/documents/:docId", c.viewDocument);
router.delete("/:id/documents/:docId", authorize("admin", "manager"), c.deleteDocument);

// ── Client invoices by client ID ──
router.get("/:id/invoices", c.getInvoicesByClientId);

module.exports = router;