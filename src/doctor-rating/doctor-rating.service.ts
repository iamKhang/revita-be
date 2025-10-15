/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDoctorRatingDto,
  UpdateDoctorRatingDto,
  DoctorRatingResponseDto,
  DoctorRatingStatsDto,
  DoctorRatingSummaryDto,
} from './dto';
import { UserContext } from '../statistics/dto/user-context.dto';

@Injectable()
export class DoctorRatingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Lấy patientId từ authId
   */
  private async getPatientIdFromAuthId(authId: string): Promise<string | null> {
    const patient = await this.prisma.patient.findUnique({
      where: { authId },
      select: { id: true },
    });

    return patient?.id || null;
  }

  /**
   * Cập nhật rating trung bình cho bác sĩ
   */
  private async updateDoctorAverageRating(doctorId: string): Promise<void> {
    const ratingStats = await this.prisma.doctorRating.aggregate({
      where: { doctorId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const averageRating = ratingStats._avg.rating || 0;
    const ratingCount = ratingStats._count.rating || 0;

    await this.prisma.doctor.update({
      where: { id: doctorId },
      data: {
        rating: Math.round(averageRating * 10) / 10, // Làm tròn 1 chữ số thập phân
        ratingCount,
      },
    });
  }

  /**
   * Tạo đánh giá mới
   */
  async create(
    createDto: CreateDoctorRatingDto,
    user: UserContext,
  ): Promise<DoctorRatingResponseDto> {
    // Kiểm tra quyền: PATIENT hoặc ADMIN
    if (user.role !== 'PATIENT' && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only patients and admins can create ratings',
      );
    }

    // Lấy patientId
    let patientId: string;
    if (user.role === 'ADMIN' && createDto.patientId) {
      // ADMIN chỉ định patientId
      patientId = createDto.patientId;
    } else {
      // PATIENT sử dụng authId của mình
      const foundPatientId = await this.getPatientIdFromAuthId(user.id);
      if (!foundPatientId) {
        throw new ForbiddenException('Patient not found');
      }
      patientId = foundPatientId;
    }

    // Kiểm tra bác sĩ có tồn tại không
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: createDto.doctorId },
      include: { auth: true },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Kiểm tra đã đánh giá bác sĩ này chưa
    const existingRating = await this.prisma.doctorRating.findUnique({
      where: {
        doctorId_patientId: {
          doctorId: createDto.doctorId,
          patientId: patientId,
        },
      },
    });
    if (existingRating) {
      throw new ConflictException('You have already rated this doctor');
    }

    // Tạo đánh giá mới
    const rating = await this.prisma.doctorRating.create({
      data: {
        doctorId: createDto.doctorId,
        patientId,
        rating: createDto.rating,
        comment: createDto.comment,
      },
      include: {
        doctor: {
          include: { auth: true },
        },
        patient: {
          include: { auth: true },
        },
      },
    });

    // Cập nhật rating trung bình cho bác sĩ
    await this.updateDoctorAverageRating(createDto.doctorId);

    return this.formatRatingResponse(rating);
  }

  /**
   * Cập nhật đánh giá
   */
  async update(
    id: string,
    updateDto: UpdateDoctorRatingDto,
    user: UserContext,
  ): Promise<DoctorRatingResponseDto> {
    // Kiểm tra quyền: PATIENT hoặc ADMIN
    if (user.role !== 'PATIENT' && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only patients and admins can update ratings',
      );
    }

    // Lấy patientId (chỉ cần cho PATIENT)
    let patientId: string | null = null;
    if (user.role === 'PATIENT') {
      patientId = await this.getPatientIdFromAuthId(user.id);
      if (!patientId) {
        throw new ForbiddenException('Patient not found');
      }
    }

    // Kiểm tra đánh giá có tồn tại không
    const existingRating = await this.prisma.doctorRating.findUnique({
      where: { id },
      include: {
        doctor: { include: { auth: true } },
        patient: { include: { auth: true } },
      },
    });

    if (!existingRating) {
      throw new NotFoundException('Rating not found');
    }

    // Kiểm tra quyền sở hữu (chỉ áp dụng cho PATIENT)
    if (user.role === 'PATIENT' && existingRating.patientId !== patientId) {
      throw new ForbiddenException('You can only update your own ratings');
    }

    // Cập nhật đánh giá
    const updatedRating = await this.prisma.doctorRating.update({
      where: { id },
      data: {
        rating: updateDto.rating,
        comment: updateDto.comment,
      },
      include: {
        doctor: { include: { auth: true } },
        patient: { include: { auth: true } },
      },
    });

    // Cập nhật rating trung bình cho bác sĩ
    await this.updateDoctorAverageRating(existingRating.doctorId);

    return this.formatRatingResponse(updatedRating);
  }

  /**
   * Xóa đánh giá
   */
  async remove(id: string, user: UserContext): Promise<void> {
    // Kiểm tra quyền: PATIENT hoặc ADMIN
    if (user.role !== 'PATIENT' && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only patients and admins can delete ratings',
      );
    }

    // Lấy patientId (chỉ cần cho PATIENT)
    let patientId: string | null = null;
    if (user.role === 'PATIENT') {
      patientId = await this.getPatientIdFromAuthId(user.id);
      if (!patientId) {
        throw new ForbiddenException('Patient not found');
      }
    }

    // Kiểm tra đánh giá
    const existingRating = await this.prisma.doctorRating.findUnique({
      where: { id },
    });

    if (!existingRating) {
      throw new NotFoundException('Rating not found');
    }

    // Kiểm tra quyền sở hữu (chỉ áp dụng cho PATIENT)
    if (user.role === 'PATIENT' && existingRating.patientId !== patientId) {
      throw new ForbiddenException('You can only delete your own ratings');
    }

    // Xóa đánh giá
    await this.prisma.doctorRating.delete({
      where: { id },
    });

    // Cập nhật rating trung bình cho bác sĩ
    await this.updateDoctorAverageRating(existingRating.doctorId);
  }

  /**
   * Lấy danh sách đánh giá của bác sĩ
   */
  async getDoctorRatings(
    doctorId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    ratings: DoctorRatingResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [ratings, total] = await Promise.all([
      this.prisma.doctorRating.findMany({
        where: { doctorId },
        include: {
          doctor: { include: { auth: true } },
          patient: { include: { auth: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.doctorRating.count({
        where: { doctorId },
      }),
    ]);

    return {
      ratings: ratings.map((rating) => this.formatRatingResponse(rating)),
      total,
      page,
      limit,
    };
  }

  /**
   * Lấy thống kê đánh giá của bác sĩ
   */
  async getDoctorRatingStats(doctorId: string): Promise<DoctorRatingStatsDto> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { auth: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const [ratingStats, ratingDistribution, recentComments] = await Promise.all(
      [
        // Thống kê tổng quan
        this.prisma.doctorRating.aggregate({
          where: { doctorId },
          _avg: { rating: true },
          _count: { rating: true },
        }),

        // Phân phối rating
        this.prisma.doctorRating.groupBy({
          by: ['rating'],
          where: { doctorId },
          _count: { rating: true },
          orderBy: { rating: 'desc' },
        }),

        // Comments gần đây
        this.prisma.doctorRating.findMany({
          where: {
            doctorId,
            comment: { not: null },
          },
          include: {
            patient: { include: { auth: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ],
    );

    const totalRatings = ratingStats._count.rating || 0;
    const averageRating = ratingStats._avg.rating || 0;

    // Tính phần trăm cho mỗi rating
    const ratingDistributionWithPercentage = ratingDistribution.map((item) => ({
      rating: item.rating,
      count: item._count.rating,
      percentage:
        totalRatings > 0 ? (item._count.rating / totalRatings) * 100 : 0,
    }));

    // Format recent comments
    const formattedComments = recentComments.map((rating) => ({
      id: rating.id,
      comment: rating.comment!,
      rating: rating.rating,
      patientName: rating.patient.auth?.name || 'Anonymous',
      createdAt: rating.createdAt.toISOString(),
    }));

    return {
      totalRatings,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution: ratingDistributionWithPercentage,
      recentComments: formattedComments,
    };
  }

  /**
   * Lấy danh sách đánh giá của patient
   */
  async getPatientRatings(
    user: UserContext,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    ratings: DoctorRatingResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (user.role !== 'PATIENT') {
      throw new ForbiddenException('Only patients can view their ratings');
    }

    const patientId = await this.getPatientIdFromAuthId(user.id);
    if (!patientId) {
      throw new ForbiddenException('Patient not found');
    }

    const skip = (page - 1) * limit;

    const [ratings, total] = await Promise.all([
      this.prisma.doctorRating.findMany({
        where: { patientId },
        include: {
          doctor: { include: { auth: true } },
          patient: { include: { auth: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.doctorRating.count({
        where: { patientId },
      }),
    ]);

    return {
      ratings: ratings.map((rating) => this.formatRatingResponse(rating)),
      total,
      page,
      limit,
    };
  }

  /**
   * Lấy tất cả đánh giá (chỉ ADMIN)
   */
  async getAllRatings(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    ratings: DoctorRatingResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [ratings, total] = await Promise.all([
      this.prisma.doctorRating.findMany({
        include: {
          doctor: { include: { auth: true } },
          patient: { include: { auth: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.doctorRating.count(),
    ]);

    return {
      ratings: ratings.map((rating) => this.formatRatingResponse(rating)),
      total,
      page,
      limit,
    };
  }

  /**
   * Lấy tất cả rating summary cho thống kê
   */
  async getAllDoctorRatingSummaries(): Promise<DoctorRatingSummaryDto[]> {
    const doctors = await this.prisma.doctor.findMany({
      include: { auth: true },
      orderBy: { rating: 'desc' },
    });

    return doctors.map((doctor) => ({
      doctorId: doctor.id,
      doctorName: doctor.auth.name,
      doctorCode: doctor.doctorCode,
      totalRatings: doctor.ratingCount,
      averageRating: doctor.rating,
      ratingCount: doctor.ratingCount,
    }));
  }

  /**
   * Format rating response
   */
  private formatRatingResponse(rating: any): DoctorRatingResponseDto {
    return {
      id: rating.id,
      doctorId: rating.doctorId,
      doctorName: rating.doctor.auth.name,
      doctorCode: rating.doctor.doctorCode,
      patientId: rating.patientId,
      patientName: rating.patient.auth?.name || 'Anonymous',
      rating: rating.rating,
      comment: rating.comment,
      createdAt: rating.createdAt.toISOString(),
      updatedAt: rating.updatedAt.toISOString(),
    };
  }
}
