import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientProfileDto } from '../dto/create-patient-profile.dto';
import { JwtUserPayload } from '../../medical-record/dto/jwt-user-payload.dto';
import { Role } from '../../rbac/roles.enum';

@Injectable()
export class PatientProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientProfileDto, user: JwtUserPayload) {
    // Check if patient exists
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });

    if (!patient) {
      throw new NotFoundException('Không tìm thấy bệnh nhân');
    }

    // Check permissions based on role
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      // Patient can only create profiles for themselves
      if (!user.patient?.id || user.patient.id !== dto.patientId) {
        throw new ForbiddenException('Bạn chỉ có thể tạo hồ sơ cho chính mình');
      }
    }

    // Create patient profile
    const patientProfile = await this.prisma.patientProfile.create({
      data: {
        profileCode: `PP${Date.now()}`,
        patientId: dto.patientId,
        name: dto.name,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        address: dto.address,
        occupation: dto.occupation,
        emergencyContact: dto.emergencyContact,
        healthInsurance: dto.healthInsurance,
        relationship: dto.relationship,
      },
      include: {
        patient: {
          include: {
            auth: true,
          },
        },
      },
    });

    return patientProfile;
  }

  async findAll(user: JwtUserPayload) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      return await this.prisma.patientProfile.findMany({
        where: { patientId: user.patient.id },
        include: {
          patient: {
            include: {
              auth: true,
            },
          },
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.ADMIN) {
      // Admin can see all patient profiles
      return await this.prisma.patientProfile.findMany({
        include: {
          patient: {
            include: {
              auth: true,
            },
          },
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }

      // Doctor can only see patient profiles they have created medical records for
      const medicalRecords = await this.prisma.medicalRecord.findMany({
        where: { doctorId: user.doctor.id },
        select: { patientProfileId: true },
        distinct: ['patientProfileId'],
      });

      const patientProfileIds = medicalRecords.map(
        (record) => record.patientProfileId,
      );

      if (patientProfileIds.length === 0) {
        return [];
      }

      return await this.prisma.patientProfile.findMany({
        where: {
          id: { in: patientProfileIds },
        },
        include: {
          patient: {
            include: {
              auth: true,
            },
          },
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.RECEPTIONIST) {
      // Receptionist can only see patient profiles they have created medical records for
      // (similar to doctor logic)
      const medicalRecords = await this.prisma.medicalRecord.findMany({
        where: {
          // Receptionist doesn't have a direct doctorId, so we need to find records
          // where the doctor is associated with this receptionist
          // For now, we'll show all patient profiles that have medical records
        },
        select: { patientProfileId: true },
        distinct: ['patientProfileId'],
      });

      const patientProfileIds = medicalRecords.map(
        (record) => record.patientProfileId,
      );

      if (patientProfileIds.length === 0) {
        return [];
      }

      return await this.prisma.patientProfile.findMany({
        where: {
          id: { in: patientProfileIds },
        },
        include: {
          patient: {
            include: {
              auth: true,
            },
          },
        },
      });
    }

    return [];
  }

  async findOne(id: string, user: JwtUserPayload) {
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id },
      include: {
        patient: {
          include: {
            auth: true,
          },
        },
      },
    });

    if (!patientProfile) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id || user.patient.id !== patientProfile.patientId) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    return patientProfile;
  }

  async findByPatient(patientId: string, user: JwtUserPayload) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id || user.patient.id !== patientId) {
        throw new ForbiddenException('Bạn chỉ có thể xem hồ sơ của chính mình');
      }
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Không tìm thấy bệnh nhân');
    }

    return await this.prisma.patientProfile.findMany({
      where: { patientId },
      include: {
        patient: {
          include: {
            auth: true,
          },
        },
      },
    });
  }
}
