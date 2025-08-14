/* eslint-disable */
import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { JwtUserPayload } from './dto/jwt-user-payload.dto';
import { Role } from '../rbac/roles.enum';
import { MedicalRecordStatus } from '@prisma/client';

@Injectable()
export class MedicalRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMedicalRecordDto, user: JwtUserPayload) {
    if (
      ![Role.DOCTOR, Role.ADMIN].includes(user.role as Role)
    ) {
      throw new ForbiddenException('Bạn không có quyền tạo hồ sơ bệnh án');
    }

    // Only support patientProfileId now
    if (!dto.patientProfileId) {
      throw new BadRequestException('Missing required field: patientProfileId');
    }

    let doctorId: string | undefined = undefined;
    if (user.role === Role.DOCTOR) {
      const doctor = await this.prisma.doctor.findUnique({
        where: { authId: user.id },
        select: { id: true }
      });
      doctorId = doctor?.id;
      if (!doctorId) {
        throw new NotFoundException('Không tìm thấy bác sĩ cho user này');
      }
    } else if (
      user.role === Role.ADMIN 
    ) {
      doctorId = (dto as any)['doctorId'];
      if (!doctorId) {
        throw new ForbiddenException('Admin phải chọn bác sĩ tạo hồ sơ (doctorId)');
      }
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { id: true }
      });
      if (!doctor) {
        throw new NotFoundException('Không tìm thấy bác sĩ');
      }
    }

    // Validate patient profile exists
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: dto.patientProfileId }
    });
    if (!patientProfile) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }

    const data: any = {
      patientProfileId: dto.patientProfileId,
      templateId: dto.templateId,
      content: dto.content,
      medicalRecordCode: `MR${Date.now()}`,
      status: MedicalRecordStatus.DRAFT,
      doctorId,
    };
    const created = await this.prisma.medicalRecord.create({ data });
    
    // Lưu lịch sử tạo mới
    await this.prisma.medicalRecordHistory.create({
      data: {
        medicalRecordId: created.id,
        changedBy: user.id,
        changes: { action: 'CREATE', data: created },
      },
    });
    
    return created;
  }

  async findAll(user: JwtUserPayload) {
    const include = {
      patientProfile: true,
      doctor: true,
    };

    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      
      // Get all patient profiles for this patient
      const patientProfiles = await this.prisma.patientProfile.findMany({
        where: { patientId: user.patient.id },
        select: { id: true },
      });
      
      const patientProfileIds = patientProfiles.map(profile => profile.id);
      
      return await this.prisma.medicalRecord.findMany({
        where: { patientProfileId: { in: patientProfileIds } },
        include,
      });
    }

    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }
      
      return await this.prisma.medicalRecord.findMany({
        where: { doctorId: user.doctor.id },
        include,
      });
    }

    // Cho admin - có thể xem tất cả
    return await this.prisma.medicalRecord.findMany({ include });
  }


  async findOne(id: string, user: JwtUserPayload) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        patientProfile: true,
        doctor: true,
      },
    });

    if (!record) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      
      // Check if the patient profile belongs to this patient
      const patientProfile = await this.prisma.patientProfile.findUnique({
        where: { id: record.patientProfileId },
        select: { patientId: true },
      });
      
      if (!patientProfile || patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }
      
      if (record.doctorId !== user.doctor.id) {
        throw new ForbiddenException('Bạn chỉ xem được hồ sơ do mình tạo');
      }
    }

    return record;
  }



  async update(id: string, dto: UpdateMedicalRecordDto, user: JwtUserPayload) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException('Bạn không có quyền sửa hồ sơ');
    }
    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }
      
      if (record.doctorId !== user.doctor.id) {
        throw new ForbiddenException('Chỉ bác sĩ tạo hồ sơ hoặc admin được sửa');
      }
    }
    // Kiểm soát luồng chuyển trạng thái
    let newStatus = record.status as MedicalRecordStatus;
    if (dto.status && dto.status !== record.status) {
      if (
        (record.status === MedicalRecordStatus.DRAFT && dto.status === MedicalRecordStatus.IN_PROGRESS) ||
        (record.status === MedicalRecordStatus.IN_PROGRESS && dto.status === MedicalRecordStatus.COMPLETED)
      ) {
        newStatus = dto.status;
      } else {
        throw new ForbiddenException('Chuyển trạng thái không hợp lệ');
      }
    }
    // Lưu lịch sử trước khi update
    await this.prisma.medicalRecordHistory.create({
      data: {
        medicalRecordId: id,
        changedBy: user.id,
        changes: { action: 'UPDATE', before: record, after: { ...record, ...dto, status: newStatus } },
      },
    });
    return await this.prisma.medicalRecord.update({
      where: { id },
      data: {
        ...(dto.content ? { content: dto.content } : {}),
        status: newStatus,
      },
    });
  }

  async remove(id: string, user: JwtUserPayload) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException('Bạn không có quyền xoá hồ sơ');
    }
    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }
      
      if (record.doctorId !== user.doctor.id) {
        throw new ForbiddenException('Chỉ bác sĩ tạo hồ sơ hoặc admin được xoá');
      }
    }
    // Lưu lịch sử trước khi xóa
    await this.prisma.medicalRecordHistory.create({
      data: {
        medicalRecordId: id,
        changedBy: user.id,
        changes: { action: 'DELETE', data: record },
      },
    });
    return await this.prisma.medicalRecord.delete({
      where: { id },
    });
  }

  async getTemplates() {
     
    return await this.prisma.template.findMany();
  }

  async getTemplateByMedicalRecord(medicalRecordId: string) {
     
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: medicalRecordId },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ');
     
    const template = await this.prisma.template.findUnique({
       
      where: { id: record.templateId },
    });
    if (!template) throw new NotFoundException('Không tìm thấy template');
     
    return template;
  }

  async getTemplateById(templateId: string) {
     
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException('Không tìm thấy template');
     
    return template;
  }
}
