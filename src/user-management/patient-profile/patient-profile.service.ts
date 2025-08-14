import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

    // For other roles (DOCTOR, ADMIN, RECEPTIONIST), they can see all patient profiles
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

    if (user.role === Role.PATIENT) {
      if (!user.patient?.id || user.patient.id !== patientProfile.patientId) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    return patientProfile;
  }

  async findByPatient(patientId: string, user: JwtUserPayload) {
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
