const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { calculateTrustScore } = require("./engines/trustEngine");
const { generateOccupantId, isValidOccupantId } = require("./services/occupantIdService");

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;
const BASE_TIME = new Date("2026-01-01T10:00:00Z");

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function hoursAfter(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function daysAfter(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function daysBefore(date, days) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function complaintDay(offsetDays) {
  return daysAfter(BASE_TIME, offsetDays);
}

function isResolvedLate(complaint) {
  if (!complaint.resolved || !complaint.slaDeadline || !complaint.resolvedAt) return false;
  return new Date(complaint.resolvedAt) > new Date(complaint.slaDeadline);
}

function getWindowCount(complaints, days, predicate = () => true) {
  const cutoff = daysBefore(BASE_TIME, days);
  return complaints.filter((item) => {
    const createdAt = new Date(item.createdAt);
    return createdAt >= cutoff && predicate(item);
  }).length;
}

async function recalculateUnitGovernance(unitId) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { complaints: true },
  });
  if (!unit) return null;

  const trustScore = calculateTrustScore(unit);
  const complaints = unit.complaints || [];

  const densityTriggered = getWindowCount(complaints, 60) >= 5;
  const slaTriggered = getWindowCount(complaints, 60, (item) => isResolvedLate(item)) >= 3;
  const incidentTriggered = getWindowCount(complaints, 60, (item) => Boolean(item.incidentFlag)) >= 1;
  const shouldRequireAudit = densityTriggered || slaTriggered || incidentTriggered || unit.auditRequired;

  await prisma.unit.update({
    where: { id: unitId },
    data: {
      trustScore,
      auditRequired: shouldRequireAudit,
      ...(shouldRequireAudit && unit.status !== "archived" ? { status: "suspended" } : {}),
    },
  });

  return trustScore;
}

async function createComplaint({
  unitId,
  studentId,
  occupantRecordId = null,
  severity,
  message,
  incidentType,
  incidentFlag,
  createdAt,
  resolved,
  resolvedAt = null,
}) {
  const slaDeadline = hoursAfter(createdAt, 48);

  const complaint = await prisma.complaint.create({
    data: {
      unitId,
      studentId,
      occupantRecordId,
      severity,
      message,
      incidentType,
      incidentFlag,
      createdAt,
      slaDeadline,
      resolved,
      resolvedAt,
    },
  });

  await recalculateUnitGovernance(unitId);
  return complaint;
}

async function createOccupancyWithOccupant({
  student,
  unit,
  corridorCode,
  roomNumber,
  occupantIndex,
  startDate,
}) {
  const publicId = generateOccupantId({
    cityCode: unit.corridor.cityCode,
    corridorCode,
    hostelCode: unit.id,
    roomNumber,
    occupantIndex,
  });
  const existing = await prisma.occupant.findUnique({
    where: { publicId },
    select: { id: true },
  });
  if (!isValidOccupantId(publicId)) {
    throw new Error(`Generated occupant ID is invalid: ${publicId}`);
  }
  if (existing) {
    throw new Error(`Duplicate occupant ID generated during seed: ${publicId}`);
  }

  const occupant = await prisma.occupant.create({
    data: {
      publicId,
      cityCode: unit.corridor.cityCode,
      corridorCode,
      hostelCode: unit.id,
      roomNumber,
      occupantIndex,
      studentId: student.id,
      unitId: unit.id,
      active: true,
      createdAt: startDate,
    },
  });

  const occupancy = await prisma.occupancy.create({
    data: {
      unitId: unit.id,
      studentId: student.id,
      startDate,
      endDate: null,
    },
  });

  return { occupant, occupancy };
}

async function main() {
  console.log("Stage 1: Reset database");
  await prisma.auditLog.deleteMany({});
  await prisma.complaint.deleteMany({});
  await prisma.occupant.deleteMany({});
  await prisma.occupancy.deleteMany({});
  await prisma.unitMedia.deleteMany({});
  await prisma.structuralChecklist.deleteMany({});
  await prisma.operationalChecklist.deleteMany({});
  await prisma.shortlist.deleteMany({});
  await prisma.vDPEntry.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.landlord.deleteMany({});
  await prisma.institution.deleteMany({});
  await prisma.corridor.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("Stage 2: Create corridors");
  const corridorAMU = await prisma.corridor.create({
    data: { name: "Aligarh AMU Academic Belt", cityCode: 11 },
  });
  const corridorKota = await prisma.corridor.create({
    data: { name: "Kota Coaching Cluster - Vigyan Nagar", cityCode: 22 },
  });
  const corridorDelhi = await prisma.corridor.create({
    data: { name: "Old Delhi Hostel Lane", cityCode: 33 },
  });

  console.log("Stage 3: Create institutions");
  const instAMU = await prisma.institution.create({ data: { name: "Aligarh Muslim University", corridorId: corridorAMU.id } });
  const instAMUEng = await prisma.institution.create({ data: { name: "AMU Engineering Faculty", corridorId: corridorAMU.id } });
  const instAllen = await prisma.institution.create({ data: { name: "Allen Career Institute", corridorId: corridorKota.id } });
  const instResonance = await prisma.institution.create({ data: { name: "Resonance Academy", corridorId: corridorKota.id } });
  const instPolytechnic = await prisma.institution.create({ data: { name: "Local Polytechnic", corridorId: corridorKota.id } });
  const instDTI = await prisma.institution.create({ data: { name: "Delhi Technical Institute", corridorId: corridorDelhi.id } });
  const instCommerce = await prisma.institution.create({ data: { name: "Old City Commerce College", corridorId: corridorDelhi.id } });

  console.log("Stage 4: Create users");
  const [adminPasswordHash, landlordPasswordHash, studentPasswordHash] = await Promise.all([
    hashPassword("admin123"),
    hashPassword("landlord123"),
    hashPassword("student123"),
  ]);

  const adminUser = await prisma.user.create({
    data: { name: "System Admin", email: "admin@nearnest.com", password: adminPasswordHash, role: "admin" },
  });

  const landlordUser1 = await prisma.user.create({
    data: { name: "Ramesh Kumar", email: "landlord@nearnest.com", password: landlordPasswordHash, role: "landlord" },
  });
  const landlordUser2 = await prisma.user.create({
    data: { name: "Suresh Gupta", email: "landlord2@nearnest.test", password: landlordPasswordHash, role: "landlord" },
  });
  const landlord1 = await prisma.landlord.create({ data: { userId: landlordUser1.id } });
  const landlord2 = await prisma.landlord.create({ data: { userId: landlordUser2.id } });

  const studentUsers = {
    amu1: await prisma.user.create({
      data: { name: "Ahmad Farooq", email: "student@nearnest.com", password: studentPasswordHash, role: "student" },
    }),
    amu2: await prisma.user.create({
      data: { name: "Fatima Zehra", email: "student2@nearnest.test", password: studentPasswordHash, role: "student" },
    }),
    amu3: await prisma.user.create({
      data: { name: "Obaidullah", email: "student3@nearnest.test", password: studentPasswordHash, role: "student" },
    }),
    kota1: await prisma.user.create({
      data: { name: "Raj Malhotra", email: "student_kota_1@nearnest.com", password: studentPasswordHash, role: "student" },
    }),
    kota2: await prisma.user.create({
      data: { name: "Priya Sharma", email: "student_kota_2@nearnest.com", password: studentPasswordHash, role: "student" },
    }),
    kota3: await prisma.user.create({
      data: { name: "Amit Kumar", email: "student_kota_3@nearnest.com", password: studentPasswordHash, role: "student" },
    }),
    delhi1: await prisma.user.create({
      data: { name: "Arjun Singh", email: "student_delhi_1@nearnest.com", password: studentPasswordHash, role: "student" },
    }),
    delhi2: await prisma.user.create({
      data: { name: "Meera Devi", email: "student_delhi_2@nearnest.com", password: studentPasswordHash, role: "student" },
    }),
  };

  const students = {
    amu1: await prisma.student.create({
      data: { name: "Ahmad Farooq", intake: "2024A", userId: studentUsers.amu1.id, corridorId: corridorAMU.id, institutionId: instAMU.id },
    }),
    amu2: await prisma.student.create({
      data: { name: "Fatima Zehra", intake: "2024A", userId: studentUsers.amu2.id, corridorId: corridorAMU.id, institutionId: instAMUEng.id },
    }),
    amu3: await prisma.student.create({
      data: { name: "Obaidullah", intake: "2023B", userId: studentUsers.amu3.id, corridorId: corridorAMU.id, institutionId: instAMU.id },
    }),
    kota1: await prisma.student.create({
      data: { name: "Raj Malhotra", intake: "2024A", userId: studentUsers.kota1.id, corridorId: corridorKota.id, institutionId: instAllen.id },
    }),
    kota2: await prisma.student.create({
      data: { name: "Priya Sharma", intake: "2024A", userId: studentUsers.kota2.id, corridorId: corridorKota.id, institutionId: instResonance.id },
    }),
    kota3: await prisma.student.create({
      data: { name: "Amit Kumar", intake: "2023C", userId: studentUsers.kota3.id, corridorId: corridorKota.id, institutionId: instPolytechnic.id },
    }),
    delhi1: await prisma.student.create({
      data: { name: "Arjun Singh", intake: "2024A", userId: studentUsers.delhi1.id, corridorId: corridorDelhi.id, institutionId: instDTI.id },
    }),
    delhi2: await prisma.student.create({
      data: { name: "Meera Devi", intake: "2024A", userId: studentUsers.delhi2.id, corridorId: corridorDelhi.id, institutionId: instCommerce.id },
    }),
  };

  console.log("Stage 5: Create units");
  const unitAMU1 = await prisma.unit.create({
    data: {
      status: "approved",
      corridorId: corridorAMU.id,
      landlordId: landlord1.id,
      rent: 5600,
      distanceKm: 0.8,
      institutionProximityKm: 0.5,
      ac: false,
      occupancyType: "double",
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 2,
      ventilationGood: true,
      capacity: 2,
      structuralApproved: true,
      operationalBaselineApproved: true,
      auditRequired: false,
    },
  });
  const unitAMU2 = await prisma.unit.create({
    data: {
      status: "approved",
      corridorId: corridorAMU.id,
      landlordId: landlord1.id,
      rent: 5200,
      distanceKm: 1.0,
      institutionProximityKm: 0.7,
      ac: false,
      occupancyType: "double",
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 1,
      ventilationGood: true,
      capacity: 2,
      structuralApproved: true,
      operationalBaselineApproved: true,
      auditRequired: false,
    },
  });
  const unitAMU3 = await prisma.unit.create({
    data: {
      status: "approved",
      corridorId: corridorAMU.id,
      landlordId: landlord2.id,
      rent: 6100,
      distanceKm: 0.6,
      institutionProximityKm: 0.4,
      ac: true,
      occupancyType: "single",
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 1,
      ventilationGood: true,
      capacity: 1,
      structuralApproved: true,
      operationalBaselineApproved: true,
      auditRequired: false,
    },
  });
  const unitKota1 = await prisma.unit.create({
    data: {
      status: "approved",
      corridorId: corridorKota.id,
      landlordId: landlord2.id,
      rent: 3800,
      distanceKm: 2.0,
      institutionProximityKm: 1.4,
      ac: false,
      occupancyType: "triple",
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 1,
      ventilationGood: true,
      capacity: 3,
      structuralApproved: true,
      operationalBaselineApproved: true,
      auditRequired: false,
    },
  });
  const unitDelhiA = await prisma.unit.create({
    data: {
      status: "approved",
      corridorId: corridorDelhi.id,
      landlordId: landlord1.id,
      rent: 7300,
      distanceKm: 1.3,
      institutionProximityKm: 1.0,
      ac: true,
      occupancyType: "triple",
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 2,
      ventilationGood: true,
      capacity: 3,
      structuralApproved: true,
      operationalBaselineApproved: true,
      auditRequired: false,
    },
  });
  const unitDelhiB = await prisma.unit.create({
    data: {
      status: "approved",
      corridorId: corridorDelhi.id,
      landlordId: landlord2.id,
      rent: 4600,
      distanceKm: 1.0,
      institutionProximityKm: 0.8,
      ac: false,
      occupancyType: "double",
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 1,
      ventilationGood: true,
      capacity: 2,
      structuralApproved: true,
      operationalBaselineApproved: true,
      auditRequired: false,
    },
  });
  const unitDelhiC = await prisma.unit.create({
    data: {
      status: "approved",
      corridorId: corridorDelhi.id,
      landlordId: landlord1.id,
      rent: 5600,
      distanceKm: 0.9,
      institutionProximityKm: 0.6,
      ac: false,
      occupancyType: "double",
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 1,
      ventilationGood: true,
      capacity: 2,
      structuralApproved: true,
      operationalBaselineApproved: true,
      auditRequired: false,
    },
  });

  console.log("Stage 6: Apply checklists");
  const healthyChecklistUnits = [unitAMU1, unitAMU2, unitAMU3, unitKota1, unitDelhiA, unitDelhiC];
  for (const unit of healthyChecklistUnits) {
    await prisma.structuralChecklist.create({
      data: {
        unitId: unit.id,
        fireExit: true,
        wiringSafe: true,
        plumbingSafe: true,
        occupancyCompliant: true,
        approved: true,
      },
    });
    await prisma.operationalChecklist.create({
      data: {
        unitId: unit.id,
        bedAvailable: true,
        waterAvailable: true,
        toiletsAvailable: true,
        ventilationGood: true,
        selfDeclaration: "All baseline controls verified.",
        approved: true,
      },
    });
  }

  await prisma.structuralChecklist.create({
    data: {
      unitId: unitDelhiB.id,
      fireExit: false,
      wiringSafe: true,
      plumbingSafe: true,
      occupancyCompliant: false,
      approved: false,
    },
  });
  await prisma.operationalChecklist.create({
    data: {
      unitId: unitDelhiB.id,
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: true,
      ventilationGood: true,
      selfDeclaration: "Pending corrective action after overcapacity violation.",
      approved: false,
    },
  });
  await prisma.unit.update({
    where: { id: unitDelhiB.id },
    data: { structuralApproved: false, operationalBaselineApproved: false, auditRequired: true },
  });

  console.log("Stage 7: Attach media");
  const mediaRows = [
    {
      unitId: unitAMU1.id,
      type: "photo",
      storageKey: "media/amu_room_1.jpg",
      publicUrl: "https://cdn.nearnest.test/media/amu_room_1.jpg",
      fileName: "amu_room_1.jpg",
      mimeType: "image/jpeg",
      sizeInBytes: 245000,
      uploadedById: landlordUser1.id,
    },
    {
      unitId: unitKota1.id,
      type: "photo",
      storageKey: "media/kota_pg_waterline.jpg",
      publicUrl: "https://cdn.nearnest.test/media/kota_pg_waterline.jpg",
      fileName: "kota_pg_waterline.jpg",
      mimeType: "image/jpeg",
      sizeInBytes: 312000,
      uploadedById: landlordUser2.id,
    },
    {
      unitId: unitDelhiA.id,
      type: "photo",
      storageKey: "media/delhi_fire_exit.jpg",
      publicUrl: "https://cdn.nearnest.test/media/delhi_fire_exit.jpg",
      fileName: "delhi_fire_exit.jpg",
      mimeType: "image/jpeg",
      sizeInBytes: 287000,
      uploadedById: landlordUser1.id,
    },
    {
      unitId: unitDelhiA.id,
      type: "document",
      storageKey: "docs/fire_safety_certificate_2024.pdf",
      publicUrl: "https://cdn.nearnest.test/docs/fire_safety_certificate_2024.pdf",
      fileName: "fire_safety_certificate_2024.pdf",
      mimeType: "application/pdf",
      sizeInBytes: 1048576,
      uploadedById: landlordUser1.id,
    },
    {
      unitId: unitKota1.id,
      type: "document",
      storageKey: "docs/plumbing_inspection_kota.pdf",
      publicUrl: "https://cdn.nearnest.test/docs/plumbing_inspection_kota.pdf",
      fileName: "plumbing_inspection_kota.pdf",
      mimeType: "application/pdf",
      sizeInBytes: 524288,
      uploadedById: landlordUser2.id,
    },
    {
      unitId: unitAMU2.id,
      type: "walkthrough360",
      storageKey: "media/walkthrough_demo.jpg",
      publicUrl: "https://cdn.nearnest.test/media/walkthrough_demo.jpg",
      fileName: "walkthrough_demo.jpg",
      mimeType: "image/jpeg",
      sizeInBytes: 1572864,
      uploadedById: landlordUser1.id,
    },
  ];

  for (const row of mediaRows) {
    await prisma.unitMedia.create({
      data: {
        ...row,
        locked: false,
        createdAt: daysAfter(BASE_TIME, 1),
      },
    });
  }

  // After submission: lock evidence.
  await prisma.unitMedia.updateMany({ where: {}, data: { locked: true } });

  console.log("Stage 8: Occupancy");
  const amuUnit1Ref = await prisma.unit.findUnique({ where: { id: unitAMU1.id }, include: { corridor: true } });
  const amuUnit2Ref = await prisma.unit.findUnique({ where: { id: unitAMU2.id }, include: { corridor: true } });
  const kotaUnit1Ref = await prisma.unit.findUnique({ where: { id: unitKota1.id }, include: { corridor: true } });
  const delhiUnitARef = await prisma.unit.findUnique({ where: { id: unitDelhiA.id }, include: { corridor: true } });
  const delhiUnitBRef = await prisma.unit.findUnique({ where: { id: unitDelhiB.id }, include: { corridor: true } });

  const occAMU1A = await createOccupancyWithOccupant({
    student: students.amu1,
    unit: amuUnit1Ref,
    corridorCode: corridorAMU.id,
    roomNumber: 101,
    occupantIndex: 1,
    startDate: daysAfter(BASE_TIME, 2),
  });
  const occAMU1B = await createOccupancyWithOccupant({
    student: students.amu2,
    unit: amuUnit1Ref,
    corridorCode: corridorAMU.id,
    roomNumber: 101,
    occupantIndex: 2,
    startDate: daysAfter(BASE_TIME, 2),
  });
  const occAMU2A = await createOccupancyWithOccupant({
    student: students.amu3,
    unit: amuUnit2Ref,
    corridorCode: corridorAMU.id,
    roomNumber: 102,
    occupantIndex: 1,
    startDate: daysAfter(BASE_TIME, 3),
  });

  const occKota1A = await createOccupancyWithOccupant({
    student: students.kota1,
    unit: kotaUnit1Ref,
    corridorCode: corridorKota.id,
    roomNumber: 201,
    occupantIndex: 1,
    startDate: daysAfter(BASE_TIME, 2),
  });
  const occKota1B = await createOccupancyWithOccupant({
    student: students.kota2,
    unit: kotaUnit1Ref,
    corridorCode: corridorKota.id,
    roomNumber: 201,
    occupantIndex: 2,
    startDate: daysAfter(BASE_TIME, 2),
  });
  const occKota1C = await createOccupancyWithOccupant({
    student: students.kota3,
    unit: kotaUnit1Ref,
    corridorCode: corridorKota.id,
    roomNumber: 201,
    occupantIndex: 3,
    startDate: daysAfter(BASE_TIME, 2),
  });

  const occDelhiA = await createOccupancyWithOccupant({
    student: students.delhi1,
    unit: delhiUnitARef,
    corridorCode: corridorDelhi.id,
    roomNumber: 301,
    occupantIndex: 1,
    startDate: daysAfter(BASE_TIME, 2),
  });

  // Overfill scenario for capacity=2 unit.
  const occDelhiB1 = await createOccupancyWithOccupant({
    student: students.kota1,
    unit: delhiUnitBRef,
    corridorCode: corridorDelhi.id,
    roomNumber: 302,
    occupantIndex: 1,
    startDate: daysAfter(BASE_TIME, 3),
  });
  const occDelhiB2 = await createOccupancyWithOccupant({
    student: students.kota2,
    unit: delhiUnitBRef,
    corridorCode: corridorDelhi.id,
    roomNumber: 302,
    occupantIndex: 2,
    startDate: daysAfter(BASE_TIME, 3),
  });
  const occDelhiB3 = await createOccupancyWithOccupant({
    student: students.kota3,
    unit: delhiUnitBRef,
    corridorCode: corridorDelhi.id,
    roomNumber: 302,
    occupantIndex: 3,
    startDate: daysAfter(BASE_TIME, 3),
  });
  void occDelhiB3;
  // student delhi2 intentionally has NO occupancy.

  console.log("Stage 9: Complaint matrix");
  await createComplaint({
    unitId: unitAMU1.id,
    studentId: students.amu1.id,
    occupantRecordId: occAMU1A.occupant.id,
    severity: 2,
    message: "Minor hygiene issue in common wash area.",
    incidentType: "other",
    incidentFlag: false,
    createdAt: complaintDay(2),
    resolved: true,
    resolvedAt: hoursAfter(complaintDay(2), 20),
  });

  await createComplaint({
    unitId: unitKota1.id,
    studentId: students.kota1.id,
    occupantRecordId: occKota1A.occupant.id,
    severity: 4,
    message: "Water leakage from upper pipeline.",
    incidentType: "water",
    incidentFlag: false,
    createdAt: complaintDay(20),
    resolved: true,
    resolvedAt: hoursAfter(complaintDay(20), 70), // resolved late
  });
  await createComplaint({
    unitId: unitKota1.id,
    studentId: students.kota1.id,
    occupantRecordId: occKota1A.occupant.id,
    severity: 2,
    message: "Low water pressure in morning hours.",
    incidentType: "water",
    incidentFlag: false,
    createdAt: complaintDay(28),
    resolved: true,
    resolvedAt: hoursAfter(complaintDay(28), 24), // on time
  });
  await createComplaint({
    unitId: unitKota1.id,
    studentId: students.kota2.id,
    occupantRecordId: occKota1B.occupant.id,
    severity: 1,
    message: "Water quality issue remains unresolved.",
    incidentType: "water",
    incidentFlag: false,
    createdAt: complaintDay(45),
    resolved: false,
  });

  await createComplaint({
    unitId: unitDelhiA.id,
    studentId: students.delhi1.id,
    occupantRecordId: occDelhiA.occupant.id,
    severity: 5,
    message: "Fire hazard near electrical panel.",
    incidentType: "fire",
    incidentFlag: true,
    createdAt: complaintDay(50),
    resolved: false,
  });

  await createComplaint({
    unitId: unitDelhiC.id,
    studentId: students.delhi1.id,
    severity: 3,
    message: "Electrical fluctuation in room sockets.",
    incidentType: "other",
    incidentFlag: false,
    createdAt: complaintDay(12),
    resolved: true,
    resolvedAt: hoursAfter(complaintDay(12), 18),
  });

  await createComplaint({
    unitId: unitDelhiC.id,
    studentId: students.delhi1.id,
    severity: 2,
    message: "Lift not working in common area.",
    incidentType: "common_area",
    incidentFlag: false,
    createdAt: complaintDay(35),
    resolved: true,
    resolvedAt: hoursAfter(complaintDay(35), 30),
  });

  console.log("Stage 10: Audit logs");
  const auditDensity = await prisma.auditLog.create({
    data: {
      unitId: unitDelhiB.id,
      triggerType: "density",
      reason: "Overcapacity violation: 3 active occupancies against capacity 2.",
      correctiveAction: "Reduce occupancy to approved capacity and re-verify baselines.",
      correctiveDeadline: daysAfter(BASE_TIME, 7),
      verificationNotes: "Landlord notified; awaiting compliance evidence.",
      createdAt: daysBefore(BASE_TIME, 2),
      resolved: false,
    },
  });
  void auditDensity;

  const auditIncident = await prisma.auditLog.create({
    data: {
      unitId: unitDelhiA.id,
      triggerType: "incident",
      reason: "Severe fire complaint triggered emergency governance action.",
      correctiveAction: "Complete wiring replacement and fire safety recertification.",
      correctiveDeadline: daysAfter(BASE_TIME, 14),
      verificationNotes: "Safety inspection pending.",
      createdAt: daysBefore(BASE_TIME, 4),
      resolved: false,
    },
  });
  void auditIncident;

  const auditManual = await prisma.auditLog.create({
    data: {
      unitId: unitAMU2.id,
      triggerType: "manual",
      reason: "Routine manual compliance review.",
      correctiveAction: "No corrective action required.",
      correctiveDeadline: null,
      verificationNotes: "Unit remains compliant.",
      createdAt: daysBefore(BASE_TIME, 25),
      resolved: true,
      resolvedAt: daysBefore(BASE_TIME, 20),
    },
  });
  void auditManual;

  const auditResolvedThenReopened = await prisma.auditLog.create({
    data: {
      unitId: unitDelhiC.id,
      triggerType: "manual",
      reason: "Resolved and reopened governance simulation.",
      correctiveAction: "Electrical check and elevator maintenance verification.",
      correctiveDeadline: daysAfter(BASE_TIME, 5),
      verificationNotes: "Resolved once, reopened for verification drift scenario.",
      createdAt: daysBefore(BASE_TIME, 18),
      resolved: true,
      resolvedAt: daysBefore(BASE_TIME, 12),
    },
  });
  void auditResolvedThenReopened;

  // Reopened unit simulation.
  await prisma.unit.update({
    where: { id: unitDelhiC.id },
    data: { status: "approved", auditRequired: false },
  });

  // Enforce overcapacity and severe incident statuses for governance clarity.
  await prisma.unit.update({
    where: { id: unitDelhiB.id },
    data: { status: "suspended", auditRequired: true },
  });
  await prisma.unit.update({
    where: { id: unitDelhiA.id },
    data: { status: "suspended", auditRequired: true },
  });

  console.log("Stage 11: VDP + shortlist");
  const vdpRows = [
    { studentId: students.amu1.id, corridorId: corridorAMU.id, intake: students.amu1.intake, verified: true, status: "verified", joinedAt: daysBefore(BASE_TIME, 60) },
    { studentId: students.amu2.id, corridorId: corridorAMU.id, intake: students.amu2.intake, verified: true, status: "shortlisted", joinedAt: daysBefore(BASE_TIME, 58) },
    { studentId: students.kota1.id, corridorId: corridorKota.id, intake: students.kota1.intake, verified: true, status: "active", joinedAt: daysBefore(BASE_TIME, 55) },
    { studentId: students.kota2.id, corridorId: corridorKota.id, intake: students.kota2.intake, verified: true, status: "verified", joinedAt: daysBefore(BASE_TIME, 54) },
    { studentId: students.delhi1.id, corridorId: corridorDelhi.id, intake: students.delhi1.intake, verified: true, status: "active", joinedAt: daysBefore(BASE_TIME, 53) },
    { studentId: students.delhi2.id, corridorId: corridorDelhi.id, intake: students.delhi2.intake, verified: true, status: "verified", joinedAt: daysBefore(BASE_TIME, 52) },
  ];
  for (const row of vdpRows) {
    await prisma.vDPEntry.create({ data: row });
  }

  await prisma.shortlist.create({ data: { studentId: students.amu2.id, unitId: unitAMU3.id, createdAt: daysBefore(BASE_TIME, 8) } });
  await prisma.shortlist.create({ data: { studentId: students.kota2.id, unitId: unitKota1.id, createdAt: daysBefore(BASE_TIME, 7) } });
  await prisma.shortlist.create({ data: { studentId: students.delhi2.id, unitId: unitDelhiC.id, createdAt: daysBefore(BASE_TIME, 6) } });

  console.log("Stage 12: Validation");
  const allUnits = await prisma.unit.findMany({ include: { complaints: true } });
  const suspendedCount = allUnits.filter((u) => u.status === "suspended").length;
  const nearThresholdCount = allUnits.filter((u) => u.trustScore >= 50 && u.trustScore <= 55).length;
  const healthyCount = allUnits.filter((u) => u.trustScore > 80).length;
  const auditRequiredCount = allUnits.filter((u) => u.auditRequired).length;
  const openAuditCount = await prisma.auditLog.count({ where: { resolved: false } });
  const resolvedAuditCount = await prisma.auditLog.count({ where: { resolved: true } });
  const complaintRows = await prisma.complaint.findMany({
    select: { id: true, unitId: true, studentId: true },
  });
  const fkComplaintOrphans = complaintRows.filter((row) => !row.unitId || !row.studentId).length;

  if (fkComplaintOrphans !== 0) {
    throw new Error("Validation failed: complaint foreign key orphan detected.");
  }
  if (suspendedCount < 1) {
    throw new Error(`Validation failed: expected at least one suspended unit, found ${suspendedCount}.`);
  }
  if (nearThresholdCount < 1) {
    throw new Error(`Validation failed: expected at least one near-threshold unit (trustScore 50-55), found ${nearThresholdCount}.`);
  }
  if (healthyCount < 1) {
    throw new Error(`Validation failed: expected at least one healthy unit (trustScore > 80), found ${healthyCount}.`);
  }
  if (auditRequiredCount < 1) {
    throw new Error(`Validation failed: expected at least one auditRequired unit, found ${auditRequiredCount}.`);
  }
  if (openAuditCount < 1 || resolvedAuditCount < 1) {
    throw new Error(`Validation failed: expected both open and resolved audits, found open=${openAuditCount}, resolved=${resolvedAuditCount}.`);
  }

  // Dawn data richness checks.
  const dawnStudentVisibleUnits = await prisma.unit.count({
    where: {
      status: "approved",
      structuralApproved: true,
      operationalBaselineApproved: true,
      trustScore: { gte: 50 },
    },
  });
  const dawnLandlordRiskUnits = await prisma.unit.count({
    where: {
      OR: [{ auditRequired: true }, { trustScore: { lt: 60 } }],
    },
  });
  const dawnAdminDensityCandidates = await prisma.complaint.count({
    where: {
      createdAt: { gte: daysBefore(BASE_TIME, 30) },
    },
  });

  if (dawnStudentVisibleUnits < 1 || dawnLandlordRiskUnits < 1 || dawnAdminDensityCandidates < 1) {
    throw new Error("Validation failed: Dawn queries would not have meaningful demo output.");
  }

  console.log("Seed complete.");
  console.log(`Admin: admin@nearnest.com / admin123`);
  console.log(`Landlords: landlord@nearnest.com, landlord2@nearnest.test / landlord123`);
  console.log(`Students: student@nearnest.com, student2@nearnest.test, student3@nearnest.test / student123`);
  console.log(`Units: ${allUnits.length}, suspended: ${suspendedCount}, near-threshold: ${nearThresholdCount}, healthy: ${healthyCount}`);
  console.log(`Audits open/resolved: ${openAuditCount}/${resolvedAuditCount}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
