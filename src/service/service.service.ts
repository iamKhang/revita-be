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
  DoctorServiceQueryDto,
  ServiceLocationQueryDto,
  UpsertServicePromotionDto,
  ServicePromotionQueryDto,
} from './dto';

type DoctorServiceQueryOptions = {
  keyword?: string;
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
  requiresDoctor?: boolean;
};

type ServiceLocationQueryOptions = {
  serviceIds?: string[];
  serviceId?: string; // Deprecated: use serviceIds instead
  boothId?: string;
  clinicRoomId?: string;
  excludeServiceIds?: string[];
  excludeServiceId?: string; // Deprecated: use excludeServiceIds instead
  keyword?: string;
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
  requiresDoctor?: boolean;
};

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
    promotion: {
      select: {
        id: true,
        name: true,
        description: true,
        allowLoyaltyDiscount: true,
        maxDiscountPercent: true,
        maxDiscountAmount: true,
        isActive: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  } satisfies Prisma.ServiceInclude;

  private readonly serviceLocationInclude = {
    specialty: {
      select: {
        id: true,
        name: true,
        specialtyCode: true,
      },
    },
    boothServices: {
      select: {
        boothId: true,
        booth: {
          select: {
            id: true,
            boothCode: true,
            name: true,
            roomId: true,
            room: {
              select: {
                id: true,
                roomCode: true,
                roomName: true,
                specialtyId: true,
                specialty: {
                  select: {
                    id: true,
                    name: true,
                    specialtyCode: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    clinicRoomServices: {
      select: {
        clinicRoomId: true,
        clinicRoom: {
          select: {
            id: true,
            roomCode: true,
            roomName: true,
            specialtyId: true,
            specialty: {
              select: {
                id: true,
                name: true,
                specialtyCode: true,
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.ServiceInclude;

  /**
   * Map service data to compact format for work session creation
   */
  private mapServiceToCompactFormat(service: {
    id: string;
    serviceCode: string;
    name: string;
    price?: number | null;
    requiresDoctor?: boolean;
    boothServices?: Array<{ boothId: string }> | null;
    clinicRoomServices?: Array<{ clinicRoomId: string }> | null;
  }) {
    const boothIds =
      service.boothServices
        ?.map((bs) => bs.boothId)
        .filter((id): id is string => Boolean(id)) ?? [];
    const clinicRoomIds =
      service.clinicRoomServices
        ?.map((crs) => crs.clinicRoomId)
        .filter((id): id is string => Boolean(id)) ?? [];

    return {
      id: service.id,
      serviceCode: service.serviceCode,
      name: service.name,
      price: service.price ?? null,
      requiresDoctor: service.requiresDoctor ?? false,
      boothIds,
      clinicRoomIds,
    };
  }

  private parseOptionalDateInput(
    value?: string,
    fieldName: string = 'date',
  ): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `Invalid ${fieldName}. Please use ISO 8601 format.`,
      );
    }

    return parsed;
  }

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

  async searchServices(query: string, limit: number = 10, offset: number = 0) {
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
      10000, // Tăng maxLimit để cho phép lấy nhiều hơn khi cần
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

    // Thêm logic search với hỗ trợ tiếng Việt
    if (query.search && query.search.trim().length > 0) {
      const searchTerm = query.search.trim();
      const normalizedSearchTerm = this.normalizeVietnameseText(searchTerm);
      
      // Tạo điều kiện search riêng và kết hợp với các filter khác bằng AND
      const searchConditions: Prisma.ServiceWhereInput = {
        OR: [
          {
            name: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: normalizedSearchTerm,
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
        ],
      };

      // Kết hợp search với các filter khác bằng AND
      const existingAnd = Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : []);
      where.AND = [
        ...existingAnd,
        searchConditions,
      ];
    }

    const [total, services] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        skip,
        take,
        orderBy: [{ name: 'asc' }, { serviceCode: 'asc' }],
        include: this.serviceInclude,
      }),
    ]);

    return {
      services,
      pagination: this.buildPagination(total, take ?? total, skip),
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

  async getServicesByDoctorCode(
    doctorCode: string,
    query: DoctorServiceQueryDto,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { doctorCode },
      select: {
        id: true,
        doctorCode: true,
        specialtyId: true,
        subSpecialties: true,
        isActive: true,
        auth: {
          select: {
            id: true,
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
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (!doctor.specialtyId) {
      throw new BadRequestException(
        'Doctor does not have a primary specialty configured',
      );
    }

    const specialtyIds = Array.from(
      new Set(
        [doctor.specialtyId, ...(doctor.subSpecialties ?? [])].filter(
          (id): id is string => Boolean(id?.trim()),
        ),
      ),
    );

    const queryOptions = query as DoctorServiceQueryOptions;

    const limitInput =
      typeof queryOptions.limit === 'number' ? queryOptions.limit : undefined;
    const offsetInput =
      typeof queryOptions.offset === 'number' ? queryOptions.offset : undefined;
    const includeInactive =
      typeof queryOptions.includeInactive === 'boolean'
        ? queryOptions.includeInactive
        : false;
    const requiresDoctorFilter =
      typeof queryOptions.requiresDoctor === 'boolean'
        ? queryOptions.requiresDoctor
        : undefined;
    const keyword =
      typeof queryOptions.keyword === 'string' &&
      queryOptions.keyword.length > 0
        ? queryOptions.keyword
        : undefined;

    const { take, skip } = this.normalizePagination(
      limitInput,
      offsetInput,
      100,
    );

    const conditions: Prisma.ServiceWhereInput[] = [
      { specialtyId: { in: specialtyIds } },
    ];

    if (!includeInactive) {
      conditions.push({ isActive: true });
    }

    if (requiresDoctorFilter !== undefined) {
      conditions.push({ requiresDoctor: requiresDoctorFilter });
    }

    if (keyword) {
      conditions.push({
        OR: [
          {
            name: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
          {
            serviceCode: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
        ],
      });
    }

    const where: Prisma.ServiceWhereInput =
      conditions.length > 1 ? { AND: conditions } : conditions[0];

    const [total, services] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        include: this.serviceLocationInclude,
        orderBy: [
          { requiresDoctor: 'desc' },
          { name: 'asc' },
          { serviceCode: 'asc' },
        ],
        skip,
        take,
      }),
    ]);

    return {
      doctor: {
        id: doctor.id,
        doctorCode: doctor.doctorCode,
        name: doctor.auth?.name ?? null,
        isActive: doctor.isActive,
        specialty: doctor.specialty,
        specialtyIds,
      },
      services: services.map((s) => this.mapServiceToCompactFormat(s)),
      pagination: this.buildPagination(total, take, skip),
    };
  }

  async getServicesByLocation(query: ServiceLocationQueryDto) {
    const queryOptions = query as ServiceLocationQueryOptions;

    const limitInput =
      typeof queryOptions.limit === 'number' ? queryOptions.limit : undefined;
    const offsetInput =
      typeof queryOptions.offset === 'number' ? queryOptions.offset : undefined;
    const includeInactive =
      typeof queryOptions.includeInactive === 'boolean'
        ? queryOptions.includeInactive
        : false;
    const requiresDoctorFilter =
      typeof queryOptions.requiresDoctor === 'boolean'
        ? queryOptions.requiresDoctor
        : undefined;

    // Merge serviceIds and serviceId (backward compatibility)
    const serviceIdsSet = new Set<string>();
    if (
      Array.isArray(queryOptions.serviceIds) &&
      queryOptions.serviceIds.length > 0
    ) {
      queryOptions.serviceIds.forEach((id) => serviceIdsSet.add(id));
    }
    if (
      typeof queryOptions.serviceId === 'string' &&
      queryOptions.serviceId.length > 0
    ) {
      serviceIdsSet.add(queryOptions.serviceId);
    }
    const allServiceIds = Array.from(serviceIdsSet);

    const boothIdFilter =
      typeof queryOptions.boothId === 'string' &&
      queryOptions.boothId.length > 0
        ? queryOptions.boothId
        : undefined;
    const clinicRoomIdFilter =
      typeof queryOptions.clinicRoomId === 'string' &&
      queryOptions.clinicRoomId.length > 0
        ? queryOptions.clinicRoomId
        : undefined;

    // Merge excludeServiceIds and excludeServiceId (backward compatibility)
    const excludeServiceIdsSet = new Set<string>();
    if (
      Array.isArray(queryOptions.excludeServiceIds) &&
      queryOptions.excludeServiceIds.length > 0
    ) {
      queryOptions.excludeServiceIds.forEach((id) =>
        excludeServiceIdsSet.add(id),
      );
    }
    if (
      typeof queryOptions.excludeServiceId === 'string' &&
      queryOptions.excludeServiceId.length > 0
    ) {
      excludeServiceIdsSet.add(queryOptions.excludeServiceId);
    }
    const allExcludeServiceIds = Array.from(excludeServiceIdsSet);

    const keyword =
      typeof queryOptions.keyword === 'string' &&
      queryOptions.keyword.length > 0
        ? queryOptions.keyword
        : undefined;

    const { take, skip } = this.normalizePagination(
      limitInput,
      offsetInput,
      100,
    );

    // Collect boothIds and clinicRoomIds from all referenced services
    const allBoothIds: Set<string>[] = [];
    const allClinicRoomIds: Set<string>[] = [];

    // If specific boothId or clinicRoomId is provided, use them directly
    if (boothIdFilter) {
      allBoothIds.push(new Set([boothIdFilter]));
    }
    if (clinicRoomIdFilter) {
      allClinicRoomIds.push(new Set([clinicRoomIdFilter]));
    }

    // Fetch location data from all referenced services
    if (allServiceIds.length > 0) {
      const sourceServices = await this.prisma.service.findMany({
        where: {
          id: { in: allServiceIds },
        },
        select: {
          id: true,
          boothServices: {
            select: {
              boothId: true,
              booth: {
                select: {
                  roomId: true,
                },
              },
            },
          },
          clinicRoomServices: {
            select: {
              clinicRoomId: true,
            },
          },
        },
      });

      if (sourceServices.length === 0) {
        throw new NotFoundException(
          `None of the provided service IDs were found: ${allServiceIds.join(', ')}`,
        );
      }

      // Collect boothIds and clinicRoomIds from each service
      for (const service of sourceServices) {
        const serviceBoothIds = new Set<string>();
        const serviceClinicRoomIds = new Set<string>();

        for (const booth of service.boothServices) {
          if (booth.boothId) {
            serviceBoothIds.add(booth.boothId);
          }
          if (booth.booth?.roomId) {
            serviceClinicRoomIds.add(booth.booth.roomId);
          }
        }

        for (const room of service.clinicRoomServices) {
          if (room.clinicRoomId) {
            serviceClinicRoomIds.add(room.clinicRoomId);
          }
        }

        if (serviceBoothIds.size > 0) {
          allBoothIds.push(serviceBoothIds);
        }
        if (serviceClinicRoomIds.size > 0) {
          allClinicRoomIds.push(serviceClinicRoomIds);
        }
      }
    }

    // Calculate intersection: only boothIds and clinicRoomIds that are common to ALL services
    // If no services provided, use the sets directly (from boothId/clinicRoomId filters)
    let intersectionBoothIds: Set<string>;
    let intersectionClinicRoomIds: Set<string>;

    if (allBoothIds.length === 0 && allClinicRoomIds.length === 0) {
      throw new BadRequestException(
        'At least one of serviceIds, boothId, or clinicRoomId must identify a location',
      );
    }

    if (allBoothIds.length > 0) {
      // Intersection of all boothId sets: only IDs that exist in ALL sets
      if (allBoothIds.length === 1) {
        intersectionBoothIds = allBoothIds[0];
      } else {
        // Start with first set, then intersect with each subsequent set
        intersectionBoothIds = new Set(allBoothIds[0]);
        for (let i = 1; i < allBoothIds.length; i++) {
          const currentSet = allBoothIds[i];
          const newIntersection = new Set<string>();
          for (const id of intersectionBoothIds) {
            if (currentSet.has(id)) {
              newIntersection.add(id);
            }
          }
          intersectionBoothIds = newIntersection;
        }
      }
    } else {
      intersectionBoothIds = new Set<string>();
    }

    if (allClinicRoomIds.length > 0) {
      // Intersection of all clinicRoomId sets: only IDs that exist in ALL sets
      if (allClinicRoomIds.length === 1) {
        intersectionClinicRoomIds = allClinicRoomIds[0];
      } else {
        // Start with first set, then intersect with each subsequent set
        intersectionClinicRoomIds = new Set(allClinicRoomIds[0]);
        for (let i = 1; i < allClinicRoomIds.length; i++) {
          const currentSet = allClinicRoomIds[i];
          const newIntersection = new Set<string>();
          for (const id of intersectionClinicRoomIds) {
            if (currentSet.has(id)) {
              newIntersection.add(id);
            }
          }
          intersectionClinicRoomIds = newIntersection;
        }
      }
    } else {
      intersectionClinicRoomIds = new Set<string>();
    }

    // If intersection is empty but we have multiple services, use union instead
    // This means: find services that share at least one booth or room with at least one reference service
    // This is more flexible when services don't have common locations
    if (
      intersectionBoothIds.size === 0 &&
      intersectionClinicRoomIds.size === 0 &&
      allServiceIds.length > 1
    ) {
      // Use union: combine all boothIds and clinicRoomIds from all services
      intersectionBoothIds = new Set<string>();
      for (const boothSet of allBoothIds) {
        for (const id of boothSet) {
          intersectionBoothIds.add(id);
        }
      }

      intersectionClinicRoomIds = new Set<string>();
      for (const roomSet of allClinicRoomIds) {
        for (const id of roomSet) {
          intersectionClinicRoomIds.add(id);
        }
      }
    }

    // Build location filters
    const locationFilters: Prisma.ServiceWhereInput[] = [];

    if (intersectionBoothIds.size > 0) {
      locationFilters.push({
        boothServices: {
          some: {
            boothId: { in: Array.from(intersectionBoothIds) },
          },
        },
      });
    }

    if (intersectionClinicRoomIds.size > 0) {
      locationFilters.push({
        clinicRoomServices: {
          some: {
            clinicRoomId: { in: Array.from(intersectionClinicRoomIds) },
          },
        },
      });
    }

    // Build all filters
    const filters: Prisma.ServiceWhereInput[] = [];

    if (locationFilters.length === 1) {
      filters.push(locationFilters[0]);
    } else if (locationFilters.length > 1) {
      // Services that have at least one matching booth OR one matching clinic room
      filters.push({ OR: locationFilters });
    }

    if (!includeInactive) {
      filters.push({ isActive: true });
    }

    if (requiresDoctorFilter !== undefined) {
      filters.push({ requiresDoctor: requiresDoctorFilter });
    }

    if (allExcludeServiceIds.length > 0) {
      filters.push({ id: { notIn: allExcludeServiceIds } });
    }

    if (keyword) {
      filters.push({
        OR: [
          {
            name: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
          {
            serviceCode: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
        ],
      });
    }

    const where: Prisma.ServiceWhereInput =
      filters.length > 1
        ? { AND: filters }
        : (filters[0] ?? ({} as Prisma.ServiceWhereInput));

    const [total, services] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        include: this.serviceLocationInclude,
        orderBy: [
          { requiresDoctor: 'desc' },
          { name: 'asc' },
          { serviceCode: 'asc' },
        ],
        skip,
        take,
      }),
    ]);

    return {
      referenceServiceIds: allServiceIds,
      boothIds: Array.from(intersectionBoothIds),
      clinicRoomIds: Array.from(intersectionClinicRoomIds),
      services: services.map((s) => this.mapServiceToCompactFormat(s)),
      pagination: this.buildPagination(total, take, skip),
    };
  }

  async createService(data: CreateServiceDto) {
    await Promise.all([
      this.ensureCategoryExists(data.categoryId),
      this.ensureSpecialtyExists(data.specialtyId),
    ]);

    try {
      const serviceCode = await this.generateUniqueServiceCode();
      const created = await this.prisma.service.create({
        data: {
          serviceCode,
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

  async upsertServicePromotion(
    serviceId: string,
    dto: UpsertServicePromotionDto,
  ) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const startDate = this.parseOptionalDateInput(dto.startDate, 'startDate');
    const endDate = this.parseOptionalDateInput(dto.endDate, 'endDate');

    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException(
        'endDate must be greater than or equal to startDate',
      );
    }

    const payload = {
      name: dto.name,
      description: dto.description ?? null,
      allowLoyaltyDiscount:
        dto.allowLoyaltyDiscount === undefined
          ? true
          : dto.allowLoyaltyDiscount,
      maxDiscountPercent: dto.maxDiscountPercent ?? null,
      maxDiscountAmount: dto.maxDiscountAmount ?? null,
      isActive: dto.isActive ?? true,
      startDate,
      endDate,
    };

    await this.prisma.servicePromotion.upsert({
      where: { serviceId },
      update: payload,
      create: {
        serviceId,
        ...payload,
      },
    });

    return this.getServiceManagementById(serviceId);
  }

  async deleteServicePromotion(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, promotion: { select: { id: true } } },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (!service.promotion) {
      throw new NotFoundException('Service promotion not found');
    }

    await this.prisma.servicePromotion.delete({
      where: { serviceId },
    });

    return {
      success: true,
      message: 'Service promotion deleted successfully',
    };
  }

  async getServicePromotionDetail(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        serviceCode: true,
        name: true,
        price: true,
        isActive: true,
        promotion: {
          select: {
            id: true,
            name: true,
            description: true,
            allowLoyaltyDiscount: true,
            maxDiscountPercent: true,
            maxDiscountAmount: true,
            isActive: true,
            startDate: true,
            endDate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  async listServicePromotions(query: ServicePromotionQueryDto) {
    const { take, skip } = this.normalizePagination(
      query.limit,
      query.offset,
      100,
    );

    const where: Prisma.ServicePromotionWhereInput = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.allowLoyaltyDiscount !== undefined) {
      where.allowLoyaltyDiscount = query.allowLoyaltyDiscount;
    }
    if (query.serviceId) {
      where.serviceId = query.serviceId;
    }
    if (query.search) {
      where.OR = [
        {
          name: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          service: {
            name: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        },
        {
          service: {
            serviceCode: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const [total, promotions] = await this.prisma.$transaction([
      this.prisma.servicePromotion.count({ where }),
      this.prisma.servicePromotion.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          service: {
            select: {
              id: true,
              serviceCode: true,
              name: true,
              price: true,
              isActive: true,
            },
          },
        },
      }),
    ]);

    return {
      promotions,
      pagination: this.buildPagination(total, take, skip),
    };
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
        orderBy: [{ name: 'asc' }, { code: 'asc' }],
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
    const packageCode = await this.generateUniquePackageCode();
    this.ensureNoDuplicateServiceIds(items);
    await this.ensureServicesExist(items.map((item) => item.serviceId));

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const pkg = await tx.package.create({
          data: {
            code: packageCode,
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
      await this.ensureServicesExist(data.items.map((item) => item.serviceId));
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.package.update({
          where: { id },
          data: {
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
    // Nếu không truyền limit thì lấy tất cả (take = undefined)
    const take = limit !== undefined ? Math.min(Math.max(limit, 1), maxLimit) : undefined;
    const skip = Math.max(offset ?? 0, 0);
    return { take, skip };
  }

  private buildPagination(total: number, limit: number | undefined, offset: number) {
    const effectiveLimit = limit ?? total;
    return {
      total,
      limit: effectiveLimit,
      offset,
      hasMore: limit !== undefined ? offset + limit < total : false,
    };
  }

  /**
   * Normalize Vietnamese text by removing accents for better search
   * Ví dụ: "Khám tổng quát" -> "Kham tong quat"
   */
  private normalizeVietnameseText(text: string): string {
    const vietnameseMap: Record<string, string> = {
      'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a',
      'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a',
      'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
      'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e',
      'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
      'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
      'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o',
      'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o',
      'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
      'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u',
      'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
      'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
      'đ': 'd',
      'À': 'A', 'Á': 'A', 'Ạ': 'A', 'Ả': 'A', 'Ã': 'A',
      'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ậ': 'A', 'Ẩ': 'A', 'Ẫ': 'A',
      'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ặ': 'A', 'Ẳ': 'A', 'Ẵ': 'A',
      'È': 'E', 'É': 'E', 'Ẹ': 'E', 'Ẻ': 'E', 'Ẽ': 'E',
      'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ệ': 'E', 'Ể': 'E', 'Ễ': 'E',
      'Ì': 'I', 'Í': 'I', 'Ị': 'I', 'Ỉ': 'I', 'Ĩ': 'I',
      'Ò': 'O', 'Ó': 'O', 'Ọ': 'O', 'Ỏ': 'O', 'Õ': 'O',
      'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ộ': 'O', 'Ổ': 'O', 'Ỗ': 'O',
      'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ợ': 'O', 'Ở': 'O', 'Ỡ': 'O',
      'Ù': 'U', 'Ú': 'U', 'Ụ': 'U', 'Ủ': 'U', 'Ũ': 'U',
      'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ự': 'U', 'Ử': 'U', 'Ữ': 'U',
      'Ỳ': 'Y', 'Ý': 'Y', 'Ỵ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y',
      'Đ': 'D',
    };

    return text
      .split('')
      .map((char) => vietnameseMap[char] || char)
      .join('');
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

  private normalizeCode(code?: string) {
    if (!code) {
      return undefined;
    }
    return code.trim().replace(/\s+/g, '').toUpperCase();
  }

  private async generateUniqueServiceCode() {
    return this.generateUniqueCode('SERV');
  }

  private async generateUniquePackageCode() {
    return this.generateUniqueCode('PACK');
  }

  private async generateUniqueCode(prefix: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${prefix}${this.randomSuffix()}`;
      const exists =
        prefix === 'SERV'
          ? await this.prisma.service.findUnique({
              where: { serviceCode: candidate },
            })
          : await this.prisma.package.findUnique({
              where: { code: candidate },
            });
      if (!exists) {
        return candidate;
      }
    }

    return `${prefix}${Date.now().toString(36).toUpperCase()}`;
  }

  private randomSuffix() {
    return `${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`.toUpperCase();
  }

  async advancedSearch(
    keyword: string,
    limit: number = 20,
    offset: number = 0,
    requiresDoctor?: boolean,
    isActive?: boolean,
  ) {
    if (!keyword || keyword.trim().length === 0) {
      return {
        results: [],
        pagination: this.buildPagination(0, limit, offset),
      };
    }

    const searchTerm = keyword.trim();
    const serviceBaseFilter: Prisma.ServiceWhereInput = {
      isActive: isActive ?? true,
    };
    const packageBaseFilter: Prisma.PackageWhereInput = {
      isActive: isActive ?? true,
    };

    if (requiresDoctor !== undefined) {
      serviceBaseFilter.requiresDoctor = requiresDoctor;
      packageBaseFilter.requiresDoctor = requiresDoctor;
    }

    // Priority 1: Services with name containing keyword
    const servicesWithNameMatch = await this.prisma.service.findMany({
      where: {
        ...serviceBaseFilter,
        name: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        serviceCode: true,
        name: true,
        price: true,
        description: true,
        durationMinutes: true,
        unit: true,
        isActive: true,
        requiresDoctor: true,
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
      },
    });

    // Priority 2: Packages with name containing keyword
    const packagesWithNameMatch = await this.prisma.package.findMany({
      where: {
        ...packageBaseFilter,
        name: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      },
      include: {
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
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    });

    // Priority 3: Packages containing services with name matching keyword
    const packagesWithServiceMatch = await this.prisma.package.findMany({
      where: {
        ...packageBaseFilter,
        items: {
          some: {
            service: {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          },
        },
        // Exclude packages already found in priority 2
        NOT: {
          name: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      },
      include: {
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
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    });

    // Priority 4: Services and Packages with description containing keyword
    const servicesWithDescMatch = await this.prisma.service.findMany({
      where: {
        ...serviceBaseFilter,
        description: {
          contains: searchTerm,
          mode: 'insensitive',
        },
        NOT: {
          name: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      },
      select: {
        id: true,
        serviceCode: true,
        name: true,
        price: true,
        description: true,
        durationMinutes: true,
        unit: true,
        isActive: true,
        requiresDoctor: true,
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
      },
    });

    const packagesWithDescMatch = await this.prisma.package.findMany({
      where: {
        ...packageBaseFilter,
        description: {
          contains: searchTerm,
          mode: 'insensitive',
        },
        // Exclude packages already found in priority 2 and 3
        NOT: {
          OR: [
            {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              items: {
                some: {
                  service: {
                    name: {
                      contains: searchTerm,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            },
          ],
        },
      },
      include: {
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
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    });

    // Combine results with priority
    const results = [
      ...servicesWithNameMatch.map((s) => ({
        type: 'service' as const,
        priority: 1,
        data: s,
      })),
      ...packagesWithNameMatch.map((p) => ({
        type: 'package' as const,
        priority: 2,
        data: p,
      })),
      ...packagesWithServiceMatch.map((p) => ({
        type: 'package' as const,
        priority: 3,
        data: p,
      })),
      ...servicesWithDescMatch.map((s) => ({
        type: 'service' as const,
        priority: 4,
        data: s,
      })),
      ...packagesWithDescMatch.map((p) => ({
        type: 'package' as const,
        priority: 4,
        data: p,
      })),
    ];

    // Sort by priority and apply pagination
    const sortedResults = results.sort((a, b) => a.priority - b.priority);
    const total = sortedResults.length;
    const paginatedResults = sortedResults.slice(offset, offset + limit);

    return {
      results: paginatedResults.map((r) => ({
        type: r.type,
        priority: r.priority,
        ...r.data,
      })),
      pagination: this.buildPagination(total, limit, offset),
      keyword: searchTerm,
    };
  }
}
