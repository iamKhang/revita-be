import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ServiceManagementQueryDto,
  CreateServiceDto,
  UpdateServiceDto,
  CreatePackageDto,
  UpdatePackageDto,
  PackageItemInputDto,
} from './dto';

@Injectable()
export class ServiceService {
  private readonly serviceInclude = {
    category: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
    specialty: {
      select: {
        id: true,
        name: true,
        specialtyCode: true,
      },
    },
    packageItems: {
      orderBy: {
        sortOrder: 'asc' as const,
      },
      include: {
        package: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
      },
    },
  } satisfies Prisma.ServiceInclude;

  private readonly packageInclude = {
    category: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
    specialty: {
      select: {
        id: true,
        name: true,
        specialtyCode: true,
      },
    },
    items: {
      orderBy: {
        sortOrder: 'asc' as const,
      },
      include: {
        service: {
          select: {
            id: true,
            serviceCode: true,
            name: true,
            price: true,
            isActive: true,
            requiresDoctor: true,
          },
        },
      },
    },
  } satisfies Prisma.PackageInclude;

  constructor(private readonly prisma: PrismaService) {}

  async searchServices(
    query: string,
    limit: number = 10,
    offset: number = 0,
  ) {
    const { take, skip } = this.normalizePagination(limit, offset, 100);

    const where: Prisma.ServiceWhereInput = query
      ? {
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
        }
      : {};

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        select: {
          id: true,
          serviceCode: true,
          name: true,
          description: true,
        },
        take,
        skip,
        orderBy: [
          {
            name: 'asc',
          },
          {
            serviceCode: 'asc',
          },
        ],
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      services,
      pagination: this.buildPagination(total, take, skip),
    };
  }

  async getAllServices(limit: number = 50, offset: number = 0) {
    const { take, skip } = this.normalizePagination(limit, offset, 100);

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        select: {
          id: true,
          serviceCode: true,
          name: true,
          description: true,
        },
        take,
        skip,
        orderBy: [
          {
            name: 'asc',
          },
          {
            serviceCode: 'asc',
          },
        ],
      }),
      this.prisma.service.count(),
    ]);

    return {
      services,
      pagination: this.buildPagination(total, take, skip),
    };
  }

  async getServiceById(id: string) {
    return this.prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        serviceCode: true,
        name: true,
        description: true,
      },
    });
  }

  async getServiceManagementList(query: ServiceManagementQueryDto) {
    const { take, skip } = this.normalizePagination(
      query.limit,
      query.offset,
      100,
    );

    const where: Prisma.ServiceWhereInput = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.specialtyId) {
      where.specialtyId = query.specialtyId;
    }
    if (query.requiresDoctor !== undefined) {
      where.requiresDoctor = query.requiresDoctor;
    }

    const [total, services] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        skip,
        take,
        orderBy: [
          { name: 'asc' },
          { serviceCode: 'asc' },
        ],
        include: this.serviceInclude,
      }),
    ]);

    return {
      services,
      pagination: this.buildPagination(total, take, skip),
    };
  }

  async getServiceManagementById(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: this.serviceInclude,
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  async createService(data: CreateServiceDto) {
    await Promise.all([
      this.ensureCategoryExists(data.categoryId),
      this.ensureSpecialtyExists(data.specialtyId),
    ]);

    try {
      const created = await this.prisma.service.create({
        data: {
          serviceCode: data.serviceCode,
          name: data.name,
          price: data.price,
          description: data.description,
          durationMinutes: data.durationMinutes,
          isActive: data.isActive ?? true,
          unit: data.unit,
          currency: data.currency,
          categoryId: data.categoryId,
          specialtyId: data.specialtyId,
          requiresDoctor: data.requiresDoctor ?? false,
        },
      });

      return this.getServiceManagementById(created.id);
    } catch (error) {
      this.handlePrismaError(error, 'service');
    }
  }

  async updateService(id: string, data: UpdateServiceDto) {
    const existing = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Service not found');
    }

    await Promise.all([
      this.ensureCategoryExists(data.categoryId),
      this.ensureSpecialtyExists(data.specialtyId),
    ]);

    try {
      await this.prisma.service.update({
        where: { id },
        data: {
          ...(data.serviceCode && { serviceCode: data.serviceCode }),
          ...(data.name && { name: data.name }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.durationMinutes !== undefined && {
            durationMinutes: data.durationMinutes,
          }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.unit !== undefined && { unit: data.unit }),
          ...(data.currency !== undefined && { currency: data.currency }),
          ...(data.categoryId !== undefined && {
            categoryId: data.categoryId,
          }),
          ...(data.specialtyId !== undefined && {
            specialtyId: data.specialtyId,
          }),
          ...(data.requiresDoctor !== undefined && {
            requiresDoctor: data.requiresDoctor,
          }),
        },
      });

      return this.getServiceManagementById(id);
    } catch (error) {
      this.handlePrismaError(error, 'service');
    }
  }

  async getPackageManagementList(query: ServiceManagementQueryDto) {
    const { take, skip } = this.normalizePagination(
      query.limit,
      query.offset,
      100,
    );

    const where: Prisma.PackageWhereInput = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.specialtyId) {
      where.specialtyId = query.specialtyId;
    }
    if (query.requiresDoctor !== undefined) {
      where.requiresDoctor = query.requiresDoctor;
    }

    const [total, packages] = await this.prisma.$transaction([
      this.prisma.package.count({ where }),
      this.prisma.package.findMany({
        where,
        skip,
        take,
        orderBy: [
          { name: 'asc' },
          { code: 'asc' },
        ],
        include: this.packageInclude,
      }),
    ]);

    return {
      packages,
      pagination: this.buildPagination(total, take, skip),
    };
  }

  async getPackageManagementById(id: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: this.packageInclude,
    });

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    return pkg;
  }

  async createPackage(data: CreatePackageDto) {
    await Promise.all([
      this.ensureCategoryExists(data.categoryId),
      this.ensureSpecialtyExists(data.specialtyId),
    ]);

    const items = data.items ?? [];
    this.ensureNoDuplicateServiceIds(items);
    await this.ensureServicesExist(items.map((item) => item.serviceId));

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const pkg = await tx.package.create({
          data: {
            code: data.code,
            name: data.name,
            description: data.description,
            price: data.price,
            isActive: data.isActive ?? true,
            requiresDoctor: data.requiresDoctor ?? false,
            categoryId: data.categoryId,
            specialtyId: data.specialtyId,
          },
        });

        if (items.length > 0) {
          await tx.packageItem.createMany({
            data: items.map((item, index) => ({
              packageId: pkg.id,
              serviceId: item.serviceId,
              quantity: item.quantity ?? 1,
              priceOverride: item.priceOverride ?? null,
              required: item.required ?? true,
              sortOrder:
                item.sortOrder !== undefined ? item.sortOrder : index + 1,
              notes: item.notes ?? null,
            })),
          });
        }

        return pkg;
      });

      return this.getPackageManagementById(created.id);
    } catch (error) {
      this.handlePrismaError(error, 'package');
    }
  }

  async updatePackage(id: string, data: UpdatePackageDto) {
    const existing = await this.prisma.package.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Package not found');
    }

    await Promise.all([
      this.ensureCategoryExists(data.categoryId),
      this.ensureSpecialtyExists(data.specialtyId),
    ]);

    if (data.items !== undefined) {
      this.ensureNoDuplicateServiceIds(data.items);
      await this.ensureServicesExist(
        data.items.map((item) => item.serviceId),
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.package.update({
          where: { id },
          data: {
            ...(data.code && { code: data.code }),
            ...(data.name && { name: data.name }),
            ...(data.description !== undefined && {
              description: data.description,
            }),
            ...(data.price !== undefined && { price: data.price }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
            ...(data.requiresDoctor !== undefined && {
              requiresDoctor: data.requiresDoctor,
            }),
            ...(data.categoryId !== undefined && {
              categoryId: data.categoryId,
            }),
            ...(data.specialtyId !== undefined && {
              specialtyId: data.specialtyId,
            }),
          },
        });

        if (data.items !== undefined) {
          await tx.packageItem.deleteMany({
            where: { packageId: id },
          });

          if (data.items.length > 0) {
            await tx.packageItem.createMany({
              data: data.items.map((item, index) => ({
                packageId: id,
                serviceId: item.serviceId,
                quantity: item.quantity ?? 1,
                priceOverride: item.priceOverride ?? null,
                required: item.required ?? true,
                sortOrder:
                  item.sortOrder !== undefined ? item.sortOrder : index + 1,
                notes: item.notes ?? null,
              })),
            });
          }
        }
      });

      return this.getPackageManagementById(id);
    } catch (error) {
      this.handlePrismaError(error, 'package');
    }
  }

  private normalizePagination(
    limit?: number,
    offset?: number,
    maxLimit: number = 100,
  ) {
    const take = Math.min(Math.max(limit ?? 20, 1), maxLimit);
    const skip = Math.max(offset ?? 0, 0);
    return { take, skip };
  }

  private buildPagination(total: number, limit: number, offset: number) {
    return {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  private async ensureCategoryExists(categoryId?: string) {
    if (!categoryId) {
      return;
    }

    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException('Service category not found');
    }
  }

  private async ensureSpecialtyExists(specialtyId?: string) {
    if (!specialtyId) {
      return;
    }

    const specialty = await this.prisma.specialty.findUnique({
      where: { id: specialtyId },
      select: { id: true },
    });

    if (!specialty) {
      throw new BadRequestException('Specialty not found');
    }
  }

  private ensureNoDuplicateServiceIds(items: PackageItemInputDto[]) {
    const duplicates = new Set<string>();
    const seen = new Set<string>();

    for (const item of items) {
      if (seen.has(item.serviceId)) {
        duplicates.add(item.serviceId);
      }
      seen.add(item.serviceId);
    }

    if (duplicates.size > 0) {
      throw new BadRequestException(
        `Duplicate service ids found: ${Array.from(duplicates).join(', ')}`,
      );
    }
  }

  private async ensureServicesExist(serviceIds: string[]) {
    if (!serviceIds?.length) {
      return;
    }

    const uniqueIds = Array.from(new Set(serviceIds));
    const services = await this.prisma.service.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });

    if (services.length !== uniqueIds.length) {
      throw new BadRequestException('One or more services not found');
    }
  }

  private handlePrismaError(error: unknown, entity: 'service' | 'package') {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      if (entity === 'service') {
        throw new BadRequestException('Service code already exists');
      }
      if (entity === 'package') {
        throw new BadRequestException('Package code already exists');
      }
    }

    throw error;
  }
}
