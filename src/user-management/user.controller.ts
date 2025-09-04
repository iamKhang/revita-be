import {
  Controller,
  Get,
  Put,
  Body,
  Req,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { PrismaClient } from '@prisma/client';
import { UpdateUserDto } from './dto/admin.dto';
import * as bcrypt from 'bcryptjs';

@Controller('users')
export class UserController {
  private prisma = new PrismaClient();

  // ==================== PUBLIC ENDPOINTS ====================

  // Lấy tất cả bác sĩ (public - không cần authentication)
  @Get('doctors')
  async findAllDoctors(@Query('specialty') specialty?: string) {
    const where: Record<string, any> = {
      role: Role.DOCTOR,
      doctor: {
        isNot: null,
      },
    };

    // Filter theo specialty nếu có
    if (specialty) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where.doctor = {
        ...where.doctor,
        clinicRooms: {
          some: {
            specialty: {
              name: {
                contains: specialty,
                mode: 'insensitive',
              },
            },
          },
        },
      };
    }

    return this.prisma.auth.findMany({
      where,
      select: {
        id: true,
        name: true,
        avatar: true,
        doctor: {
          select: {
            id: true,
            doctorCode: true,
            degrees: true,
            yearsExperience: true,
            rating: true,
            workHistory: true,
            description: true,
            clinicRooms: {
              select: {
                id: true,
                roomCode: true,
                roomName: true,
                specialty: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  // ==================== AUTHENTICATED ENDPOINTS ====================

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateMe(@Req() req: any, @Body() body: UpdateUserDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found');
    const currentUser = await this.prisma.auth.findUnique({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: { id: userId },
    });
    if (!currentUser) throw new NotFoundException('User not found');

    // Build auth update data explicitly
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
      // role-specific below
      degrees,
      yearsExperience,
      workHistory,
      description,
      loyaltyPoints,
      adminCode,
    } = body;

    const authUpdateData: Record<string, any> = {};
    if (name !== undefined) authUpdateData.name = name;
    if (dateOfBirth !== undefined)
      authUpdateData.dateOfBirth = new Date(dateOfBirth);
    if (gender !== undefined) authUpdateData.gender = gender;
    if (address !== undefined) authUpdateData.address = address;
    if (citizenId !== undefined) authUpdateData.citizenId = citizenId;
    if (avatar !== undefined) authUpdateData.avatar = avatar;
    if (email !== undefined) authUpdateData.email = email;
    if (phone !== undefined) authUpdateData.phone = phone;
    if (password !== undefined)
      authUpdateData.password = await bcrypt.hash(password, 10);

    const updatedAuth = await this.prisma.auth.update({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: { id: userId },
      data: authUpdateData,
    });

    let roleRecord: any = null;
    switch (currentUser.role) {
      case Role.DOCTOR: {
        const doctorUpdateData: Record<string, any> = {};
        if (degrees !== undefined) doctorUpdateData.degrees = degrees;
        if (yearsExperience !== undefined)
          doctorUpdateData.yearsExperience = yearsExperience;
        if (workHistory !== undefined)
          doctorUpdateData.workHistory = workHistory;
        if (description !== undefined)
          doctorUpdateData.description = description;
        if (Object.keys(doctorUpdateData).length > 0) {
          roleRecord = await this.prisma.doctor.update({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            where: { authId: userId },
            data: doctorUpdateData,
          });
        }
        break;
      }
      case Role.PATIENT: {
        if (loyaltyPoints !== undefined) {
          roleRecord = await this.prisma.patient.update({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            where: { authId: userId },
            data: { loyaltyPoints },
          });
        }
        break;
      }
      case Role.ADMIN: {
        if (adminCode !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          roleRecord = await (this.prisma as any).admin.update({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            where: { authId: userId },
            data: { adminCode },
          });
        }
        break;
      }
      case Role.RECEPTIONIST: {
        // No extra updatable fields for receptionist currently
        break;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return
    return { auth: updatedAuth, roleRecord } as any;
  }

  // ==================== ROLE-BASED ENDPOINTS ====================

  // Lấy tất cả users theo role (cho ADMIN, RECEPTIONIST, DOCTOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('by-role')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  async findUsersByRole(
    @Req() req: any,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userRole = req.user?.role;

    const where: Record<string, any> = {};

    // Filter theo role nếu có
    if (role) {
      where.role = role as Role;
    }

    // Filter theo search term nếu có
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Logic phân quyền:
    // - ADMIN: có thể xem tất cả users
    // - RECEPTIONIST: chỉ có thể xem PATIENT và DOCTOR
    // - DOCTOR: chỉ có thể xem PATIENT
    if (userRole === Role.RECEPTIONIST) {
      where.role = {
        in: [Role.PATIENT, Role.DOCTOR],
      };
    } else if (userRole === Role.DOCTOR) {
      where.role = Role.PATIENT;
    }
    // ADMIN có thể xem tất cả nên không cần filter

    const users = await this.prisma.auth.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        doctor: {
          select: {
            id: true,
            doctorCode: true,
            degrees: true,
            yearsExperience: true,
            rating: true,
            clinicRooms: {
              select: {
                id: true,
                roomCode: true,
                roomName: true,
                specialty: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        patient: {
          select: {
            id: true,
            patientCode: true,
            loyaltyPoints: true,
          },
        },
        receptionist: {
          select: {
            id: true,
          },
        },
        admin: {
          select: {
            id: true,
            adminCode: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return users;
  }

  // Lấy tất cả doctors (cho ADMIN, RECEPTIONIST)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('doctors/all')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  async findAllDoctorsForStaff(
    @Query('specialty') specialty?: string,
    @Query('search') search?: string,
  ) {
    const where: Record<string, any> = {
      role: Role.DOCTOR,
      doctor: {
        isNot: null,
      },
    };

    // Filter theo specialty nếu có
    if (specialty) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where.doctor = {
        ...where.doctor,
        clinicRooms: {
          some: {
            specialty: {
              name: {
                contains: specialty,
                mode: 'insensitive',
              },
            },
          },
        },
      };
    }

    // Filter theo search term nếu có
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        {
          doctor: {
            doctorCode: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    return this.prisma.auth.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        doctor: {
          select: {
            id: true,
            doctorCode: true,
            degrees: true,
            yearsExperience: true,
            rating: true,
            workHistory: true,
            description: true,
            clinicRooms: {
              select: {
                id: true,
                roomCode: true,
                roomName: true,
                specialty: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  // Lấy tất cả receptionists (cho ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('receptionists')
  @Roles(Role.ADMIN)
  async findAllReceptionists(@Query('search') search?: string) {
    const where: Record<string, any> = {
      role: Role.RECEPTIONIST,
      receptionist: {
        isNot: null,
      },
    };

    // Filter theo search term nếu có
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.auth.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        receptionist: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  // Tìm kiếm user theo tên, số điện thoại, id, email (Public - không cần authentication)
  @Get('search')
  async searchUsers(
    @Query('query') query: string,
    @Query('role') role?: string,
  ) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Query parameter is required');
    }

    const where: Record<string, any> = {
      OR: [
        { id: { equals: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    };

    // Filter theo role nếu có
    if (role) {
      where.role = role as Role;
    }

    const users = await this.prisma.auth.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        citizenId: true,
        // Include patient information if user is a patient
        patient: {
          select: {
            id: true,
            patientCode: true,
            loyaltyPoints: true,
            patientProfiles: {
              select: {
                id: true,
                profileCode: true,
                name: true,
                dateOfBirth: true,
                gender: true,
                address: true,
                occupation: true,
                healthInsurance: true,
                relationship: true,
                isActive: true,
              },
            },
          },
        },
        // Include doctor information if user is a doctor
        doctor: {
          select: {
            id: true,
            doctorCode: true,
            degrees: true,
            yearsExperience: true,
            rating: true,
            workHistory: true,
            description: true,
            clinicRooms: {
              select: {
                id: true,
                roomCode: true,
                roomName: true,
                specialty: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        // Include receptionist information if user is a receptionist
        receptionist: {
          select: {
            id: true,
          },
        },
        // Include admin information if user is an admin
        admin: {
          select: {
            id: true,
            adminCode: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      take: 20, // Giới hạn kết quả trả về
    });

    return {
      query,
      total: users.length,
      users,
    };
  }

  // Lấy tất cả patients (cho ADMIN, RECEPTIONIST, DOCTOR)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('patients')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  async findAllPatients(@Query('search') search?: string) {
    const where: Record<string, any> = {
      role: Role.PATIENT,
    };

    // Xây dựng patient filter
    const patientFilter: Record<string, any> = {
      isNot: null,
    };

    // Filter theo search term nếu có
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        {
          patient: {
            patientCode: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    // Gán patient filter vào where
    where.patient = patientFilter;

    return this.prisma.auth.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        patient: {
          select: {
            id: true,
            patientCode: true,
            loyaltyPoints: true,
            patientProfiles: {
              select: {
                id: true,
                profileCode: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}
