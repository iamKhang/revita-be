/* eslint-disable */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { Role } from '../rbac/roles.enum';
import { JwtUserPayload } from './dto/jwt-user-payload.dto';
import { Prisma, MedicalRecordStatus } from '@prisma/client';

@Injectable()
export class MedicalRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMedicalRecordDto, user: JwtUserPayload) {
    if (
      ![Role.DOCTOR, Role.SYSTEM_ADMIN, Role.CLINIC_ADMIN].includes(user.role as Role)
    ) {
      throw new ForbiddenException('Bạn không có quyền tạo hồ sơ bệnh án');
    }
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId }
    });
    if (!patient) {
      throw new NotFoundException('Không tìm thấy bệnh nhân');
    }
    let doctorId: string | undefined = undefined;
    if (user.role === Role.DOCTOR) {
      const doctor = await this.prisma.doctor.findUnique({
        where: { userId: user.id },
        select: { id: true }
      });
      doctorId = doctor?.id;
      if (!doctorId) {
        throw new NotFoundException('Không tìm thấy bác sĩ cho user này');
      }
    } else if (
      user.role === Role.SYSTEM_ADMIN ||
      user.role === Role.CLINIC_ADMIN
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
    const data: any = {
      patientId: dto.patientId,
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
      patient: true,
      doctor: true,
    };

    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      
      return await this.prisma.medicalRecord.findMany({
        where: { patientId: user.patient.id },
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

    // Cho admin và clinic admin - có thể xem tất cả
    return await this.prisma.medicalRecord.findMany({ include });
  }


  async findOne(id: string, user: JwtUserPayload) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        patient: true,
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
      
      if (record.patientId !== user.patient.id) {
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
