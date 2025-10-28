import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../rbac/public.decorator';
import { Role } from '../rbac/roles.enum';

@Controller('public')
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách bác sĩ (public)
   * GET /public/doctors
   * Optional query: specialtyId, specialtyName (filter)
   */
  @Get('doctors')
  @Public()
  async getDoctors(
    @Query('specialtyId') specialtyId?: string,
    @Query('specialtyName') specialtyName?: string,
  ) {
    const where = {
      role: Role.DOCTOR,
      doctor: {
        is: {
          ...(specialtyId && { specialtyId }),
          ...(specialtyName && {
            specialty: {
              is: {
                name: { contains: specialtyName },
              },
            },
          }),
        },
      },
    };

    return this.prisma.auth.findMany({
      where,
      select: {
        id: true,
        name: true,
        avatar: true,
        doctor: {
          select: {
            id: true,
            doctorCode: true,
            yearsExperience: true,
            rating: true,
            workHistory: true,
            description: true,
            specialty: {
              select: { id: true, specialtyCode: true, name: true, description: true, imgUrl: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Lấy danh sách chuyên khoa (public)
   * GET /public/specialties
   */
  @Get('specialties')
  @Public()
  async getSpecialties() {
    return this.prisma.specialty.findMany({
      select: {
        id: true,
        specialtyCode: true,
        name: true,
        imgUrl: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
