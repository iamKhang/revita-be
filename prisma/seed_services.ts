import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ServiceData {
  serviceCode: string;
  name: string;
  price: number;
  timePerPatient: number;
  description: string;
  rooms: string[];
}

async function main() {
  console.log('🌱 Starting services seed...');

  // Read the services JSON file
  const servicesPath = path.join(__dirname, 'Data', 'services.json');
  const servicesData: ServiceData[] = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));

  console.log(`📄 Found ${servicesData.length} services to seed`);

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

  // Process each service
  for (const serviceData of servicesData) {
    try {
      // Check if service already exists
      const existingService = await prisma.service.findUnique({
        where: { serviceCode: serviceData.serviceCode },
      });

      if (existingService) {
        console.log(`⚠️  Service ${serviceData.serviceCode} already exists, skipping...`);
        continue;
      }

      // Create the service
      const service = await prisma.service.create({
        data: {
          serviceCode: serviceData.serviceCode,
          name: serviceData.name,
          price: serviceData.price,
          durationMinutes: serviceData.timePerPatient,
          description: serviceData.description,
        },
      });

      console.log(`✅ Created service: ${service.serviceCode} - ${service.name}`);

      // Create clinic room service relationships
      const clinicRoomServiceData = serviceData.rooms
        .map(roomCode => {
          const roomId = roomCodeToIdMap.get(roomCode);
          if (!roomId) {
            console.log(`⚠️  Room ${roomCode} not found, skipping...`);
            return null;
          }
          return {
            clinicRoomId: roomId,
            serviceId: service.id,
          };
        })
        .filter((item): item is { clinicRoomId: string; serviceId: string } => item !== null);

      if (clinicRoomServiceData.length > 0) {
        await prisma.clinicRoomService.createMany({
          data: clinicRoomServiceData,
          skipDuplicates: true,
        });
        console.log(`🔗 Linked service to ${clinicRoomServiceData.length} rooms`);
      }

    } catch (error) {
      console.error(`❌ Error creating service ${serviceData.serviceCode}:`, error);
    }
  }

  console.log('🎉 Services seed completed!');
}

main()
  .catch((e) => {
    console.error('💥 Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
