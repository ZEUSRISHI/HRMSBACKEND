const express = require("express");
const router = express.Router();
const { createEvent, getEvents, getAllEvents, updateEvent, deleteEvent } = require("../controllers/calendarController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.post("/", authorize("admin"), createEvent);
router.get("/", getEvents);
router.get("/all", authorize("admin"), getAllEvents);
router.put("/:id", authorize("admin"), updateEvent);
router.delete("/:id", authorize("admin"), deleteEvent);

module.exports = router;