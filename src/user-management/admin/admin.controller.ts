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
import { CreateCounterDto, UpdateCounterDto } from '../dto/counter.dto';

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
        clinicRooms: true,
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
  async findAllServices() {
    const where = {} as const;
    return this.prisma.service.findMany({
      where,
    });
  }

  // ==================== COUNTER MANAGEMENT ====================

  // Lấy tất cả counters
  @Get('counters')
  @Roles(Role.ADMIN)
  async findAllCounters(@Query('isActive') isActive?: string) {
    const where: Record<string, any> = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    return this.prisma.counter.findMany({
      where,
      include: {
        receptionist: {
          include: {
            auth: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        queueItems: {
          where: {
            status: 'WAITING',
          },
          orderBy: {
            priorityScore: 'desc',
          },
        },
        _count: {
          select: {
            queueItems: {
              where: {
                status: 'WAITING',
              },
            },
          },
        },
      },
      orderBy: {
        counterCode: 'asc',
      },
    });
  }

  // Lấy counter theo ID
  @Get('counters/:counterId')
  @Roles(Role.ADMIN)
  async findCounterById(@Param('counterId') counterId: string) {
    const counter = await this.prisma.counter.findUnique({
      where: { id: counterId },
      include: {
        receptionist: {
          include: {
            auth: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        queueItems: {
          include: {
            appointment: {
              include: {
                patientProfile: true,
              },
            },
          },
          orderBy: {
            priorityScore: 'desc',
          },
        },
        assignments: {
          include: {
            appointment: {
              include: {
                patientProfile: true,
              },
            },
          },
          orderBy: {
            assignedAt: 'desc',
          },
          take: 10, // Lấy 10 assignment gần nhất
        },
      },
    });

    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    return counter;
  }

  // Tạo counter mới
  @Post('counters')
  @Roles(Role.ADMIN)
  async createCounter(@Body() body: CreateCounterDto) {
    const {
      counterCode,
      counterName,
      location,
      isActive = true,
      maxQueue = 10,
      receptionistId,
    } = body;

    // Kiểm tra counterCode đã tồn tại chưa
    const existingCounter = await this.prisma.counter.findUnique({
      where: { counterCode },
    });
    if (existingCounter) {
      throw new BadRequestException('Counter code already exists');
    }

    // Kiểm tra receptionistId có tồn tại không (nếu có)
    if (receptionistId) {
      const receptionist = await this.prisma.receptionist.findUnique({
        where: { id: receptionistId },
      });
      if (!receptionist) {
        throw new BadRequestException('Receptionist not found');
      }
    }

    const counter = await this.prisma.counter.create({
      data: {
        counterCode,
        counterName,
        location,
        isActive,
        maxQueue,
        receptionistId,
      },
      include: {
        receptionist: {
          include: {
            auth: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return counter;
  }

  // Cập nhật counter
  @Put('counters/:counterId')
  @Roles(Role.ADMIN)
  async updateCounter(
    @Param('counterId') counterId: string,
    @Body() body: UpdateCounterDto,
  ) {
    const counter = await this.prisma.counter.findUnique({
      where: { id: counterId },
    });
    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    const {
      counterCode,
      counterName,
      location,
      isActive,
      maxQueue,
      receptionistId,
    } = body;

    // Kiểm tra counterCode đã tồn tại chưa (nếu thay đổi)
    if (counterCode && counterCode !== counter.counterCode) {
      const existingCounter = await this.prisma.counter.findUnique({
        where: { counterCode },
      });
      if (existingCounter) {
        throw new BadRequestException('Counter code already exists');
      }
    }

    // Kiểm tra receptionistId có tồn tại không (nếu có)
    if (receptionistId) {
      const receptionist = await this.prisma.receptionist.findUnique({
        where: { id: receptionistId },
      });
      if (!receptionist) {
        throw new BadRequestException('Receptionist not found');
      }
    }

    const updateData: Record<string, any> = {};
    if (counterCode !== undefined) updateData.counterCode = counterCode;
    if (counterName !== undefined) updateData.counterName = counterName;
    if (location !== undefined) updateData.location = location;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (maxQueue !== undefined) updateData.maxQueue = maxQueue;
    if (receptionistId !== undefined)
      updateData.receptionistId = receptionistId;

    const updatedCounter = await this.prisma.counter.update({
      where: { id: counterId },
      data: updateData,
      include: {
        receptionist: {
          include: {
            auth: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return updatedCounter;
  }

  // Xóa counter
  @Delete('counters/:counterId')
  @Roles(Role.ADMIN)
  async deleteCounter(@Param('counterId') counterId: string) {
    const counter = await this.prisma.counter.findUnique({
      where: { id: counterId },
      include: {
        queueItems: {
          where: {
            status: 'WAITING',
          },
        },
      },
    });

    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    // Kiểm tra xem counter có queue items đang chờ không
    if (counter.queueItems.length > 0) {
      throw new BadRequestException(
        'Cannot delete counter with active queue items',
      );
    }

    // Xóa các bản ghi liên quan trước
    await this.prisma.counterQueueItem.deleteMany({
      where: { counterId },
    });

    await this.prisma.counterAssignment.deleteMany({
      where: { counterId },
    });

    // Xóa counter
    await this.prisma.counter.delete({
      where: { id: counterId },
    });

    return { message: 'Counter deleted successfully' };
  }

  // Lấy thống kê counter
  @Get('counters/:counterId/stats')
  @Roles(Role.ADMIN)
  async getCounterStats(@Param('counterId') counterId: string) {
    const counter = await this.prisma.counter.findUnique({
      where: { id: counterId },
    });
    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    // Thống kê queue hiện tại
    const currentQueueCount = await this.prisma.counterQueueItem.count({
      where: {
        counterId,
        status: 'WAITING',
      },
    });

    // Thống kê assignments hôm nay
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAssignments = await this.prisma.counterAssignment.count({
      where: {
        counterId,
        assignedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Thống kê assignments đã hoàn thành hôm nay
    const todayCompleted = await this.prisma.counterAssignment.count({
      where: {
        counterId,
        completedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return {
      counterId,
      counterName: counter.counterName,
      currentQueueCount,
      todayAssignments,
      todayCompleted,
      maxQueue: counter.maxQueue,
      queueUtilization: Math.round(
        (currentQueueCount / counter.maxQueue) * 100,
      ),
    };
  }
}
