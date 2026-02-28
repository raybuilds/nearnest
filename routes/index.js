const express = require("express");
const corridorController = require("../controllers/corridorController");
const studentController = require("../controllers/studentController");
const unitController = require("../controllers/unitController");
const complaintController = require("../controllers/complaintController");

const router = express.Router();

router.post("/corridor", corridorController.createCorridor);
router.get("/corridor/:corridorId/overview", corridorController.getCorridorOverview);

router.post("/student", studentController.createStudent);

router.post("/unit", unitController.createUnit);
router.get("/units/:corridorId", unitController.getVisibleUnitsByCorridor);

router.post("/complaint", complaintController.createComplaint);
router.patch("/complaint/:complaintId/resolve", complaintController.resolveComplaint);

module.exports = router;
