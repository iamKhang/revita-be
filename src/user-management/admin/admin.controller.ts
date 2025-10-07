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
import { CodeGeneratorService } from '../patient-profile/code-generator.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  private prisma = new PrismaClient();
  private codeGenerator = new CodeGeneratorService();

  // Quản lý tất cả users
  @Get('users')
  @Roles(Role.ADMIN)
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
      specialtyId,
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
      case Role.DOCTOR: {
        if (!specialtyId) {
          throw new BadRequestException('Missing required field: specialtyId for DOCTOR');
        }
        const doctorCode = this.codeGenerator.generateDoctorCode(name);
        roleRecord = await this.prisma.doctor.create({
          data: {
            id: auth.id,
            doctorCode,
            authId: auth.id,
            yearsExperience: yearsExperience || 0,
            rating: 0,
            workHistory: workHistory || '',
            description: description || '',
            specialtyId,
          },
        });
        break;
      }

      case Role.PATIENT: {
        const patientCode = this.codeGenerator.generatePatientCode(
          name,
          new Date(dateOfBirth),
          gender,
        );
        roleRecord = await this.prisma.patient.create({
          data: {
            id: auth.id,
            patientCode,
            authId: auth.id,
            loyaltyPoints: loyaltyPoints || 0,
          },
        });
        break;
      }

      case Role.RECEPTIONIST:
        roleRecord = await this.prisma.receptionist.create({
          data: {
            id: auth.id,
            authId: auth.id,
          },
        });
        break;

      case Role.ADMIN: {
        const finalAdminCode =
          adminCode || this.codeGenerator.generateAdminCode(name);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        roleRecord = await (this.prisma as any).admin.create({
          data: {
            id: auth.id,
            adminCode: finalAdminCode,
            authId: auth.id,
          },
        });
        break;
      }

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
      specialtyId,
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
        if (specialtyId) doctorUpdateData.specialty = { connect: { id: specialtyId } };

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
      case Role.DOCTOR: {
        // Use a transaction to clean up all dependencies referencing the doctor
        await this.prisma.$transaction(async (tx) => {
          const doctor = await tx.doctor.findUnique({
            where: { authId: userId },
          });

          if (!doctor) {
            return;
          }

          const doctorId = doctor.id;

          // Handle ClinicRoom that uniquely references this doctor
          // Since clinicRoomId was removed from Appointment, we need to find clinic rooms through services
          const clinicRooms = await tx.clinicRoom.findMany({
            where: {
              services: {
                some: {
                  service: {
                    appointments: {
                      some: { doctorId: doctorId }
                    }
                  }
                }
              }
            },
          });

          // Delete clinic room services for this doctor's appointments
          for (const clinicRoom of clinicRooms) {
            await tx.clinicRoomService.deleteMany({
              where: { clinicRoomId: clinicRoom.id },
            });
          }

          // Delete the clinic rooms themselves
          for (const clinicRoom of clinicRooms) {
            await tx.clinicRoom.delete({
              where: { id: clinicRoom.id },
            });
          }

          // Collect appointment ids for this doctor to cleanup queue/assignments and MR linked to appointments
          const appointments = await tx.appointment.findMany({
            where: { doctorId: doctorId },
            select: { id: true },
          });
          const appointmentIds = appointments.map((a) => a.id);

          if (appointmentIds.length > 0) {
            // Không cần xóa counterQueueItem vì đã được lưu trong Redis
            // await tx.counterAssignment.deleteMany({
            //   where: { appointmentId: { in: appointmentIds } },
            // });
            await tx.medicalRecord.deleteMany({
              where: { appointmentId: { in: appointmentIds } },
            });
          }

          // Delete appointments for this doctor
          await tx.appointment.deleteMany({
            where: { doctorId: doctorId },
          });

          // Delete work sessions for this doctor
          await tx.workSession.deleteMany({
            where: { doctorId: doctorId },
          });

          // Delete medical records authored by this doctor (not already removed via appointment cleanup)
          await tx.medicalRecord.deleteMany({
            where: { doctorId: doctorId },
          });

          // Detach prescriptions from this doctor (doctorId is nullable)
          await tx.prescription.updateMany({
            where: { doctorId: doctorId },
            data: { doctorId: null },
          });

          // Finally, delete the doctor row
          await tx.doctor.deleteMany({
            where: { authId: userId },
          });
        });
        break;
      }
      case Role.PATIENT: {
        await this.prisma.$transaction(async (tx) => {
          const patient = await tx.patient.findUnique({
            where: { authId: userId },
          });

          if (!patient) return;

          const patientId = patient.id;

          // Get all patient profiles for this patient
          const profiles = await tx.patientProfile.findMany({
            where: { patientId },
            select: { id: true },
          });
          const profileIds = profiles.map((p) => p.id);

          if (profileIds.length > 0) {
            // Appointments for these profiles
            const appointments = await tx.appointment.findMany({
              where: { patientProfileId: { in: profileIds } },
              select: { id: true },
            });
            const appointmentIds = appointments.map((a) => a.id);

            if (appointmentIds.length > 0) {
              // Không cần xóa counterQueueItem vì đã được lưu trong Redis
              // await tx.counterAssignment.deleteMany({
              //   where: { appointmentId: { in: appointmentIds } },
              // });
              await tx.medicalRecord.deleteMany({
                where: { appointmentId: { in: appointmentIds } },
              });
              await tx.appointment.deleteMany({
                where: { id: { in: appointmentIds } },
              });
            }

            // Medical records tied directly to patient profiles
            await tx.medicalRecord.deleteMany({
              where: { patientProfileId: { in: profileIds } },
            });

            // Prescriptions for these profiles
            const prescriptions = await tx.prescription.findMany({
              where: { patientProfileId: { in: profileIds } },
              select: { id: true },
            });
            const prescriptionIds = prescriptions.map((p) => p.id);

            if (prescriptionIds.length > 0) {
              // InvoiceDetails may reference prescriptions
              await tx.invoiceDetail.updateMany({
                where: { prescriptionId: { in: prescriptionIds } },
                data: { prescriptionId: null },
              });

              await tx.prescriptionService.deleteMany({
                where: { prescriptionId: { in: prescriptionIds } },
              });

              await tx.prescription.deleteMany({
                where: { id: { in: prescriptionIds } },
              });
            }

            // Invoices for these profiles
            const invoices = await tx.invoice.findMany({
              where: { patientProfileId: { in: profileIds } },
              select: { id: true },
            });
            const invoiceIds = invoices.map((i) => i.id);

            if (invoiceIds.length > 0) {
              await tx.invoiceDetail.deleteMany({
                where: { invoiceId: { in: invoiceIds } },
              });
              await tx.invoice.deleteMany({
                where: { id: { in: invoiceIds } },
              });
            }

            // Finally remove patient profiles
            await tx.patientProfile.deleteMany({
              where: { id: { in: profileIds } },
            });
          }

          // Remove the patient row itself
          await tx.patient.deleteMany({
            where: { authId: userId },
          });
        });
        break;
      }
      case Role.RECEPTIONIST: {
        await this.prisma.$transaction(async (tx) => {
          const receptionist = await tx.receptionist.findUnique({
            where: { authId: userId },
          });

          if (!receptionist) return;

          const receptionistId = receptionist.id;

          // Find counters assigned to this receptionist
          const counters = await tx.counter.findMany({
            where: { receptionistId },
            select: { id: true },
          });
          const counterIds = counters.map((c) => c.id);

          if (counterIds.length > 0) {
            // Không cần xóa counterQueueItem vì đã được lưu trong Redis
            // For safety, ensure no active queue items are left
            await tx.counterAssignment.deleteMany({
              where: { counterId: { in: counterIds } },
            });

            // Detach receptionist from counters
            await tx.counter.updateMany({
              where: { id: { in: counterIds } },
              data: { receptionistId: null },
            });
          }

          await tx.receptionist.deleteMany({
            where: { authId: userId },
          });
        });
        break;
      }
      case Role.ADMIN:
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.prisma as any).admin.deleteMany({
          where: { authId: userId },
        });
        break;
      case Role.CASHIER: {
        await this.prisma.$transaction(async (tx) => {
          const cashier = await tx.cashier.findUnique({
            where: { authId: userId },
          });
          if (!cashier) return;

          const cashierId = cashier.id;

          // Find invoices created/owned by this cashier
          const invoices = await tx.invoice.findMany({
            where: { cashierId },
            select: { id: true },
          });
          const invoiceIds = invoices.map((i) => i.id);

          if (invoiceIds.length > 0) {
            await tx.invoiceDetail.deleteMany({
              where: { invoiceId: { in: invoiceIds } },
            });
            await tx.invoice.deleteMany({
              where: { id: { in: invoiceIds } },
            });
          }

          await tx.cashier.deleteMany({
            where: { authId: userId },
          });
        });
        break;
      }
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
  async findAllSpecialties(
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
      this.prisma.specialty.count(),
      this.prisma.specialty.findMany({
        include: { clinicRooms: true, templates: true },
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

  // Quản lý templates
  @Get('templates')
  @Roles(Role.ADMIN)
  async findAllTemplates(
    @Query('specialtyId') specialtyId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const where = specialtyId ? { specialtyId } : {};
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || '10', 10) || 10, 1),
      100,
    );
    const skip = (pageNum - 1) * limitNum;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.template.count({ where }),
      this.prisma.template.findMany({
        where,
        include: { specialty: true },
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

  // Quản lý services
  @Get('services')
  @Roles(Role.ADMIN)
  async findAllServices(
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
      this.prisma.service.count(),
      this.prisma.service.findMany({
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

  // ==================== COUNTER MANAGEMENT ====================

  // Lấy tất cả counters
  @Get('counters')
  @Roles(Role.ADMIN)
  async findAllCounters(
    @Query('isActive') isActive?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const where: Record<string, any> = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || '10', 10) || 10, 1),
      100,
    );
    const skip = (pageNum - 1) * limitNum;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.counter.count({ where }),
      this.prisma.counter.findMany({
        where,
        include: {
          receptionist: {
            include: {
              auth: {
                select: { id: true, name: true, phone: true, email: true },
              },
            },
          },
          // queueItems đã được lưu trong Redis
          // queueItems: {
          //   where: { status: 'WAITING' },
          //   orderBy: { priorityScore: 'desc' },
          // },
          _count: {
            select: {
              // queueItems: { where: { status: 'WAITING' } },
              assignments: true,
            },
          },
        },
        orderBy: { counterCode: 'asc' },
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
        // queueItems đã được lưu trong Redis
        // queueItems: {
        //   include: {
        //     appointment: {
        //       include: {
        //         patientProfile: true,
        //       },
        //     },
        //   },
        //   orderBy: {
        //     priorityScore: 'desc',
        //   },
        // },
        assignments: {
          include: {
            receptionist: {
              include: {
                auth: {
                  select: { name: true, email: true },
                },
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
      // include: {
      //   queueItems: {
      //     where: {
      //       status: 'WAITING',
      //     },
      //   },
      // },
    });

    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    // Kiểm tra xem counter có queue items đang chờ không (từ Redis)
    // if (counter.queueItems.length > 0) {
    //   throw new BadRequestException(
    //     'Cannot delete counter with active queue items',
    //   );
    // }

    // Không cần xóa counterQueueItem vì đã được lưu trong Redis
    // Xóa các bản ghi liên quan trước

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

    // Thống kê queue hiện tại (từ Redis thay vì database)
    // const currentQueueCount = await this.prisma.counterQueueItem.count({
    //   where: {
    //     counterId,
    //     status: 'WAITING',
    //   },
    // });
    const currentQueueCount = 0; // Sẽ lấy từ Redis

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
