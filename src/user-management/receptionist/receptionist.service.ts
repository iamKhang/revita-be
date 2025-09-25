import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenCounterDto, CloseCounterDto, CounterStatusResponseDto, CounterListResponseDto } from './dto/counter-management.dto';

@Injectable()
export class ReceptionistService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lấy danh sách tất cả các quầy với trạng thái hiện tại
   */
  async getAllCounters(): Promise<CounterListResponseDto> {
    const counters = await this.prisma.counter.findMany({
      where: { isActive: true },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            receptionist: {
              include: {
                auth: true
              }
            }
          },
          orderBy: { assignedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { counterCode: 'asc' }
    });

    const counterStatuses: CounterStatusResponseDto[] = counters.map(counter => ({
      counterId: counter.id,
      counterCode: counter.counterCode,
      counterName: counter.counterName,
      location: counter.location,
      isActive: counter.isActive,
      currentAssignment: counter.assignments.length > 0 ? {
        id: counter.assignments[0].id,
        receptionistId: counter.assignments[0].receptionistId,
        receptionistName: counter.assignments[0].receptionist.auth.name,
        assignedAt: counter.assignments[0].assignedAt,
        status: counter.assignments[0].status,
        notes: counter.assignments[0].notes
      } : undefined
    }));

    return { counters: counterStatuses };
  }

  /**
   * Mở quầy - tạo CounterAssignment mới
   * Trước khi tạo mới, cập nhật các phiên ACTIVE thành CANCELLED
   */
  async openCounter(receptionistId: string, openCounterDto: OpenCounterDto): Promise<{ success: boolean; assignmentId: string }> {
    const { counterId, notes } = openCounterDto;

    // Kiểm tra quầy có tồn tại và đang hoạt động không
    const counter = await this.prisma.counter.findUnique({
      where: { id: counterId }
    });

    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    if (!counter.isActive) {
      throw new BadRequestException('Counter is not active');
    }

    // Kiểm tra receptionist có tồn tại không
    const receptionist = await this.prisma.receptionist.findUnique({
      where: { id: receptionistId }
    });

    if (!receptionist) {
      throw new NotFoundException('Receptionist not found');
    }

    // Sử dụng transaction để đảm bảo tính nhất quán
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật tất cả các phiên ACTIVE của quầy này thành CANCELLED
      await tx.counterAssignment.updateMany({
        where: {
          counterId: counterId,
          status: 'ACTIVE'
        },
        data: {
          status: 'CANCELLED',
          completedAt: new Date()
        }
      });

      // 2. Tạo phiên mới
      const newAssignment = await tx.counterAssignment.create({
        data: {
          counterId: counterId,
          receptionistId: receptionistId,
          status: 'ACTIVE',
          notes: notes,
          assignedAt: new Date()
        }
      });

      return newAssignment;
    });

    return {
      success: true,
      assignmentId: result.id
    };
  }

  /**
   * Đóng quầy - cập nhật CounterAssignment thành COMPLETED
   */
  async closeCounter(receptionistId: string, closeCounterDto: CloseCounterDto): Promise<{ success: boolean }> {
    const { counterId, notes } = closeCounterDto;

    // Tìm phiên ACTIVE của receptionist tại quầy này
    const activeAssignment = await this.prisma.counterAssignment.findFirst({
      where: {
        counterId: counterId,
        receptionistId: receptionistId,
        status: 'ACTIVE'
      }
    });

    if (!activeAssignment) {
      throw new BadRequestException('No active assignment found for this receptionist at this counter');
    }

    // Cập nhật phiên thành COMPLETED
    await this.prisma.counterAssignment.update({
      where: { id: activeAssignment.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes: notes || activeAssignment.notes
      }
    });

    return { success: true };
  }

  /**
   * Lấy trạng thái quầy hiện tại của receptionist
   */
  async getCurrentCounterStatus(receptionistId: string): Promise<CounterStatusResponseDto | null> {
    const activeAssignment = await this.prisma.counterAssignment.findFirst({
      where: {
        receptionistId: receptionistId,
        status: 'ACTIVE'
      },
      include: {
        counter: true,
        receptionist: {
          include: {
            auth: true
          }
        }
      }
    });

    if (!activeAssignment) {
      return null;
    }

    return {
      counterId: activeAssignment.counter.id,
      counterCode: activeAssignment.counter.counterCode,
      counterName: activeAssignment.counter.counterName,
      location: activeAssignment.counter.location,
      isActive: activeAssignment.counter.isActive,
      currentAssignment: {
        id: activeAssignment.id,
        receptionistId: activeAssignment.receptionistId,
        receptionistName: activeAssignment.receptionist.auth.name,
        assignedAt: activeAssignment.assignedAt,
        status: activeAssignment.status,
        notes: activeAssignment.notes
      }
    };
  }
}
