import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Roles } from '../../rbac/roles.decorator';
import { Role } from '../../rbac/roles.enum';
import { RolesGuard } from '../../rbac/roles.guard';
import { PrismaClient } from '@prisma/client';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { UpdatePatientDto } from '../dto/update-patient.dto';
import { BookAppointmentDto } from '../dto/book-appointment.dto';

@UseGuards(RolesGuard)
@Controller()
export class ReceptionistController {
  private prisma = new PrismaClient();

  @Post('patients')
  @Roles(Role.RECEPTIONIST)
  async registerPatient(@Body() body: CreatePatientDto) {
    const {
      name,
      dateOfBirth,
      gender,
      address,
      citizenId,
      avatar,
      phone,
      email,
      password,
    } = body;
    if (!name || !dateOfBirth || !gender || !address || !password) {
      throw new BadRequestException('Missing required fields');
    }
    if (citizenId) {
      const existed = await this.prisma.user.findUnique({
        where: { citizenId },
      });
      if (existed) throw new BadRequestException('CitizenId already exists');
    }
    const user = await this.prisma.user.create({
      data: {
        name,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        address,
        citizenId,
        avatar,
        role: Role.PATIENT,
        auth: { create: { phone, email, password } },
      },
    });
    const patient = await this.prisma.patient.create({
      data: {
        userId: user.id,
        patientCode: `PAT${Date.now()}`,
        address,
        emergencyContact: {},
      },
    });
    return { user, patient };
  }

  @Get('clinics/:clinicId/patients')
  @Roles(Role.RECEPTIONIST)
  async listPatients(@Param('clinicId') clinicId: string) {
    // Lấy tất cả bệnh nhân từng có lịch hẹn tại clinic này
    const appointments = await this.prisma.appointment.findMany({
      where: { clinicId },
      select: { patientId: true },
      distinct: ['patientId'],
    });
    const patientIds = appointments.map((a) => a.patientId);
    return this.prisma.patient.findMany({
      where: { id: { in: patientIds } },
      include: { user: true },
    });
  }

  @Put('patients/:patientId')
  @Roles(Role.RECEPTIONIST)
  async updatePatient(
    @Param('patientId') patientId: string,
    @Body() body: UpdatePatientDto,
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    await this.prisma.user.update({
      where: { id: patient.userId! },
      data: body,
    });
    return this.prisma.patient.update({ where: { id: patientId }, data: body });
  }

  @Post('appointments')
  @Roles(Role.RECEPTIONIST)
  async bookAppointment(@Body() body: BookAppointmentDto) {
    const {
      bookerId,
      patientId,
      clinicId,
      specialtyId,
      doctorId,
      serviceId,
      status,
      date,
      startTime,
      endTime,
    } = body;
    if (
      !bookerId ||
      !patientId ||
      !clinicId ||
      !specialtyId ||
      !doctorId ||
      !serviceId ||
      !date ||
      !startTime ||
      !endTime
    ) {
      throw new BadRequestException('Missing required fields');
    }
    return this.prisma.appointment.create({
      data: {
        appointmentCode: `APPT${Date.now()}`,
        bookerId,
        patientId,
        clinicId,
        specialtyId,
        doctorId,
        serviceId,
        status,
        date: new Date(date),
        startTime,
        endTime,
      },
    });
  }

  @Get('clinics/:clinicId/appointments')
  @Roles(Role.RECEPTIONIST)
  async listAppointments(@Param('clinicId') clinicId: string) {
    return this.prisma.appointment.findMany({
      where: { clinicId },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
        service: true,
        specialty: true,
      },
    });
  }
}
