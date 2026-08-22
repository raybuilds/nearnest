const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../prismaClient");
const { JWT_SECRET } = require("../middlewares/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, intake, corridorId, institutionId, phoneNumber, studentOccupantId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "name, email, password and role are required" });
    }

    if (!["student", "landlord", "parent"].includes(role)) {
      return res.status(400).json({ error: "role must be student, landlord, or parent" });
    }

    if (role === "student" && (!intake || !corridorId)) {
      return res.status(400).json({ error: "student registration requires intake and corridorId" });
    }

    if (role === "parent" && (!phoneNumber || !studentOccupantId)) {
      return res.status(400).json({ error: "parent registration requires phoneNumber and studentOccupantId" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() },
    });
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: String(name).trim(),
          email: String(email).toLowerCase().trim(),
          password: passwordHash,
          role,
        },
      });

      let student = null;
      let landlord = null;
      let parent = null;

      if (role === "student") {
        const corridor = await tx.corridor.findUnique({ where: { id: Number(corridorId) } });
        if (!corridor) {
          throw new Error("Corridor not found");
        }

        if (institutionId !== undefined && institutionId !== null) {
          const institution = await tx.institution.findUnique({
            where: { id: Number(institutionId) },
          });
          if (!institution) {
            throw new Error("Institution not found");
          }
          if (institution.corridorId !== Number(corridorId)) {
            throw new Error("Institution does not belong to corridor");
          }
        }

        student = await tx.student.create({
          data: {
            name: String(name).trim(),
            intake: String(intake).trim(),
            corridorId: Number(corridorId),
            userId: user.id,
            institutionId: institutionId === undefined || institutionId === null ? null : Number(institutionId),
          },
        });
      }

      if (role === "landlord") {
        landlord = await tx.landlord.create({
          data: {
            userId: user.id,
          },
        });
      }

      if (role === "parent") {
        const occupant = await tx.occupant.findFirst({
          where: {
            publicId: String(studentOccupantId).trim(),
            active: true,
          },
          select: { studentId: true },
        });

        if (!occupant) {
          throw new Error("Active occupant record not found");
        }

        parent = await tx.parent.create({
          data: {
            userId: user.id,
            phoneNumber: String(phoneNumber).trim(),
          },
        });

        await tx.parentStudent.create({
          data: {
            parentId: parent.id,
            studentId: occupant.studentId,
            verified: true,
            active: true,
          },
        });
      }

      return { user, student, landlord, parent };
    });

    const token = jwt.sign(
      {
        id: result.user.id,
        role: result.user.role,
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.status(201).json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      studentId: result.student?.id || null,
      landlordId: result.landlord?.id || null,
      parentId: result.parent?.id || null,
      token,
    });
  } catch (error) {
    if (error.message === "Corridor not found") {
      return res.status(404).json({ error: "Corridor not found" });
    }
    if (error.message === "Institution not found") {
      return res.status(404).json({ error: "Institution not found" });
    }
    if (error.message === "Institution does not belong to corridor") {
      return res.status(400).json({ error: "Institution does not belong to corridor" });
    }
    if (error.message === "Active occupant record not found") {
      return res.status(404).json({ error: "Active occupant record not found" });
    }
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(String(password), user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    let studentId = null;
    let landlordId = null;
    let parentId = null;
    if (user.role === "student") {
      const student = await prisma.student.findFirst({ where: { userId: user.id } });
      studentId = student?.id || null;
    }
    if (user.role === "landlord") {
      const landlord = await prisma.landlord.findFirst({ where: { userId: user.id } });
      landlordId = landlord?.id || null;
    }
    if (user.role === "parent") {
      const parent = await prisma.parent.findFirst({ where: { userId: user.id } });
      parentId = parent?.id || null;
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      studentId,
      landlordId,
      parentId,
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
