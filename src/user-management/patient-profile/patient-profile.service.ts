import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientProfileDto } from '../dto/create-patient-profile.dto';
import { UpdatePatientProfileDto } from '../dto/update-patient-profile.dto';
import { CreateIndependentPatientProfileDto } from '../dto/create-independent-patient-profile.dto';
import { SearchPatientProfileDto } from '../dto/search-patient-profile.dto';
import { LinkPatientProfileDto } from '../dto/link-patient-profile.dto';
import { JwtUserPayload } from '../../medical-record/dto/jwt-user-payload.dto';
import { Role } from '../../rbac/roles.enum';
import { CodeGeneratorService } from './code-generator.service';

@Injectable()
export class PatientProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

  async create(dto: CreatePatientProfileDto, user: JwtUserPayload) {
    // Check if patient exists (if patientId is provided)
    if (dto.patientId) {
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
          throw new ForbiddenException(
            'Bạn chỉ có thể tạo hồ sơ cho chính mình',
          );
        }
      }
    }

    // Generate profile code
    const profileCode = this.codeGenerator.generateProfileCode(
      dto.name,
      new Date(dto.dateOfBirth),
      dto.gender,
      !dto.patientId, // isIndependent = true if no patientId
    );

    const canManagePriorityFlags =
      user.role !== Role.PATIENT && user.role !== undefined;

    // Create patient profile
    const patientProfile = await this.prisma.patientProfile.create({
      data: {
        profileCode,
        patientId: dto.patientId || null, // Có thể null cho PatientProfile độc lập
        name: dto.name,
        phone: dto.phone || null,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        address: dto.address,
        occupation: dto.occupation,
        emergencyContact: dto.emergencyContact,
        healthInsurance: dto.healthInsurance,
        relationship: dto.relationship,
        isPregnant: canManagePriorityFlags
          ? dto.isPregnant ?? false
          : false,
        isDisabled: canManagePriorityFlags
          ? dto.isDisabled ?? false
          : false,
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
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.ADMIN) {
      // Admin can see all patient profiles (both linked and independent)
      return await this.prisma.patientProfile.findMany({
        include: {
          patient: {
            include: {
              auth: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }

      // Doctor can see patient profiles they have created medical records for
      // and also independent profiles (for creating new medical records)
      const medicalRecords = await this.prisma.medicalRecord.findMany({
        where: { doctorId: user.doctor.id },
        select: { patientProfileId: true },
        distinct: ['patientProfileId'],
      });

      const patientProfileIds = medicalRecords.map(
        (record) => record.patientProfileId,
      );

      // Get both linked profiles and independent profiles
      return await this.prisma.patientProfile.findMany({
        where: {
          OR: [
            { id: { in: patientProfileIds } },
            { patientId: null }, // Independent profiles
          ],
        },
        include: {
          patient: {
            include: {
              auth: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.RECEPTIONIST || user.role === Role.CASHIER) {
      // Receptionist and Cashier can see all patient profiles
      return await this.prisma.patientProfile.findMany({
        include: {
          patient: {
            include: {
              auth: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
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
      // Patient can only view their own profiles
      if (!user.patient?.id || user.patient.id !== patientProfile.patientId) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    // Staff (DOCTOR, ADMIN, RECEPTIONIST, CASHIER) can view any profile
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

  async update(
    id: string,
    dto: UpdatePatientProfileDto,
    user: JwtUserPayload,
  ): Promise<unknown> {
    const existing = await this.prisma.patientProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      // Patient can only update their own profiles
      if (!user.patient?.id || user.patient.id !== existing.patientId) {
        throw new ForbiddenException('Bạn không có quyền cập nhật hồ sơ này');
      }
    }

    // Staff can update any profile

    const canManagePriorityFlags =
      user.role !== Role.PATIENT && user.role !== undefined;

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.dateOfBirth !== undefined)
      data.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.occupation !== undefined) data.occupation = dto.occupation;
    if (dto.emergencyContact !== undefined)
      data.emergencyContact = dto.emergencyContact;
    if (dto.healthInsurance !== undefined)
      data.healthInsurance = dto.healthInsurance;
    if (dto.relationship !== undefined) data.relationship = dto.relationship;
    if (canManagePriorityFlags && dto.isPregnant !== undefined)
      data.isPregnant = dto.isPregnant;
    if (canManagePriorityFlags && dto.isDisabled !== undefined)
      data.isDisabled = dto.isDisabled;

    const updated = await this.prisma.patientProfile.update({
      where: { id },
      data,
      include: {
        patient: {
          include: {
            auth: true,
          },
        },
      },
    });

    return updated;
  }

  // Tạo PatientProfile độc lập (cho staff)
  async createIndependent(
    dto: CreateIndependentPatientProfileDto,
    user: JwtUserPayload,
  ) {
    // Chỉ staff mới có thể tạo PatientProfile độc lập
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException('Bệnh nhân không thể tạo hồ sơ độc lập');
    }

    // Check if patient exists (if patientId is provided)
    if (dto.patientId) {
      const patient = await this.prisma.patient.findUnique({
        where: { id: dto.patientId },
      });

      if (!patient) {
        throw new NotFoundException('Không tìm thấy bệnh nhân');
      }
    }

    // Generate profile code for independent profile
    const profileCode = this.codeGenerator.generateProfileCode(
      dto.name,
      new Date(dto.dateOfBirth),
      dto.gender,
      true, // isIndependent = true
    );

    // Create independent patient profile
    const patientProfile = await this.prisma.patientProfile.create({
      data: {
        profileCode,
        patientId: dto.patientId || null,
        name: dto.name,
        phone: dto.phone || null,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        address: dto.address,
        occupation: dto.occupation,
        emergencyContact: dto.emergencyContact,
        healthInsurance: dto.healthInsurance,
        relationship: dto.relationship,
        isPregnant: dto.isPregnant ?? false,
        isDisabled: dto.isDisabled ?? false,
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

  // Tìm kiếm PatientProfile theo tên, số điện thoại hoặc mã hồ sơ
  async search(dto: SearchPatientProfileDto, user: JwtUserPayload) {
    // Chỉ staff mới có thể tìm kiếm
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException('Bệnh nhân không có quyền tìm kiếm hồ sơ');
    }

    const orConditions: Record<string, unknown>[] = [];

    if (dto.name) {
      orConditions.push({
        name: {
          contains: dto.name,
          mode: 'insensitive',
        },
      });
    }

    if (dto.phone) {
      orConditions.push({
        phone: {
          contains: dto.phone,
          mode: 'insensitive',
        },
      });
    }

    // Support both profileCode and code parameters
    const codeToSearch = dto.profileCode || dto.code;
    if (codeToSearch) {
      orConditions.push({
        profileCode: {
          contains: codeToSearch,
          mode: 'insensitive',
        },
      });
    }

    // If no search criteria provided, return empty result
    if (orConditions.length === 0) {
      return [];
    }

    return await this.prisma.patientProfile.findMany({
      where: {
        OR: orConditions,
      },
      include: {
        patient: {
          include: {
            auth: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Liên kết PatientProfile với Patient
  async linkToPatient(
    profileId: string,
    dto: LinkPatientProfileDto,
    user: JwtUserPayload,
  ) {
    // Chỉ staff mới có thể liên kết
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException('Bệnh nhân không có quyền liên kết hồ sơ');
    }

    // Check if patient profile exists
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: profileId },
    });

    if (!patientProfile) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }

    // Check if patient exists
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });

    if (!patient) {
      throw new NotFoundException('Không tìm thấy bệnh nhân');
    }

    // Update patient profile to link with patient
    const updated = await this.prisma.patientProfile.update({
      where: { id: profileId },
      data: {
        patientId: dto.patientId,
      },
      include: {
        patient: {
          include: {
            auth: true,
          },
        },
      },
    });

    return updated;
  }

  // Hủy liên kết PatientProfile với Patient
  async unlinkFromPatient(profileId: string, user: JwtUserPayload) {
    // Chỉ staff mới có thể hủy liên kết
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException(
        'Bệnh nhân không có quyền hủy liên kết hồ sơ',
      );
    }

    // Check if patient profile exists
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: profileId },
    });

    if (!patientProfile) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }

    // Update patient profile to unlink from patient
    const updated = await this.prisma.patientProfile.update({
      where: { id: profileId },
      data: {
        patientId: null,
      },
      include: {
        patient: {
          include: {
            auth: true,
          },
        },
      },
    });

    return updated;
  }

  // Lấy tất cả PatientProfile độc lập (không liên kết với Patient)
  async findIndependentProfiles(user: JwtUserPayload) {
    // Chỉ staff mới có thể xem
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException(
        'Bệnh nhân không có quyền xem hồ sơ độc lập',
      );
    }

    return await this.prisma.patientProfile.findMany({
      where: {
        patientId: null,
      },
      include: {
        patient: {
          include: {
            auth: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Tìm kiếm PatientProfile theo mã code chính xác
  async findByCode(code: string, user: JwtUserPayload) {
    // Chỉ staff mới có thể tìm kiếm
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException('Bệnh nhân không có quyền tìm kiếm hồ sơ');
    }

    const patientProfile = await this.prisma.patientProfile.findFirst({
      where: {
        profileCode: code,
      },
      include: {
        patient: {
          include: {
            auth: true,
          },
        },
      },
    });

    if (!patientProfile) {
      throw new NotFoundException(
        'Không tìm thấy hồ sơ bệnh nhân với mã code này',
      );
    }

    return patientProfile;
  }

  // Tìm kiếm nâng cao với nhiều tiêu chí
  async advancedSearch(
    dto: SearchPatientProfileDto & {
      gender?: string;
      ageMin?: number;
      ageMax?: number;
      isIndependent?: boolean;
    },
    user: JwtUserPayload,
  ) {
    // Chỉ staff mới có thể tìm kiếm
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException('Bệnh nhân không có quyền tìm kiếm hồ sơ');
    }

    const andConditions: Record<string, unknown>[] = [];
    const orConditions: Record<string, unknown>[] = [];

    // Basic search criteria (OR logic)
    if (dto.name) {
      orConditions.push({
        name: {
          contains: dto.name,
          mode: 'insensitive',
        },
      });
    }

    if (dto.phone) {
      orConditions.push({
        phone: {
          contains: dto.phone,
          mode: 'insensitive',
        },
      });
    }

    const codeToSearch = dto.profileCode || dto.code;
    if (codeToSearch) {
      orConditions.push({
        profileCode: {
          contains: codeToSearch,
          mode: 'insensitive',
        },
      });
    }

    // Add OR conditions to AND conditions if any exist
    if (orConditions.length > 0) {
      andConditions.push({ OR: orConditions });
    }

    // Additional filter criteria (AND logic)
    if (dto.gender) {
      andConditions.push({
        gender: {
          contains: dto.gender,
          mode: 'insensitive',
        },
      });
    }

    if (dto.isIndependent !== undefined) {
      if (dto.isIndependent) {
        andConditions.push({ patientId: null });
      } else {
        andConditions.push({ patientId: { not: null } });
      }
    }

    // Age filtering
    if (dto.ageMin !== undefined || dto.ageMax !== undefined) {
      const now = new Date();
      const ageConditions: Record<string, unknown>[] = [];

      if (dto.ageMin !== undefined) {
        const maxBirthDate = new Date(
          now.getFullYear() - dto.ageMin,
          now.getMonth(),
          now.getDate(),
        );
        ageConditions.push({ dateOfBirth: { lte: maxBirthDate } });
      }

      if (dto.ageMax !== undefined) {
        const minBirthDate = new Date(
          now.getFullYear() - dto.ageMax - 1,
          now.getMonth(),
          now.getDate(),
        );
        ageConditions.push({ dateOfBirth: { gte: minBirthDate } });
      }

      if (ageConditions.length > 0) {
        andConditions.push({ AND: ageConditions });
      }
    }

    // If no search criteria provided, return empty result
    if (andConditions.length === 0) {
      return [];
    }

    return await this.prisma.patientProfile.findMany({
      where: {
        AND: andConditions,
      },
      include: {
        patient: {
          include: {
            auth: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
