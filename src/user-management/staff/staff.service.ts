import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { CertificateType, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CodeGeneratorService } from '../patient-profile/code-generator.service';

@Injectable()
export class StaffService {
  private codeGen = new CodeGeneratorService();
  private static readonly STAFF_ROLES: Role[] = [
    Role.DOCTOR,
    Role.RECEPTIONIST,
    Role.TECHNICIAN,
    Role.CASHIER,
    Role.ADMIN,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private parseDateOrThrow(value: string | Date, fieldName: string): Date {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) {
      throw new BadRequestException(`Invalid date for ${fieldName}`);
    }
    return d;
  }

  private generateRandomPassword(length = 10): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < length; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  }

  async createStaff(body: CreateStaffDto) {
    const { name, dateOfBirth, gender, address, role, phone, email, avatar, citizenId } = body;
    if (!name || !dateOfBirth || !gender || !address || !role) {
      throw new BadRequestException('Missing required fields');
    }
    const roleValue: Role = (typeof role === 'string' ? (role.toUpperCase() as Role) : role) as Role;
    if (!StaffService.STAFF_ROLES.includes(roleValue)) {
      throw new BadRequestException('Role must be one of: DOCTOR, RECEPTIONIST, TECHNICIAN, CASHIER, ADMIN');
    }

    if (citizenId) {
      const existed = await this.prisma.auth.findUnique({ where: { citizenId } });
      if (existed) throw new BadRequestException('CitizenId already exists');
    }
    if (email) {
      const existedEmail = await this.prisma.auth.findUnique({ where: { email } }).catch(() => null);
      if (existedEmail) throw new BadRequestException('Email already exists');
    }
    if (phone) {
      const existedPhone = await this.prisma.auth.findUnique({ where: { phone } }).catch(() => null);
      if (existedPhone) throw new BadRequestException('Phone already exists');
    }

    const plainPassword = this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const auth = await tx.auth.create({
          data: {
            name,
          dateOfBirth: this.parseDateOrThrow(dateOfBirth, 'dateOfBirth'),
            gender,
            address,
            citizenId: citizenId || null,
            avatar: avatar || null,
          role: roleValue,
            phone: phone || null,
            email: email || null,
            password: hashedPassword,
          },
        });

        let staffRecord: any = null;
      if (roleValue === Role.DOCTOR) {
          if (!body.doctorInfo) {
            throw new BadRequestException('Missing required field for doctor: doctorInfo');
          }
          const info = body.doctorInfo;
          if (!info.specialtyId) {
            throw new BadRequestException('Missing required field for doctor: doctorInfo.specialtyId');
          }
          const doctorCode = this.codeGen.generateDoctorCode(name, undefined);
          staffRecord = await tx.doctor.create({
            data: {
              authId: auth.id,
              doctorCode,
              yearsExperience: info.yearsExperience ?? 0,
              rating: info.rating ?? 0,
              workHistory: info.workHistory ?? '',
              description: info.description ?? '',
              specialtyId: info.specialtyId,
              subSpecialties: info.subSpecialties ?? [],
              position: info.position ?? null,
            },
          });
      } else if (roleValue === Role.TECHNICIAN) {
          const technicianCode = `TECH${Date.now()}`; // simple unique code
          staffRecord = await tx.technician.create({
            data: {
              authId: auth.id,
              technicianCode,
            },
          });
      } else if (roleValue === Role.RECEPTIONIST) {
          staffRecord = await tx.receptionist.create({
            data: { authId: auth.id },
          });
      } else if (roleValue === Role.CASHIER) {
          staffRecord = await tx.cashier.create({
            data: { authId: auth.id },
          });
      } else if (roleValue === Role.ADMIN) {
          const adminCode = this.codeGen.generateAdminCode(name);
          staffRecord = await tx.admin.create({
            data: {
              authId: auth.id,
              adminCode,
              position: body.adminInfo?.position ?? null,
            },
          });
        }

        // Certificates: chỉ cho Doctor/Technician
        if (
          body.certificates &&
          body.certificates.length > 0 &&
          (roleValue === Role.DOCTOR || roleValue === Role.TECHNICIAN)
        ) {
          for (const c of body.certificates) {
            await tx.certificate.create({
              data: {
                code: c.code ?? null,
                title: c.title,
                type: c.type as CertificateType,
                issuedBy: c.issuedBy ?? null,
                issuedAt: c.issuedAt ? this.parseDateOrThrow(c.issuedAt, 'issuedAt') : null,
                expiryAt: c.expiryAt ? this.parseDateOrThrow(c.expiryAt, 'expiryAt') : null,
                file: c.file ?? null,
                description: c.description ?? null,
                doctorId: roleValue === Role.DOCTOR ? staffRecord.id : null,
                technicianId: roleValue === Role.TECHNICIAN ? staffRecord.id : null,
              },
            });
          }
        }

        // Email credentials if email provided
        if (email) {
          await this.emailService.sendAccountCredentials({
            email,
            name,
            username: email || phone || auth.id,
            password: plainPassword,
          role: roleValue,
          });
        }

        return {
          auth,
          staff: staffRecord,
        };
      });
    } catch (e: any) {
      // Surface Prisma error details for easier debugging
      // eslint-disable-next-line no-console
      console.error('Create staff failed:', e);
      throw new BadRequestException({ message: 'Create staff failed', detail: e?.message, code: e?.code });
    }
  }

  async listStaff(params: { role?: Role; page?: number; limit?: number }) {
    const { role, page = 1, limit = 10 } = params;
    const where: any = role ? { role } : { role: { in: StaffService.STAFF_ROLES } };
    const skip = (Math.max(page, 1) - 1) * Math.min(Math.max(limit, 1), 100);
    const take = Math.min(Math.max(limit, 1), 100);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.auth.count({ where }),
      this.prisma.auth.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          doctor: { include: { certificates: true } },
          receptionist: true,
          technician: { include: { certificates: true } },
          cashier: true,
          admin: true,
        },
        skip,
        take,
      }),
    ]);
    return {
      data,
      meta: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getStaffByAuthId(authId: string) {
    const auth = await this.prisma.auth.findUnique({
      where: { id: authId },
      include: {
        doctor: { include: { certificates: true } },
        receptionist: true,
        technician: { include: { certificates: true } },
        cashier: true,
        admin: true,
      },
    });
    if (!auth) throw new NotFoundException('Staff not found');
    if (!auth.role || auth.role === Role.PATIENT)
      throw new NotFoundException('Not a staff account');
    return auth;
  }

  async updateStaff(authId: string, dto: UpdateStaffDto) {
    const auth = await this.prisma.auth.findUnique({ where: { id: authId } });
    if (!auth) throw new NotFoundException('Staff not found');

    const updates: any = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.dateOfBirth !== undefined) updates.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.gender !== undefined) updates.gender = dto.gender;
    if (dto.address !== undefined) updates.address = dto.address;
    if (dto.phone !== undefined) updates.phone = dto.phone;
    if (dto.email !== undefined) updates.email = dto.email;
    if (dto.avatar !== undefined) updates.avatar = dto.avatar;
    if (dto.citizenId !== undefined) updates.citizenId = dto.citizenId;

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx.auth.update({ where: { id: authId }, data: updates });
      }

      // role-specific update
      const role = auth.role as Role;
      if (role === Role.DOCTOR && dto.doctorInfo) {
        const data: any = {
          yearsExperience: dto.doctorInfo.yearsExperience ?? undefined,
          rating: dto.doctorInfo.rating ?? undefined,
          workHistory: dto.doctorInfo.workHistory ?? undefined,
          description: dto.doctorInfo.description ?? undefined,
          subSpecialties: dto.doctorInfo.subSpecialties ?? undefined,
          licenseNumber: dto.doctorInfo.licenseNumber ?? undefined,
          licenseIssuedAt: dto.doctorInfo.licenseIssuedAt
            ? new Date(dto.doctorInfo.licenseIssuedAt)
            : undefined,
          licenseExpiry: dto.doctorInfo.licenseExpiry
            ? new Date(dto.doctorInfo.licenseExpiry)
            : undefined,
          department: dto.doctorInfo.department ?? undefined,
          position: dto.doctorInfo.position ?? undefined,
          isActive: dto.doctorInfo.isActive ?? undefined,
        };
        if (dto.doctorInfo.specialtyId) {
          data.specialty = { connect: { id: dto.doctorInfo.specialtyId } };
        }
        await tx.doctor.update({ where: { authId }, data });
      } else if (role === Role.TECHNICIAN && dto.technicianInfo) {
        await tx.technician.update({
          where: { authId },
          data: { isActive: dto.technicianInfo.isActive ?? undefined },
        });
      } else if (role === Role.RECEPTIONIST && dto.receptionistInfo) {
        await tx.receptionist.update({
          where: { authId },
          data: { isActive: dto.receptionistInfo.isActive ?? undefined },
        });
      } else if (role === Role.CASHIER && dto.cashierInfo) {
        await tx.cashier.update({
          where: { authId },
          data: { isActive: dto.cashierInfo.isActive ?? undefined },
        });
      } else if (role === Role.ADMIN && dto.adminInfo) {
        await tx.admin.update({
          where: { authId },
          data: {
            isActive: dto.adminInfo.isActive ?? undefined,
            position: dto.adminInfo.position ?? undefined,
          },
        });
      }

      // certificates: chỉ cho Doctor/Technician
      if (dto.certificates && dto.certificates.length >= 0) {
        if (role === Role.DOCTOR || role === Role.TECHNICIAN) {
          const staff =
            role === Role.DOCTOR
              ? await tx.doctor.findUnique({ where: { authId } })
              : await tx.technician.findUnique({ where: { authId } });
          if (!staff) throw new NotFoundException('Staff record not found');

          if (dto.replaceAllCertificates) {
            await tx.certificate.deleteMany({
              where: role === Role.DOCTOR ? { doctorId: staff.id } : { technicianId: staff.id },
            });
          }

          for (const c of dto.certificates) {
            await tx.certificate.create({
              data: {
                code: c.code ?? null,
                title: c.title,
                type: c.type as CertificateType,
                issuedBy: c.issuedBy ?? null,
                issuedAt: c.issuedAt ? this.parseDateOrThrow(c.issuedAt, 'issuedAt') : null,
                expiryAt: c.expiryAt ? this.parseDateOrThrow(c.expiryAt, 'expiryAt') : null,
                file: c.file ?? null,
                description: c.description ?? null,
                doctorId: role === Role.DOCTOR ? staff.id : null,
                technicianId: role === Role.TECHNICIAN ? staff.id : null,
              },
            });
          }
        }
      }

      const updated = await tx.auth.findUnique({
        where: { id: authId },
        include: {
          doctor: { include: { certificates: true } },
          receptionist: true,
          technician: { include: { certificates: true } },
          cashier: true,
          admin: true,
        },
      });
      return updated;
    });
  }

  async deactivateStaff(authId: string) {
    const auth = await this.prisma.auth.findUnique({ where: { id: authId } });
    if (!auth) throw new NotFoundException('Staff not found');
    const role = auth.role as Role;
    if (!role || role === Role.PATIENT) throw new BadRequestException('Not a staff account');

    return this.prisma.$transaction(async (tx) => {
      if (role === Role.DOCTOR) {
        await tx.doctor.update({ where: { authId }, data: { isActive: false } });
      } else if (role === Role.RECEPTIONIST) {
        await tx.receptionist.update({ where: { authId }, data: { isActive: false } });
      } else if (role === Role.TECHNICIAN) {
        await tx.technician.update({ where: { authId }, data: { isActive: false } });
      } else if (role === Role.CASHIER) {
        await tx.cashier.update({ where: { authId }, data: { isActive: false } });
      } else if (role === Role.ADMIN) {
        await tx.admin.update({ where: { authId }, data: { isActive: false } });
      }
      return { success: true };
    });
  }
}
