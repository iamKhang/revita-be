import {
  Controller,
  Get,
  Put,
  Body,
  Req,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { PrismaClient } from '@prisma/client';
import { UpdateUserDto } from './dto/admin.dto';

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
        workSessions: {
          some: {
            booth: {
              room: {
                specialty: {
                  name: {
                    contains: specialty,
                    mode: 'insensitive',
                  },
                },
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
            // clinicRooms: {
            //   select: {
            //     id: true,
            //     roomCode: true,
            //     roomName: true,
            //     specialty: {
            //       select: {
            //         id: true,
            //         name: true,
            //       },
            //     },
            //   },
            // },
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
    return this.prisma.auth.update({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: { id: userId },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: body as any,
    });
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
            // clinicRooms: {
            //   select: {
            //     id: true,
            //     roomCode: true,
            //     roomName: true,
            //     specialty: {
            //       select: {
            //         id: true,
            //         name: true,
            //       },
            //     },
            //   },
            // },
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
        workSessions: {
          some: {
            booth: {
              room: {
                specialty: {
                  name: {
                    contains: specialty,
                    mode: 'insensitive',
                  },
                },
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
            // clinicRooms: {
            //   select: {
            //     id: true,
            //     roomCode: true,
            //     roomName: true,
            //     specialty: {
            //       select: {
            //         id: true,
            //         name: true,
            //       },
            //     },
            //   },
            // },
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
