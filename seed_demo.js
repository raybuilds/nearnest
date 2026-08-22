const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { calculateTrustScore } = require("./services/intelligence/trustEngine");
const { generateOccupantId, isValidOccupantId } = require("./services/occupantIdService");

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;
const NOW = new Date();

function daysAgo(days) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function hoursAfter(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function isResolvedAfterSla(complaint) {
  if (!complaint?.resolved || !complaint?.resolvedAt || !complaint?.slaDeadline) return false;
  return new Date(complaint.resolvedAt) > new Date(complaint.slaDeadline);
}

function countRecentComplaints(complaints, windowDays = 30) {
  const cutoff = daysAgo(windowDays);
  return complaints.filter((complaint) => new Date(complaint.createdAt) >= cutoff).length;
}

async function resetDatabase() {
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
}

async function createUser({ name, email, password, role }) {
  return prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password,
      role,
    },
  });
}

async function createStudentAccount({ name, email, password, intake, corridorId, institutionId }) {
  const user = await createUser({ name, email, password, role: "student" });
  const student = await prisma.student.create({
    data: {
      name,
      intake,
      userId: user.id,
      corridorId,
      institutionId,
    },
  });

  return { user, student };
}

async function createLandlordAccount({ name, email, password }) {
  const user = await createUser({ name, email, password, role: "landlord" });
  const landlord = await prisma.landlord.create({
    data: { userId: user.id },
  });

  return { user, landlord };
}

async function createAdminAccount({ name, email, password }) {
  return createUser({ name, email, password, role: "admin" });
}

async function createChecklistPair(unitId, structural, operational) {
  await prisma.structuralChecklist.create({
    data: {
      unitId,
      fireExit: structural.fireExit,
      wiringSafe: structural.wiringSafe,
      plumbingSafe: structural.plumbingSafe,
      occupancyCompliant: structural.occupancyCompliant,
      approved: structural.approved,
    },
  });

  await prisma.operationalChecklist.create({
    data: {
      unitId,
      bedAvailable: operational.bedAvailable,
      waterAvailable: operational.waterAvailable,
      toiletsAvailable: operational.toiletsAvailable,
      ventilationGood: operational.ventilationGood,
      selfDeclaration: operational.selfDeclaration,
      approved: operational.approved,
    },
  });
}

async function createUnit(data) {
  const { structuralChecklist, operationalChecklist, ...unitData } = data;
  const unit = await prisma.unit.create({ data: unitData });
  await createChecklistPair(unit.id, structuralChecklist, operationalChecklist);
  return prisma.unit.findUnique({
    where: { id: unit.id },
    include: { corridor: true, landlord: true },
  });
}

async function createOccupancyWithOccupant({ student, unit, roomNumber, occupantIndex, startDate }) {
  const publicId = generateOccupantId({
    cityCode: unit.corridor.cityCode,
    corridorCode: unit.corridorId,
    hostelCode: unit.id,
    roomNumber,
    occupantIndex,
  });

  if (!isValidOccupantId(publicId)) {
    throw new Error(`Invalid occupant ID generated for unit ${unit.id}`);
  }

  const occupant = await prisma.occupant.create({
    data: {
      publicId,
      cityCode: unit.corridor.cityCode,
      corridorCode: unit.corridorId,
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

async function createComplaint({
  unitId,
  studentId,
  occupantRecordId,
  severity,
  message,
  incidentType,
  incidentFlag = false,
  createdAt,
  resolved = false,
  resolvedAt = null,
}) {
  const slaDeadline = hoursAfter(createdAt, 48);

  return prisma.complaint.create({
    data: {
      unitId,
      studentId,
      occupantRecordId: occupantRecordId || null,
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
}

async function recalculateUnit(unitId) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { complaints: true },
  });

  const complaints = unit?.complaints || [];
  const trustScore = calculateTrustScore(unit);
  const unresolvedCount = complaints.filter((complaint) => !complaint.resolved).length;
  const slaBreaches = complaints.filter(isResolvedAfterSla).length;
  const recentComplaintCount = countRecentComplaints(complaints, 30);
  const recurringByType = complaints.reduce((map, complaint) => {
    const key = complaint.incidentType || "other";
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  const hasRecurring = Array.from(recurringByType.values()).some((count) => count >= 3);
  const shouldRequireAudit =
    trustScore < 50 ||
    unresolvedCount >= 2 ||
    slaBreaches >= 2 ||
    recentComplaintCount >= 4 ||
    hasRecurring;

  let status = "approved";
  if (trustScore < 50) {
    status = "suspended";
  }

  await prisma.unit.update({
    where: { id: unitId },
    data: {
      trustScore,
      auditRequired: shouldRequireAudit,
      status,
    },
  });

  return { trustScore, shouldRequireAudit, status };
}

async function attachAuditIfNeeded({
  unitId,
  triggerType,
  reason,
  correctiveAction,
  correctiveDeadline,
  verificationNotes,
  createdAt,
  resolved = false,
  resolvedAt = null,
}) {
  return prisma.auditLog.create({
    data: {
      unitId,
      triggerType,
      reason,
      correctiveAction,
      correctiveDeadline,
      verificationNotes,
      createdAt,
      resolved,
      resolvedAt,
    },
  });
}

async function main() {
  await resetDatabase();

  const [adminPassword, landlordPassword, studentPassword] = await Promise.all([
    hashPassword("admin123"),
    hashPassword("landlord123"),
    hashPassword("student123"),
  ]);

  // Corridor mix:
  // Vigyan Nagar = mostly safe inventory with one near-threshold unit.
  // Talwandi = highest complaint density and strongest remediation story.
  // Rajiv Gandhi Nagar = mixed corridor with one safe unit and one severe governance failure.
  const vigyanNagar = await prisma.corridor.create({
    data: { name: "Vigyan Nagar", cityCode: 21 },
  });
  const talwandi = await prisma.corridor.create({
    data: { name: "Talwandi", cityCode: 22 },
  });
  const rajivGandhiNagar = await prisma.corridor.create({
    data: { name: "Rajiv Gandhi Nagar", cityCode: 23 },
  });

  const institutions = {
    vigyanA: await prisma.institution.create({
      data: { name: "Allen Digital Campus", corridorId: vigyanNagar.id },
    }),
    vigyanB: await prisma.institution.create({
      data: { name: "Newton Science Academy", corridorId: vigyanNagar.id },
    }),
    talwandiA: await prisma.institution.create({
      data: { name: "Resonance Learning Hub", corridorId: talwandi.id },
    }),
    talwandiB: await prisma.institution.create({
      data: { name: "Catalyst Test Prep", corridorId: talwandi.id },
    }),
    rajivA: await prisma.institution.create({
      data: { name: "Government Technical Institute", corridorId: rajivGandhiNagar.id },
    }),
    rajivB: await prisma.institution.create({
      data: { name: "Rajiv Commerce College", corridorId: rajivGandhiNagar.id },
    }),
  };

  await createAdminAccount({
    name: "Ananya Mehta",
    email: "admin@nearnest.com",
    password: adminPassword,
  });

  const landlords = {
    dev: await createLandlordAccount({
      name: "Devendra Saini",
      email: "landlord@nearnest.com",
      password: landlordPassword,
    }),
    kavita: await createLandlordAccount({
      name: "Kavita Bansal",
      email: "landlord2@nearnest.test",
      password: landlordPassword,
    }),
    imran: await createLandlordAccount({
      name: "Imran Sheikh",
      email: "landlord3@nearnest.test",
      password: landlordPassword,
    }),
  };

  const students = {
    aarav: await createStudentAccount({
      name: "Aarav Jain",
      email: "student@nearnest.com",
      password: studentPassword,
      intake: "2026A",
      corridorId: vigyanNagar.id,
      institutionId: institutions.vigyanA.id,
    }),
    neha: await createStudentAccount({
      name: "Neha Sharma",
      email: "student2@nearnest.test",
      password: studentPassword,
      intake: "2026A",
      corridorId: vigyanNagar.id,
      institutionId: institutions.vigyanB.id,
    }),
    rohan: await createStudentAccount({
      name: "Rohan Verma",
      email: "student3@nearnest.test",
      password: studentPassword,
      intake: "2025B",
      corridorId: talwandi.id,
      institutionId: institutions.talwandiA.id,
    }),
    ishita: await createStudentAccount({
      name: "Ishita Rao",
      email: "student4@nearnest.test",
      password: studentPassword,
      intake: "2026A",
      corridorId: talwandi.id,
      institutionId: institutions.talwandiB.id,
    }),
    mohit: await createStudentAccount({
      name: "Mohit Solanki",
      email: "student5@nearnest.test",
      password: studentPassword,
      intake: "2025C",
      corridorId: rajivGandhiNagar.id,
      institutionId: institutions.rajivA.id,
    }),
    sana: await createStudentAccount({
      name: "Sana Khan",
      email: "student6@nearnest.test",
      password: studentPassword,
      intake: "2026A",
      corridorId: rajivGandhiNagar.id,
      institutionId: institutions.rajivB.id,
    }),
  };

  // Unit ladder for demo:
  // high trust => strong search results
  // medium trust => visible but risky
  // low trust => suspended / audit-heavy
  const units = {
    vigyanSafeA: await createUnit({
      corridorId: vigyanNagar.id,
      landlordId: landlords.dev.landlord.id,
      status: "approved",
      trustScore: 92,
      rent: 7800,
      distanceKm: 0.7,
      institutionProximityKm: 0.4,
      ac: true,
      occupancyType: "double",
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 2,
      ventilationGood: true,
      capacity: 2,
      structuralApproved: true,
      operationalBaselineApproved: true,
      auditRequired: false,
      structuralChecklist: {
        fireExit: true,
        wiringSafe: true,
        plumbingSafe: true,
        occupancyCompliant: true,
        approved: true,
      },
      operationalChecklist: {
        bedAvailable: true,
        waterAvailable: true,
        toiletsAvailable: true,
        ventilationGood: true,
        selfDeclaration: "Freshly renovated with compliant utilities and documented maintenance.",
        approved: true,
      },
    }),
    vigyanSafeB: await createUnit({
      corridorId: vigyanNagar.id,
      landlordId: landlords.dev.landlord.id,
      status: "approved",
      trustScore: 88,
      rent: 7400,
      distanceKm: 0.9,
      institutionProximityKm: 0.6,
      ac: true,
      occupancyType: "double",
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 2,
      ventilationGood: true,
      capacity: 2,
      structuralApproved: true,
      operationalBaselineApproved: true,
      auditRequired: false,
      structuralChecklist: {
        fireExit: true,
        wiringSafe: true,
        plumbingSafe: true,
        occupancyCompliant: true,
        approved: true,
      },
      operationalChecklist: {
        bedAvailable: true,
        waterAvailable: true,
        toiletsAvailable: true,
        ventilationGood: true,
        selfDeclaration: "Consistently clean operations and no recent governance events.",
        approved: true,
      },
    }),
    vigyanBorderline: await createUnit({
      corridorId: vigyanNagar.id,
      landlordId: landlords.kavita.landlord.id,
      status: "approved",
      trustScore: 60,
      rent: 6900,
      distanceKm: 1.2,
      institutionProximityKm: 0.8,
      ac: false,
      occupancyType: "triple",
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 2,
      ventilationGood: true,
      capacity: 3,
      structuralApproved: true,
      operationalBaselineApproved: true,
      auditRequired: false,
      structuralChecklist: {
        fireExit: true,
        wiringSafe: true,
        plumbingSafe: true,
        occupancyCompliant: true,
        approved: true,
      },
      operationalChecklist: {
        bedAvailable: true,
        waterAvailable: true,
        toiletsAvailable: true,
        ventilationGood: true,
        selfDeclaration: "Good inventory but recent service delays need monitoring.",
        approved: true,
      },
    }),
    talwandiMediumA: await createUnit({
      corridorId: talwandi.id,
      landlordId: landlords.kavita.landlord.id,
      status: "approved",
      trustScore: 64,
      rent: 6100,
      distanceKm: 1.4,
      institutionProximityKm: 1.0,
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
      structuralChecklist: {
        fireExit: true,
        wiringSafe: true,
        plumbingSafe: true,
        occupancyCompliant: true,
        approved: true,
      },
      operationalChecklist: {
        bedAvailable: true,
        waterAvailable: true,
        toiletsAvailable: true,
        ventilationGood: true,
        selfDeclaration: "Mostly stable operations with occasional maintenance lag.",
        approved: true,
      },
    }),
    talwandiMediumB: await createUnit({
      corridorId: talwandi.id,
      landlordId: landlords.imran.landlord.id,
      status: "approved",
      trustScore: 58,
      rent: 5800,
      distanceKm: 1.8,
      institutionProximityKm: 1.1,
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
      structuralChecklist: {
        fireExit: true,
        wiringSafe: true,
        plumbingSafe: true,
        occupancyCompliant: true,
        approved: true,
      },
      operationalChecklist: {
        bedAvailable: true,
        waterAvailable: true,
        toiletsAvailable: true,
        ventilationGood: true,
        selfDeclaration: "Affordable unit with minor recurring sanitation follow-ups.",
        approved: true,
      },
    }),
    talwandiLowA: await createUnit({
      corridorId: talwandi.id,
      landlordId: landlords.kavita.landlord.id,
      status: "approved",
      trustScore: 35,
      rent: 5200,
      distanceKm: 1.9,
      institutionProximityKm: 1.4,
      ac: false,
      occupancyType: "triple",
      bedAvailable: true,
      waterAvailable: false,
      toiletsAvailable: 1,
      ventilationGood: false,
      capacity: 3,
      structuralApproved: false,
      operationalBaselineApproved: false,
      auditRequired: true,
      structuralChecklist: {
        fireExit: true,
        wiringSafe: false,
        plumbingSafe: false,
        occupancyCompliant: false,
        approved: false,
      },
      operationalChecklist: {
        bedAvailable: true,
        waterAvailable: false,
        toiletsAvailable: false,
        ventilationGood: false,
        selfDeclaration: "Pending repairs after repeated water, sanitation, and electrical complaints.",
        approved: false,
      },
    }),
    rajivSafe: await createUnit({
      corridorId: rajivGandhiNagar.id,
      landlordId: landlords.dev.landlord.id,
      status: "approved",
      trustScore: 84,
      rent: 6500,
      distanceKm: 0.8,
      institutionProximityKm: 0.5,
      ac: true,
      occupancyType: "double",
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 2,
      ventilationGood: true,
      capacity: 2,
      structuralApproved: true,
      operationalBaselineApproved: true,
      auditRequired: false,
      structuralChecklist: {
        fireExit: true,
        wiringSafe: true,
        plumbingSafe: true,
        occupancyCompliant: true,
        approved: true,
      },
      operationalChecklist: {
        bedAvailable: true,
        waterAvailable: true,
        toiletsAvailable: true,
        ventilationGood: true,
        selfDeclaration: "High-demand unit with strong audit readiness and low complaint pressure.",
        approved: true,
      },
    }),
    rajivMedium: await createUnit({
      corridorId: rajivGandhiNagar.id,
      landlordId: landlords.imran.landlord.id,
      status: "approved",
      trustScore: 55,
      rent: 6000,
      distanceKm: 1.6,
      institutionProximityKm: 1.2,
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
      structuralChecklist: {
        fireExit: true,
        wiringSafe: true,
        plumbingSafe: true,
        occupancyCompliant: true,
        approved: true,
      },
      operationalChecklist: {
        bedAvailable: true,
        waterAvailable: true,
        toiletsAvailable: true,
        ventilationGood: true,
        selfDeclaration: "Near-threshold unit with manageable but visible service pressure.",
        approved: true,
      },
    }),
    rajivLow: await createUnit({
      corridorId: rajivGandhiNagar.id,
      landlordId: landlords.imran.landlord.id,
      status: "approved",
      trustScore: 30,
      rent: 4900,
      distanceKm: 2.1,
      institutionProximityKm: 1.7,
      ac: false,
      occupancyType: "quad",
      bedAvailable: true,
      waterAvailable: false,
      toiletsAvailable: 1,
      ventilationGood: false,
      capacity: 2,
      structuralApproved: false,
      operationalBaselineApproved: false,
      auditRequired: true,
      structuralChecklist: {
        fireExit: false,
        wiringSafe: false,
        plumbingSafe: false,
        occupancyCompliant: false,
        approved: false,
      },
      operationalChecklist: {
        bedAvailable: true,
        waterAvailable: false,
        toiletsAvailable: false,
        ventilationGood: false,
        selfDeclaration: "Over-occupied unit with unresolved utilities and sanitation risks.",
        approved: false,
      },
    }),
  };

  const occupancies = {
    aarav: await createOccupancyWithOccupant({
      student: students.aarav.student,
      unit: units.vigyanSafeA,
      roomNumber: 101,
      occupantIndex: 1,
      startDate: daysAgo(42),
    }),
    neha: await createOccupancyWithOccupant({
      student: students.neha.student,
      unit: units.vigyanBorderline,
      roomNumber: 201,
      occupantIndex: 1,
      startDate: daysAgo(36),
    }),
    rohan: await createOccupancyWithOccupant({
      student: students.rohan.student,
      unit: units.talwandiMediumA,
      roomNumber: 301,
      occupantIndex: 1,
      startDate: daysAgo(28),
    }),
    ishita: await createOccupancyWithOccupant({
      student: students.ishita.student,
      unit: units.talwandiLowA,
      roomNumber: 302,
      occupantIndex: 1,
      startDate: daysAgo(24),
    }),
    mohit: await createOccupancyWithOccupant({
      student: students.mohit.student,
      unit: units.rajivSafe,
      roomNumber: 401,
      occupantIndex: 1,
      startDate: daysAgo(20),
    }),
    sana: await createOccupancyWithOccupant({
      student: students.sana.student,
      unit: units.rajivLow,
      roomNumber: 402,
      occupantIndex: 1,
      startDate: daysAgo(18),
    }),
  };

  const vdpEntries = [
    { studentId: students.aarav.student.id, corridorId: vigyanNagar.id, intake: "2026A", joinedAt: daysAgo(60) },
    { studentId: students.neha.student.id, corridorId: vigyanNagar.id, intake: "2026A", joinedAt: daysAgo(55) },
    { studentId: students.rohan.student.id, corridorId: talwandi.id, intake: "2025B", joinedAt: daysAgo(52) },
    { studentId: students.ishita.student.id, corridorId: talwandi.id, intake: "2026A", joinedAt: daysAgo(48) },
    { studentId: students.mohit.student.id, corridorId: rajivGandhiNagar.id, intake: "2025C", joinedAt: daysAgo(44) },
    { studentId: students.sana.student.id, corridorId: rajivGandhiNagar.id, intake: "2026A", joinedAt: daysAgo(40) },
  ];
  for (const entry of vdpEntries) {
    await prisma.vDPEntry.create({
      data: {
        studentId: entry.studentId,
        corridorId: entry.corridorId,
        intake: entry.intake,
        verified: true,
        status: "verified",
        joinedAt: entry.joinedAt,
      },
    });
  }

  await prisma.shortlist.createMany({
    data: [
      { studentId: students.aarav.student.id, unitId: units.vigyanSafeB.id, createdAt: daysAgo(7) },
      { studentId: students.neha.student.id, unitId: units.vigyanSafeA.id, createdAt: daysAgo(5) },
      { studentId: students.rohan.student.id, unitId: units.talwandiMediumB.id, createdAt: daysAgo(6) },
      { studentId: students.mohit.student.id, unitId: units.rajivMedium.id, createdAt: daysAgo(4) },
    ],
  });

  // Scenario A: safe vs risky comparison for trust explanation.
  // Scenario B: borderline unit already under pressure for complaint-to-trust demos.
  // Scenario C: recurring issues driving landlord remediation output.
  // Scenario D: Talwandi complaint density for admin corridor analysis.
  const complaintSpecs = [
    {
      unitId: units.vigyanBorderline.id,
      studentId: students.neha.student.id,
      occupantRecordId: occupancies.neha.occupant.id,
      severity: 3,
      message: "Water leakage from bathroom ceiling restarted during the evening.",
      incidentType: "water",
      createdAt: daysAgo(17),
      resolved: true,
      resolvedAt: hoursAfter(daysAgo(17), 60),
    },
    {
      unitId: units.vigyanBorderline.id,
      studentId: students.neha.student.id,
      occupantRecordId: occupancies.neha.occupant.id,
      severity: 4,
      message: "Sanitation issue near the wash basin remains unresolved.",
      incidentType: "sanitation",
      createdAt: daysAgo(8),
      resolved: false,
    },
    {
      unitId: units.talwandiMediumA.id,
      studentId: students.rohan.student.id,
      occupantRecordId: occupancies.rohan.occupant.id,
      severity: 2,
      message: "Washroom cleaning was delayed over the weekend.",
      incidentType: "sanitation",
      createdAt: daysAgo(21),
      resolved: true,
      resolvedAt: hoursAfter(daysAgo(21), 28),
    },
    {
      unitId: units.talwandiMediumA.id,
      studentId: students.rohan.student.id,
      occupantRecordId: occupancies.rohan.occupant.id,
      severity: 3,
      message: "Electricity issue caused a two-hour outage in the study room.",
      incidentType: "electricity",
      incidentFlag: true,
      createdAt: daysAgo(11),
      resolved: true,
      resolvedAt: hoursAfter(daysAgo(11), 54),
    },
    {
      unitId: units.talwandiMediumB.id,
      studentId: students.rohan.student.id,
      severity: 2,
      message: "Water supply was low in the morning block.",
      incidentType: "water",
      createdAt: daysAgo(14),
      resolved: true,
      resolvedAt: hoursAfter(daysAgo(14), 22),
    },
    {
      unitId: units.talwandiLowA.id,
      studentId: students.ishita.student.id,
      occupantRecordId: occupancies.ishita.occupant.id,
      severity: 4,
      message: "Water leakage near the common wash area has spread across the corridor.",
      incidentType: "water",
      createdAt: daysAgo(26),
      resolved: true,
      resolvedAt: hoursAfter(daysAgo(26), 75),
    },
    {
      unitId: units.talwandiLowA.id,
      studentId: students.ishita.student.id,
      occupantRecordId: occupancies.ishita.occupant.id,
      severity: 4,
      message: "Electricity issue keeps tripping the room sockets during study hours.",
      incidentType: "electricity",
      incidentFlag: true,
      createdAt: daysAgo(19),
      resolved: false,
    },
    {
      unitId: units.talwandiLowA.id,
      studentId: students.ishita.student.id,
      occupantRecordId: occupancies.ishita.occupant.id,
      severity: 3,
      message: "Sanitation complaints continue because drains are still blocked.",
      incidentType: "sanitation",
      createdAt: daysAgo(10),
      resolved: false,
    },
    {
      unitId: units.talwandiLowA.id,
      studentId: students.ishita.student.id,
      occupantRecordId: occupancies.ishita.occupant.id,
      severity: 5,
      message: "Overcrowding in the room is making sleep and study impossible.",
      incidentType: "overcrowding",
      incidentFlag: true,
      createdAt: daysAgo(5),
      resolved: false,
    },
    {
      unitId: units.rajivMedium.id,
      studentId: students.mohit.student.id,
      severity: 3,
      message: "Sanitation issue in the staircase was fixed but response took too long.",
      incidentType: "sanitation",
      createdAt: daysAgo(16),
      resolved: true,
      resolvedAt: hoursAfter(daysAgo(16), 65),
    },
    {
      unitId: units.rajivMedium.id,
      studentId: students.mohit.student.id,
      severity: 2,
      message: "Water leakage under the sink returned after temporary repair.",
      incidentType: "water",
      createdAt: daysAgo(7),
      resolved: false,
    },
    {
      unitId: units.rajivLow.id,
      studentId: students.sana.student.id,
      occupantRecordId: occupancies.sana.occupant.id,
      severity: 5,
      message: "Overcrowding has exceeded available sleeping capacity for the room.",
      incidentType: "overcrowding",
      incidentFlag: true,
      createdAt: daysAgo(25),
      resolved: false,
    },
    {
      unitId: units.rajivLow.id,
      studentId: students.sana.student.id,
      occupantRecordId: occupancies.sana.occupant.id,
      severity: 4,
      message: "Electricity issue near the switchboard is still unsafe.",
      incidentType: "electricity",
      incidentFlag: true,
      createdAt: daysAgo(12),
      resolved: false,
    },
    {
      unitId: units.rajivLow.id,
      studentId: students.sana.student.id,
      occupantRecordId: occupancies.sana.occupant.id,
      severity: 3,
      message: "Sanitation remains poor because shared toilets are not being cleaned.",
      incidentType: "sanitation",
      createdAt: daysAgo(6),
      resolved: false,
    },
  ];

  for (const complaint of complaintSpecs) {
    await createComplaint(complaint);
  }

  for (const unit of Object.values(units)) {
    await recalculateUnit(unit.id);
  }

  await prisma.unit.update({
    where: { id: units.vigyanSafeA.id },
    data: {
      trustScore: 92,
      status: "approved",
      auditRequired: false,
      structuralApproved: true,
      operationalBaselineApproved: true,
    },
  });
  await prisma.unit.update({
    where: { id: units.vigyanSafeB.id },
    data: {
      trustScore: 88,
      status: "approved",
      auditRequired: false,
      structuralApproved: true,
      operationalBaselineApproved: true,
    },
  });
  await prisma.unit.update({
    where: { id: units.rajivSafe.id },
    data: {
      trustScore: 84,
      status: "approved",
      auditRequired: false,
      structuralApproved: true,
      operationalBaselineApproved: true,
    },
  });
  await prisma.unit.update({
    where: { id: units.vigyanBorderline.id },
    data: {
      trustScore: 53,
      status: "approved",
      auditRequired: true,
      structuralApproved: true,
      operationalBaselineApproved: true,
    },
  });
  await prisma.unit.update({
    where: { id: units.rajivMedium.id },
    data: {
      trustScore: 55,
      status: "approved",
      auditRequired: true,
      structuralApproved: true,
      operationalBaselineApproved: true,
    },
  });
  await prisma.unit.update({
    where: { id: units.talwandiLowA.id },
    data: {
      status: "suspended",
      trustScore: 27,
      auditRequired: true,
      structuralApproved: false,
      operationalBaselineApproved: false,
    },
  });
  await prisma.unit.update({
    where: { id: units.rajivLow.id },
    data: {
      status: "suspended",
      trustScore: 21,
      auditRequired: true,
      structuralApproved: false,
      operationalBaselineApproved: false,
    },
  });

  await attachAuditIfNeeded({
    unitId: units.vigyanBorderline.id,
    triggerType: "sla",
    reason: "Repeated service delays and one unresolved hygiene complaint pushed the unit near the trust threshold.",
    correctiveAction: "Resolve open sanitation issue and document preventive plumbing maintenance.",
    correctiveDeadline: daysAgo(-5),
    verificationNotes: "Used in demo to show a unit that is still visible but at risk of dropping.",
    createdAt: daysAgo(6),
  });
  await attachAuditIfNeeded({
    unitId: units.talwandiLowA.id,
    triggerType: "recurring_complaints",
    reason: "Recurring water, electricity, sanitation, and overcrowding complaints indicate systemic neglect.",
    correctiveAction: "Repair utilities, reduce occupancy load, and complete sanitation remediation before review.",
    correctiveDeadline: daysAgo(-3),
    verificationNotes: "Primary landlord remediation scenario.",
    createdAt: daysAgo(4),
  });
  await attachAuditIfNeeded({
    unitId: units.rajivLow.id,
    triggerType: "overcrowding",
    reason: "Overcrowding and unresolved electrical risk breached governance tolerance.",
    correctiveAction: "Reduce occupants to approved capacity and submit new safety evidence.",
    correctiveDeadline: daysAgo(-2),
    verificationNotes: "Strong audit case for admin corridor review.",
    createdAt: daysAgo(3),
  });
  await attachAuditIfNeeded({
    unitId: units.vigyanSafeA.id,
    triggerType: "manual_review",
    reason: "Routine periodic governance review for a high-trust unit.",
    correctiveAction: "No action required.",
    correctiveDeadline: null,
    verificationNotes: "Resolved manual review included for audit history realism.",
    createdAt: daysAgo(22),
    resolved: true,
    resolvedAt: daysAgo(18),
  });

  const summary = await prisma.unit.findMany({
    include: {
      complaints: true,
      corridor: true,
    },
    orderBy: [{ corridorId: "asc" }, { id: "asc" }],
  });

  const highTrust = summary.filter((unit) => unit.trustScore >= 80).length;
  const mediumTrust = summary.filter((unit) => unit.trustScore >= 50 && unit.trustScore < 80).length;
  const lowTrust = summary.filter((unit) => unit.trustScore < 50).length;
  const activeStudents = await prisma.occupancy.count({ where: { endDate: null } });
  const openComplaints = await prisma.complaint.count({ where: { resolved: false } });
  const corridorsWithDensity = await prisma.corridor.findMany({
    include: {
      units: {
        include: {
          complaints: true,
        },
      },
    },
  });

  if (summary.length < 8 || summary.length > 12) {
    throw new Error(`Expected 8-12 units, found ${summary.length}`);
  }
  if (activeStudents < 6) {
    throw new Error(`Expected at least 6 active occupancies, found ${activeStudents}`);
  }
  if (highTrust < 2 || mediumTrust < 2 || lowTrust < 2) {
    throw new Error("Trust distribution was not seeded across high / medium / low categories");
  }
  if (openComplaints < 5) {
    throw new Error(`Expected meaningful unresolved complaint pressure, found ${openComplaints}`);
  }
  if (!corridorsWithDensity.some((corridor) => corridor.units.some((unit) => unit.complaints.length >= 3))) {
    throw new Error("Expected at least one corridor with dense complaint activity");
  }

  console.log("Demo seed created successfully.");
  console.log("Admin: admin@nearnest.com / admin123");
  console.log("Landlords: landlord@nearnest.com, landlord2@nearnest.test, landlord3@nearnest.test / landlord123");
  console.log("Students: student@nearnest.com, student2@nearnest.test, student3@nearnest.test, student4@nearnest.test, student5@nearnest.test, student6@nearnest.test / student123");
  console.log(`Units seeded: ${summary.length} (high=${highTrust}, medium=${mediumTrust}, low=${lowTrust})`);
}

main()
  .catch((error) => {
    console.error("seed_demo failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
