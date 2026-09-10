-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "isAdultOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isCoupleFriendly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OwnerProfile" ADD COLUMN     "bankAccountLast4" TEXT,
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankIfsc" TEXT,
ADD COLUMN     "bankName" TEXT;
