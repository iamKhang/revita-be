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
import { CreateMedicalRecordDto } from '../dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from '../dto/update-medical-record.dto';

@UseGuards(RolesGuard)
@Controller('doctors/:doctorId')
export class DoctorController {
  private prisma = new PrismaClient();

  @Get('appointments')
  @Roles(Role.DOCTOR)
  async viewAppointments(@Param('doctorId') doctorId: string) {
    return this.prisma.appointment.findMany({
      where: { doctorId },
      include: {
        patient: { include: { user: true } },
        clinic: true,
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
        patient: { include: { user: true } },
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
    const { patientId, templateId, content, appointmentId } = body;
    if (!patientId || !templateId || !content) {
      throw new BadRequestException('Missing required fields');
    }
    return this.prisma.medicalRecord.create({
      data: {
        medicalRecordCode: `MR${Date.now()}`,
        doctorId,
        patientId,
        templateId,
        content,
        appointmentId,
      },
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
