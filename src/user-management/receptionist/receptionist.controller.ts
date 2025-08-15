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
        id: auth.id,
        authId: auth.id,
        patientCode: `PAT${Date.now()}`,
        loyaltyPoints: 0,
      },
    });
    return { auth, patient };
  }

  @Get('patients')
  @Roles(Role.RECEPTIONIST)
  async listPatients() {
    // Lấy tất cả bệnh nhân
    return this.prisma.patient.findMany({
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

  @Get('appointments')
  @Roles(Role.RECEPTIONIST)
  async listAppointments() {
    return this.prisma.appointment.findMany({
      include: {
        patientProfile: { include: { patient: { include: { auth: true } } } },
        doctor: { include: { auth: true } },
        service: true,
        specialty: true,
      },
    });
  }
}
