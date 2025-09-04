import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrescriptionStatus } from '@prisma/client';

export interface ScanPrescriptionResponse {
  prescription: any;
  currentService?: any;
}

export interface UpdateServiceStatusResponse {
  service: any;
  nextService?: any;
  message: string;
}

export interface UpdateResultsResponse {
  service: any;
  message: string;
}

export interface GetServicesQuery {
  status?: PrescriptionStatus;
  workSessionId?: string;
}

@Injectable()
export class PrescriptionServiceManagementService {
  private readonly logger = new Logger(PrescriptionServiceManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async scanPrescription(
    prescriptionCode: string,
    userId: string,
    userRole: string,
  ): Promise<ScanPrescriptionResponse> {
    try {
      this.logger.log(`${userRole} ${userId} scanning prescription: ${prescriptionCode}`);

      // Tìm prescription theo code
      const prescription = await this.prisma.prescription.findFirst({
        where: { prescriptionCode },
        include: {
          patientProfile: {
            select: {
              id: true,
              name: true,
              dateOfBirth: true,
              gender: true,
              patient: {
                select: {
                  patientCode: true,
                },
              },
            },
          },
        },
      });

      if (!prescription) {
        throw new NotFoundException('Không tìm thấy phiếu chỉ định với mã này');
      }

      // Lấy prescriptionServices riêng biệt
      const prescriptionServices = await this.prisma.prescriptionService.findMany({
        where: { prescriptionId: prescription.id },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              price: true,
              description: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      });

      // Tìm service đang ở trạng thái WAITING
      const waitingService = prescriptionServices.find(
        (ps) => ps.status === PrescriptionStatus.WAITING,
      );

      // Nếu có service WAITING, cập nhật thành SERVING và gán user
      let currentService: any = null;
      if (waitingService) {
        const updateData: any = {
          status: PrescriptionStatus.SERVING,
          startedAt: new Date(),
        };

        // Gán doctor hoặc technician tùy theo role
        if (userRole === 'DOCTOR') {
          updateData.doctorId = userId;
        } else if (userRole === 'TECHNICIAN') {
          updateData.technicianId = userId;
        }

        currentService = await this.prisma.prescriptionService.update({
          where: {
            prescriptionId_serviceId: {
              prescriptionId: prescription.id,
              serviceId: waitingService.serviceId,
            },
          },
          data: updateData,
          include: {
            service: true,
            doctor: { include: { auth: true } },
            technician: { include: { auth: true } },
          },
        });

        this.logger.log(`Service ${waitingService.serviceId} updated to SERVING for ${userRole} ${userId}`);
      }

      return {
        prescription: {
          ...prescription,
          prescriptionServices,
        },
        currentService,
      };
    } catch (error) {
      this.logger.error(`Scan prescription error: ${error.message}`);
      throw error;
    }
  }

  async updateServiceStatus(
    prescriptionServiceId: string,
    status: PrescriptionStatus,
    userId: string,
    userRole: string,
    note?: string,
  ): Promise<UpdateServiceStatusResponse> {
    try {
      this.logger.log(`${userRole} ${userId} updating service ${prescriptionServiceId} to ${status}`);

      // Parse composite key
      const [prescriptionId, serviceId] = prescriptionServiceId.split('-');

      // Tìm prescription service
      const prescriptionService = await this.prisma.prescriptionService.findFirst({
        where: {
          prescriptionId,
          serviceId,
          OR: [
            { doctorId: userRole === 'DOCTOR' ? userId : undefined },
            { technicianId: userRole === 'TECHNICIAN' ? userId : undefined },
          ].filter(Boolean),
        },
        include: {
          service: true,
        },
      });

      if (!prescriptionService) {
        throw new NotFoundException('Không tìm thấy service hoặc bạn không có quyền cập nhật');
      }

      // Lấy tất cả prescription services để tìm service tiếp theo
      const allPrescriptionServices = await this.prisma.prescriptionService.findMany({
        where: { prescriptionId: prescriptionService.prescriptionId },
        include: { service: true },
        orderBy: { order: 'asc' },
      });

      // Cập nhật status
      const updateData: any = {
        status,
        note,
      };

      if (status === PrescriptionStatus.WAITING_RESULT) {
        updateData.completedAt = new Date();
      }

      const updatedService = await this.prisma.prescriptionService.update({
        where: {
          prescriptionId_serviceId: {
            prescriptionId: prescriptionService.prescriptionId,
            serviceId: prescriptionService.serviceId,
          },
        },
        data: updateData,
        include: { service: true },
      });

      let nextService: any = null;

      // Nếu chuyển từ SERVING sang WAITING_RESULT, tìm service tiếp theo và chuyển sang WAITING
      if (
        prescriptionService.status === PrescriptionStatus.SERVING &&
        status === PrescriptionStatus.WAITING_RESULT
      ) {
        const currentOrder = prescriptionService.order;
        const nextOrderService = allPrescriptionServices.find(
          (ps) => ps.order === currentOrder + 1,
        );

        if (nextOrderService) {
          nextService = await this.prisma.prescriptionService.update({
            where: {
              prescriptionId_serviceId: {
                prescriptionId: prescriptionService.prescriptionId,
                serviceId: nextOrderService.serviceId,
              },
            },
            data: {
              status: PrescriptionStatus.WAITING,
            },
            include: { service: true },
          });

          this.logger.log(`Next service ${nextOrderService.serviceId} updated to WAITING`);
        }
      }

      return {
        service: updatedService,
        nextService,
        message: 'Cập nhật trạng thái thành công',
      };
    } catch (error) {
      this.logger.error(`Update service status error: ${error.message}`);
      throw error;
    }
  }

  async updateServiceResults(
    prescriptionServiceId: string,
    results: string[],
    userId: string,
    userRole: string,
    note?: string,
  ): Promise<UpdateResultsResponse> {
    try {
      this.logger.log(`${userRole} ${userId} updating results for service ${prescriptionServiceId}`);

      const [prescriptionId, serviceId] = prescriptionServiceId.split('-');

      // Tìm prescription service
      const prescriptionService = await this.prisma.prescriptionService.findFirst({
        where: {
          prescriptionId,
          serviceId,
          OR: [
            { doctorId: userRole === 'DOCTOR' ? userId : undefined },
            { technicianId: userRole === 'TECHNICIAN' ? userId : undefined },
          ].filter(Boolean),
        },
        include: { service: true },
      });

      if (!prescriptionService) {
        throw new NotFoundException('Không tìm thấy service hoặc bạn không có quyền cập nhật');
      }

      // Kiểm tra trạng thái hiện tại
      if (prescriptionService.status !== PrescriptionStatus.WAITING_RESULT) {
        throw new BadRequestException('Service phải ở trạng thái WAITING_RESULT mới có thể cập nhật kết quả');
      }

      // Cập nhật kết quả và chuyển sang COMPLETED
      const updatedService = await this.prisma.prescriptionService.update({
        where: {
          prescriptionId_serviceId: {
            prescriptionId: prescriptionService.prescriptionId,
            serviceId: prescriptionService.serviceId,
          },
        },
        data: {
          status: PrescriptionStatus.COMPLETED,
          results,
          note,
          completedAt: new Date(),
        },
        include: { service: true },
      });

      this.logger.log(`Service ${prescriptionService.serviceId} completed with results`);

      return {
        service: updatedService,
        message: 'Cập nhật kết quả thành công',
      };
    } catch (error) {
      this.logger.error(`Update service results error: ${error.message}`);
      throw error;
    }
  }

  async getUserServices(
    userId: string,
    userRole: string,
    query: GetServicesQuery,
  ) {
    try {
      const whereCondition: any = {};

      // Filter by assigned user
      if (userRole === 'DOCTOR') {
        whereCondition.doctorId = userId;
      } else if (userRole === 'TECHNICIAN') {
        whereCondition.technicianId = userId;
      }

      if (query.status) {
        whereCondition.status = query.status;
      }

      const services = await this.prisma.prescriptionService.findMany({
        where: whereCondition,
        include: {
          prescription: {
            include: {
              patientProfile: {
                select: {
                  id: true,
                  name: true,
                  dateOfBirth: true,
                  gender: true,
                },
              },
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              price: true,
              description: true,
            },
          },
        },
        orderBy: [
          { startedAt: 'desc' },
        ],
      });

      return {
        services,
        total: services.length,
      };
    } catch (error) {
      this.logger.error(`Get user services error: ${error.message}`);
      throw error;
    }
  }

  async getUserWorkSession(userId: string, userRole: string) {
    try {
      const now = new Date();

      let workSession;
      if (userRole === 'DOCTOR') {
        workSession = await this.prisma.workSession.findFirst({
          where: {
            doctorId: userId,
            startTime: { lte: now },
            endTime: { gte: now },
          },
          include: {
            booth: {
              include: {
                room: {
                  include: {
                    specialty: true,
                  },
                },
              },
            },
          },
        });
      } else if (userRole === 'TECHNICIAN') {
        workSession = await this.prisma.workSession.findFirst({
          where: {
            technicianId: userId,
            startTime: { lte: now },
            endTime: { gte: now },
          },
          include: {
            booth: {
              include: {
                room: {
                  include: {
                    specialty: true,
                  },
                },
              },
            },
          },
        });
      }

      return workSession;
    } catch (error) {
      this.logger.error(`Get user work session error: ${error.message}`);
      throw error;
    }
  }
}


