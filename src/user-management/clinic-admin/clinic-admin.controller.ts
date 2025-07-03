import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { CreateDoctorDto } from '../dto/create-doctor.dto';
import { UpdateDoctorDto } from '../dto/update-doctor.dto';
import { CreateReceptionistDto } from '../dto/create-receptionist.dto';

@UseGuards(RolesGuard)
@Controller('clinics/:clinicId')
export class ClinicAdminController {
  private prisma = new PrismaClient();

  @Get('doctors')
  @Roles(Role.CLINIC_ADMIN)
  async findDoctors(@Param('clinicId') clinicId: string) {
    return this.prisma.doctor.findMany({
      where: { clinicId },
      include: { user: true },
    });
  }

  @Post('doctors')
  @Roles(Role.CLINIC_ADMIN)
  async createDoctor(
    @Param('clinicId') clinicId: string,
    @Body() body: CreateDoctorDto,
  ) {
    const { name, dateOfBirth, gender, address, citizenId, avatar, password } =
      body;
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
        role: Role.DOCTOR,
        auth: { create: { password } },
      },
    });
    const doctor = await this.prisma.doctor.create({
      data: {
        userId: user.id,
        clinicId,
        doctorCode: `DOC${Date.now()}`,
        degrees: [],
        yearsExperience: 0,
        rating: 0,
        workHistory: '',
        description: '',
      },
    });
    return { user, doctor };
  }

  @Put('doctors/:doctorId')
  @Roles(Role.CLINIC_ADMIN)
  async updateDoctor(
    @Param('clinicId') clinicId: string,
    @Param('doctorId') doctorId: string,
    @Body() body: UpdateDoctorDto,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor || doctor.clinicId !== clinicId)
      throw new NotFoundException('Doctor not found in this clinic');

    const {
      name,
      dateOfBirth,
      gender,
      address,
      citizenId,
      avatar,
      ...doctorData
    } = body;

    if (name || dateOfBirth || gender || address || citizenId || avatar) {
      await this.prisma.user.update({
        where: { id: doctor.userId },
        data: { name, dateOfBirth, gender, address, citizenId, avatar },
      });
    }

    return this.prisma.doctor.update({
      where: { id: doctorId },
      data: doctorData,
    });
  }

  @Delete('doctors/:doctorId')
  @Roles(Role.CLINIC_ADMIN)
  async removeDoctor(
    @Param('clinicId') clinicId: string,
    @Param('doctorId') doctorId: string,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor || doctor.clinicId !== clinicId)
      throw new NotFoundException('Doctor not found in this clinic');
    await this.prisma.user.update({
      where: { id: doctor.userId },
      data: { role: Role.PATIENT },
    });
    return { message: 'Doctor deactivated' };
  }

  @Get('receptionists')
  @Roles(Role.CLINIC_ADMIN)
  async findReceptionists(@Param('clinicId') clinicId: string) {
    return this.prisma.receptionist.findMany({
      where: { clinicId },
      include: { user: true },
    });
  }

  @Post('receptionists')
  @Roles(Role.CLINIC_ADMIN)
  async createReceptionist(
    @Param('clinicId') clinicId: string,
    @Body() body: CreateReceptionistDto,
  ) {
    const { name, dateOfBirth, gender, address, citizenId, avatar, password } =
      body;
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
        role: Role.RECEPTIONIST,
        auth: { create: { password } },
      },
    });
    const receptionist = await this.prisma.receptionist.create({
      data: {
        userId: user.id,
        clinicId,
      },
    });
    return { user, receptionist };
  }

  // Nếu có updateReceptionist thì dùng UpdateReceptionistDto
}
