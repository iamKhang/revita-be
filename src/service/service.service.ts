import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  async searchServices(query: string, limit: number = 10, offset: number = 0) {
    const services = await this.prisma.service.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive', // Case insensitive search
            },
          },
          {
            description: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            serviceCode: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        serviceCode: true,
        name: true,
        description: true,
      },
      take: limit,
      skip: offset,
      orderBy: [
        {
          name: 'asc',
        },
        {
          serviceCode: 'asc',
        },
      ],
    });

    const total = await this.prisma.service.count({
      where: {
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            serviceCode: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    return {
      services,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async getAllServices(limit: number = 50, offset: number = 0) {
    const services = await this.prisma.service.findMany({
      select: {
        id: true,
        serviceCode: true,
        name: true,
        description: true,
      },
      take: limit,
      skip: offset,
      orderBy: [
        {
          name: 'asc',
        },
        {
          serviceCode: 'asc',
        },
      ],
    });

    const total = await this.prisma.service.count();

    return {
      services,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async getServiceById(id: string) {
    return await this.prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        serviceCode: true,
        name: true,
        description: true,
      },
    });
  }
}
