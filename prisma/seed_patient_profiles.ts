import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface PatientProfileSeed {
  id: string;
  profileCode: string;
  patientId?: string | null;
  name: string;
  phone?: string | null;
  dateOfBirth: string;
  gender: string;
  address?: string | null;
  occupation?: string | null;
  emergencyContact?: unknown;
  healthInsurance?: string | null;
  relationship?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const DATA_PATH = path.join(__dirname, 'Data', 'patient_profiles.json');

const toDate = (value?: string) => (value ? new Date(value) : undefined);

async function seedPatientProfiles() {
  console.log('🚀 Bắt đầu seed dữ liệu PatientProfile...');

  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Không tìm thấy file dữ liệu: ${DATA_PATH}`);
  }

  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const profiles: PatientProfileSeed[] = JSON.parse(raw);

  if (!Array.isArray(profiles)) {
    throw new Error('Dữ liệu patient_profiles.json phải là một mảng.');
  }

  console.log(`📄 Đọc được ${profiles.length} hồ sơ bệnh nhân.`);

  for (const profile of profiles) {
    await prisma.patientProfile.upsert({
      where: { id: profile.id },
      update: {
        profileCode: profile.profileCode,
        patientId: profile.patientId ?? null,
        name: profile.name,
        phone: profile.phone ?? null,
        dateOfBirth: toDate(profile.dateOfBirth)!,
        gender: profile.gender,
        address: profile.address ?? null,
        occupation: profile.occupation ?? null,
        emergencyContact: profile.emergencyContact ?? {},
        healthInsurance: profile.healthInsurance ?? null,
        relationship: profile.relationship ?? null,
        isActive: profile.isActive ?? true,
        createdAt: toDate(profile.createdAt) ?? new Date(),
        updatedAt: toDate(profile.updatedAt) ?? new Date(),
      },
      create: {
        id: profile.id,
        profileCode: profile.profileCode,
        patientId: profile.patientId ?? null,
        name: profile.name,
        phone: profile.phone ?? null,
        dateOfBirth: toDate(profile.dateOfBirth)!,
        gender: profile.gender,
        address: profile.address ?? null,
        occupation: profile.occupation ?? null,
        emergencyContact: profile.emergencyContact ?? {},
        healthInsurance: profile.healthInsurance ?? null,
        relationship: profile.relationship ?? null,
        isActive: profile.isActive ?? true,
        createdAt: toDate(profile.createdAt) ?? new Date(),
        updatedAt: toDate(profile.updatedAt) ?? new Date(),
      },
    });
  }

  console.log('✅ Seed dữ liệu PatientProfile hoàn tất!');
}

if (require.main === module) {
  seedPatientProfiles()
    .then(() => {
      console.log('🎉 Seed PatientProfile hoàn thành thành công!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seed PatientProfile thất bại:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedPatientProfiles };
