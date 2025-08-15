import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Roles } from '../../rbac/roles.decorator';
import { Role } from '../../rbac/roles.enum';
import { RolesGuard } from '../../rbac/roles.guard';
import { JwtAuthGuard } from '../../login/jwt-auth.guard';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto, UpdateUserDto } from '../dto/admin.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  private prisma = new PrismaClient();

  // Quản lý tất cả users
  @Get('users')
  @Roles(Role.ADMIN)
  async findAllUsers(@Query('role') role?: string) {
    const where = role ? { role: role as Role } : {};
    return this.prisma.auth.findMany({
      where,
      include: {
        doctor: true,
        patient: true,
        receptionist: true,
        admin: true,
      },
    });
  }

  @Get('users/:userId')
  @Roles(Role.ADMIN)
  async findUserById(@Param('userId') userId: string) {
    const user = await this.prisma.auth.findUnique({
      where: { id: userId },
      include: {
        doctor: true,
        patient: true,
        receptionist: true,
        admin: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Tạo user mới với role cụ thể
  @Post('users')
  @Roles(Role.ADMIN)
  async createUser(@Body() body: CreateUserDto) {
    const {
      name,
      dateOfBirth,
      gender,
      address,
      citizenId,
      avatar,
      password,
      email,
      phone,
      role,
      // Doctor specific fields
      degrees,
      yearsExperience,
      workHistory,
      description,
      // Patient specific fields
      loyaltyPoints,
      // Receptionist specific fields
      // Admin specific fields
      adminCode,
    } = body;

    if (!name || !dateOfBirth || !gender || !address || !password || !role) {
      throw new BadRequestException('Missing required fields');
    }

    // Check if citizenId already exists
    if (citizenId) {
      const existed = await this.prisma.auth.findUnique({
        where: { citizenId },
      });
      if (existed) throw new BadRequestException('CitizenId already exists');
    }

    // Check if email already exists
    if (email) {
      const existed = await this.prisma.auth.findUnique({
        where: { email },
      });
      if (existed) throw new BadRequestException('Email already exists');
    }

    // Check if phone already exists
    if (phone) {
      const existed = await this.prisma.auth.findUnique({
        where: { phone },
      });
      if (existed) throw new BadRequestException('Phone already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create auth record
    const auth = await this.prisma.auth.create({
      data: {
        name,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        address,
        citizenId,
        avatar,
        role: role,
        email,
        phone,
        password: hashedPassword,
      },
    });

    // Create role-specific records
    let roleRecord: any = null;

    switch (role) {
      case Role.DOCTOR:
        roleRecord = await this.prisma.doctor.create({
          data: {
            id: auth.id,
            doctorCode: `DOC${Date.now()}`,
            authId: auth.id,
            degrees: degrees || [],
            yearsExperience: yearsExperience || 0,
            rating: 0,
            workHistory: workHistory || '',
            description: description || '',
          },
        });
        break;

      case Role.PATIENT:
        roleRecord = await this.prisma.patient.create({
          data: {
            id: auth.id,
            patientCode: `PAT${Date.now()}`,
            authId: auth.id,
            loyaltyPoints: loyaltyPoints || 0,
          },
        });
        break;

      case Role.RECEPTIONIST:
        roleRecord = await this.prisma.receptionist.create({
          data: {
            id: auth.id,
            authId: auth.id,
          },
        });
        break;

      case Role.ADMIN:
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        roleRecord = await (this.prisma as any).admin.create({
          data: {
            id: auth.id,
            adminCode: adminCode || `ADM${Date.now()}`,
            authId: auth.id,
          },
        });
        break;

      default:
        throw new BadRequestException('Invalid role');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return { auth, roleRecord };
  }

  @Put('users/:userId')
  @Roles(Role.ADMIN)
  async updateUser(
    @Param('userId') userId: string,
    @Body() body: UpdateUserDto,
  ) {
    const user = await this.prisma.auth.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const {
      name,
      dateOfBirth,
      gender,
      address,
      citizenId,
      avatar,
      email,
      phone,
      password,
      // Doctor specific fields
      degrees,
      yearsExperience,
      workHistory,
      description,
      // Patient specific fields
      loyaltyPoints,
      // Admin specific fields
      adminCode,
    } = body;

    // Update auth record
    const updateData: Record<string, any> = {};
    if (name) updateData.name = name;
    if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
    if (gender) updateData.gender = gender;
    if (address) updateData.address = address;
    if (citizenId) updateData.citizenId = citizenId;
    if (avatar) updateData.avatar = avatar;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const updatedAuth = await this.prisma.auth.update({
      where: { id: userId },
      data: updateData,
    });

    // Update role-specific records
    let roleRecord: any = null;

    switch (user.role) {
      case Role.DOCTOR: {
        const doctorUpdateData: Record<string, any> = {};
        if (degrees) doctorUpdateData.degrees = degrees;
        if (yearsExperience) doctorUpdateData.yearsExperience = yearsExperience;
        if (workHistory) doctorUpdateData.workHistory = workHistory;
        if (description) doctorUpdateData.description = description;

        if (Object.keys(doctorUpdateData).length > 0) {
          roleRecord = await this.prisma.doctor.update({
            where: { authId: userId },
            data: doctorUpdateData,
          });
        }
        break;
      }

      case Role.PATIENT:
        if (loyaltyPoints !== undefined) {
          roleRecord = await this.prisma.patient.update({
            where: { authId: userId },
            data: { loyaltyPoints },
          });
        }
        break;

      case Role.ADMIN:
        if (adminCode) {
          roleRecord = await this.prisma.admin.update({
            where: { authId: userId },
            data: { adminCode },
          });
        }
        break;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return { auth: updatedAuth, roleRecord };
  }

  @Delete('users/:userId')
  @Roles(Role.ADMIN)
  async deleteUser(@Param('userId') userId: string) {
    const user = await this.prisma.auth.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    // Delete role-specific records first
    switch (user.role) {
      case Role.DOCTOR:
        await this.prisma.doctor.deleteMany({
          where: { authId: userId },
        });
        break;
      case Role.PATIENT:
        await this.prisma.patient.deleteMany({
          where: { authId: userId },
        });
        break;
      case Role.RECEPTIONIST:
        await this.prisma.receptionist.deleteMany({
          where: { authId: userId },
        });
        break;
      case Role.ADMIN:
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.prisma as any).admin.deleteMany({
          where: { authId: userId },
        });
        break;
    }

    // Delete auth record
    await this.prisma.auth.delete({
      where: { id: userId },
    });

    return { message: 'User deleted successfully' };
  }

  // Quản lý specialties
  @Get('specialties')
  @Roles(Role.ADMIN)
  async findAllSpecialties() {
    return this.prisma.specialty.findMany({
      include: {
        doctors: true,
        services: true,
        templates: true,
      },
    });
  }

  // Quản lý templates
  @Get('templates')
  @Roles(Role.ADMIN)
  async findAllTemplates(@Query('specialtyId') specialtyId?: string) {
    const where = specialtyId ? { specialtyId } : {};
    return this.prisma.template.findMany({
      where,
      include: {
        specialty: true,
      },
    });
  }

  // Quản lý services
  @Get('services')
  @Roles(Role.ADMIN)
  async findAllServices(@Query('specialtyId') specialtyId?: string) {
    const where = specialtyId ? { specialtyId } : {};
    return this.prisma.service.findMany({
      where,
      include: {
        specialty: true,
      },
    });
  }
}
