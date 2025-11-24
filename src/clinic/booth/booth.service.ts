import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBoothDto, UpdateBoothDto, BoothResponseDto, SaveBoothServicesDto } from '../dto/booth.dto';
import { CodeGeneratorService } from '../../user-management/patient-profile/code-generator.service';

@Injectable()
export class BoothService {
  private codeGen = new CodeGeneratorService();

  constructor(private readonly prisma: PrismaService) {}

  async createBooth(dto: CreateBoothDto): Promise<BoothResponseDto> {
    // Check if clinic room exists
    const clinicRoom = await this.prisma.clinicRoom.findUnique({
      where: { id: dto.roomId },
      include: {
        specialty: {
          select: {
            id: true,
            name: true,
            specialtyCode: true,
          },
        },
      },
    });

    if (!clinicRoom) {
      throw new BadRequestException('Clinic room not found');
    }

    // Generate booth code
    const existingBoothsCount = await this.prisma.booth.count({
      where: { roomId: dto.roomId },
    });
    
    const boothCode = this.codeGen.generateBoothCode(clinicRoom.roomCode, existingBoothsCount);

    // Validate services if provided
    if (dto.serviceIds && dto.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: dto.serviceIds } },
      });

      if (services.length !== dto.serviceIds.length) {
        throw new BadRequestException('One or more services not found');
      }
    }

    const booth = await this.prisma.$transaction(async (tx) => {
      // Create booth
      const newBooth = await tx.booth.create({
        data: {
          boothCode: boothCode,
          name: dto.name,
          roomId: dto.roomId,
          description: dto.description,
          isActive: dto.isActive ?? true,
        },
      });

      // Add services to booth if provided
      if (dto.serviceIds && dto.serviceIds.length > 0) {
        await tx.boothService.createMany({
          data: dto.serviceIds.map((serviceId) => ({
            boothId: newBooth.id,
            serviceId,
          })),
        });
      }

      return newBooth;
    });

    return this.findBoothById(booth.id);
  }

  async findAllBooths(
    page: number = 1,
    limit: number = 10,
    roomId?: string,
    isActive?: boolean,
  ): Promise<{
    data: BoothResponseDto[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (Math.max(page, 1) - 1) * Math.min(Math.max(limit, 1), 100);
    const take = Math.min(Math.max(limit, 1), 100);

    const where: any = {};
    if (roomId) {
      where.roomId = roomId;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [total, booths] = await this.prisma.$transaction([
      this.prisma.booth.count({ where }),
      this.prisma.booth.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
        include: {
          room: {
            include: {
              specialty: {
                select: {
                  id: true,
                  name: true,
                  specialtyCode: true,
                },
              },
            },
          },
          boothServices: {
            include: {
              service: {
                select: {
                  id: true,
                  serviceCode: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: booths.map((booth) => this.mapToResponseDto(booth)),
      meta: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findBoothById(id: string): Promise<BoothResponseDto> {
    const booth = await this.prisma.booth.findUnique({
      where: { id },
      include: {
        room: {
          include: {
            specialty: {
              select: {
                id: true,
                name: true,
                specialtyCode: true,
              },
            },
          },
        },
        boothServices: {
          include: {
            service: {
              select: {
                id: true,
                serviceCode: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!booth) {
      throw new NotFoundException('Booth not found');
    }

    return this.mapToResponseDto(booth);
  }

  async updateBooth(id: string, dto: UpdateBoothDto): Promise<BoothResponseDto> {
    const existingBooth = await this.prisma.booth.findUnique({
      where: { id },
    });

    if (!existingBooth) {
      throw new NotFoundException('Booth not found');
    }


    // Check if clinic room exists (if being updated)
    if (dto.roomId && dto.roomId !== existingBooth.roomId) {
      const clinicRoom = await this.prisma.clinicRoom.findUnique({
        where: { id: dto.roomId },
      });

      if (!clinicRoom) {
        throw new BadRequestException('Clinic room not found');
      }
    }

    // Validate services if provided
    if (dto.serviceIds && dto.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: dto.serviceIds } },
      });

      if (services.length !== dto.serviceIds.length) {
        throw new BadRequestException('One or more services not found');
      }
    }

    const booth = await this.prisma.$transaction(async (tx) => {
      // Update booth
      const updatedBooth = await tx.booth.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.roomId && { roomId: dto.roomId }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      // Update services if provided
      if (dto.serviceIds !== undefined) {
        // Remove existing services
        await tx.boothService.deleteMany({
          where: { boothId: id },
        });

        // Add new services
        if (dto.serviceIds.length > 0) {
          await tx.boothService.createMany({
            data: dto.serviceIds.map((serviceId) => ({
              boothId: id,
              serviceId,
            })),
          });
        }
      }

      return updatedBooth;
    });

    return this.findBoothById(booth.id);
  }

  async assignServiceToBooth(
    boothId: string,
    serviceId: string,
  ): Promise<BoothResponseDto> {
    const [booth, service] = await Promise.all([
      this.prisma.booth.findUnique({
        where: { id: boothId },
        select: { id: true },
      }),
      this.prisma.service.findUnique({
        where: { id: serviceId },
        select: { id: true, isActive: true },
      }),
    ]);

    if (!booth) {
      throw new NotFoundException('Booth not found');
    }
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const existingRelation = await this.prisma.boothService.findUnique({
      where: {
        boothId_serviceId: {
          boothId,
          serviceId,
        },
      },
    });

    if (existingRelation) {
      throw new BadRequestException('Service already assigned to this booth');
    }

    await this.prisma.boothService.create({
      data: {
        boothId,
        serviceId,
      },
    });

    return this.findBoothById(boothId);
  }

  async removeServiceFromBooth(
    boothId: string,
    serviceId: string,
  ): Promise<BoothResponseDto> {
    const booth = await this.prisma.booth.findUnique({
      where: { id: boothId },
      select: { id: true },
    });

    if (!booth) {
      throw new NotFoundException('Booth not found');
    }

    const relation = await this.prisma.boothService.findUnique({
      where: {
        boothId_serviceId: {
          boothId,
          serviceId,
        },
      },
    });

    if (!relation) {
      throw new NotFoundException('Service not assigned to this booth');
    }

    await this.prisma.boothService.delete({
      where: {
        boothId_serviceId: {
          boothId,
          serviceId,
        },
      },
    });

    return this.findBoothById(boothId);
  }

  async getBoothServices(boothId: string): Promise<{
    services: Array<{
      id: string;
      serviceCode: string;
      name: string;
      price?: number;
    }>;
  }> {
    const booth = await this.prisma.booth.findUnique({
      where: { id: boothId },
      include: {
        boothServices: {
          include: {
            service: {
              select: {
                id: true,
                serviceCode: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!booth) {
      throw new NotFoundException('Booth not found');
    }

    return {
      services: (booth.boothServices?.map((bs) => ({
        ...bs.service,
        price: bs.service.price ?? undefined,
      })) || []) as Array<{
        id: string;
        serviceCode: string;
        name: string;
        price?: number;
      }>,
    };
  }

  async saveBoothServices(boothId: string, dto: SaveBoothServicesDto): Promise<{
    message: string;
    booth: BoothResponseDto;
  }> {
    const booth = await this.prisma.booth.findUnique({
      where: { id: boothId },
      select: { id: true },
    });

    if (!booth) {
      throw new NotFoundException('Booth not found');
    }

    // Normalize serviceIds - default to empty array if not provided
    const serviceIds = dto.serviceIds || [];

    // Validate services if provided
    if (serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: serviceIds } },
      });

      if (services.length !== serviceIds.length) {
        throw new BadRequestException('One or more services not found');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove all existing services
      await tx.boothService.deleteMany({
        where: { boothId },
      });

      // Add new services if provided
      if (serviceIds.length > 0) {
        await tx.boothService.createMany({
          data: serviceIds.map((serviceId) => ({
            boothId,
            serviceId,
          })),
        });
      }
    });

    const updatedBooth = await this.findBoothById(boothId);

    return {
      message: `Đã cập nhật ${serviceIds.length} dịch vụ cho buồng`,
      booth: updatedBooth,
    };
  }

  async getAvailableServices(boothId: string, query?: string, limit: number = 50): Promise<{
    services: Array<{
      id: string;
      serviceCode: string;
      name: string;
      price?: number;
      displayName: string; // "Tên dịch vụ - CODE"
    }>;
  }> {
    const booth = await this.prisma.booth.findUnique({
      where: { id: boothId },
      include: {
        boothServices: {
          select: {
            serviceId: true,
          },
        },
      },
    });

    if (!booth) {
      throw new NotFoundException('Booth not found');
    }

    // Lấy danh sách serviceId đã có trong buồng
    const existingServiceIds = booth.boothServices.map((bs) => bs.serviceId);

    // Tìm kiếm dịch vụ (exclude các dịch vụ đã có)
    const where: any = {
      isActive: true,
      ...(existingServiceIds.length > 0 && {
        id: {
          notIn: existingServiceIds,
        },
      }),
    };

    // Nếu có query, thêm điều kiện tìm kiếm
    if (query && query.trim().length > 0) {
      const searchTerm = query.trim();
      where.OR = [
        {
          name: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          serviceCode: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      ];
    }

    const services = await this.prisma.service.findMany({
      where,
      select: {
        id: true,
        serviceCode: true,
        name: true,
        price: true,
      },
      take: limit,
      orderBy: [
        {
          name: 'asc',
        },
        {
          serviceCode: 'asc',
        },
      ],
    });

    return {
      services: services.map((service) => ({
        id: service.id,
        serviceCode: service.serviceCode,
        name: service.name,
        price: service.price ?? undefined,
        displayName: `${service.name} - ${service.serviceCode}`,
      })),
    };
  }

  async deleteBooth(id: string): Promise<{ message: string }> {
    const existingBooth = await this.prisma.booth.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            workSessions: true,
          },
        },
      },
    });

    if (!existingBooth) {
      throw new NotFoundException('Booth not found');
    }

    // Check if booth has work sessions
    if (existingBooth._count.workSessions > 0) {
      throw new BadRequestException('Cannot delete booth that has work sessions');
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove booth-services relationships
      await tx.boothService.deleteMany({
        where: { boothId: id },
      });

      // Delete the booth
      await tx.booth.delete({
        where: { id },
      });
    });

    return { message: 'Booth deleted successfully' };
  }

  private mapToResponseDto(booth: any): BoothResponseDto {
    return {
      id: booth.id,
      boothCode: booth.boothCode,
      name: booth.name,
      roomId: booth.roomId,
      room: booth.room,
      description: booth.description,
      isActive: booth.isActive,
      createdAt: booth.createdAt,
      updatedAt: booth.updatedAt,
      services: booth.boothServices?.map((bs: any) => bs.service),
    };
  }
}
