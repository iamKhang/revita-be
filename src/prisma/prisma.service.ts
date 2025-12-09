import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { PrescriptionStatus } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly moduleRef: ModuleRef) {
    super();
    this.setupMiddleware();
  }

  private setupMiddleware() {
    // Middleware để theo dõi thay đổi status trên PrescriptionService
    this.$use(async (params, next) => {
      const result = await next(params);

      // Xử lý khi là model Prescription
      if (params.model === 'Prescription') {
        // Xử lý khi update Prescription
        if (params.action === 'update') {
          const newStatus = params.args?.data?.status;
          if (newStatus === PrescriptionStatus.COMPLETED) {
            const where = params.args?.where;
            this.logger.log(
              `[Prescription UPDATE] Status changed to COMPLETED, Where: ${JSON.stringify(where)}`,
            );

            try {
              // Xây dựng where clause đúng format
              let whereClause: any;
              if (where?.id) {
                whereClause = { id: where.id };
              } else if (typeof where === 'string') {
                whereClause = { id: where };
              } else {
                whereClause = where;
              }

              // Lấy Prescription sau update
              const updated = await (this as any).prescription.findUnique({
                where: whereClause,
                include: {
                  belongsToService: {
                    select: {
                      id: true,
                      status: true,
                    },
                  },
                },
              });

              if (updated && updated.belongsToServiceId) {
                const prescriptionService = updated.belongsToService;
                
                // Logic 2: Nếu Prescription chuyển thành COMPLETED và có belongsToService
                // Kiểm tra PrescriptionService có status là WAITING_RESULT không
                if (prescriptionService && prescriptionService.status === PrescriptionStatus.WAITING_RESULT) {
                  // Kiểm tra tất cả issuedPrescriptions (Prescription trong relation) đều COMPLETED chưa
                  const prescriptionServiceWithIssued = await (this as any).prescriptionService.findUnique({
                    where: { id: prescriptionService.id },
                    include: {
                      issuedPrescriptions: {
                        select: {
                          id: true,
                          status: true,
                        },
                      },
                    },
                  });

                  if (prescriptionServiceWithIssued) {
                    const allIssuedCompleted = prescriptionServiceWithIssued.issuedPrescriptions.every(
                      (p: any) => p.status === PrescriptionStatus.COMPLETED,
                    );

                    if (allIssuedCompleted) {
                      // Chuyển PrescriptionService từ WAITING_RESULT thành RETURNING
                      await (this as any).prescriptionService.update({
                        where: { id: prescriptionService.id },
                        data: { status: PrescriptionStatus.RETURNING },
                      });
                      this.logger.log(
                        `[Prescription UPDATE] All issued prescriptions completed, updated PrescriptionService ${prescriptionService.id} from WAITING_RESULT to RETURNING`,
                      );
                    }
                  }
                }
              }
            } catch (err) {
              this.logger.warn(`Middleware post-Prescription-update handling failed: ${(err as Error).message}`);
            }
          }
        }
      }

      // Chỉ xử lý khi là model PrescriptionService
      if (params.model === 'PrescriptionService') {
        // Xử lý khi create
        if (params.action === 'create') {
          const newStatus = params.args?.data?.status;
          if (newStatus && newStatus !== PrescriptionStatus.NOT_STARTED && newStatus !== PrescriptionStatus.PENDING) {
            this.logger.log(
              `[PrescriptionService CREATE] Status: ${newStatus}, PrescriptionId: ${params.args.data?.prescriptionId}, ServiceId: ${params.args.data?.serviceId}`,
            );
          }
        }

        // Xử lý khi update
        if (params.action === 'update') {
          const newStatus = params.args?.data?.status;
          if (newStatus && newStatus !== PrescriptionStatus.NOT_STARTED && newStatus !== PrescriptionStatus.PENDING) {
            const where = params.args?.where;
            this.logger.log(
              `[PrescriptionService UPDATE] Status changed to: ${newStatus}, Where: ${JSON.stringify(where)}`,
            );

            try {
              // Xây dựng where clause đúng format cho compound unique key
              let whereClause: any;
              if (where?.prescriptionId_serviceId) {
                // Đã có compound key trong where object
                whereClause = {
                  prescriptionId_serviceId: where.prescriptionId_serviceId,
                };
              } else if (where?.prescriptionId && where?.serviceId) {
                // Có prescriptionId và serviceId riêng lẻ, cần xây dựng compound key
                whereClause = {
                  prescriptionId_serviceId: {
                    prescriptionId: where.prescriptionId,
                    serviceId: where.serviceId,
                  },
                };
              } else if (where?.id) {
                // Có id trực tiếp
                whereClause = { id: where.id };
              } else {
                // Fallback: dùng where trực tiếp (có thể sẽ lỗi nhưng để Prisma báo lỗi)
                whereClause = where;
              }

              // Lấy oldStatus trước khi update
              const oldRecord = await (this as any).prescriptionService.findUnique({
                where: whereClause,
                select: { id: true, status: true },
              });
              const oldStatus = oldRecord?.status;

              // Lấy bản ghi sau update với đầy đủ thông tin
              const updated = await (this as any).prescriptionService.findUnique({
                where: whereClause,
                include: {
                  prescription: {
                    include: { patientProfile: true },
                  },
                  service: true,
                  doctor: {
                    include: { auth: { select: { id: true, name: true } } },
                  },
                  technician: {
                    include: { auth: { select: { id: true, name: true } } },
                  },
                  booth: {
                    include: {
                      room: {
                        select: {
                          id: true,
                          roomCode: true,
                          roomName: true,
                        },
                      },
                    },
                  },
                },
              });

              if (updated) {
                // Logic 1: Nếu PrescriptionService chuyển thành COMPLETED, kiểm tra xem tất cả services trong Prescription đã COMPLETED chưa
                if (newStatus === PrescriptionStatus.COMPLETED) {
                  try {
                    const prescription = await (this as any).prescription.findUnique({
                      where: { id: updated.prescriptionId },
                      include: {
                        services: {
                          select: { id: true, status: true },
                        },
                      },
                    });

                    if (prescription) {
                      const allServicesCompleted = prescription.services.every(
                        (s: any) => s.status === PrescriptionStatus.COMPLETED,
                      );

                      if (allServicesCompleted && prescription.status !== PrescriptionStatus.COMPLETED) {
                        await (this as any).prescription.update({
                          where: { id: prescription.id },
                          data: { status: PrescriptionStatus.COMPLETED },
                        });
                        this.logger.log(
                          `[PrescriptionService UPDATE] All services completed, updated Prescription ${prescription.id} to COMPLETED`,
                        );
                      }
                    }
                  } catch (err) {
                    this.logger.warn(`Failed to check and update Prescription status: ${(err as Error).message}`);
                  }
                }

                // Cập nhật queue cho doctor / technician nếu có
                try {
                  // Lazy import để tránh circular dependency
                  const { PrescriptionService } = await import('../prescription/prescription.service');
                  const domainSvc = this.moduleRef.get(PrescriptionService, { strict: false });
                  if (domainSvc && updated.doctorId) {
                    await domainSvc.updateQueueInRedis(updated.doctorId, 'DOCTOR');
                  }
                  if (domainSvc && updated.technicianId) {
                    await domainSvc.updateQueueInRedis(updated.technicianId, 'TECHNICIAN');
                  }
                } catch (err) {
                  this.logger.warn(`Failed to update queue in Redis: ${(err as Error).message}`);
                }

                // Logic phát socket khi chuyển sang/từ SERVING
                try {
                  const { WebSocketService } = await import('../websocket/websocket.service');
                  const ws = this.moduleRef.get(WebSocketService, { strict: false });
                  
                  if (ws) {
                    let clinicRoomId: string | null = null;
                    
                    // Try to get clinicRoomId from booth or directly from PrescriptionService
                    if (updated.boothId && updated.booth) {
                      clinicRoomId = updated.booth.roomId;
                    } else if (updated.clinicRoomId) {
                      clinicRoomId = updated.clinicRoomId;
                    }

                    // If we have clinicRoomId, emit events
                    if (clinicRoomId) {
                      // Khi chuyển sang SERVING (từ bất kỳ trạng thái nào)
                      if (newStatus === PrescriptionStatus.SERVING && oldStatus !== PrescriptionStatus.SERVING) {
                        const servingEvent = {
                          type: 'PRESCRIPTION_SERVICE_SERVING',
                          data: {
                            prescriptionServiceId: updated.id,
                            patientProfileId: updated.prescription.patientProfileId,
                            patientName: updated.prescription.patientProfile.name,
                            prescriptionCode: updated.prescription.prescriptionCode,
                            boothId: updated.boothId ?? null,
                            boothCode: updated.booth?.boothCode ?? null,
                            boothName: updated.booth?.name ?? null,
                            clinicRoomId: clinicRoomId,
                            clinicRoomCode: updated.booth?.room?.roomCode ?? null,
                            clinicRoomName: updated.booth?.room?.roomName ?? null,
                            doctorId: updated.doctorId ?? null,
                            doctorName: updated.doctor?.auth?.name ?? null,
                            technicianId: updated.technicianId ?? null,
                            technicianName: updated.technician?.auth?.name ?? null,
                          },
                          timestamp: new Date().toISOString(),
                        };

                        await ws.sendToClinicRoom(clinicRoomId, 'prescription_service_serving', servingEvent);
                        this.logger.log(
                          `[PrescriptionService UPDATE] Sent SERVING event to clinic room ${clinicRoomId} for PrescriptionService ${updated.id}`,
                        );
                      }

                      // Khi chuyển từ SERVING sang trạng thái khác
                      if (oldStatus === PrescriptionStatus.SERVING && newStatus !== PrescriptionStatus.SERVING) {
                        const removeEvent = {
                          type: 'PRESCRIPTION_SERVICE_REMOVED',
                          data: {
                            prescriptionServiceId: updated.id,
                            patientProfileId: updated.prescription.patientProfileId,
                            prescriptionCode: updated.prescription.prescriptionCode,
                          },
                          timestamp: new Date().toISOString(),
                        };

                        await ws.sendToClinicRoom(clinicRoomId, 'prescription_service_removed', removeEvent);
                        this.logger.log(
                          `[PrescriptionService UPDATE] Sent REMOVED event to clinic room ${clinicRoomId} for PrescriptionService ${updated.id}`,
                        );
                      }
                    } else {
                      // Log when we can't find clinicRoomId
                      this.logger.warn(
                        `[PrescriptionService UPDATE] Cannot emit socket events: No clinicRoomId or boothId for PrescriptionService ${updated.id}`,
                      );
                    }
                  }
                } catch (err) {
                  this.logger.warn(`Failed to send SERVING/REMOVED WebSocket notification: ${(err as Error).message}`);
                }

                // Phát sự kiện websocket đến các bên liên quan (giữ nguyên logic cũ)
                try {
                  // Lazy import để tránh circular dependency
                  const { WebSocketService } = await import('../websocket/websocket.service');
                  const ws = this.moduleRef.get(WebSocketService, { strict: false });
                const payload = {
                  patientProfileId: updated.prescription.patientProfileId,
                  patientName: updated.prescription.patientProfile.name,
                  prescriptionCode: updated.prescription.prescriptionCode,
                  oldStatus: oldStatus ?? 'UNKNOWN',
                  newStatus: newStatus,
                  doctorId: updated.doctorId ?? undefined,
                  technicianId: updated.technicianId ?? undefined,
                  serviceIds: [updated.serviceId],
                  clinicRoomIds: updated.clinicRoomId ? [updated.clinicRoomId] : [],
                  boothIds: updated.boothId ? [updated.boothId] : [],
                };
                  if (ws) {
                    await ws.notifyPatientStatusChanged(payload);
                  }
                } catch (err) {
                  this.logger.warn(`Failed to send WebSocket notification: ${(err as Error).message}`);
                }
              }
            } catch (err) {
              this.logger.warn(`Middleware post-update handling failed: ${(err as Error).message}`);
            }
          }
        }

        // Xử lý khi updateMany
        if (params.action === 'updateMany') {
          const newStatus = params.args?.data?.status;
          if (newStatus && newStatus !== PrescriptionStatus.NOT_STARTED && newStatus !== PrescriptionStatus.PENDING) {
            const where = params.args?.where;
            this.logger.log(
              `[PrescriptionService UPDATE_MANY] Status changed to: ${newStatus}, Where: ${JSON.stringify(where)}`,
            );

            try {
              // Lấy oldStatus cho tất cả records trước khi update
              const oldRecords = await (this as any).prescriptionService.findMany({
                where,
                select: { id: true, status: true },
              });
              const oldStatusMap = new Map(oldRecords.map((r: any) => [r.id, r.status]));

              // Tìm các bản ghi bị ảnh hưởng để cập nhật queue và phát sự kiện
              const affected = await (this as any).prescriptionService.findMany({
                where,
                include: {
                  prescription: { include: { patientProfile: true } },
                  doctor: {
                    include: { auth: { select: { id: true, name: true } } },
                  },
                  technician: {
                    include: { auth: { select: { id: true, name: true } } },
                  },
                  booth: {
                    include: {
                      room: {
                        select: {
                          id: true,
                          roomCode: true,
                          roomName: true,
                        },
                      },
                    },
                  },
                },
              });

              // Logic 1: Nếu PrescriptionService chuyển thành COMPLETED, kiểm tra xem tất cả services trong Prescription đã COMPLETED chưa
              if (newStatus === PrescriptionStatus.COMPLETED) {
                const prescriptionIds = new Set(affected.map((rec: any) => rec.prescriptionId));
                
                for (const prescriptionId of prescriptionIds) {
                  try {
                    const prescription = await (this as any).prescription.findUnique({
                      where: { id: prescriptionId },
                      include: {
                        services: {
                          select: { id: true, status: true },
                        },
                      },
                    });

                    if (prescription) {
                      const allServicesCompleted = prescription.services.every(
                        (s: any) => s.status === PrescriptionStatus.COMPLETED,
                      );

                      if (allServicesCompleted && prescription.status !== PrescriptionStatus.COMPLETED) {
                        await (this as any).prescription.update({
                          where: { id: prescription.id },
                          data: { status: PrescriptionStatus.COMPLETED },
                        });
                        this.logger.log(
                          `[PrescriptionService UPDATE_MANY] All services completed, updated Prescription ${prescription.id} to COMPLETED`,
                        );
                      }
                    }
                  } catch (err) {
                    this.logger.warn(`Failed to check and update Prescription status for ${prescriptionId}: ${(err as Error).message}`);
                  }
                }
              }
              
              // Logic phát socket khi chuyển sang/từ SERVING cho updateMany
              try {
                const { WebSocketService } = await import('../websocket/websocket.service');
                const ws = this.moduleRef.get(WebSocketService, { strict: false });

                if (ws) {
                  for (const rec of affected) {
                    const oldStatus = oldStatusMap.get(rec.id);
                    
                    if (rec.boothId && rec.booth) {
                      const clinicRoomId = rec.booth.roomId;
                      const clinicRoom = rec.booth.room;

                      // Khi chuyển sang SERVING
                      if (newStatus === PrescriptionStatus.SERVING && oldStatus !== PrescriptionStatus.SERVING) {
                        const servingEvent = {
                          type: 'PRESCRIPTION_SERVICE_SERVING',
                          data: {
                            prescriptionServiceId: rec.id,
                            patientProfileId: rec.prescription.patientProfileId,
                            patientName: rec.prescription.patientProfile.name,
                            prescriptionCode: rec.prescription.prescriptionCode,
                            boothId: rec.boothId,
                            boothCode: rec.booth.boothCode,
                            boothName: rec.booth.name,
                            clinicRoomId: clinicRoomId,
                            clinicRoomCode: clinicRoom.roomCode,
                            clinicRoomName: clinicRoom.roomName,
                            doctorId: rec.doctorId ?? null,
                            doctorName: rec.doctor?.auth?.name ?? null,
                            technicianId: rec.technicianId ?? null,
                            technicianName: rec.technician?.auth?.name ?? null,
                          },
                          timestamp: new Date().toISOString(),
                        };

                        await ws.sendToClinicRoom(clinicRoomId, 'prescription_service_serving', servingEvent);
                        this.logger.log(
                          `[PrescriptionService UPDATE_MANY] Sent SERVING event to clinic room ${clinicRoomId} for PrescriptionService ${rec.id}`,
                        );
                      }

                      // Khi chuyển từ SERVING sang trạng thái khác
                      if (oldStatus === PrescriptionStatus.SERVING && newStatus !== PrescriptionStatus.SERVING) {
                        const removeEvent = {
                          type: 'PRESCRIPTION_SERVICE_REMOVED',
                          data: {
                            prescriptionServiceId: rec.id,
                            patientProfileId: rec.prescription.patientProfileId,
                            prescriptionCode: rec.prescription.prescriptionCode,
                          },
                          timestamp: new Date().toISOString(),
                        };

                        await ws.sendToClinicRoom(clinicRoomId, 'prescription_service_removed', removeEvent);
                        this.logger.log(
                          `[PrescriptionService UPDATE_MANY] Sent REMOVED event to clinic room ${clinicRoomId} for PrescriptionService ${rec.id}`,
                        );
                      }
                    }
                  }
                }
              } catch (err) {
                this.logger.warn(`Failed to send SERVING/REMOVED WebSocket notification for updateMany: ${(err as Error).message}`);
              }

              try {
                // Lazy import để tránh circular dependency
                const { PrescriptionService } = await import('../prescription/prescription.service');
                const { WebSocketService } = await import('../websocket/websocket.service');
                const domainSvc = this.moduleRef.get(PrescriptionService, { strict: false });
                const ws = this.moduleRef.get(WebSocketService, { strict: false });

                if (domainSvc && ws) {
                  for (const rec of affected) {
                    const oldStatus = oldStatusMap.get(rec.id);
                    
                    if (rec.doctorId) {
                      await domainSvc.updateQueueInRedis(rec.doctorId, 'DOCTOR');
                    }
                    if (rec.technicianId) {
                      await domainSvc.updateQueueInRedis(rec.technicianId, 'TECHNICIAN');
                    }
                    await ws.notifyPatientStatusChanged({
                      patientProfileId: rec.prescription.patientProfileId,
                      patientName: rec.prescription.patientProfile.name,
                      prescriptionCode: rec.prescription.prescriptionCode,
                      oldStatus: (oldStatus as string) ?? 'UNKNOWN',
                      newStatus: newStatus,
                      doctorId: rec.doctorId ?? undefined,
                      technicianId: rec.technicianId ?? undefined,
                      serviceIds: [rec.serviceId],
                      clinicRoomIds: rec.clinicRoomId ? [rec.clinicRoomId] : [],
                      boothIds: rec.boothId ? [rec.boothId] : [],
                    });
                  }
                }
              } catch (err) {
                this.logger.warn(`Failed to update queue/notify for updateMany: ${(err as Error).message}`);
              }
            } catch (err) {
              this.logger.warn(`Middleware post-updateMany handling failed: ${(err as Error).message}`);
            }
          }
        }
      }

      return result;
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
