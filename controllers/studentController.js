const prisma = require("../prismaClient");

async function createStudent(req, res, next) {
  try {
    const { name, intake, corridorId } = req.body;

    if (!name || !intake || !corridorId) {
      return res.status(400).json({ error: "name, intake and corridorId are required" });
    }

    const corridor = await prisma.corridor.findUnique({ where: { id: Number(corridorId) } });

    if (!corridor) {
      return res.status(404).json({ error: "Corridor not found" });
    }

    const student = await prisma.student.create({
      data: {
        name: String(name).trim(),
        intake: String(intake).trim(),
        corridorId: Number(corridorId),
      },
    });

    res.status(201).json(student);
  } catch (error) {
    next(error);
  }
}

module.exports = { createStudent };
