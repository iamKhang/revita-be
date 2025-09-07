import { PrismaClient, Role } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Đường dẫn thư mục Data (đặt các file JSON của bạn ở prisma/Data)
const DATA = (...p: string[]) => path.join(__dirname, "Data", ...p);

function readJson<T>(file: string): T {
  const full = DATA(file);
  if (!fs.existsSync(full)) {
    throw new Error(`Không tìm thấy file: ${full}`);
  }
  const raw = fs.readFileSync(full, "utf-8");
  return JSON.parse(raw) as T;
}

// Parse ISO date string -> Date | undefined
const asDate = (v: any) => (v ? new Date(v) : undefined);

// Chỉ giữ các field hợp lệ cho Auth (tránh field lạ làm fail)
// LƯU Ý: Prisma enum Role cần đúng giá trị: "DOCTOR" | "PATIENT" | ...
async function mapAuth(a: any) {
  const role: Role = (Role as any)[a.role] ?? a.role; // hỗ trợ string literal
  
  // Mã hóa password nếu có
  let hashedPassword: string | null = null;
  if (a.password) {
    const saltRounds = 10;
    hashedPassword = await bcrypt.hash(a.password, saltRounds);
  }
  
  return {
    id: a.id,
    phone: a.phone ?? null,
    email: a.email ?? null,
    googleId: null,
    password: hashedPassword,
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null,
    name: a.name,
    dateOfBirth: asDate(a.dateOfBirth)!,
    gender: a.gender,
    avatar: a.avatar ?? null,
    address: a.address,
    citizenId: a.citizenId ?? null,
    role,
  };
}

function mapDoctor(d: any) {
  return {
    id: d.id,
    doctorCode: d.doctorCode,
    authId: d.authId,
    degrees: d.degrees ?? [],
    yearsExperience: d.yearsExperience,
    rating: d.rating,
    workHistory: d.workHistory,
    description: d.description,
  };
}

function mapPatient(p: any) {
  return {
    id: p.id,
    patientCode: p.patientCode,
    authId: p.authId ?? null,
    loyaltyPoints: p.loyaltyPoints ?? 0,
  };
}

function mapReceptionist(r: any) {
  return {
    id: r.id,
    authId: r.authId,
  };
}

function mapCashier(c: any) {
  return {
    id: c.id,
    authId: c.authId,
  };
}

function mapAdmin(a: any) {
  return {
    id: a.id,
    authId: a.authId,
    adminCode: a.adminCode ?? `ADM-${a.id?.slice(0, 6)}`, // nếu schema bạn có adminCode thì giữ; nếu không, Prisma sẽ bỏ qua field lạ
  } as any;
}

function mapTechnician(t: any, index: number) {
  return {
    id: t.id,
    technicianCode: `TECH-${String(index + 1).padStart(3, '0')}`,
    authId: t.authId,
  };
}

function mapPatientProfile(pf: any) {
  return {
    id: pf.id,
    profileCode: pf.profileCode,
    patientId: pf.patientId,
    name: pf.name,
    dateOfBirth: asDate(pf.dateOfBirth)!,
    gender: pf.gender,
    address: pf.address ?? null,
    occupation: pf.occupation ?? null,
    emergencyContact: pf.emergencyContact ?? {},
    healthInsurance: pf.healthInsurance ?? null,
    relationship: pf.relationship ?? null,
    isActive: pf.isActive ?? true,
    createdAt: asDate(pf.createdAt) ?? new Date(),
    updatedAt: asDate(pf.updatedAt) ?? new Date(),
  };
}

async function main() {
  // === Đọc file JSON theo đúng danh sách bạn đã gửi ===
  const auths = readJson<any[]>("auth.json");                 // :contentReference[oaicite:8]{index=8}
  const doctors = readJson<any[]>("doctors.json");            // :contentReference[oaicite:9]{index=9}
  const patients = readJson<any[]>("patients.json");          // :contentReference[oaicite:10]{index=10}
  const patientProfiles = readJson<any[]>("patient_profiles.json"); // :contentReference[oaicite:11]{index=11}
  const receptionists = readJson<any[]>("receptionists.json");     // :contentReference[oaicite:12]{index=12}
  const cashiers = readJson<any[]>("cashiers.json");               // :contentReference[oaicite:13]{index=13}
  const admins = readJson<any[]>("admins.json");                   // :contentReference[oaicite:14]{index=14}
  const technicians = readJson<any[]>("technicians.json");         // :contentReference[oaicite:15]{index=15}

  // Không bắt buộc, dùng để cảnh báo nhẹ nếu doctors.json có specialtyCode không thuộc danh mục
  let specialtyCodes: Set<string> | null = null;
  try {
    const specs = readJson<any[]>("specialties.json");        // :contentReference[oaicite:15]{index=15}
    specialtyCodes = new Set((specs ?? []).map(s => s.specialtyCode));
  } catch {
    // bỏ qua nếu không có file
  }

  // === Seed Auth trước
  console.log("⏳ Seeding Auth...");
  for (const raw of auths) {
    const data = await mapAuth(raw);
    await prisma.auth.upsert({
      where: { id: data.id },
      update: {},
      create: data,
    });
  }

  // === Seed Doctors
  console.log("⏳ Seeding Doctors...");
  for (const raw of doctors) {
    // Cảnh báo nếu có specialtyCode không nằm trong specialties.json (nếu có)
    if (specialtyCodes && raw.specialtyCode && !specialtyCodes.has(raw.specialtyCode)) {
      console.warn(`⚠️  Doctor ${raw.doctorCode} có specialtyCode không khớp danh mục: ${raw.specialtyCode}`);
    }
    const data = mapDoctor(raw);
    await prisma.doctor.upsert({
      where: { id: data.id },
      update: {},
      create: data,
    });
  }

  // === Seed Technicians
  console.log("⏳ Seeding Technicians...");
  for (const [index, raw] of technicians.entries()) {
    const data = mapTechnician(raw, index);
    await prisma.technician.upsert({
      where: { id: data.id },
      update: {},
      create: data,
    });
  }

  // === Seed Patients
  console.log("⏳ Seeding Patients...");
  for (const raw of patients) {
    const data = mapPatient(raw);
    await prisma.patient.upsert({
      where: { id: data.id },
      update: {},
      create: data,
    });
  }

  // === Seed PatientProfiles
  console.log("⏳ Seeding PatientProfiles...");
  for (const raw of patientProfiles) {
    const data = mapPatientProfile(raw);
    await prisma.patientProfile.upsert({
      where: { id: data.id },
      update: {},
      create: data,
    });
  }

  // === Seed Receptionists
  console.log("⏳ Seeding Receptionists...");
  for (const raw of receptionists) {
    const data = mapReceptionist(raw);
    await prisma.receptionist.upsert({
      where: { id: data.id },
      update: {},
      create: data,
    });
  }

  // === Seed Cashiers
  console.log("⏳ Seeding Cashiers...");
  for (const raw of cashiers) {
    const data = mapCashier(raw);
    await prisma.cashier.upsert({
      where: { id: data.id },
      update: {},
      create: data,
    });
  }

  // === Seed Admins
  console.log("⏳ Seeding Admins...");
  for (const raw of admins) {
    const data = mapAdmin(raw);
    await prisma.admin.upsert({
      where: { id: data.id },
      update: {},
      create: data,
    });
  }

  console.log("✅ Seed users completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
