import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ServiceCategoryListQueryDto,
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
} from './dto';

@Injectable()
export class ServiceCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(query: ServiceCategoryListQueryDto) {
    const take =
      query.limit !== undefined
        ? Math.min(Math.max(query.limit, 1), 1000)
        : 100;
    const skip =
      query.offset !== undefined ? Math.max(query.offset, 0) : 0;

    const where: Prisma.ServiceCategoryWhereInput = query.search
      ? {
          OR: [
            {
              name: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
            {
              code: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {};

    const [total, categories] = await this.prisma.$transaction([
      this.prisma.serviceCategory.count({ where }),
      this.prisma.serviceCategory.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip,
        take,
        include: {
          _count: {
            select: {
              services: true,
              packages: true,
            },
          },
        },
      }),
    ]);

    return {
      categories: categories.map((category) => ({
        id: category.id,
        code: category.code,
        name: category.name,
        description: category.description,
        servicesCount: category._count.services,
        packagesCount: category._count.packages,
      })),
      pagination: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + take < total,
      },
    };
  }

  async createCategory(dto: CreateServiceCategoryDto) {
    const code = await this.generateUniqueCategoryCode(dto.name);

    try {
      return await this.prisma.serviceCategory.create({
        data: {
          code,
          name: dto.name,
          description: dto.description ?? null,
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async updateCategory(id: string, dto: UpdateServiceCategoryDto) {
    const existing = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Service category not found');
    }

    if (!dto.name && dto.description === undefined) {
      return existing;
    }

    try {
      return await this.prisma.serviceCategory.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async getCategoryDetail(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        services: {
          select: {
            id: true,
            name: true,
            serviceCode: true,
            isActive: true,
          },
        },
        packages: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Service category not found');
    }

    return category;
  }

  private async generateUniqueCategoryCode(name?: string) {
    const basePrefix = this.buildPrefixFromName(name);

    for (let attempt = 0; attempt < 10; attempt++) {
      const suffix = (attempt + 1).toString().padStart(3, '0');
      const candidate = `${basePrefix}${suffix}`;
      const exists = await this.prisma.serviceCategory.findUnique({
        where: { code: candidate },
      });
      if (!exists) {
        return candidate;
      }
    }

    return `${basePrefix}${Date.now().toString(36).toUpperCase()}`;
  }

  private buildPrefixFromName(name?: string) {
    if (!name) {
      return 'SCAT';
    }
    const cleaned = name
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 4);
    return cleaned.length >= 3 ? `SC${cleaned}` : `SCAT`;
  }

  private handlePrismaError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException('Service category code already exists');
    }
    throw error;
  }
}
