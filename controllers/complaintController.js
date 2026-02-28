const prisma = require("../prismaClient");
const trustService = require("../services/trustService");

async function createComplaint(req, res, next) {
  try {
    const { unitId, studentId, severity } = req.body;

    if (!unitId || !studentId || severity === undefined) {
      return res.status(400).json({ error: "unitId, studentId and severity are required" });
    }

    const parsedSeverity = Number(severity);

    if (!Number.isInteger(parsedSeverity) || parsedSeverity < 1 || parsedSeverity > 5) {
      return res.status(400).json({ error: "severity must be an integer from 1 to 5" });
    }

    const [unit, student] = await Promise.all([
      prisma.unit.findUnique({ where: { id: Number(unitId) } }),
      prisma.student.findUnique({ where: { id: Number(studentId) } }),
    ]);

    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const complaint = await prisma.complaint.create({
      data: {
        unitId: Number(unitId),
        studentId: Number(studentId),
        severity: parsedSeverity,
      },
    });

    const trustScore = await trustService.recalculateUnitTrustScore(Number(unitId));

    res.status(201).json({
      message: "Complaint recorded",
      complaint,
      trustScore,
    });
  } catch (error) {
    next(error);
  }
}

async function resolveComplaint(req, res, next) {
  try {
    const complaintId = Number(req.params.complaintId);

    if (Number.isNaN(complaintId)) {
      return res.status(400).json({ error: "complaintId must be a number" });
    }

    const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });

    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: { resolved: true },
    });

    const trustScore = await trustService.recalculateUnitTrustScore(updatedComplaint.unitId);

    res.json({
      message: "Complaint resolved",
      complaint: updatedComplaint,
      trustScore,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createComplaint,
  resolveComplaint,
};
