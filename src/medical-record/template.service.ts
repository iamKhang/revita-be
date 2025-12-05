import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto, TemplateQueryDto } from './dto/template.dto';
import { JwtUserPayload } from './dto/jwt-user-payload.dto';
import { Role } from '../rbac/roles.enum';

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo template mới (chỉ ADMIN)
   */
  async create(dto: CreateTemplateDto, user: JwtUserPayload) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ admin mới có quyền tạo template');
    }

    // Kiểm tra templateCode đã tồn tại chưa
    const existing = await this.prisma.template.findFirst({
      where: { templateCode: dto.templateCode },
    });

    if (existing) {
      throw new BadRequestException(
        `Template với mã code "${dto.templateCode}" đã tồn tại`,
      );
    }

    // Kiểm tra specialty tồn tại
    const specialty = await this.prisma.specialty.findUnique({
      where: { id: dto.specialtyId },
    });

    if (!specialty) {
      throw new NotFoundException('Không tìm thấy chuyên khoa');
    }

    return await this.prisma.template.create({
      data: {
        templateCode: dto.templateCode,
        name: dto.name,
        fields: dto.fields as any,
        specialtyId: dto.specialtyId,
        isActive: dto.isActive ?? true,
      },
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
  }

  /**
   * Lấy danh sách templates với phân trang và filter
   */
  async findAll(query: TemplateQueryDto, user: JwtUserPayload) {
    const limit = Math.min(query.limit ?? 10, 100);
    const offset = query.offset ?? 0;

    const where: any = {};

    if (query.specialtyId) {
      where.specialtyId = query.specialtyId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { templateCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.template.count({ where }),
      this.prisma.template.findMany({
        where,
        include: {
          specialty: {
            select: {
              id: true,
              name: true,
              specialtyCode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        limit,
        offset,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lấy template theo ID
   */
  async findOne(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
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

    if (!template) {
      throw new NotFoundException(`Không tìm thấy template với ID: ${id}`);
    }

    return template;
  }

  /**
   * Lấy template theo templateCode
   */
  async findByCode(templateCode: string) {
    const template = await this.prisma.template.findFirst({
      where: { templateCode },
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

    if (!template) {
      throw new NotFoundException(
        `Không tìm thấy template với mã code: ${templateCode}`,
      );
    }

    return template;
  }

  /**
   * Cập nhật template (chỉ ADMIN)
   */
  async update(id: string, dto: UpdateTemplateDto, user: JwtUserPayload) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ admin mới có quyền cập nhật template');
    }

    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Không tìm thấy template với ID: ${id}`);
    }

    // Kiểm tra specialty nếu có cập nhật
    if (dto.specialtyId) {
      const specialty = await this.prisma.specialty.findUnique({
        where: { id: dto.specialtyId },
      });

      if (!specialty) {
        throw new NotFoundException('Không tìm thấy chuyên khoa');
      }
    }

    const updateData: any = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.fields !== undefined) {
      updateData.fields = dto.fields as any;
    }

    if (dto.specialtyId !== undefined) {
      updateData.specialtyId = dto.specialtyId;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    return await this.prisma.template.update({
      where: { id },
      data: updateData,
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
  }

  /**
   * Xóa template (chỉ ADMIN)
   * Kiểm tra xem template có đang được sử dụng trong medical records không
   */
  async remove(id: string, user: JwtUserPayload) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ admin mới có quyền xóa template');
    }

    const template = await this.prisma.template.findUnique({
      where: { id },
      include: {
        medicalRecords: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Không tìm thấy template với ID: ${id}`);
    }

    // Kiểm tra template có đang được sử dụng không
    if (template.medicalRecords.length > 0) {
      throw new BadRequestException(
        'Không thể xóa template đang được sử dụng trong bệnh án. Vui lòng vô hiệu hóa (isActive = false) thay vì xóa.',
      );
    }

    return await this.prisma.template.delete({
      where: { id },
    });
  }
}

