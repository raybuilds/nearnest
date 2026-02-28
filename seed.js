const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@nearnest.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@nearnest.com",
      password: adminPassword,
      role: "admin",
    },
  });
  console.log("Created admin user:", admin.email);

  const corridor = await prisma.corridor.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Aligarh AMU Corridor",
    },
  });
  console.log("Created corridor:", corridor.name);

  const studentPassword = await bcrypt.hash("student123", 10);
  const studentUser = await prisma.user.upsert({
    where: { email: "student@nearnest.com" },
    update: {},
    create: {
      name: "Test Student",
      email: "student@nearnest.com",
      password: studentPassword,
      role: "student",
    },
  });
  const student = await prisma.student.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Test Student",
      intake: "2026A",
      corridorId: corridor.id,
      userId: studentUser.id,
    },
  });

  const student2User = await prisma.user.upsert({
    where: { email: "student2@nearnest.test" },
    update: {},
    create: {
      name: "Ayaan Student",
      email: "student2@nearnest.test",
      password: studentPassword,
      role: "student",
    },
  });
  const student2 = await prisma.student.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: "Ayaan Student",
      intake: "2026A",
      corridorId: corridor.id,
      userId: student2User.id,
    },
  });

  const student3User = await prisma.user.upsert({
    where: { email: "student3@nearnest.test" },
    update: {},
    create: {
      name: "Noor Student",
      email: "student3@nearnest.test",
      password: studentPassword,
      role: "student",
    },
  });
  const student3 = await prisma.student.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      name: "Noor Student",
      intake: "2026B",
      corridorId: corridor.id,
      userId: student3User.id,
    },
  });
  console.log("Created demo student users.");

  const landlordPassword = await bcrypt.hash("landlord123", 10);
  const landlordUser = await prisma.user.upsert({
    where: { email: "landlord@nearnest.com" },
    update: {},
    create: {
      name: "Test Landlord",
      email: "landlord@nearnest.com",
      password: landlordPassword,
      role: "landlord",
    },
  });
  const landlord = await prisma.landlord.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, userId: landlordUser.id },
  });

  const landlord2User = await prisma.user.upsert({
    where: { email: "landlord2@nearnest.test" },
    update: {},
    create: {
      name: "Prime Landlord",
      email: "landlord2@nearnest.test",
      password: landlordPassword,
      role: "landlord",
    },
  });
  const landlord2 = await prisma.landlord.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, userId: landlord2User.id },
  });
  console.log("Created demo landlord users.");

  const demoUnits = [
    {
      id: 12,
      landlordId: landlord.id,
      status: "approved",
      trustScore: 82,
      rent: 8500,
      distanceKm: 0.8,
      institutionProximityKm: 0.5,
      ac: true,
      occupancyType: "single",
      capacity: 2,
      structuralApproved: true,
      operationalBaselineApproved: true,
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 1,
      ventilationGood: true,
      auditRequired: false,
    },
    {
      id: 17,
      landlordId: landlord.id,
      status: "approved",
      trustScore: 74,
      rent: 6500,
      distanceKm: 1.9,
      institutionProximityKm: 1.2,
      ac: false,
      occupancyType: "double",
      capacity: 3,
      structuralApproved: true,
      operationalBaselineApproved: true,
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 2,
      ventilationGood: true,
      auditRequired: false,
    },
    {
      id: 27,
      landlordId: landlord.id,
      status: "admin_review",
      trustScore: 55,
      rent: 7200,
      distanceKm: 1.1,
      institutionProximityKm: 0.8,
      ac: true,
      occupancyType: "triple",
      capacity: 3,
      structuralApproved: false,
      operationalBaselineApproved: false,
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 1,
      ventilationGood: true,
      auditRequired: true,
    },
    {
      id: 28,
      landlordId: landlord.id,
      status: "approved",
      trustScore: 78,
      rent: 7000,
      distanceKm: 1.0,
      institutionProximityKm: 0.9,
      ac: true,
      occupancyType: "double",
      capacity: 2,
      structuralApproved: true,
      operationalBaselineApproved: true,
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 1,
      ventilationGood: true,
      auditRequired: false,
    },
    {
      id: 31,
      landlordId: landlord2.id,
      status: "suspended",
      trustScore: 46,
      rent: 5800,
      distanceKm: 2.6,
      institutionProximityKm: 2.1,
      ac: false,
      occupancyType: "shared",
      capacity: 4,
      structuralApproved: false,
      operationalBaselineApproved: true,
      bedAvailable: true,
      waterAvailable: true,
      toiletsAvailable: 2,
      ventilationGood: false,
      auditRequired: true,
    },
  ];

  for (const unit of demoUnits) {
    await prisma.unit.upsert({
      where: { id: unit.id },
      update: unit,
      create: { ...unit, corridorId: corridor.id },
    });
  }

  const structuralChecklistRows = [
    { unitId: 12, fireExit: true, wiringSafe: true, plumbingSafe: true, occupancyCompliant: true, approved: true },
    { unitId: 17, fireExit: true, wiringSafe: true, plumbingSafe: true, occupancyCompliant: true, approved: true },
    { unitId: 27, fireExit: false, wiringSafe: true, plumbingSafe: false, occupancyCompliant: false, approved: false },
    { unitId: 28, fireExit: true, wiringSafe: true, plumbingSafe: true, occupancyCompliant: true, approved: true },
    { unitId: 31, fireExit: false, wiringSafe: false, plumbingSafe: true, occupancyCompliant: false, approved: false },
  ];
  for (const row of structuralChecklistRows) {
    await prisma.structuralChecklist.upsert({
      where: { unitId: row.unitId },
      update: row,
      create: row,
    });
  }

  const operationalChecklistRows = [
    { unitId: 12, bedAvailable: true, waterAvailable: true, toiletsAvailable: true, ventilationGood: true, selfDeclaration: "All amenities checked and maintained weekly.", approved: true },
    { unitId: 17, bedAvailable: true, waterAvailable: true, toiletsAvailable: true, ventilationGood: true, selfDeclaration: "Good for budget-focused students, clean shared spaces.", approved: true },
    { unitId: 27, bedAvailable: true, waterAvailable: true, toiletsAvailable: true, ventilationGood: true, selfDeclaration: "Pending final inspection paperwork upload.", approved: false },
    { unitId: 28, bedAvailable: true, waterAvailable: true, toiletsAvailable: true, ventilationGood: true, selfDeclaration: "Near AMU gate, recently renovated rooms.", approved: true },
    { unitId: 31, bedAvailable: true, waterAvailable: true, toiletsAvailable: true, ventilationGood: false, selfDeclaration: "Ventilation fix in progress.", approved: false },
  ];
  for (const row of operationalChecklistRows) {
    await prisma.operationalChecklist.upsert({
      where: { unitId: row.unitId },
      update: row,
      create: row,
    });
  }

  const mediaRows = [
    {
      id: 1201,
      unitId: 12,
      type: "photo",
      storageKey: "external:https://demo.nearnest.local/unit12-photo.jpg",
      publicUrl: "https://demo.nearnest.local/unit12-photo.jpg",
      fileName: "unit12-photo.jpg",
      mimeType: "image/jpeg",
      sizeInBytes: 0,
      uploadedById: landlordUser.id,
      locked: true,
    },
    {
      id: 1202,
      unitId: 12,
      type: "document",
      storageKey: "external:https://demo.nearnest.local/unit12-doc.pdf",
      publicUrl: "https://demo.nearnest.local/unit12-doc.pdf",
      fileName: "unit12-doc.pdf",
      mimeType: "application/pdf",
      sizeInBytes: 0,
      uploadedById: landlordUser.id,
      locked: true,
    },
    {
      id: 1203,
      unitId: 12,
      type: "walkthrough360",
      storageKey: "external:https://demo.nearnest.local/unit12-360",
      publicUrl: "https://demo.nearnest.local/unit12-360",
      fileName: "unit12-360",
      mimeType: "text/html",
      sizeInBytes: 0,
      uploadedById: landlordUser.id,
      locked: true,
    },
    {
      id: 1701,
      unitId: 17,
      type: "photo",
      storageKey: "external:https://demo.nearnest.local/unit17-photo.jpg",
      publicUrl: "https://demo.nearnest.local/unit17-photo.jpg",
      fileName: "unit17-photo.jpg",
      mimeType: "image/jpeg",
      sizeInBytes: 0,
      uploadedById: landlordUser.id,
      locked: true,
    },
    {
      id: 1702,
      unitId: 17,
      type: "document",
      storageKey: "external:https://demo.nearnest.local/unit17-doc.pdf",
      publicUrl: "https://demo.nearnest.local/unit17-doc.pdf",
      fileName: "unit17-doc.pdf",
      mimeType: "application/pdf",
      sizeInBytes: 0,
      uploadedById: landlordUser.id,
      locked: true,
    },
    {
      id: 1703,
      unitId: 17,
      type: "walkthrough360",
      storageKey: "external:https://demo.nearnest.local/unit17-360",
      publicUrl: "https://demo.nearnest.local/unit17-360",
      fileName: "unit17-360",
      mimeType: "text/html",
      sizeInBytes: 0,
      uploadedById: landlordUser.id,
      locked: true,
    },
    {
      id: 2801,
      unitId: 28,
      type: "photo",
      storageKey: "external:https://demo.nearnest.local/unit28-photo.jpg",
      publicUrl: "https://demo.nearnest.local/unit28-photo.jpg",
      fileName: "unit28-photo.jpg",
      mimeType: "image/jpeg",
      sizeInBytes: 0,
      uploadedById: landlordUser.id,
      locked: true,
    },
    {
      id: 2802,
      unitId: 28,
      type: "document",
      storageKey: "external:https://demo.nearnest.local/unit28-doc.pdf",
      publicUrl: "https://demo.nearnest.local/unit28-doc.pdf",
      fileName: "unit28-doc.pdf",
      mimeType: "application/pdf",
      sizeInBytes: 0,
      uploadedById: landlordUser.id,
      locked: true,
    },
    {
      id: 2803,
      unitId: 28,
      type: "walkthrough360",
      storageKey: "external:https://demo.nearnest.local/unit28-360",
      publicUrl: "https://demo.nearnest.local/unit28-360",
      fileName: "unit28-360",
      mimeType: "text/html",
      sizeInBytes: 0,
      uploadedById: landlordUser.id,
      locked: true,
    },
  ];
  for (const row of mediaRows) {
    await prisma.unitMedia.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }

  const vdpRows = [
    { id: 1, studentId: student.id, corridorId: corridor.id, intake: student.intake, verified: true, status: "verified" },
    { id: 2, studentId: student2.id, corridorId: corridor.id, intake: student2.intake, verified: true, status: "shortlisted" },
    { id: 3, studentId: student3.id, corridorId: corridor.id, intake: student3.intake, verified: true, status: "active" },
  ];
  for (const row of vdpRows) {
    await prisma.vDPEntry.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }

  const shortlists = [
    { id: 201, studentId: student.id, unitId: 28 },
    { id: 202, studentId: student2.id, unitId: 28 },
    { id: 203, studentId: student3.id, unitId: 12 },
    { id: 204, studentId: student2.id, unitId: 17 },
  ];
  for (const row of shortlists) {
    await prisma.shortlist.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }

  const occupancies = [
    { id: 301, unitId: 28, studentId: student.id, endDate: null },
    { id: 302, unitId: 12, studentId: student3.id, endDate: null },
  ];
  for (const row of occupancies) {
    await prisma.occupancy.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }

  const now = new Date();
  const complaints = [
    {
      id: 401,
      unitId: 28,
      studentId: student.id,
      severity: 2,
      incidentType: "other",
      incidentFlag: false,
      message: "Water pressure was low during morning hours.",
      resolved: true,
      createdAt: new Date(now.getTime() - 50 * 60 * 60 * 1000),
      slaDeadline: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    },
    {
      id: 402,
      unitId: 28,
      studentId: student2.id,
      severity: 4,
      incidentType: "safety",
      incidentFlag: true,
      message: "Main gate latch is broken and does not lock at night.",
      resolved: false,
      createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      slaDeadline: new Date(now.getTime() + 40 * 60 * 60 * 1000),
      resolvedAt: null,
    },
    {
      id: 403,
      unitId: 17,
      studentId: student2.id,
      severity: 3,
      incidentType: "harassment",
      incidentFlag: true,
      message: "Repeated noise disturbance from adjacent room late at night.",
      resolved: true,
      createdAt: new Date(now.getTime() - 120 * 60 * 60 * 1000),
      slaDeadline: new Date(now.getTime() - 72 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 60 * 60 * 60 * 1000),
    },
    {
      id: 404,
      unitId: 12,
      studentId: student3.id,
      severity: 5,
      incidentType: "fire",
      incidentFlag: true,
      message: "Electrical board sparked briefly near kitchen area.",
      resolved: false,
      createdAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
      slaDeadline: new Date(now.getTime() + 28 * 60 * 60 * 1000),
      resolvedAt: null,
    },
    {
      id: 405,
      unitId: 31,
      studentId: student2.id,
      severity: 4,
      incidentType: "injury",
      incidentFlag: true,
      message: "Slipped near wet staircase due to leakage.",
      resolved: false,
      createdAt: new Date(now.getTime() - 26 * 60 * 60 * 1000),
      slaDeadline: new Date(now.getTime() + 22 * 60 * 60 * 1000),
      resolvedAt: null,
    },
  ];
  for (const row of complaints) {
    await prisma.complaint.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }

  await prisma.unit.update({
    where: { id: 12 },
    data: { trustScore: 69, auditRequired: true, status: "approved" },
  });
  await prisma.unit.update({
    where: { id: 17 },
    data: { trustScore: 66, auditRequired: true, status: "approved" },
  });
  await prisma.unit.update({
    where: { id: 28 },
    data: { trustScore: 63, auditRequired: true, status: "suspended" },
  });
  await prisma.unit.update({
    where: { id: 31 },
    data: { trustScore: 44, auditRequired: true, status: "suspended" },
  });

  await prisma.auditLog.upsert({
    where: { id: 501 },
    update: {},
    create: {
      id: 501,
      unitId: 28,
      triggerType: "incident",
      reason: "Demo: repeated incident complaints in 60-day window",
      correctiveAction: "Repair gate lock and submit verification video",
      correctiveDeadline: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      resolved: false,
    },
  });
  await prisma.auditLog.upsert({
    where: { id: 502 },
    update: {},
    create: {
      id: 502,
      unitId: 17,
      triggerType: "sla_breach",
      reason: "Demo: complaint resolved after SLA deadline",
      correctiveAction: "Introduce complaint escalation SOP within 12 hours",
      correctiveDeadline: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
      resolved: false,
    },
  });

  console.log("Seeded demo units, media, shortlists, occupancies, complaints, and audit logs.");
  console.log("Seed completed successfully.");
  console.log("Login credentials:");
  console.log("  Admin:     admin@nearnest.com / admin123");
  console.log("  Student:   student@nearnest.com / student123");
  console.log("  Student2:  student2@nearnest.test / student123");
  console.log("  Student3:  student3@nearnest.test / student123");
  console.log("  Landlord:  landlord@nearnest.com / landlord123");
  console.log("  Landlord2: landlord2@nearnest.test / landlord123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
