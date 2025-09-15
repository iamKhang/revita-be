import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface BoothData {
  roomCode: string;
  boothCode: string;
  name: string;
  isActive: boolean;
}

async function main() {
  console.log('🌱 Starting booths seed...');

  // Read the booths JSON file
  const boothsPath = path.join(__dirname, 'Data', 'booths.json');
  const boothsData: BoothData[] = JSON.parse(fs.readFileSync(boothsPath, 'utf8'));

  console.log(`📄 Found ${boothsData.length} booths to seed`);

  // Get all existing clinic rooms to map room codes to IDs
  const clinicRooms = await prisma.clinicRoom.findMany({
    select: {
      id: true,
      roomCode: true,
    },
  });

  const roomCodeToIdMap = new Map<string, string>();
  clinicRooms.forEach(room => {
    roomCodeToIdMap.set(room.roomCode, room.id);
  });

  console.log(`🏥 Found ${clinicRooms.length} clinic rooms`);

  // Process each booth
  for (const boothData of boothsData) {
    try {
      // Check if booth already exists
      const existingBooth = await prisma.booth.findUnique({
        where: { boothCode: boothData.boothCode },
      });

      if (existingBooth) {
        console.log(`⚠️  Booth ${boothData.boothCode} already exists, skipping...`);
        continue;
      }

      // Get the room ID
      const roomId = roomCodeToIdMap.get(boothData.roomCode);
      if (!roomId) {
        console.log(`⚠️  Room ${boothData.roomCode} not found, skipping booth ${boothData.boothCode}...`);
        continue;
      }

      // Create the booth
      const booth = await prisma.booth.create({
        data: {
          boothCode: boothData.boothCode,
          name: boothData.name,
          roomId: roomId,
          description: `Buồng khám trong phòng ${boothData.roomCode}`,
          isActive: boothData.isActive,
        },
      });

      console.log(`✅ Created booth: ${booth.boothCode} - ${booth.name} in room ${boothData.roomCode}`);

    } catch (error) {
      console.error(`❌ Error creating booth ${boothData.boothCode}:`, error);
    }
  }

  console.log('🎉 Booths seed completed!');
}

main()
  .catch((e) => {
    console.error('💥 Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
