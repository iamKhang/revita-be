import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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
  limit?: number;
  offset?: number;
}

@Injectable()
export class PrescriptionServiceManagementService {
  private readonly logger = new Logger(
    PrescriptionServiceManagementService.name,
  );

  constructor(private readonly prisma: PrismaService) {}

  async scanPrescription(
    prescriptionCode: string,
    userId: string,
    userRole: string,
  ): Promise<ScanPrescriptionResponse> {
    try {
      this.logger.log(
        `${userRole} ${userId} scanning prescription: ${prescriptionCode}`,
      );

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
      const prescriptionServices =
        await this.prisma.prescriptionService.findMany({
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

      // Debug: Log tất cả prescription services
      this.logger.log(
        `Found ${prescriptionServices.length} prescription services for prescription ${prescription.id}`,
      );
      prescriptionServices.forEach((ps, index) => {
        this.logger.log(
          `Service ${index + 1}: ${ps.service.name} - Status: ${ps.status} - DoctorId: ${ps.doctorId} - TechnicianId: ${ps.technicianId}`,
        );
      });

      // Tìm service đang ở trạng thái WAITING
      const waitingService = prescriptionServices.find(
        (ps) => ps.status === PrescriptionStatus.WAITING,
      );

      this.logger.log(
        `Waiting service found: ${waitingService ? waitingService.service.name : 'None'}`,
      );

      // Resolve auth ID to doctor/technician ID for checking permissions
      let resolvedUserId: string | null = null;
      if (userRole === 'DOCTOR') {
        const doctor = await this.prisma.doctor.findFirst({
          where: { authId: userId },
        });
        resolvedUserId = doctor?.id || null;
      } else if (userRole === 'TECHNICIAN') {
        const technician = await this.prisma.technician.findFirst({
          where: { authId: userId },
        });
        resolvedUserId = technician?.id || null;
      }

      this.logger.log(`Resolved ${userRole} ID: ${resolvedUserId}`);

      // Nếu có service WAITING, cập nhật thành SERVING và gán user
      let currentService: any = null;
      if (waitingService) {
        const updateData: any = {
          status: PrescriptionStatus.SERVING,
          startedAt: new Date(),
        };

        // Resolve auth ID to doctor/technician ID and assign
        if (userRole === 'DOCTOR') {
          const doctor = await this.prisma.doctor.findFirst({
            where: { authId: userId },
          });
          if (doctor) {
            updateData.doctorId = doctor.id;
          }
        } else if (userRole === 'TECHNICIAN') {
          const technician = await this.prisma.technician.findFirst({
            where: { authId: userId },
          });
          if (technician) {
            updateData.technicianId = technician.id;
          }
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

        this.logger.log(
          `Service ${waitingService.serviceId} updated to SERVING for ${userRole} ${userId}`,
        );
      } else {
        // Nếu không có service WAITING, kiểm tra xem có service nào đã được assign cho user hiện tại không
        const assignedService = prescriptionServices.find((ps) => {
          if (userRole === 'DOCTOR' && ps.doctorId === resolvedUserId) {
            return (
              ps.status === PrescriptionStatus.SERVING ||
              ps.status === PrescriptionStatus.WAITING_RESULT
            );
          } else if (
            userRole === 'TECHNICIAN' &&
            ps.technicianId === resolvedUserId
          ) {
            return (
              ps.status === PrescriptionStatus.SERVING ||
              ps.status === PrescriptionStatus.WAITING_RESULT
            );
          }
          return false;
        });

        if (assignedService) {
          this.logger.log(
            `Found assigned service: ${assignedService.service.name} - Status: ${assignedService.status}`,
          );
          currentService = assignedService;
        } else {
          this.logger.log(`No service found for ${userRole} ${resolvedUserId}`);
          // Kiểm tra xem có service nào đang ở trạng thái SERVING hoặc WAITING_RESULT không
          const activeService = prescriptionServices.find(
            (ps) =>
              ps.status === PrescriptionStatus.SERVING ||
              ps.status === PrescriptionStatus.WAITING_RESULT,
          );

          if (activeService) {
            this.logger.log(
              `Found active service: ${activeService.service.name} - Status: ${activeService.status} - Assigned to Doctor: ${activeService.doctorId} - Technician: ${activeService.technicianId}`,
            );
          }
        }
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
      this.logger.log(
        `${userRole} ${userId} updating service ${prescriptionServiceId} to ${status}`,
      );

      // Parse composite key
      const [prescriptionId, serviceId] = prescriptionServiceId.split('-');

      // Resolve auth ID to doctor/technician ID
      let resolvedUserId: string | null = null;
      if (userRole === 'DOCTOR') {
        const doctor = await this.prisma.doctor.findFirst({
          where: { authId: userId },
        });
        resolvedUserId = doctor?.id || null;
      } else if (userRole === 'TECHNICIAN') {
        const technician = await this.prisma.technician.findFirst({
          where: { authId: userId },
        });
        resolvedUserId = technician?.id || null;
      }

      if (!resolvedUserId) {
        throw new NotFoundException('Không tìm thấy thông tin user');
      }

      // Tìm prescription service
      const prescriptionService =
        await this.prisma.prescriptionService.findFirst({
          where: {
            prescriptionId,
            serviceId,
            OR: [
              { doctorId: userRole === 'DOCTOR' ? resolvedUserId : undefined },
              {
                technicianId:
                  userRole === 'TECHNICIAN' ? resolvedUserId : undefined,
              },
            ].filter(Boolean),
          },
          include: {
            service: true,
          },
        });

      if (!prescriptionService) {
        throw new NotFoundException(
          'Không tìm thấy service hoặc bạn không có quyền cập nhật',
        );
      }

      // Lấy tất cả prescription services để tìm service tiếp theo
      const allPrescriptionServices =
        await this.prisma.prescriptionService.findMany({
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

          this.logger.log(
            `Next service ${nextOrderService.serviceId} updated to WAITING`,
          );
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
      this.logger.log(
        `${userRole} ${userId} updating results for service ${prescriptionServiceId}`,
      );

      const [prescriptionId, serviceId] = prescriptionServiceId.split('-');

      // Resolve auth ID to doctor/technician ID
      let resolvedUserId: string | null = null;
      if (userRole === 'DOCTOR') {
        const doctor = await this.prisma.doctor.findFirst({
          where: { authId: userId },
        });
        resolvedUserId = doctor?.id || null;
      } else if (userRole === 'TECHNICIAN') {
        const technician = await this.prisma.technician.findFirst({
          where: { authId: userId },
        });
        resolvedUserId = technician?.id || null;
      }

      if (!resolvedUserId) {
        throw new NotFoundException('Không tìm thấy thông tin user');
      }

      // Tìm prescription service
      const prescriptionService =
        await this.prisma.prescriptionService.findFirst({
          where: {
            prescriptionId,
            serviceId,
            OR: [
              { doctorId: userRole === 'DOCTOR' ? resolvedUserId : undefined },
              {
                technicianId:
                  userRole === 'TECHNICIAN' ? resolvedUserId : undefined,
              },
            ].filter(Boolean),
          },
          include: { service: true },
        });

      if (!prescriptionService) {
        throw new NotFoundException(
          'Không tìm thấy service hoặc bạn không có quyền cập nhật',
        );
      }

      // Kiểm tra trạng thái hiện tại
      if (prescriptionService.status !== PrescriptionStatus.WAITING_RESULT) {
        throw new BadRequestException(
          'Service phải ở trạng thái WAITING_RESULT mới có thể cập nhật kết quả',
        );
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

      this.logger.log(
        `Service ${prescriptionService.serviceId} completed with results`,
      );

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

      // Resolve auth ID to doctor/technician ID
      if (userRole === 'DOCTOR') {
        const doctor = await this.prisma.doctor.findFirst({
          where: { authId: userId },
        });
        if (!doctor) {
          return { services: [], total: 0 };
        }
        whereCondition.doctorId = doctor.id;
      } else if (userRole === 'TECHNICIAN') {
        const technician = await this.prisma.technician.findFirst({
          where: { authId: userId },
        });
        if (!technician) {
          return { services: [], total: 0 };
        }
        whereCondition.technicianId = technician.id;
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
              serviceCode: true,
              name: true,
              price: true,
              description: true,
              timePerPatient: true,
            },
          },
        },
        orderBy: [{ startedAt: 'desc' }],
        take: query.limit || 50,
        skip: query.offset || 0,
      });

      const total = await this.prisma.prescriptionService.count({
        where: whereCondition,
      });

      return {
        services,
        total,
        limit: query.limit || 50,
        offset: query.offset || 0,
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
        // First find the doctor record for this auth ID
        const doctor = await this.prisma.doctor.findFirst({
          where: { authId: userId },
        });

        if (!doctor) {
          return null;
        }

        workSession = await this.prisma.workSession.findFirst({
          where: {
            doctorId: doctor.id,
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
            doctor: {
              include: {
                auth: true,
              },
            },
          },
        });
      } else if (userRole === 'TECHNICIAN') {
        // First find the technician record for this auth ID
        const technician = await this.prisma.technician.findFirst({
          where: { authId: userId },
        });

        if (!technician) {
          return null;
        }

        workSession = await this.prisma.workSession.findFirst({
          where: {
            technicianId: technician.id,
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
            technician: {
              include: {
                auth: true,
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
