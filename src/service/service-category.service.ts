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
    // Nếu có code được truyền vào, sử dụng code đó, nếu không thì tự động generate
    let code = dto.code;
    
    if (!code || code.trim().length === 0) {
      code = await this.generateUniqueCategoryCode(dto.name);
    } else {
      // Kiểm tra code đã tồn tại chưa
      code = code.trim();
      const existing = await this.prisma.serviceCategory.findUnique({
        where: { code },
      });
      if (existing) {
        throw new BadRequestException(`Service category code '${code}' already exists`);
      }
    }

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

    if (!dto.name && dto.description === undefined && !dto.code) {
      return existing;
    }

    // Nếu có code mới được truyền vào, kiểm tra code đã tồn tại chưa (trừ chính nó)
    if (dto.code && dto.code.trim().length > 0) {
      const code = dto.code.trim();
      const codeExists = await this.prisma.serviceCategory.findFirst({
        where: {
          code,
          id: { not: id }, // Loại trừ chính category đang cập nhật
        },
      });
      if (codeExists) {
        throw new BadRequestException(`Service category code '${code}' already exists`);
      }
    }

    try {
      return await this.prisma.serviceCategory.update({
        where: { id },
        data: {
          ...(dto.code && { code: dto.code.trim() }),
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
            serviceCode: true,
            name: true,
            price: true,
            description: true,
            durationMinutes: true,
            isActive: true,
            unit: true,
            currency: true,
            requiresDoctor: true,
            specialty: {
              select: {
                id: true,
                name: true,
                specialtyCode: true,
              },
            },
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [
            { name: 'asc' },
            { serviceCode: 'asc' },
          ],
        },
        packages: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            price: true,
            isActive: true,
            requiresDoctor: true,
            specialty: {
              select: {
                id: true,
                name: true,
                specialtyCode: true,
              },
            },
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [
            { name: 'asc' },
            { code: 'asc' },
          ],
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Service category not found');
    }

    return category;
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            services: true,
            packages: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Service category not found');
    }

    // Kiểm tra xem category có đang được sử dụng không
    if (category._count.services > 0 || category._count.packages > 0) {
      throw new BadRequestException(
        `Cannot delete service category. It is currently being used by ${category._count.services} service(s) and ${category._count.packages} package(s).`,
      );
    }

    try {
      await this.prisma.serviceCategory.delete({
        where: { id },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
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

  async addServiceToCategory(categoryId: string, serviceId: string) {
    // Kiểm tra category tồn tại
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Service category not found');
    }

    // Kiểm tra service tồn tại
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Cập nhật service để thêm vào category
    try {
      return await this.prisma.service.update({
        where: { id: serviceId },
        data: {
          categoryId,
        },
        include: {
          category: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async removeServiceFromCategory(categoryId: string, serviceId: string) {
    // Kiểm tra category tồn tại
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Service category not found');
    }

    // Kiểm tra service tồn tại và đang thuộc category này
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (service.categoryId !== categoryId) {
      throw new BadRequestException(
        'Service does not belong to this category',
      );
    }

    // Xóa service khỏi category (set categoryId = null)
    try {
      return await this.prisma.service.update({
        where: { id: serviceId },
        data: {
          categoryId: null,
        },
        include: {
          category: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
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
