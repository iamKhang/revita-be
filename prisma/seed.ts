import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Tạo Clinic
  const clinic = await prisma.clinic.create({
    data: {
      clinicCode: 'CLINIC001',
      name: 'Phòng khám Đa khoa Trà Ôn',
      address: '123 Đường Lớn, TP HCM',
      phone: '0123456789',
      email: 'clinic1@example.com',
    },
  });

  // 2. Tạo Specialty
  const specialty = await prisma.specialty.create({
    data: {
      name: 'Nội tổng quát',
      clinicId: clinic.id,
    },
  });

  // 3. Tạo Service
  await prisma.service.create({
    data: {
      serviceCode: 'SERVICE001',
      name: 'Khám tổng quát',
      price: 200000,
      description: 'Khám sức khỏe tổng quát',
      specialtyId: specialty.id,
      clinicId: clinic.id,
    },
  });

  // 4. Tạo các user và auth cho từng role
  const password = await bcrypt.hash('123456789', 10);

  // Doctor
  const doctorUser = await prisma.user.create({
    data: {
      name: 'Trần Đình Kiên',
      dateOfBirth: new Date('2003-05-07'),
      gender: 'male',
      avatar: null,
      address: 'TP HCM',
      citizenId: '1111111111',
      role: 'DOCTOR',
      auth: {
        create: {
          phone: '0325421882',
          email: 'doctor1@example.com',
          password,
        },
      },
    },
  });
  const doctor = await prisma.doctor.create({
    data: {
      doctorCode: 'DOC001',
      userId: doctorUser.id,
      clinicId: clinic.id,
      degrees: 'Bác sĩ đa khoa',
      yearsExperience: 10,
      rating: 4.8,
      workHistory: 'Bệnh viện Trà Ôn',
      description: 'Chuyên gia nội tổng quát',
    },
  });
  await prisma.doctorSpecialty.create({
    data: {
      doctorId: doctor.id,
      specialtyId: specialty.id,
    },
  });

  // Patient
  const patientUser = await prisma.user.create({
    data: {
      name: 'Nguyễn Thanh Cảnh',
      dateOfBirth: new Date('2003-01-01'),
      gender: 'male',
      avatar: null,
      address: 'TP HCM',
      citizenId: '2222222222',
      role: 'PATIENT',
      auth: {
        create: {
          phone: '0900000002',
          email: 'patient1@example.com',
          password,
        },
      },
    },
  });
  await prisma.patient.create({
    data: {
      patientCode: 'PAT001',
      userId: patientUser.id,
      address: 'TP HCM',
      occupation: 'Sinh viên',
      emergencyContact: JSON.stringify({
        name: 'Lê Hoàng Khang',
        phone: '0900000003',
      }),
      healthInsurance: 'HI123456',
    },
  });

  // Receptionist
  const receptionistUser = await prisma.user.create({
    data: {
      name: 'Lê Hoàng Khang',
      dateOfBirth: new Date('1990-03-10'),
      gender: 'male',
      avatar: null,
      address: 'TP HCM',
      citizenId: '3333333333',
      role: 'RECEPTIONIST',
      auth: {
        create: {
          phone: '0900000004',
          email: 'receptionist1@example.com',
          password,
        },
      },
    },
  });
  await prisma.receptionist.create({
    data: {
      userId: receptionistUser.id,
      clinicId: clinic.id,
    },
  });

  // Clinic Admin
  const clinicAdminUser = await prisma.user.create({
    data: {
      name: 'Trần Đình Kiên',
      dateOfBirth: new Date('1985-07-20'),
      gender: 'male',
      avatar: null,
      address: 'TP HCM',
      citizenId: '4444444444',
      role: 'CLINIC_ADMIN',
      auth: {
        create: {
          phone: '0900000005',
          email: 'clinicadmin1@example.com',
          password,
        },
      },
    },
  });
  await prisma.clinicAdmin.create({
    data: {
      clinicAdminCode: 'CA001',
      userId: clinicAdminUser.id,
      clinicId: clinic.id,
    },
  });

  // System Admin
  const systemAdminUser = await prisma.user.create({
    data: {
      name: 'Trần Đình Kiên',
      dateOfBirth: new Date('2003-05-07'),
      gender: 'male',
      avatar: null,
      address: 'TP HCM',
      citizenId: '5555555555',
      role: 'SYSTEM_ADMIN',
      auth: {
        create: {
          phone: '0325421881',
          email: 'systemadmin@example.com',
          password,
        },
      },
    },
  });
  await prisma.systemAdmin.create({
    data: {
      systemAdminCode: 'SA001',
      userId: systemAdminUser.id,
    },
  });

  console.log('Seeded clinic, users, and roles!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .finally(() => prisma.$disconnect());
