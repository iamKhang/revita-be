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
              } else {
                // Fallback: dùng where trực tiếp (có thể sẽ lỗi nhưng để Prisma báo lỗi)
                whereClause = where;
              }

              // Lấy bản ghi sau update
              const updated = await (this as any).prescriptionService.findUnique({
                where: whereClause,
                include: {
                  prescription: {
                    include: { patientProfile: true },
                  },
                  service: true,
                },
              });

              if (updated) {
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

                // Phát sự kiện websocket đến các bên liên quan
                try {
                  // Lazy import để tránh circular dependency
                  const { WebSocketService } = await import('../websocket/websocket.service');
                  const ws = this.moduleRef.get(WebSocketService, { strict: false });
                const payload = {
                  patientProfileId: updated.prescription.patientProfileId,
                  patientName: updated.prescription.patientProfile.name,
                  prescriptionCode: updated.prescription.prescriptionCode,
                  oldStatus: 'UNKNOWN',
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
              // Tìm các bản ghi bị ảnh hưởng để cập nhật queue và phát sự kiện
              const affected = await (this as any).prescriptionService.findMany({
                where,
                include: {
                  prescription: { include: { patientProfile: true } },
                },
              });
              
              try {
                // Lazy import để tránh circular dependency
                const { PrescriptionService } = await import('../prescription/prescription.service');
                const { WebSocketService } = await import('../websocket/websocket.service');
                const domainSvc = this.moduleRef.get(PrescriptionService, { strict: false });
                const ws = this.moduleRef.get(WebSocketService, { strict: false });

                if (domainSvc && ws) {
                  for (const rec of affected) {
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
                      oldStatus: 'UNKNOWN',
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
