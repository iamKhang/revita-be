import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClinicRoomDto, UpdateClinicRoomDto, ClinicRoomResponseDto } from '../dto/clinic-room.dto';
import { CodeGeneratorService } from '../../user-management/patient-profile/code-generator.service';

@Injectable()
export class ClinicRoomService {
  private codeGen = new CodeGeneratorService();

  constructor(private readonly prisma: PrismaService) {}

  async createClinicRoom(dto: CreateClinicRoomDto): Promise<ClinicRoomResponseDto> {
    // Validate required fields
    if (!dto.specialtyId) {
      throw new BadRequestException('specialtyId is required');
    }

    // Check if specialty exists
    const specialty = await this.prisma.specialty.findUnique({
      where: { id: dto.specialtyId },
    });

    if (!specialty) {
      throw new BadRequestException('Specialty not found');
    }

    // Generate room code
    const existingRoomsCount = await this.prisma.clinicRoom.count({
      where: { specialtyId: dto.specialtyId },
    });
    
    const roomCode = this.codeGen.generateClinicRoomCode(specialty.specialtyCode, existingRoomsCount);

    // Validate services if provided
    if (dto.serviceIds && dto.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: dto.serviceIds } },
      });

      if (services.length !== dto.serviceIds.length) {
        throw new BadRequestException('One or more services not found');
      }
    }

    const clinicRoom = await this.prisma.$transaction(async (tx) => {
      // Create clinic room
      const room = await tx.clinicRoom.create({
        data: {
          roomCode: roomCode,
          roomName: dto.roomName,
          specialtyId: dto.specialtyId,
          description: dto.description,
          address: dto.address,
        },
      });

      // Add services to room if provided
      if (dto.serviceIds && dto.serviceIds.length > 0) {
        await tx.clinicRoomService.createMany({
          data: dto.serviceIds.map((serviceId) => ({
            clinicRoomId: room.id,
            serviceId,
          })),
        });
      }

      return room;
    });

    return this.findClinicRoomById(clinicRoom.id);
  }

  async findAllClinicRooms(
    page: number = 1,
    limit: number = 10,
    specialtyId?: string,
  ): Promise<{
    data: ClinicRoomResponseDto[];
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
    if (specialtyId) {
      where.specialtyId = specialtyId;
    }

    const [total, clinicRooms] = await this.prisma.$transaction([
      this.prisma.clinicRoom.count({ where }),
      this.prisma.clinicRoom.findMany({
        where,
        orderBy: { roomName: 'asc' },
        skip,
        take,
        include: {
          specialty: {
            select: {
              id: true,
              name: true,
              specialtyCode: true,
            },
          },
          services: {
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
          _count: {
            select: {
                booth: true,
            },
          },
        },
      }),
    ]);

    return {
      data: clinicRooms.map((room) => this.mapToResponseDto(room)),
      meta: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findClinicRoomById(id: string): Promise<ClinicRoomResponseDto> {
    const clinicRoom = await this.prisma.clinicRoom.findUnique({
      where: { id },
      include: {
        specialty: {
          select: {
            id: true,
            name: true,
            specialtyCode: true,
          },
        },
        services: {
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
        booth: {
          select: {
            id: true,
            boothCode: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!clinicRoom) {
      throw new NotFoundException('Clinic room not found');
    }

    return this.mapToResponseDto(clinicRoom);
  }

  async updateClinicRoom(id: string, dto: UpdateClinicRoomDto): Promise<ClinicRoomResponseDto> {
    const existingRoom = await this.prisma.clinicRoom.findUnique({
      where: { id },
    });

    if (!existingRoom) {
      throw new NotFoundException('Clinic room not found');
    }


    // Check if specialty exists (if being updated)
    if (dto.specialtyId && dto.specialtyId !== existingRoom.specialtyId) {
      const specialty = await this.prisma.specialty.findUnique({
        where: { id: dto.specialtyId },
      });

      if (!specialty) {
        throw new BadRequestException('Specialty not found');
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

    const clinicRoom = await this.prisma.$transaction(async (tx) => {
      // Update clinic room
      const room = await tx.clinicRoom.update({
        where: { id },
        data: {
          ...(dto.roomName && { roomName: dto.roomName }),
          ...(dto.specialtyId && { specialtyId: dto.specialtyId }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.address !== undefined && { address: dto.address }),
        },
      });

      // Update services if provided
      if (dto.serviceIds !== undefined) {
        // Remove existing services
        await tx.clinicRoomService.deleteMany({
          where: { clinicRoomId: id },
        });

        // Add new services
        if (dto.serviceIds.length > 0) {
          await tx.clinicRoomService.createMany({
            data: dto.serviceIds.map((serviceId) => ({
              clinicRoomId: id,
              serviceId,
            })),
          });
        }
      }

      return room;
    });

    return this.findClinicRoomById(clinicRoom.id);
  }

  async deleteClinicRoom(id: string): Promise<{ message: string }> {
    const existingRoom = await this.prisma.clinicRoom.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
                booth: true,
          },
        },
      },
    });

    if (!existingRoom) {
      throw new NotFoundException('Clinic room not found');
    }

    // Check if room has booths
    if (existingRoom._count.booth > 0) {
      throw new BadRequestException('Cannot delete clinic room that has booths');
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove room-services relationships
      await tx.clinicRoomService.deleteMany({
        where: { clinicRoomId: id },
      });

      // Delete the room
      await tx.clinicRoom.delete({
        where: { id },
      });
    });

    return { message: 'Clinic room deleted successfully' };
  }

  private mapToResponseDto(room: any): ClinicRoomResponseDto {
    return {
      id: room.id,
      roomCode: room.roomCode,
      roomName: room.roomName,
      specialtyId: room.specialtyId,
      specialty: room.specialty,
      description: room.description,
      address: room.address,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      services: room.services?.map((rs: any) => rs.service),
      booths: room.booth,
    };
  }
}
