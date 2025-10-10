import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
  HttpStatus,
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
    prescriptionId: string,
    serviceId: string,
    status: PrescriptionStatus,
    userId: string,
    userRole: string,
    note?: string,
  ): Promise<UpdateServiceStatusResponse> {
    try {
      this.logger.log(
        `${userRole} ${userId} updating service ${prescriptionId}-${serviceId} to ${status}`,
      );

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
    prescriptionId: string,
    serviceId: string,
    results: string[],
    userId: string,
    userRole: string,
    note?: string,
  ): Promise<UpdateResultsResponse> {
    try {
      this.logger.log(
        `${userRole} ${userId} updating results for service ${prescriptionId}-${serviceId}`,
      );

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
    console.log('=== getUserServices called ===');
    console.log('userId:', userId);
    console.log('userRole:', userRole);
    console.log('query:', query);

    try {
      const whereCondition: any = {};

      // Resolve auth ID to doctor/technician ID
      if (userRole === 'DOCTOR') {
        console.log('Looking for doctor with authId:', userId);
        const doctor = await this.prisma.doctor.findFirst({
          where: { authId: userId },
        });
        console.log('Doctor found:', doctor);
        if (!doctor) {
          console.log('No doctor found, returning empty result');
          return { services: [], total: 0 };
        }
        whereCondition.doctorId = doctor.id;
        console.log('whereCondition:', whereCondition);
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

      console.log('Executing query with whereCondition:', whereCondition);
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
              durationMinutes: true,
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

      console.log('Services found:', services.length);
      console.log('Total count:', total);

      const result = {
        services,
        total,
        limit: query.limit || 50,
        offset: query.offset || 0,
      };

      console.log('Returning result:', result);
      return result;
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

  async getRoomWaitingList(roomId: string): Promise<{
    waitingList: Array<{
      patientId: string;
      patientName: string;
      status: string;
      boothName: string;
    }>;
    total: number;
  }> {
    try {
      this.logger.log(`Getting waiting list for room: ${roomId}`);

      // Bước 1: Tìm phòng theo ID
      const room = await this.prisma.clinicRoom.findUnique({
        where: { id: roomId },
        include: {
          booth: {
            include: {
              workSessions: {
                where: {
                  OR: [{ status: 'APPROVED' }, { status: 'IN_PROGRESS' }],
                },
                include: {
                  doctor: {
                    include: {
                      prescriptionServices: {
                        where: {
                          status: {
                            in: [
                              PrescriptionStatus.WAITING,
                              PrescriptionStatus.PREPARING,
                              PrescriptionStatus.SERVING,
                              PrescriptionStatus.SKIPPED,
                            ],
                          },
                        },
                        include: {
                          prescription: {
                            include: {
                              patientProfile: true,
                            },
                          },
                          service: true,
                        },
                      },
                    },
                  },
                  technician: {
                    include: {
                      prescriptionServices: {
                        where: {
                          status: {
                            in: [
                              PrescriptionStatus.WAITING,
                              PrescriptionStatus.PREPARING,
                              PrescriptionStatus.SERVING,
                              PrescriptionStatus.SKIPPED
                            ],
                          },
                        },
                        include: {
                          prescription: {
                            include: {
                              patientProfile: true,
                            },
                          },
                          service: true,
                        },
                      },
                    },
                  },
                  booth: true,
                },
              },
            },
          },
        },
      });

      if (!room) {
        throw new NotFoundException(
          `Không tìm thấy phòng với ID: ${roomId}`,
        );
      }

      // Bước 2: Thu thập tất cả prescription services từ các work sessions
      const allPrescriptionServices: Array<{
        prescription: { patientProfile: { id: string; name: string } };
        status: PrescriptionStatus;
        boothName: string;
        updatedAt?: Date;
        createdAt: Date;
      }> = [];

      for (const booth of room.booth) {
        for (const workSession of booth.workSessions) {
          // Thu thập từ doctor
          if (workSession.doctor?.prescriptionServices) {
            workSession.doctor.prescriptionServices.forEach((ps) => {
              allPrescriptionServices.push({
                prescription: ps.prescription,
                status: ps.status,
                boothName: workSession.booth?.name || 'Unknown',
                updatedAt: ps.completedAt || ps.startedAt || undefined,
                createdAt: ps.startedAt || new Date(),
              });
            });
          }

          // Thu thập từ technician
          if (workSession.technician?.prescriptionServices) {
            workSession.technician.prescriptionServices.forEach((ps) => {
              allPrescriptionServices.push({
                prescription: ps.prescription,
                status: ps.status,
                boothName: workSession.booth?.name || 'Unknown',
                updatedAt: ps.completedAt || ps.startedAt || undefined,
                createdAt: ps.startedAt || new Date(),
              });
            });
          }
        }
      }

      // Bước 3: Group theo patient và lấy thông tin mới nhất
      const patientMap = new Map<
        string,
        {
          patientId: string;
          patientName: string;
          status: string;
          boothName: string;
          lastUpdated: Date;
        }
      >();

      for (const ps of allPrescriptionServices) {
        const patientId = ps.prescription.patientProfile.id;
        const patientName = ps.prescription.patientProfile.name;

        if (!patientMap.has(patientId)) {
          patientMap.set(patientId, {
            patientId,
            patientName,
            status: this.getStatusDisplayName(ps.status),
            boothName: ps.boothName,
            lastUpdated: ps.updatedAt || ps.createdAt,
          });
        } else {
          // Nếu đã có, kiểm tra xem có cần cập nhật không (lấy status có priority cao hơn)
          const existing = patientMap.get(patientId)!;
          const currentStatusPriority = this.getStatusPriority(ps.status);
          const existingStatusPriority = this.getStatusPriority(
            this.getStatusEnumFromDisplay(existing.status),
          );

          if (
            currentStatusPriority > existingStatusPriority ||
            (currentStatusPriority === existingStatusPriority &&
              (ps.updatedAt || ps.createdAt) > existing.lastUpdated)
          ) {
            existing.status = this.getStatusDisplayName(ps.status);
            existing.boothName = ps.boothName;
            existing.lastUpdated = ps.updatedAt || ps.createdAt;
          }
        }
      }

      const waitingList = Array.from(patientMap.values());

      return {
        waitingList,
        total: waitingList.length,
      };
    } catch (error) {
      this.logger.error(
        `Get room waiting list error: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private getStatusDisplayName(status: PrescriptionStatus): string {
    switch (status) {
      case PrescriptionStatus.WAITING:
        return 'Đang chờ';
      case PrescriptionStatus.PREPARING:
        return 'Đang chuẩn bị';
      case PrescriptionStatus.SERVING:
        return 'Đang phục vụ';
      case PrescriptionStatus.SKIPPED:
        return 'Bỏ qua';
      default:
        return 'Không xác định';
    }
  }

  private getStatusPriority(status: PrescriptionStatus): number {
    switch (status) {
      case PrescriptionStatus.SERVING:
        return 5;
      case PrescriptionStatus.PREPARING:
        return 4;
      case PrescriptionStatus.WAITING:
        return 3;
      case PrescriptionStatus.WAITING_RESULT:
        return 2;
      case PrescriptionStatus.SKIPPED:
        return 1;
      default:
        return 0;
    }
  }

  private getStatusEnumFromDisplay(displayName: string): PrescriptionStatus {
    switch (displayName) {
      case 'Đang phục vụ':
        return PrescriptionStatus.SERVING;
      case 'Đang chuẩn bị':
        return PrescriptionStatus.PREPARING;
      case 'Đang chờ':
        return PrescriptionStatus.WAITING;
      case 'Đang chờ kết quả':
        return PrescriptionStatus.WAITING_RESULT;
      case 'Bỏ qua':
        return PrescriptionStatus.SKIPPED;
      default:
        return PrescriptionStatus.WAITING;
    }
  }

  /**
   * Phân công prescription service cho doctor hoặc technician cụ thể
   */
  async assignServiceToStaff(
    prescriptionId: string,
    serviceId: string,
    staffId: string,
    staffRole: 'DOCTOR' | 'TECHNICIAN',
  ): Promise<{
    success: boolean;
    message: string;
    prescriptionService?: any;
  }> {
    try {
      this.logger.log(
        `Assigning service ${prescriptionId}-${serviceId} to ${staffRole} ${staffId}`,
      );

      // Kiểm tra prescription service tồn tại
      const prescriptionService =
        await this.prisma.prescriptionService.findFirst({
          where: {
            prescriptionId,
            serviceId,
          },
          include: {
            service: true,
            prescription: {
              include: {
                patientProfile: true,
              },
            },
          },
        });

      if (!prescriptionService) {
        throw new NotFoundException(
          'Không tìm thấy prescription service để phân công',
        );
      }

      // Kiểm tra staff tồn tại
      let staffRecord;
      if (staffRole === 'DOCTOR') {
        staffRecord = await this.prisma.doctor.findUnique({
          where: { id: staffId },
          include: { auth: true },
        });
      } else {
        staffRecord = await this.prisma.technician.findUnique({
          where: { id: staffId },
          include: { auth: true },
        });
      }

      if (!staffRecord) {
        throw new NotFoundException(
          `Không tìm thấy ${staffRole.toLowerCase()} với ID: ${staffId}`,
        );
      }

      // Cập nhật doctorId hoặc technicianId
      const updateData: any = {};
      if (staffRole === 'DOCTOR') {
        updateData.doctorId = staffId;
        // Nếu đã có technician, giữ nguyên
      } else {
        updateData.technicianId = staffId;
        // Nếu đã có doctor, giữ nguyên
      }

      // Nếu service đang ở trạng thái NOT_STARTED hoặc PENDING, chuyển sang WAITING
      if (
        prescriptionService.status === PrescriptionStatus.NOT_STARTED ||
        prescriptionService.status === PrescriptionStatus.PENDING
      ) {
        updateData.status = PrescriptionStatus.WAITING;
      }

      const updatedService = await this.prisma.prescriptionService.update({
        where: {
          prescriptionId_serviceId: {
            prescriptionId,
            serviceId,
          },
        },
        data: updateData,
        include: {
          service: true,
          prescription: {
            include: {
              patientProfile: true,
            },
          },
          doctor: { include: { auth: true } },
          technician: { include: { auth: true } },
        },
      });

      this.logger.log(
        `Successfully assigned service ${prescriptionId}-${serviceId} to ${staffRole} ${staffRecord.auth.name}`,
      );

      return {
        success: true,
        message: `Đã phân công dịch vụ cho ${staffRecord.auth.name}`,
        prescriptionService: updatedService,
      };
    } catch (error) {
      this.logger.error(`Assign service error: ${(error as Error).message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi phân công dịch vụ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Phân công nhiều services cùng lúc dựa trên work session
   */
  async assignServicesFromWorkSession(
    workSessionId: string,
  ): Promise<{
    success: boolean;
    message: string;
    assignedServices: Array<{
      prescriptionId: string;
      serviceId: string;
      staffRole: 'DOCTOR' | 'TECHNICIAN';
      staffName: string;
    }>;
  }> {
    try {
      this.logger.log(`Assigning services from work session: ${workSessionId}`);

      // Tìm work session
      const workSession = await this.prisma.workSession.findUnique({
        where: { id: workSessionId },
        include: {
          doctor: { include: { auth: true } },
          technician: { include: { auth: true } },
          booth: {
            include: {
              room: {
                include: {
                  services: {
                    include: {
                      service: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!workSession) {
        throw new NotFoundException('Không tìm thấy work session');
      }

      // Lấy danh sách service mà phòng này cung cấp
      if (!workSession.booth) {
        throw new NotFoundException('Work session không có booth');
      }
      const roomServiceIds = workSession.booth.room.services.map(
        (rs) => rs.serviceId,
      );

      if (roomServiceIds.length === 0) {
        return {
          success: true,
          message: 'Phòng này không cung cấp dịch vụ nào',
          assignedServices: [],
        };
      }

      // Tìm prescription services đang chờ phân công cho các service này
      const pendingServices = await this.prisma.prescriptionService.findMany({
        where: {
          serviceId: { in: roomServiceIds },
          status: {
            in: [PrescriptionStatus.NOT_STARTED, PrescriptionStatus.PENDING],
          },
          // Chưa được assign cho ai
          AND: [
            { doctorId: null },
            { technicianId: null },
          ],
        },
        include: {
          service: true,
          prescription: {
            include: {
              patientProfile: true,
            },
          },
        },
        orderBy: { order: 'asc' }, // Theo thứ tự trong prescription
      });

      const assignedServices: Array<{
        prescriptionId: string;
        serviceId: string;
        staffRole: 'DOCTOR' | 'TECHNICIAN';
        staffName: string;
      }> = [];

      // Phân công cho doctor nếu có
      if (workSession.doctorId && workSession.doctor) {
        for (const service of pendingServices) {
          try {
            await this.assignServiceToStaff(
              service.prescriptionId,
              service.serviceId,
              workSession.doctorId,
              'DOCTOR',
            );

            assignedServices.push({
              prescriptionId: service.prescriptionId,
              serviceId: service.serviceId,
              staffRole: 'DOCTOR',
              staffName: workSession.doctor.auth.name,
            });
          } catch (error) {
            this.logger.warn(
              `Failed to assign service ${service.prescriptionId}-${service.serviceId} to doctor: ${(error as Error).message}`,
            );
          }
        }
      }
      // Hoặc phân công cho technician nếu có
      else if (workSession.technicianId && workSession.technician) {
        for (const service of pendingServices) {
          try {
            await this.assignServiceToStaff(
              service.prescriptionId,
              service.serviceId,
              workSession.technicianId,
              'TECHNICIAN',
            );

            assignedServices.push({
              prescriptionId: service.prescriptionId,
              serviceId: service.serviceId,
              staffRole: 'TECHNICIAN',
              staffName: workSession.technician.auth.name,
            });
          } catch (error) {
            this.logger.warn(
              `Failed to assign service ${service.prescriptionId}-${service.serviceId} to technician: ${(error as Error).message}`,
            );
          }
        }
      }

      this.logger.log(
        `Assigned ${assignedServices.length} services from work session ${workSessionId}`,
      );

      return {
        success: true,
        message: `Đã phân công ${assignedServices.length} dịch vụ`,
        assignedServices,
      };
    } catch (error) {
      this.logger.error(
        `Assign services from work session error: ${(error as Error).message}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi phân công dịch vụ từ work session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
