import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import * as bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  async findAll(role?: string) {
    const where = role ? { role: role as Role } : {};
    return this.prisma.user.findMany({
      where,
      include: { auth: true },
    });
  }

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { auth: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(createUserDto: CreateUserDto) {
    const {
      name,
      dateOfBirth,
      gender,
      avatar,
      address,
      citizenId,
      role,
      password,
      clinicId,
    } = createUserDto;
    // Kiểm tra role hợp lệ
    if (!Object.values(Role).includes(role as Role)) {
      throw new BadRequestException('Invalid role');
    }
    // Kiểm tra citizenId trùng
    if (citizenId) {
      const existed = await this.prisma.user.findUnique({
        where: { citizenId },
      });
      if (existed) throw new BadRequestException('CitizenId already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Tạo user và auth
    const user = await this.prisma.user.create({
      data: {
        name,
        dateOfBirth,
        gender,
        avatar,
        address,
        citizenId,
        role: role as Role,
        auth: {
          create: {
            password: hashedPassword,
          },
        },
      },
    });
    // Tạo entity liên quan theo role
    if (role === Role.DOCTOR) {
      await this.prisma.doctor.create({
        data: {
          userId: user.id,
          clinicId: clinicId!,
          doctorCode: `DOC${Date.now()}`,
          degrees: [],
          yearsExperience: 0,
          rating: 0,
          workHistory: '',
          description: '',
        },
      });
    } else if (role === Role.RECEPTIONIST) {
      await this.prisma.receptionist.create({
        data: {
          userId: user.id,
          clinicId: clinicId!,
        },
      });
    } else if (role === Role.CLINIC_ADMIN) {
      await this.prisma.clinicAdmin.create({
        data: {
          userId: user.id,
          clinicId: clinicId!,
          clinicAdminCode: `CA${Date.now()}`,
        },
      });
    }
    return user;
  }

  async update(userId: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...updateUserDto,
        role: updateUserDto.role ? (updateUserDto.role as Role) : undefined,
      },
    });
  }

  async softDelete(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.PATIENT },
    });
  }
}
