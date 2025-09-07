import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Simple code generator for seed data
function generateProfileCode(
  name: string,
  dateOfBirth: Date,
  gender: string,
  isIndependent: boolean = false,
): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const second = now.getSeconds().toString().padStart(2, '0');

  const genderCode =
    gender.toLowerCase().includes('nam') ||
    gender.toLowerCase().includes('male')
      ? 'M'
      : 'F';
  const lastNameInitial =
    name.split(' ')[0].charAt(0).toUpperCase().charCodeAt(0) - 64;
  const prefix = isIndependent ? 'PPI' : 'PP';

  return `${prefix}${year}${month}${day}${hour}${minute}${second}${genderCode}${lastNameInitial}`;
}

function generatePatientCode(
  name: string,
  dateOfBirth: Date,
  gender: string,
): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const second = now.getSeconds().toString().padStart(2, '0');

  const genderCode =
    gender.toLowerCase().includes('nam') ||
    gender.toLowerCase().includes('male')
      ? 'M'
      : 'F';
  const lastNameInitial =
    name.split(' ')[0].charAt(0).toUpperCase().charCodeAt(0) - 64;

  return `PAT${year}${month}${day}${hour}${minute}${second}${genderCode}${lastNameInitial}`;
}

function generateDoctorCode(name: string, specialty?: string): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const second = now.getSeconds().toString().padStart(2, '0');

  const specialtyCode = specialty ? getSpecialtyCode(specialty) : 'X';
  const lastNameInitial =
    name.split(' ')[0].charAt(0).toUpperCase().charCodeAt(0) - 64;

  return `DOC${year}${month}${day}${hour}${minute}${second}${specialtyCode}${lastNameInitial}`;
}

function getSpecialtyCode(specialty: string): string {
  const specialtyMap: Record<string, string> = {
    'tim mạch': 'TM',
    'thần kinh': 'TK',
    'nội khoa': 'NK',
    'ngoại khoa': 'NK',
    'sản phụ khoa': 'SG',
    'nhi khoa': 'NH',
    mắt: 'MT',
    'tai mũi họng': 'TMH',
    'da liễu': 'DL',
    'xương khớp': 'XK',
    'tâm thần': 'TT',
    'ung bướu': 'UB',
    'hồi sức cấp cứu': 'HS',
    'gây mê hồi sức': 'GM',
    'chẩn đoán hình ảnh': 'CD',
    'xét nghiệm': 'XN',
    dược: 'DC',
  };

  const specialtyLower = specialty.toLowerCase();
  for (const [key, code] of Object.entries(specialtyMap)) {
    if (specialtyLower.includes(key)) {
      return code;
    }
  }

  // Fallback: lấy 2 chữ cái đầu
  return specialty.substring(0, 2).toUpperCase();
}

const prisma = new PrismaClient();

// Stable IDs to keep data consistent across runs
const IDS = {
  specialties: {
    dental: '11111111-1111-1111-1111-111111111111',
    eye: '11111111-1111-1111-1111-111111111112',
    internal: '11111111-1111-1111-1111-111111111113',
    ent: '11111111-1111-1111-1111-111111111114',
  },
  auth: {
    rhm01: '22222222-2222-2222-2222-222222222201',
    rhm02: '22222222-2222-2222-2222-222222222202',
    mat01: '22222222-2222-2222-2222-222222222203',
    noi01: '22222222-2222-2222-2222-222222222204',
    tmh01: '22222222-2222-2222-2222-222222222205',
    patient01: '55555555-5555-5555-5555-555555555501',
    patient02: '55555555-5555-5555-5555-555555555502',
    patient03: '55555555-5555-5555-5555-555555555503',
    patient04: '55555555-5555-5555-5555-555555555504',
    patient05: '55555555-5555-5555-5555-555555555505',
    patient06: '55555555-5555-5555-5555-555555555506',
    patient07: '55555555-5555-5555-5555-555555555507',
    patient08: '55555555-5555-5555-5555-555555555508',
    patient09: '55555555-5555-5555-5555-555555555509',
    patient10: '55555555-5555-5555-5555-555555555510',
  },
  rooms: {
    RHM01: '33333333-3333-3333-3333-333333333301',
    RHM02: '33333333-3333-3333-3333-333333333302',
    MAT01: '33333333-3333-3333-3333-333333333303',
    NOI01: '33333333-3333-3333-3333-333333333304',
    TMH01: '33333333-3333-3333-3333-333333333305',
  },
  services: {
    KHAM_RHM: '44444444-4444-4444-4444-444444444401',
    CAORANG: '44444444-4444-4444-4444-444444444402',
    TRAM: '44444444-4444-4444-4444-444444444403',
    KHAM_MAT: '44444444-4444-4444-4444-444444444404',
    DOTHILUC: '44444444-4444-4444-4444-444444444405',
    KHUCXA: '44444444-4444-4444-4444-444444444406',
    KHAM_NOI: '44444444-4444-4444-4444-444444444407',
    KHAM_TMH: '44444444-4444-4444-4444-444444444408',
  },
  profiles: {
    pp01: '66666666-6666-6666-6666-666666666601',
    pp02: '66666666-6666-6666-6666-666666666602',
    pp03: '66666666-6666-6666-6666-666666666603',
    pp04: '66666666-6666-6666-6666-666666666604',
    pp05: '66666666-6666-6666-6666-666666666605',
    pp06: '66666666-6666-6666-6666-666666666606',
    pp07: '66666666-6666-6666-6666-666666666607',
    pp08: '66666666-6666-6666-6666-666666666608',
    pp09: '66666666-6666-6666-6666-666666666609',
    pp10: '66666666-6666-6666-6666-666666666610',
    // PatientProfile độc lập (không liên kết với Patient)
    pp11: '66666666-6666-6666-6666-666666666611',
    pp12: '66666666-6666-6666-6666-666666666612',
    pp13: '66666666-6666-6666-6666-666666666613',
  },
};

async function ensureSpecialtyWithId(id: string, name: string) {
  const byId = await prisma.specialty.findUnique({ where: { id } });
  if (byId) return byId;
  const byName = await prisma.specialty.findFirst({ where: { name } });
  if (byName) return byName;
  return prisma.specialty.create({ data: { id, name } });
}

async function ensureAuthAndDoctor(opts: {
  auth: {
    id: string;
    name: string;
    email: string;
    role: 'DOCTOR';
    phone?: string | null;
  };
  doctor: {
    id?: string;
    doctorCode: string;
    degrees: Prisma.InputJsonValue;
    yearsExperience: number;
    rating: number;
    workHistory: string;
    description: string;
  };
}) {
  const password = await bcrypt.hash('123456789', 10);
  let auth = await prisma.auth.findUnique({ where: { id: opts.auth.id } });
  if (!auth) {
    // fallback if existed by email with different id
    const byEmail = await prisma.auth.findUnique({
      where: { email: opts.auth.email },
    });
    auth =
      byEmail ??
      (await prisma.auth.create({
        data: {
          id: opts.auth.id,
          name: opts.auth.name,
          dateOfBirth: new Date('1985-01-01'),
          email: opts.auth.email,
          phone: opts.auth.phone ?? null,
          password,
          gender: 'male',
          avatar: null,
          address: 'TP HCM',
          citizenId: null,
          role: 'DOCTOR',
        },
      }));
  }
  let doctor = await prisma.doctor.findUnique({ where: { authId: auth.id } });
  if (!doctor) {
    // Generate doctor code if not provided
    const finalDoctorCode =
      opts.doctor.doctorCode ||
      generateDoctorCode(
        auth.name,
        'Nội khoa', // Default specialty
      );

    doctor = await prisma.doctor.create({
      data: {
        id: auth.id,
        doctorCode: finalDoctorCode,
        authId: auth.id,
        degrees: opts.doctor.degrees,
        yearsExperience: opts.doctor.yearsExperience,
        rating: opts.doctor.rating,
        workHistory: opts.doctor.workHistory,
        description: opts.doctor.description,
      },
    });
  }
  return { auth, doctor };
}

async function ensureServiceWithId(
  id: string,
  serviceCode: string,
  name: string,
  price: number,
  description: string,
) {
  let s = await prisma.service.findUnique({ where: { id } });
  if (!s) {
    const byCode = await prisma.service.findFirst({ where: { serviceCode } });
    s =
      byCode ??
      (await prisma.service.create({
        data: { id, serviceCode, name, price, description },
      }));
  }
  return s;
}

async function ensureAuthWithId(opts: {
  id: string;
  name: string;
  email: string;
  role: 'PATIENT';
  phone?: string | null;
}) {
  const password = await bcrypt.hash('123456789', 10);
  let auth = await prisma.auth.findUnique({ where: { id: opts.id } });
  if (!auth) {
    const byEmail = await prisma.auth.findUnique({
      where: { email: opts.email },
    });
    auth =
      byEmail ??
      (await prisma.auth.create({
        data: {
          id: opts.id,
          name: opts.name,
          dateOfBirth: new Date('1990-01-01'),
          email: opts.email,
          phone: opts.phone ?? null,
          password,
          gender: 'male',
          avatar: null,
          address: 'TP HCM',
          citizenId: null,
          role: 'PATIENT',
        },
      }));
  }
  return auth;
}

async function ensurePatientByAuthId(authId: string, patientCode?: string) {
  let patient = await prisma.patient.findUnique({ where: { authId } });
  if (!patient) {
    // Get auth info for code generation
    const auth = await prisma.auth.findUnique({ where: { id: authId } });
    const finalPatientCode =
      patientCode ||
      (auth
        ? generatePatientCode(auth.name, auth.dateOfBirth, auth.gender)
        : `PAT${Date.now()}`);

    patient = await prisma.patient.create({
      data: {
        id: authId,
        patientCode: finalPatientCode,
        authId,
        loyaltyPoints: 0,
      },
    });
  }
  return patient;
}

async function ensurePatientProfileWithId(opts: {
  id: string;
  profileCode: string;
  patientId?: string | null; // Có thể null - PatientProfile độc lập
  name: string;
  phone?: string | null;
  dateOfBirth: Date;
  gender: string;
  address?: string | null;
}) {
  let profile = await prisma.patientProfile.findUnique({
    where: { id: opts.id },
  });
  if (!profile) {
    const byCode = await prisma.patientProfile.findFirst({
      where: { profileCode: opts.profileCode },
    });
    // Generate profile code if not provided
    const finalProfileCode =
      opts.profileCode ||
      generateProfileCode(
        opts.name,
        opts.dateOfBirth,
        opts.gender,
        !opts.patientId, // isIndependent
      );

    profile =
      byCode ??
      (await prisma.patientProfile.create({
        data: {
          id: opts.id,
          profileCode: finalProfileCode,
          patientId: opts.patientId ?? null, // Có thể null
          name: opts.name,
          phone: opts.phone ?? null,
          dateOfBirth: opts.dateOfBirth,
          gender: opts.gender,
          address: opts.address ?? 'TP HCM',
          occupation: 'Nhân viên',
          emergencyContact: { name: 'Liên hệ khẩn cấp', phone: '0900000000' },
          healthInsurance: null,
          relationship: 'self',
        },
      }));
  }
  return profile;
}

async function ensureRoomWithId(
  id: string,
  roomCode: string,
  roomName: string,
  specialtyId: string,
  doctorId: string,
  description?: string | null,
) {
  let room = await prisma.clinicRoom.findUnique({ where: { id } });
  if (!room) {
    const byCode = await prisma.clinicRoom.findUnique({ where: { roomCode } });
    room =
      byCode ??
      (await prisma.clinicRoom.create({
        data: {
          id,
          roomCode,
          roomName,
          specialtyId,
          doctorId,
          description: description ?? null,
        },
      }));
  }
  return room;
}

async function linkRoomServices(roomId: string, serviceIds: string[]) {
  for (const serviceId of serviceIds) {
    const link = await prisma.clinicRoomService.findFirst({
      where: { clinicRoomId: roomId, serviceId },
    });
    if (!link) {
      await prisma.clinicRoomService.create({
        data: { clinicRoomId: roomId, serviceId },
      });
    }
  }
}

async function main() {
  // Specialties (curated)
  const specDental = await ensureSpecialtyWithId(
    IDS.specialties.dental,
    'Răng hàm mặt',
  );
  const specEye = await ensureSpecialtyWithId(IDS.specialties.eye, 'Mắt');
  const specInternal = await ensureSpecialtyWithId(
    IDS.specialties.internal,
    'Nội tổng quát',
  );
  const specENT = await ensureSpecialtyWithId(
    IDS.specialties.ent,
    'Tai mũi họng',
  );

  // Doctors (curated)
  const { doctor: doctorDental1 } = await ensureAuthAndDoctor({
    auth: {
      id: IDS.auth.rhm01,
      name: 'Bác sĩ RHM 01',
      email: 'doctor.rhm01@example.com',
      role: 'DOCTOR',
    },
    doctor: {
      doctorCode: 'DOC_RHM_01',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      degrees: JSON.parse(JSON.stringify(['BS CKI', 'Răng hàm mặt'])),
      yearsExperience: 10,
      rating: 4.6,
      workHistory: 'Bệnh viện RHM TP',
      description: 'Bác sĩ RHM phòng 01',
    },
  });
  const { doctor: doctorDental2 } = await ensureAuthAndDoctor({
    auth: {
      id: IDS.auth.rhm02,
      name: 'Bác sĩ RHM 02',
      email: 'doctor.rhm02@example.com',
      role: 'DOCTOR',
    },
    doctor: {
      doctorCode: 'DOC_RHM_02',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      degrees: JSON.parse(JSON.stringify(['BS CKI', 'Răng hàm mặt'])),
      yearsExperience: 8,
      rating: 4.5,
      workHistory: 'Bệnh viện RHM TP',
      description: 'Bác sĩ RHM phòng 02',
    },
  });
  const { doctor: doctorEye1 } = await ensureAuthAndDoctor({
    auth: {
      id: IDS.auth.mat01,
      name: 'Bác sĩ Mắt 01',
      email: 'doctor.mat01@example.com',
      role: 'DOCTOR',
    },
    doctor: {
      doctorCode: 'DOC_MAT_01',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      degrees: JSON.parse(JSON.stringify(['BS CKI', 'Mắt'])),
      yearsExperience: 9,
      rating: 4.7,
      workHistory: 'Bệnh viện Mắt',
      description: 'Bác sĩ Mắt phòng 01',
    },
  });
  const { doctor: doctorInternal1 } = await ensureAuthAndDoctor({
    auth: {
      id: IDS.auth.noi01,
      name: 'Bác sĩ Nội 01',
      email: 'doctor.noi01@example.com',
      role: 'DOCTOR',
    },
    doctor: {
      doctorCode: 'DOC_NOI_01',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      degrees: JSON.parse(JSON.stringify(['BS CKI', 'Nội tổng quát'])),
      yearsExperience: 12,
      rating: 4.6,
      workHistory: 'Bệnh viện Nội tổng quát',
      description: 'Bác sĩ Nội 01',
    },
  });
  const { doctor: doctorENT1 } = await ensureAuthAndDoctor({
    auth: {
      id: IDS.auth.tmh01,
      name: 'Bác sĩ TMH 01',
      email: 'doctor.tmh01@example.com',
      role: 'DOCTOR',
    },
    doctor: {
      doctorCode: 'DOC_TMH_01',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      degrees: JSON.parse(JSON.stringify(['BS CKI', 'Tai mũi họng'])),
      yearsExperience: 7,
      rating: 4.4,
      workHistory: 'Bệnh viện Tai Mũi Họng',
      description: 'Bác sĩ TMH 01',
    },
  });

  // Rooms (curated)
  const roomRHM01 = await ensureRoomWithId(
    IDS.rooms.RHM01,
    'RHM-01',
    'Phòng RHM 01',
    specDental.id,
    doctorDental1.id,
    'Phòng răng hàm mặt số 01',
  );
  const roomRHM02 = await ensureRoomWithId(
    IDS.rooms.RHM02,
    'RHM-02',
    'Phòng RHM 02',
    specDental.id,
    doctorDental2.id,
    'Phòng răng hàm mặt số 02',
  );
  const roomMAT01 = await ensureRoomWithId(
    IDS.rooms.MAT01,
    'MAT-01',
    'Phòng Mắt 01',
    specEye.id,
    doctorEye1.id,
    'Phòng mắt số 01',
  );
  const roomNOI01 = await ensureRoomWithId(
    IDS.rooms.NOI01,
    'NOI-01',
    'Phòng Nội 01',
    specInternal.id,
    doctorInternal1.id,
    'Phòng nội tổng quát 01',
  );
  const roomTMH01 = await ensureRoomWithId(
    IDS.rooms.TMH01,
    'TMH-01',
    'Phòng TMH 01',
    specENT.id,
    doctorENT1.id,
    'Phòng tai mũi họng 01',
  );

  // Services (global curated, reused across rooms)
  const svcKhamRHM = await ensureServiceWithId(
    IDS.services.KHAM_RHM,
    'KHAM_RHM',
    'Khám răng tổng quát',
    150000,
    'Khám răng tổng quát',
  );
  const svcCaoRang = await ensureServiceWithId(
    IDS.services.CAORANG,
    'CAORANG',
    'Lấy cao răng',
    200000,
    'Lấy cao răng',
  );
  const svcTram = await ensureServiceWithId(
    IDS.services.TRAM,
    'TRAM',
    'Trám răng',
    300000,
    'Trám răng',
  );

  const svcKhamMat = await ensureServiceWithId(
    IDS.services.KHAM_MAT,
    'KHAM_MAT',
    'Khám mắt tổng quát',
    150000,
    'Khám mắt tổng quát',
  );
  const svcDoThiLuc = await ensureServiceWithId(
    IDS.services.DOTHILUC,
    'DOTHILUC',
    'Đo thị lực',
    120000,
    'Đo thị lực',
  );
  const svcKhucXa = await ensureServiceWithId(
    IDS.services.KHUCXA,
    'KHUCXA',
    'Đo khúc xạ',
    180000,
    'Đo khúc xạ',
  );

  const svcKhamNoi = await ensureServiceWithId(
    IDS.services.KHAM_NOI,
    'KHAM_NOI',
    'Khám nội tổng quát',
    150000,
    'Khám nội tổng quát',
  );
  const svcKhamTMH = await ensureServiceWithId(
    IDS.services.KHAM_TMH,
    'KHAM_TMH',
    'Khám tai mũi họng',
    150000,
    'Khám tai mũi họng',
  );

  // Link rooms <-> services (many-to-many)
  await linkRoomServices(roomRHM01.id, [
    svcKhamRHM.id,
    svcCaoRang.id,
    svcTram.id,
  ]);
  await linkRoomServices(roomRHM02.id, [svcKhamRHM.id, svcCaoRang.id]);
  await linkRoomServices(roomMAT01.id, [
    svcKhamMat.id,
    svcDoThiLuc.id,
    svcKhucXa.id,
  ]);
  await linkRoomServices(roomNOI01.id, [svcKhamNoi.id]);
  await linkRoomServices(roomTMH01.id, [svcKhamTMH.id]);

  // Create 10 patients with one profile each (stable IDs)
  const patientDefs = [
    {
      idx: '01',
      authId: IDS.auth.patient01,
      email: 'patient01@example.com',
      name: 'Nguyễn Văn A',
      phone: '0901000001',
      profileId: IDS.profiles.pp01,
      profileCode: 'PP_U01',
      gender: 'male',
      dob: new Date('1990-01-15'),
    },
    {
      idx: '02',
      authId: IDS.auth.patient02,
      email: 'patient02@example.com',
      name: 'Trần Thị B',
      phone: '0901000002',
      profileId: IDS.profiles.pp02,
      profileCode: 'PP_U02',
      gender: 'female',
      dob: new Date('1991-02-20'),
    },
    {
      idx: '03',
      authId: IDS.auth.patient03,
      email: 'patient03@example.com',
      name: 'Lê Văn C',
      phone: '0901000003',
      profileId: IDS.profiles.pp03,
      profileCode: 'PP_U03',
      gender: 'male',
      dob: new Date('1989-03-10'),
    },
    {
      idx: '04',
      authId: IDS.auth.patient04,
      email: 'patient04@example.com',
      name: 'Phạm Thị D',
      phone: '0901000004',
      profileId: IDS.profiles.pp04,
      profileCode: 'PP_U04',
      gender: 'female',
      dob: new Date('1992-04-05'),
    },
    {
      idx: '05',
      authId: IDS.auth.patient05,
      email: 'patient05@example.com',
      name: 'Huỳnh Văn E',
      phone: '0901000005',
      profileId: IDS.profiles.pp05,
      profileCode: 'PP_U05',
      gender: 'male',
      dob: new Date('1993-05-25'),
    },
    {
      idx: '06',
      authId: IDS.auth.patient06,
      email: 'patient06@example.com',
      name: 'Võ Thị F',
      phone: '0901000006',
      profileId: IDS.profiles.pp06,
      profileCode: 'PP_U06',
      gender: 'female',
      dob: new Date('1994-06-18'),
    },
    {
      idx: '07',
      authId: IDS.auth.patient07,
      email: 'patient07@example.com',
      name: 'Đặng Văn G',
      phone: '0901000007',
      profileId: IDS.profiles.pp07,
      profileCode: 'PP_U07',
      gender: 'male',
      dob: new Date('1995-07-12'),
    },
    {
      idx: '08',
      authId: IDS.auth.patient08,
      email: 'patient08@example.com',
      name: 'Bùi Thị H',
      phone: '0901000008',
      profileId: IDS.profiles.pp08,
      profileCode: 'PP_U08',
      gender: 'female',
      dob: new Date('1996-08-30'),
    },
    {
      idx: '09',
      authId: IDS.auth.patient09,
      email: 'patient09@example.com',
      name: 'Phan Văn I',
      phone: '0901000009',
      profileId: IDS.profiles.pp09,
      profileCode: 'PP_U09',
      gender: 'male',
      dob: new Date('1990-09-09'),
    },
    {
      idx: '10',
      authId: IDS.auth.patient10,
      email: 'patient10@example.com',
      name: 'Ngô Thị K',
      phone: '0901000010',
      profileId: IDS.profiles.pp10,
      profileCode: 'PP_U10',
      gender: 'female',
      dob: new Date('1991-10-22'),
    },
  ];

  for (const pd of patientDefs) {
    const auth = await ensureAuthWithId({
      id: pd.authId,
      name: pd.name,
      email: pd.email,
      role: 'PATIENT',
    });
    const patient = await ensurePatientByAuthId(auth.id, `PAT_${pd.idx}`);
    await ensurePatientProfileWithId({
      id: pd.profileId,
      profileCode: pd.profileCode,
      patientId: patient.id, // Liên kết với Patient
      name: pd.name,
      phone: pd.phone,
      dateOfBirth: pd.dob,
      gender: pd.gender,
      address: 'TP HCM',
    });
  }

  // Tạo một số PatientProfile độc lập (không liên kết với Patient)
  const independentProfiles = [
    {
      id: IDS.profiles.pp11,
      profileCode: 'PP_IND_01',
      name: 'Nguyễn Thị X',
      phone: '0902000001', // Có thể trùng số điện thoại
      dateOfBirth: new Date('1988-03-15'),
      gender: 'female',
    },
    {
      id: IDS.profiles.pp12,
      profileCode: 'PP_IND_02',
      name: 'Trần Văn Y',
      phone: '0902000002',
      dateOfBirth: new Date('1992-07-22'),
      gender: 'male',
    },
    {
      id: IDS.profiles.pp13,
      profileCode: 'PP_IND_03',
      name: 'Lê Thị Z',
      phone: '0901000001', // Trùng số điện thoại với patient01
      dateOfBirth: new Date('1995-11-08'),
      gender: 'female',
    },
  ];

  for (const profile of independentProfiles) {
    await ensurePatientProfileWithId({
      id: profile.id,
      profileCode: profile.profileCode,
      patientId: null, // Không liên kết với Patient
      name: profile.name,
      phone: profile.phone,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      address: 'TP HCM',
    });
  }

  console.log(
    'Seed clinic data completed (specialties, doctors, rooms, services, links, patients, independent profiles).',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
