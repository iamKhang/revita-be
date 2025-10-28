import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSpecialtyDto,
  UpdateSpecialtyDto,
  SpecialtyResponseDto,
} from '../dto/specialty.dto';
import { Specialty } from '@prisma/client';

@Injectable()
export class SpecialtyService {
  constructor(private readonly prisma: PrismaService) {}

  async createSpecialty(
    dto: CreateSpecialtyDto,
  ): Promise<SpecialtyResponseDto> {
    // Check if specialtyCode already exists
    const existingSpecialty = await this.prisma.specialty.findUnique({
      where: { specialtyCode: dto.specialtyCode },
    });

    if (existingSpecialty) {
      throw new BadRequestException('Specialty code already exists');
    }

    const specialty = await this.prisma.specialty.create({
      data: {
        specialtyCode: dto.specialtyCode,
        name: dto.name,
        description: dto.description,
        imgUrl: dto.imgUrl,
      },
    });

    return this.mapToResponseDto(specialty);
  }

  async findAllSpecialties(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: SpecialtyResponseDto[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (Math.max(page, 1) - 1) * Math.min(Math.max(limit, 1), 100);
    const take = Math.min(Math.max(limit, 1), 100);

    const [total, specialties] = await this.prisma.$transaction([
      this.prisma.specialty.count(),
      this.prisma.specialty.findMany({
        orderBy: { name: 'asc' },
        skip,
        take,
        include: {
          _count: {
            select: {
              clinicRooms: true,
              doctors: true,
              services: true,
            },
          },
        },
      }),
    ]);

    return {
      data: specialties.map((specialty) => this.mapToResponseDto(specialty)),
      meta: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findSpecialtyById(id: string): Promise<SpecialtyResponseDto> {
    const specialty = await this.prisma.specialty.findUnique({
      where: { id },
      include: {
        clinicRooms: {
          include: {
            _count: {
              select: {
                booth: true,
              },
            },
          },
        },
        doctors: {
          select: {
            id: true,
            doctorCode: true,
            auth: {
              select: {
                name: true,
              },
            },
          },
        },
        services: {
          select: {
            id: true,
            serviceCode: true,
            name: true,
            price: true,
          },
        },
        _count: {
          select: {
            appointments: true,
            templates: true,
          },
        },
      },
    });

    if (!specialty) {
      throw new NotFoundException('Specialty not found');
    }

    return this.mapToResponseDto(specialty);
  }

  async updateSpecialty(
    id: string,
    dto: UpdateSpecialtyDto,
  ): Promise<SpecialtyResponseDto> {
    const existingSpecialty = await this.prisma.specialty.findUnique({
      where: { id },
    });

    if (!existingSpecialty) {
      throw new NotFoundException('Specialty not found');
    }

    // Check if specialtyCode already exists (if being updated)
    if (
      dto.specialtyCode &&
      dto.specialtyCode !== existingSpecialty.specialtyCode
    ) {
      const duplicateSpecialty = await this.prisma.specialty.findUnique({
        where: { specialtyCode: dto.specialtyCode },
      });

      if (duplicateSpecialty) {
        throw new BadRequestException('Specialty code already exists');
      }
    }

    const specialty = await this.prisma.specialty.update({
      where: { id },
      data: {
        ...(dto.specialtyCode && { specialtyCode: dto.specialtyCode }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imgUrl !== undefined && { imgUrl: dto.imgUrl }),
      },
    });

    return this.mapToResponseDto(specialty);
  }

  async deleteSpecialty(id: string): Promise<{ message: string }> {
    const existingSpecialty = await this.prisma.specialty.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            clinicRooms: true,
            doctors: true,
            appointments: true,
          },
        },
      },
    });

    if (!existingSpecialty) {
      throw new NotFoundException('Specialty not found');
    }

    // Check if specialty is being used
    if (
      existingSpecialty._count.clinicRooms > 0 ||
      existingSpecialty._count.doctors > 0 ||
      existingSpecialty._count.appointments > 0
    ) {
      throw new BadRequestException(
        'Cannot delete specialty that is being used by clinic rooms, doctors, or appointments',
      );
    }

    await this.prisma.specialty.delete({
      where: { id },
    });

    return { message: 'Specialty deleted successfully' };
  }

  private mapToResponseDto(
    specialty: Specialty & { createdAt?: Date; updatedAt?: Date },
  ): SpecialtyResponseDto {
    return {
      id: specialty.id,
      specialtyCode: specialty.specialtyCode,
      name: specialty.name,
      description: specialty.description || undefined,
      imgUrl: specialty.imgUrl || undefined,
      createdAt: specialty.createdAt,
      updatedAt: specialty.updatedAt,
    };
  }
}
