import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ClinicRoomData {
  roomCode: string;
  roomName: string;
  specialtyCode: string;
  description: string;
  address: string;
}

async function main() {
  console.log('🌱 Starting clinic rooms seed...');

  // Read the clinic rooms JSON file
  const clinicRoomsPath = path.join(__dirname, 'Data', 'clinic_rooms.json');
  const clinicRoomsData: ClinicRoomData[] = JSON.parse(fs.readFileSync(clinicRoomsPath, 'utf8'));

  console.log(`📄 Found ${clinicRoomsData.length} clinic rooms to seed`);

  // Get all existing specialties to map specialty codes to IDs
  const specialties = await prisma.specialty.findMany({
    select: {
      id: true,
      specialtyCode: true,
    },
  });

  const specialtyCodeToIdMap = new Map<string, string>();
  specialties.forEach(specialty => {
    specialtyCodeToIdMap.set(specialty.specialtyCode, specialty.id);
  });

  console.log(`🏥 Found ${specialties.length} specialties`);

  // Process each clinic room
  for (const roomData of clinicRoomsData) {
    try {
      // Check if clinic room already exists
      const existingRoom = await prisma.clinicRoom.findUnique({
        where: { roomCode: roomData.roomCode },
      });

      if (existingRoom) {
        console.log(`⚠️  Clinic room ${roomData.roomCode} already exists, skipping...`);
        continue;
      }

      // Get the specialty ID
      const specialtyId = specialtyCodeToIdMap.get(roomData.specialtyCode);
      if (!specialtyId) {
        console.log(`⚠️  Specialty ${roomData.specialtyCode} not found, skipping room ${roomData.roomCode}...`);
        continue;
      }

      // Create the clinic room
      const clinicRoom = await prisma.clinicRoom.create({
        data: {
          roomCode: roomData.roomCode,
          roomName: roomData.roomName,
          specialtyId: specialtyId,
          description: roomData.description,
          address: roomData.address,
        },
      });

      console.log(`✅ Created clinic room: ${clinicRoom.roomCode} - ${clinicRoom.roomName} (${roomData.specialtyCode})`);

    } catch (error) {
      console.error(`❌ Error creating clinic room ${roomData.roomCode}:`, error);
    }
  }

  console.log('🎉 Clinic rooms seed completed!');
}

main()
  .catch((e) => {
    console.error('💥 Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
