import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  // === Đọc file JSON ===
  const specialties = JSON.parse(
    fs.readFileSync(path.join(__dirname, "Data/specialties.json"), "utf-8")
  );
  const clinicRooms = JSON.parse(
    fs.readFileSync(path.join(__dirname, "Data/clinic_rooms.json"), "utf-8")
  );
  const booths = JSON.parse(
    fs.readFileSync(path.join(__dirname, "Data/booths.json"), "utf-8")
  );
  const services = JSON.parse(
    fs.readFileSync(path.join(__dirname, "Data/services.json"), "utf-8")
  );

  // === Seed Specialty ===
  console.log("Seeding specialties...");
  const specialtyMap: Record<string, string> = {}; // specialtyCode -> id
  for (const s of specialties) {
    const spec = await prisma.specialty.upsert({
      where: { specialtyCode: s.specialtyCode },
      update: { name: s.name },
      create: {
        specialtyCode: s.specialtyCode,
        name: s.name,
      },
    });
    specialtyMap[s.specialtyCode] = spec.id;
  }

  // === Seed ClinicRoom ===
  console.log("Seeding clinic rooms...");
  const roomMap: Record<string, string> = {}; // roomCode -> id
  for (const r of clinicRooms) {
    const room = await prisma.clinicRoom.upsert({
      where: { roomCode: r.roomCode },
      update: {
        roomName: r.roomName,
        description: r.description,
        address: r.address,
        specialtyId: specialtyMap[r.specialtyCode],
      },
      create: {
        roomCode: r.roomCode,
        roomName: r.roomName,
        description: r.description,
        address: r.address,
        specialtyId: specialtyMap[r.specialtyCode],
      },
    });
    roomMap[r.roomCode] = room.id;
  }

  // === Seed Booth ===
  console.log("Seeding booths...");
  for (const b of booths) {
    await prisma.booth.upsert({
      where: { boothCode: b.boothCode },
      update: {
        name: b.name,
        isActive: b.isActive,
        roomId: roomMap[b.roomCode],
      },
      create: {
        boothCode: b.boothCode,
        name: b.name,
        isActive: b.isActive,
        roomId: roomMap[b.roomCode],
      },
    });
  }

  // === Seed Service + ClinicRoomService ===
  console.log("Seeding services...");
  for (const s of services) {
    const service = await prisma.service.upsert({
      where: { serviceCode: s.serviceCode },
      update: {
        name: s.name,
        price: s.price,
        description: s.description,
        timePerPatient: s.timePerPatient,
      },
      create: {
        serviceCode: s.serviceCode,
        name: s.name,
        price: s.price,
        description: s.description,
        timePerPatient: s.timePerPatient,
      },
    });

    // Liên kết service với các phòng
    for (const roomCode of s.rooms) {
      const roomId = roomMap[roomCode];
      if (!roomId) continue;
      await prisma.clinicRoomService.upsert({
        where: {
          clinicRoomId_serviceId: {
            clinicRoomId: roomId,
            serviceId: service.id,
          },
        },
        update: {},
        create: {
          clinicRoomId: roomId,
          serviceId: service.id,
        },
      });
    }
  }

  console.log("✅ Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
