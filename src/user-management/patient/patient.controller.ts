import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Roles } from '../../rbac/roles.decorator';
import { Role } from '../../rbac/roles.enum';
import { RolesGuard } from '../../rbac/roles.guard';
import { PrismaClient } from '@prisma/client';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { UpdatePatientDto } from '../dto/update-patient.dto';
import { JwtAuthGuard } from '../../login/jwt-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientController {
  private prisma = new PrismaClient();

  @Post('register')
  @Roles(Role.PATIENT)
  async selfRegister(@Body() body: CreatePatientDto) {
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

  @Get('me')
  @Roles(Role.PATIENT)
  async viewProfile(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    return { user, patient };
  }

  @Put('me')
  @Roles(Role.PATIENT)
  async updateProfile(@Req() req: any, @Body() body: UpdatePatientDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await this.prisma.user.update({ where: { id: userId }, data: body });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return this.prisma.patient.update({ where: { userId }, data: body });
  }

  @Get('me/appointments')
  @Roles(Role.PATIENT)
  async viewAppointments(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new NotFoundException('Patient not found');
    return this.prisma.appointment.findMany({
      where: { patientId: patient.id },
      include: {
        doctor: { include: { user: true } },
        clinic: true,
        service: true,
        specialty: true,
      },
    });
  }

  @Get('me/medical-records')
  @Roles(Role.PATIENT)
  async viewMedicalRecords(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new NotFoundException('Patient not found');
    return this.prisma.medicalRecord.findMany({
      where: { patientId: patient.id },
      include: {
        doctor: { include: { user: true } },
        template: true,
        appointment: true,
      },
    });
  }
}
