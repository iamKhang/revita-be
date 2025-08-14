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
import { JwtAuthGuard } from 'src/login/jwt-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('receptionists')
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
      const existed = await this.prisma.auth.findUnique({
        where: { citizenId },
      });
      if (existed) throw new BadRequestException('CitizenId already exists');
    }
    const auth = await this.prisma.auth.create({
      data: {
        name,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        address,
        citizenId,
        avatar,
        role: Role.PATIENT,
        phone,
        email,
        password,
      },
    });
    const patient = await this.prisma.patient.create({
      data: {
        authId: auth.id,
        patientCode: `PAT${Date.now()}`,
        loyaltyPoints: 0,
      },
    });
    return { auth, patient };
  }

  @Get('clinics/:clinicId/patients')
  @Roles(Role.RECEPTIONIST)
  async listPatients(@Param('clinicId') clinicId: string) {
    // Lấy tất cả bệnh nhân từng có lịch hẹn tại clinic này
    const appointments = await this.prisma.appointment.findMany({
      where: { clinicId },
      select: { patientProfileId: true },
      distinct: ['patientProfileId'],
    });
    const patientProfileIds = appointments.map((a) => a.patientProfileId);
    return this.prisma.patient.findMany({
      where: { id: { in: patientProfileIds } },
      include: { auth: true },
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
    await this.prisma.auth.update({
      where: { id: patient.authId! },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: body as any,
    });
    return this.prisma.patient.update({
      where: { id: patientId },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: body as any,
    });
  }

  @Post('appointments')
  @Roles(Role.RECEPTIONIST)
  async bookAppointment(@Body() body: BookAppointmentDto) {
    const {
      bookerId,
      patientProfileId,
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
      !patientProfileId ||
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
        patientProfileId,
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
        patientProfile: { include: { patient: { include: { auth: true } } } },
        doctor: { include: { auth: true } },
        service: true,
        specialty: true,
      },
    });
  }
}
