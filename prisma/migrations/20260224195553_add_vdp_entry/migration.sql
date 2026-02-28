-- CreateTable
CREATE TABLE "VDPEntry" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "corridorId" INTEGER NOT NULL,
    "intake" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VDPEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VDPEntry" ADD CONSTRAINT "VDPEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
