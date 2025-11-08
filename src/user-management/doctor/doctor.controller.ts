import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Roles } from '../../rbac/roles.decorator';
import { Role } from '../../rbac/roles.enum';
import { RolesGuard } from '../../rbac/roles.guard';
import { PrismaClient } from '@prisma/client';
import { CreateMedicalRecordDto } from '../../medical-record/dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from '../../medical-record/dto/update-medical-record.dto';
import { JwtAuthGuard } from '../../login/jwt-auth.guard';
import { CodeGeneratorService } from '../patient-profile/code-generator.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('doctors/:doctorId')
export class DoctorController {
  private prisma = new PrismaClient();
  private codeGenerator = new CodeGeneratorService();

  @Get('appointments')
  @Roles(Role.DOCTOR)
  async viewAppointments(@Param('doctorId') doctorId: string) {
    return this.prisma.appointment.findMany({
      where: { doctorId },
      include: {
        patientProfile: { include: { patient: { include: { auth: true } } } },
        service: true,
        specialty: true,
      },
    });
  }

  @Get('medical-records')
  @Roles(Role.DOCTOR)
  async viewMedicalRecords(@Param('doctorId') doctorId: string) {
    return this.prisma.medicalRecord.findMany({
      where: { doctorId },
      include: {
        patientProfile: { include: { patient: { include: { auth: true } } } },
        template: true,
        appointment: true,
      },
    });
  }

  @Post('medical-records')
  @Roles(Role.DOCTOR)
  async createMedicalRecord(
    @Param('doctorId') doctorId: string,
    @Body() body: CreateMedicalRecordDto,
  ) {
    if (!body.patientProfileId) {
      throw new BadRequestException('Missing required field: patientProfileId');
    }

    if (!body.templateId || !body.content) {
      throw new BadRequestException(
        'Missing required fields: templateId and content',
      );
    }

    // Get doctor and patient names for code generation
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { auth: true },
    });
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: body.patientProfileId },
    });

    const medicalRecordCode = this.codeGenerator.generateMedicalRecordCode(
      doctor?.auth?.name || 'Unknown',
      patientProfile?.name || 'Unknown',
    );

    // Nếu có appointmentCode, tìm appointment theo code và lấy id
    let appointmentId: string | undefined;
    if (body.appointmentCode) {
      const appointment = await this.prisma.appointment.findFirst({
        where: {
          appointmentCode: body.appointmentCode,
        },
        select: {
          id: true,
        },
      });

      if (!appointment) {
        throw new NotFoundException(
          `Không tìm thấy cuộc hẹn với mã code: ${body.appointmentCode}`,
        );
      }

      appointmentId = appointment.id;
    }

    const data: {
      medicalRecordCode: string;
      doctorId: string;
      patientProfileId: string;
      templateId: string;
      content: object;
      appointmentId?: string;
    } = {
      medicalRecordCode,
      doctorId,
      patientProfileId: body.patientProfileId,
      templateId: body.templateId,
      content: body.content,
    };

    // Thêm appointmentId nếu có
    if (appointmentId) {
      data.appointmentId = appointmentId;
    }

    return this.prisma.medicalRecord.create({
      data,
    });
  }

  @Put('medical-records/:recordId')
  @Roles(Role.DOCTOR)
  async updateMedicalRecord(
    @Param('doctorId') doctorId: string,
    @Param('recordId') recordId: string,
    @Body() body: UpdateMedicalRecordDto,
  ) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: recordId },
    });
    if (!record || record.doctorId !== doctorId)
      throw new NotFoundException(
        'Medical record not found or not owned by this doctor',
      );
    return this.prisma.medicalRecord.update({
      where: { id: recordId },
      data: body,
    });
  }
}
