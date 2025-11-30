import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClinicRoomDto, UpdateClinicRoomDto, ClinicRoomResponseDto, SaveCommonServicesDto } from '../dto/clinic-room.dto';
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

    // Validate booths and their services if provided
    if (dto.booths && dto.booths.length > 0) {
      for (const booth of dto.booths) {
        if (booth.serviceIds && booth.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
            where: { id: { in: booth.serviceIds } },
      });

          if (services.length !== booth.serviceIds.length) {
            throw new BadRequestException(`One or more services not found for booth: ${booth.name}`);
          }
        }
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

      // Create booths if provided
      if (dto.booths && dto.booths.length > 0) {
        const existingBoothsCount = await tx.booth.count({
          where: { roomId: room.id },
        });

        for (let i = 0; i < dto.booths.length; i++) {
          const boothDto = dto.booths[i];
          const boothCode = this.codeGen.generateBoothCode(roomCode, existingBoothsCount + i);
          
          const booth = await tx.booth.create({
            data: {
              boothCode: boothCode,
              name: boothDto.name,
              roomId: room.id,
              description: boothDto.description,
              isActive: boothDto.isActive ?? true,
            },
          });

          // Add services to booth if provided
          if (boothDto.serviceIds && boothDto.serviceIds.length > 0) {
            await tx.boothService.createMany({
              data: boothDto.serviceIds.map((serviceId) => ({
                boothId: booth.id,
            serviceId,
          })),
        });
          }
        }
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
          booth: {
            select: {
              id: true,
              boothCode: true,
              name: true,
              isActive: true,
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

    // Validate booths and their services if provided
    if (dto.booths && dto.booths.length > 0) {
      for (const booth of dto.booths) {
        if (booth.serviceIds && booth.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
            where: { id: { in: booth.serviceIds } },
      });

          if (services.length !== booth.serviceIds.length) {
            throw new BadRequestException(`One or more services not found for booth: ${booth.name || 'unnamed'}`);
          }
        }
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

      // Update booths if provided
      if (dto.booths !== undefined) {
        // Get existing booths
        const existingBooths = await tx.booth.findMany({
          where: { roomId: id },
        });

        const existingBoothsCount = existingBooths.length;

        // Create/Update booths
        for (let i = 0; i < dto.booths.length; i++) {
          const boothDto = dto.booths[i];
          
          // If booth has an id, it's an update; otherwise, it's a new booth
          const boothId = boothDto.id;
          
          if (boothId) {
            // Update existing booth
            const existingBooth = existingBooths.find(b => b.id === boothId);
            if (existingBooth) {
              await tx.booth.update({
                where: { id: boothId },
                data: {
                  ...(boothDto.name && { name: boothDto.name }),
                  ...(boothDto.description !== undefined && { description: boothDto.description }),
                  ...(boothDto.isActive !== undefined && { isActive: boothDto.isActive }),
                },
              });

              // Update booth services if provided
              if (boothDto.serviceIds !== undefined) {
        // Remove existing services
                await tx.boothService.deleteMany({
                  where: { boothId },
        });

        // Add new services
                if (boothDto.serviceIds.length > 0) {
                  await tx.boothService.createMany({
                    data: boothDto.serviceIds.map((serviceId) => ({
                      boothId,
              serviceId,
            })),
          });
                }
              }
            }
          } else {
            // Create new booth
            if (!boothDto.name) {
              throw new BadRequestException('Booth name is required when creating new booth');
            }
            const boothCode = this.codeGen.generateBoothCode(room.roomCode, existingBoothsCount + i);
            
            const newBooth = await tx.booth.create({
              data: {
                boothCode: boothCode,
                name: boothDto.name,
                roomId: id,
                description: boothDto.description,
                isActive: boothDto.isActive ?? true,
              },
            });

            // Add services to booth if provided
            if (boothDto.serviceIds && boothDto.serviceIds.length > 0) {
              await tx.boothService.createMany({
                data: boothDto.serviceIds.map((serviceId) => ({
                  boothId: newBooth.id,
                  serviceId,
                })),
              });
            }
          }
        }
      }

      return room;
    });

    return this.findClinicRoomById(clinicRoom.id);
  }

  async assignServiceToClinicRoom(
    roomId: string,
    serviceId: string,
  ): Promise<ClinicRoomResponseDto> {
    const [clinicRoom, service] = await Promise.all([
      this.prisma.clinicRoom.findUnique({
        where: { id: roomId },
        select: { id: true },
      }),
      this.prisma.service.findUnique({
        where: { id: serviceId },
        select: { id: true, isActive: true },
      }),
    ]);

    if (!clinicRoom) {
      throw new NotFoundException('Clinic room not found');
    }
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const existingRelation = await this.prisma.clinicRoomService.findUnique({
      where: {
        clinicRoomId_serviceId: {
          clinicRoomId: roomId,
          serviceId,
        },
      },
    });

    if (existingRelation) {
      throw new BadRequestException('Service already assigned to this clinic room');
    }

    await this.prisma.clinicRoomService.create({
      data: {
        clinicRoomId: roomId,
        serviceId,
      },
    });

    return this.findClinicRoomById(roomId);
  }

  async removeServiceFromClinicRoom(
    roomId: string,
    serviceId: string,
  ): Promise<ClinicRoomResponseDto> {
    const clinicRoom = await this.prisma.clinicRoom.findUnique({
      where: { id: roomId },
      select: { id: true },
    });

    if (!clinicRoom) {
      throw new NotFoundException('Clinic room not found');
    }

    const relation = await this.prisma.clinicRoomService.findUnique({
      where: {
        clinicRoomId_serviceId: {
          clinicRoomId: roomId,
          serviceId,
        },
      },
    });

    if (!relation) {
      throw new NotFoundException('Service not assigned to this clinic room');
    }

    await this.prisma.clinicRoomService.delete({
      where: {
        clinicRoomId_serviceId: {
          clinicRoomId: roomId,
          serviceId,
        },
      },
    });

    return this.findClinicRoomById(roomId);
  }

  async getCommonServices(roomId: string): Promise<{
    services: Array<{
      id: string;
      serviceCode: string;
      name: string;
      price?: number;
    }>;
  }> {
    const clinicRoom = await this.prisma.clinicRoom.findUnique({
      where: { id: roomId },
      include: {
        booth: {
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
        },
      },
    });

    if (!clinicRoom) {
      throw new NotFoundException('Clinic room not found');
    }

    // Nếu không có buồng nào, trả về mảng rỗng
    if (!clinicRoom.booth || clinicRoom.booth.length === 0) {
      return { services: [] };
    }

    // Lấy tất cả dịch vụ của các buồng
    const allBoothServices: Map<string, {
      id: string;
      serviceCode: string;
      name: string;
      price?: number;
      count: number;
    }> = new Map();

    for (const booth of clinicRoom.booth) {
      if (booth.boothServices && booth.boothServices.length > 0) {
        for (const boothService of booth.boothServices) {
          const serviceId = boothService.service.id;
          if (allBoothServices.has(serviceId)) {
            const existing = allBoothServices.get(serviceId)!;
            existing.count++;
          } else {
            allBoothServices.set(serviceId, {
              id: boothService.service.id,
              serviceCode: boothService.service.serviceCode,
              name: boothService.service.name,
              price: boothService.service.price ?? undefined,
              count: 1,
            });
          }
        }
      }
    }

    // Chỉ lấy các dịch vụ có trong TẤT CẢ các buồng (giao)
    const totalBooths = clinicRoom.booth.length;
    const commonServices = Array.from(allBoothServices.values())
      .filter(service => service.count === totalBooths)
      .map(({ count, ...service }) => service);

    return { services: commonServices };
  }

  async saveCommonServices(roomId: string, dto: SaveCommonServicesDto): Promise<{
    message: string;
    updatedBooths: number;
  }> {
    const clinicRoom = await this.prisma.clinicRoom.findUnique({
      where: { id: roomId },
      include: {
        booth: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!clinicRoom) {
      throw new NotFoundException('Clinic room not found');
    }

    // Validate services
    if (dto.serviceIds && dto.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: dto.serviceIds } },
      });

      if (services.length !== dto.serviceIds.length) {
        throw new BadRequestException('One or more services not found');
      }
    }

    // Nếu không có buồng nào, không làm gì
    if (!clinicRoom.booth || clinicRoom.booth.length === 0) {
      throw new BadRequestException('Clinic room has no booths');
    }

    let updatedBoothsCount = 0;

    await this.prisma.$transaction(async (tx) => {
      // Cập nhật dịch vụ cho tất cả các buồng trong phòng
      for (const booth of clinicRoom.booth) {
        // Xóa tất cả dịch vụ hiện tại của buồng
        await tx.boothService.deleteMany({
          where: { boothId: booth.id },
        });

        // Thêm các dịch vụ chung vào buồng
        if (dto.serviceIds && dto.serviceIds.length > 0) {
          await tx.boothService.createMany({
            data: dto.serviceIds.map((serviceId) => ({
              boothId: booth.id,
              serviceId,
            })),
          });
          updatedBoothsCount++;
        }
      }
    });

    return {
      message: `Đã cập nhật ${updatedBoothsCount} buồng với ${dto.serviceIds?.length || 0} dịch vụ chung`,
      updatedBooths: updatedBoothsCount,
    };
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
      booths: room.booth?.map((booth: any) => ({
        id: booth.id,
        boothCode: booth.boothCode,
        name: booth.name,
        isActive: booth.isActive,
        services: booth.boothServices?.map((bs: any) => bs.service) || [],
      })),
    };
  }
}
