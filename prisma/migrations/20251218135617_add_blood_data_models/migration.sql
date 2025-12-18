-- CreateTable
CREATE TABLE "blood_data" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testDate" TEXT NOT NULL,
    "hbA1c" DOUBLE PRECISION,
    "randomBloodSugar" DOUBLE PRECISION,
    "totalCholesterol" DOUBLE PRECISION,
    "triglycerides" DOUBLE PRECISION,
    "hdlCholesterol" DOUBLE PRECISION,
    "ldlCholesterol" DOUBLE PRECISION,
    "bun" DOUBLE PRECISION,
    "creatinine" DOUBLE PRECISION,
    "uricAcid" DOUBLE PRECISION,
    "hemoglobin" DOUBLE PRECISION,
    "bnp" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cardiopulmonary_exercise_tests" (
    "id" TEXT NOT NULL,
    "bloodDataId" TEXT NOT NULL,
    "testDate" TEXT NOT NULL,
    "cpxRound" INTEGER NOT NULL,
    "atOneMinBefore" DOUBLE PRECISION,
    "atDuring" DOUBLE PRECISION,
    "maxLoad" DOUBLE PRECISION,
    "loadWeight" DOUBLE PRECISION,
    "vo2" DOUBLE PRECISION,
    "mets" DOUBLE PRECISION,
    "heartRate" DOUBLE PRECISION,
    "systolicBloodPressure" DOUBLE PRECISION,
    "findings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cardiopulmonary_exercise_tests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "blood_data" ADD CONSTRAINT "blood_data_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardiopulmonary_exercise_tests" ADD CONSTRAINT "cardiopulmonary_exercise_tests_bloodDataId_fkey" FOREIGN KEY ("bloodDataId") REFERENCES "blood_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;
