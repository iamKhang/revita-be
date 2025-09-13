import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface SpecialtyData {
  specialtyCode: string;
  name: string;
}

async function main() {
  console.log('🌱 Starting specialties seed...');

  // Read the specialties JSON file
  const specialtiesPath = path.join(__dirname, 'Data', 'specialties.json');
  const specialtiesData: SpecialtyData[] = JSON.parse(fs.readFileSync(specialtiesPath, 'utf8'));

  console.log(`📄 Found ${specialtiesData.length} specialties to seed`);

  // Process each specialty
  for (const specialtyData of specialtiesData) {
    try {
      // Check if specialty already exists
      const existingSpecialty = await prisma.specialty.findUnique({
        where: { specialtyCode: specialtyData.specialtyCode },
      });

      if (existingSpecialty) {
        console.log(`⚠️  Specialty ${specialtyData.specialtyCode} already exists, skipping...`);
        continue;
      }

      // Create the specialty
      const specialty = await prisma.specialty.create({
        data: {
          specialtyCode: specialtyData.specialtyCode,
          name: specialtyData.name,
        },
      });

      console.log(`✅ Created specialty: ${specialty.specialtyCode} - ${specialty.name}`);

    } catch (error) {
      console.error(`❌ Error creating specialty ${specialtyData.specialtyCode}:`, error);
    }
  }

  console.log('🎉 Specialties seed completed!');
}

main()
  .catch((e) => {
    console.error('💥 Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
