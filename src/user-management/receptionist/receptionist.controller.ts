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
  Query,
} from '@nestjs/common';
import { Roles } from '../../rbac/roles.decorator';
import { Role } from '../../rbac/roles.enum';
import { RolesGuard } from '../../rbac/roles.guard';
import { PrismaClient } from '@prisma/client';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { UpdatePatientDto } from '../dto/update-patient.dto';
import { BookAppointmentDto } from '../dto/book-appointment.dto';
import { JwtAuthGuard } from 'src/login/jwt-auth.guard';
import { CodeGeneratorService } from '../patient-profile/code-generator.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('receptionists')
export class ReceptionistController {
  private prisma = new PrismaClient();
  private codeGenerator = new CodeGeneratorService();

  @Get('users')
  @Roles(Role.RECEPTIONIST)
  async findAllUsers(
    @Query('role') role?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const where = role ? { role: role as Role } : {};
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || '10', 10) || 10, 1),
      100,
    );
    const skip = (pageNum - 1) * limitNum;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.auth.count({ where }),
      this.prisma.auth.findMany({
        where,
        include: {
          doctor: true,
          patient: true,
          receptionist: true,
          admin: true,
          cashier: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
      }),
    ]);

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

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
        patientCode: this.codeGenerator.generatePatientCode(
          name,
          new Date(dateOfBirth),
          gender,
        ),
        loyaltyPoints: 0,
      },
    });
    return { auth, patient };
  }

  @Get('patients')
  @Roles(Role.RECEPTIONIST)
  async listPatients(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || '10', 10) || 10, 1),
      100,
    );
    const skip = (pageNum - 1) * limitNum;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.patient.count(),
      this.prisma.patient.findMany({
        include: { auth: true },
        orderBy: { patientCode: 'asc' },
        skip,
        take: limitNum,
      }),
    ]);

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
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
    // Build explicit updates for auth and patient
    const {
      name,
      dateOfBirth,
      gender,
      address,
      citizenId,
      avatar,
      phone,
      email,
      loyaltyPoints,
    } = body;

    const authUpdate: Record<string, any> = {};
    if (name !== undefined) authUpdate.name = name;
    if (dateOfBirth !== undefined)
      authUpdate.dateOfBirth = new Date(dateOfBirth);
    if (gender !== undefined) authUpdate.gender = gender;
    if (address !== undefined) authUpdate.address = address;
    if (citizenId !== undefined) authUpdate.citizenId = citizenId;
    if (avatar !== undefined) authUpdate.avatar = avatar;
    if (phone !== undefined) authUpdate.phone = phone;
    if (email !== undefined) authUpdate.email = email;

    const patientUpdate: Record<string, any> = {};
    if (loyaltyPoints !== undefined)
      patientUpdate.loyaltyPoints = loyaltyPoints;

    // Execute updates in a transaction for consistency
    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(authUpdate).length > 0) {
        await tx.auth.update({
          where: { id: patient.authId! },
          data: authUpdate,
        });
      }
      if (Object.keys(patientUpdate).length > 0) {
        await tx.patient.update({
          where: { id: patientId },
          data: patientUpdate,
        });
      }
      return tx.patient.findUnique({
        where: { id: patientId },
        include: { auth: true },
      });
    });

    return updated;
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

    // Fetch doctor and patient profile for code generation
    const [doctor, patientProfile] = await Promise.all([
      this.prisma.doctor.findUnique({
        where: { id: doctorId },
        include: { auth: true },
      }),
      this.prisma.patientProfile.findUnique({
        where: { id: patientProfileId },
      }),
    ]);

    if (!doctor || !patientProfile) {
      throw new BadRequestException('Doctor or patient profile not found');
    }

    // Find appropriate work session for the doctor on the given date
    const appointmentDate = new Date(date);
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const workSession = await this.prisma.workSession.findFirst({
      where: {
        doctorId: doctorId,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['APPROVED', 'IN_PROGRESS'],
        },
        services: {
          some: {
            serviceId: serviceId,
          },
        },
      },
    });

    if (!workSession) {
      throw new BadRequestException('No available work session found for this doctor and service on the selected date');
    }

    return this.prisma.appointment.create({
      data: {
        appointmentCode: this.codeGenerator.generateAppointmentCode(
          doctor.auth.name,
          patientProfile.name,
        ),
        bookerId,
        patientProfileId,
        specialtyId,
        doctorId,
        serviceId,
        workSessionId: workSession.id,
        status,
        date: new Date(date),
        startTime,
        endTime,
      },
    });
  }

  @Get('appointments')
  @Roles(Role.RECEPTIONIST)
  async listAppointments(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || '10', 10) || 10, 1),
      100,
    );
    const skip = (pageNum - 1) * limitNum;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.appointment.count(),
      this.prisma.appointment.findMany({
        include: {
          patientProfile: { include: { patient: { include: { auth: true } } } },
          doctor: { include: { auth: true } },
          service: true,
          specialty: true,
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }
}
