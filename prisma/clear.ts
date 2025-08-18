import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.medicalRecord.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.clinicRoomService.deleteMany();
  await prisma.clinicRoom.deleteMany();
  await prisma.service.deleteMany();
  await prisma.template.deleteMany();
  await prisma.specialty.deleteMany();
  await prisma.receptionist.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.patient.deleteMany();
  // await prisma.admin.deleteMany();
  await prisma.auth.deleteMany();
  console.log('All data cleared!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
