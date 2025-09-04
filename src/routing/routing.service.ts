import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka.producer';

export type AssignRequest = {
  patientProfileId: string;
  serviceIds: string[];
  requestedTime?: Date; // Thời gian bệnh nhân muốn được khám
};

export type AssignedRoom = {
  roomId: string;
  roomCode: string;
  roomName: string;
  boothId: string;
  boothCode: string;
  boothName: string;
  doctorId: string | null;
  technicianId: string | null;
  doctorCode: string;
  doctorName: string;
  technicianCode: string;
  technicianName: string;
  serviceIds: string[];
  estimatedStartTime: Date;
  estimatedEndTime: Date;
  totalDuration: number; // Tổng thời gian thực hiện các dịch vụ (phút)
};

export type UpdateStatusRequest = {
  patientProfileId: string;
  roomId?: string;
  roomCode?: string;
};

export type PatientStatus =
  | 'LEFT_TEMPORARILY'
  | 'RETURNED'
  | 'SERVING'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'WAITING_RESULT';

type ClinicRoomWithBooths = {
  id: string;
  roomCode: string;
  roomName: string;
  booth: Array<{
    id: string;
    boothCode: string;
    name: string;
    workSessions: Array<{
      id: string;
      doctorId: string | null;
      technicianId: string | null;
      doctor: { doctorCode: string; auth: { name: string } } | null;
      technician: { technicianCode: string; auth: { name: string } } | null;
      startTime: Date;
      endTime: Date;
      nextAvailableAt: Date | null;
    }>;
  }>;
};

@Injectable()
export class RoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaProducerService,
  ) {}

  async listRooms() {
    const now = new Date();
    const rooms = await this.prisma.clinicRoom.findMany({
      select: {
        id: true,
        roomCode: true,
        roomName: true,
        specialty: { select: { name: true } },
        booth: {
          where: { isActive: true },
          select: {
            id: true,
            boothCode: true,
            name: true,
            workSessions: {
              where: { startTime: { lte: now }, endTime: { gte: now } },
              select: {
                id: true,
                doctorId: true,
                startTime: true,
                endTime: true,
                nextAvailableAt: true,
                doctor: { select: { doctorCode: true, auth: { select: { name: true } } } },
              },
              orderBy: { startTime: 'asc' },
              take: 1,
            },
          },
        },
        services: {
          select: {
            service: { select: { id: true, serviceCode: true, name: true } },
          },
        },
      },
      orderBy: { roomCode: 'asc' },
    });

    return rooms.map((r) => ({
      id: r.id,
      roomCode: r.roomCode,
      roomName: r.roomName,
      specialtyName: r.specialty?.name ?? null,
      services: r.services.map((s) => ({
        id: s.service.id,
        code: s.service.serviceCode,
        name: s.service.name,
      })),
      booths: r.booth.map((b) => {
        const ws = b.workSessions[0];
        return {
          id: b.id,
          boothCode: b.boothCode,
          name: b.name,
          doctorId: ws?.doctorId ?? null,
          doctorCode: ws?.doctor?.doctorCode ?? null,
          doctorName: ws?.doctor?.auth.name ?? null,
          nextAvailableAt: ws?.nextAvailableAt ?? null,
          sessionEndTime: ws?.endTime ?? null,
        };
      }),
    }));
  }

  async assignPatientToRooms(request: AssignRequest): Promise<AssignedRoom[]> {
    // Verify patient profile exists
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id: request.patientProfileId },
      include: { patient: { include: { auth: true } } },
    });
    if (!profile) throw new NotFoundException('Patient profile not found');
    const patientName =
      profile.name && profile.name.trim().length > 0
        ? profile.name
        : (profile.patient?.auth?.name ?? null);
    const status = 'WAITING';

    // Get current time or use requested time
    const currentTime = request.requestedTime || new Date();

    // Get services with their duration
    const services = await this.prisma.service.findMany({
      where: { id: { in: request.serviceIds } },
      select: { id: true, name: true, timePerPatient: true },
    });

    if (services.length !== request.serviceIds.length) {
      throw new NotFoundException('Some services not found');
    }

    // For each requested service, find a suitable room/booth independently
    const perServiceAssignments: Array<{
      roomId: string;
      roomCode: string;
      roomName: string;
      boothId: string;
      boothCode: string;
      boothName: string;
      doctorId: string | null;
      technicianId: string | null;
      doctorCode: string;
      doctorName: string;
      technicianCode: string;
      technicianName: string;
      serviceIds: string[];
      estimatedStartTime: Date;
      estimatedEndTime: Date;
      totalDuration: number;
    }> = [];

    for (const svc of services) {
      // Find rooms that can perform this service
      const rsForService = await this.prisma.clinicRoomService.findMany({
        where: { serviceId: svc.id },
        include: {
          clinicRoom: {
            include: {
              booth: {
                where: { isActive: true },
                include: {
                  workSessions: {
                    where: {
                      startTime: { lte: currentTime },
                      endTime: { gte: currentTime },
                    },
                    include: {
                      doctor: { include: { auth: true } },
                      technician: { include: { auth: true } },
                    },
                    orderBy: { startTime: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

      const candidates: typeof perServiceAssignments = [] as any;
      const requiredTimeMs = svc.timePerPatient * 60 * 1000;

      for (const rs of rsForService) {
        const roomId = rs.clinicRoomId;
        const roomCode = rs.clinicRoom.roomCode;
        const roomName = rs.clinicRoom.roomName;

        for (const booth of rs.clinicRoom.booth) {
          for (const workSession of booth.workSessions) {
            const sessionEndTime = new Date(workSession.endTime);
            const availableTime = sessionEndTime.getTime() - currentTime.getTime();
            if (availableTime >= requiredTimeMs) {
              const estimatedStartTime = new Date(currentTime);
              const estimatedEndTime = new Date(currentTime.getTime() + requiredTimeMs);

              candidates.push({
                roomId,
                roomCode,
                roomName,
                boothId: booth.id,
                boothCode: booth.boothCode,
                boothName: booth.name,
                doctorId: workSession.doctorId,
                technicianId: workSession.technicianId,
                doctorCode: workSession.doctor?.doctorCode || (workSession.technician ? 'N/A' : 'N/A'),
                doctorName: workSession.doctor?.auth.name || (workSession.technician ? 'N/A' : 'N/A'),
                technicianCode: workSession.technician?.technicianCode || 'N/A',
                technicianName: workSession.technician?.auth.name || 'N/A',
                serviceIds: [svc.id],
                estimatedStartTime,
                estimatedEndTime,
                totalDuration: svc.timePerPatient,
              });
            }
          }
        }
      }

      // Choose the earliest candidate for this service
      candidates.sort(
        (a, b) => a.estimatedStartTime.getTime() - b.estimatedStartTime.getTime(),
      );
      if (candidates.length > 0) {
        perServiceAssignments.push(candidates[0]);
      } else {
        console.log(`No active sessions found for service ${svc.id} (${svc.name}), using fallback`);
        // Fallback: still guide the patient to a correct room even if no active session now
        // Pick the first eligible clinic room for this service
        if (rsForService.length > 0) {
          const rs0 = rsForService[0];
          const roomId = rs0.clinicRoomId;
          const roomCode = rs0.clinicRoom.roomCode;
          const roomName = rs0.clinicRoom.roomName;
          // Try to pick any booth (even if it currently has no active session)
          const booth0 = rs0.clinicRoom.booth[0] || null;
          const estimatedStartTime = new Date(currentTime);
          const estimatedEndTime = new Date(
            currentTime.getTime() + svc.timePerPatient * 60 * 1000,
          );

          // Try to find any work session for this booth (past, present, or future)
          let fallbackDoctorId: string | null = null;
          let fallbackTechnicianId: string | null = null;
          let fallbackDoctorCode = 'N/A';
          let fallbackDoctorName = 'N/A';
          let fallbackTechnicianCode = 'N/A';
          let fallbackTechnicianName = 'N/A';

          if (booth0) {
            const anyWorkSession = await this.prisma.workSession.findFirst({
              where: { boothId: booth0.id },
              include: {
                doctor: { include: { auth: true } },
                technician: { include: { auth: true } },
              },
              orderBy: { startTime: 'desc' },
            });

            if (anyWorkSession) {
              fallbackDoctorId = anyWorkSession.doctorId;
              fallbackTechnicianId = anyWorkSession.technicianId;
              fallbackDoctorCode = anyWorkSession.doctor?.doctorCode || 'N/A';
              fallbackDoctorName = anyWorkSession.doctor?.auth.name || 'N/A';
              fallbackTechnicianCode = anyWorkSession.technician?.technicianCode || 'N/A';
              fallbackTechnicianName = anyWorkSession.technician?.auth.name || 'N/A';
              console.log(`Fallback found work session for booth ${booth0.boothCode}: doctor=${fallbackDoctorName}, technician=${fallbackTechnicianName}`);
            } else {
              console.log(`No work session found for booth ${booth0.boothCode}`);
            }
          }

          perServiceAssignments.push({
            roomId,
            roomCode,
            roomName,
            boothId: booth0?.id || null as any,
            boothCode: booth0?.boothCode || 'N/A',
            boothName: booth0?.name || 'N/A',
            doctorId: fallbackDoctorId,
            technicianId: fallbackTechnicianId,
            doctorCode: fallbackDoctorCode,
            doctorName: fallbackDoctorName,
            technicianCode: fallbackTechnicianCode,
            technicianName: fallbackTechnicianName,
            serviceIds: [svc.id],
            estimatedStartTime,
            estimatedEndTime,
            totalDuration: svc.timePerPatient,
          });
        }
      }
    }

    if (perServiceAssignments.length === 0) {
      console.warn('No available doctors or booths for the requested services at this time');
      return [];
    }

    // Publish to Kafka for each assignment
    const topic = process.env.KAFKA_TOPIC_ASSIGNMENTS || 'clinic.assignments';
    try {
      await this.kafka.publish(
        topic,
        perServiceAssignments.map((c) => ({
          key: c.roomId,
          value: {
            type: 'PATIENT_ASSIGNED',
            patientProfileId: request.patientProfileId,
            patientName,
            status,
            roomId: c.roomId,
            roomCode: c.roomCode,
            boothId: c.boothId,
            boothCode: c.boothCode,
            boothName: c.boothName,
            doctorId: c.doctorId,
            doctorCode: c.doctorCode,
            doctorName: c.doctorName,
            serviceIds: c.serviceIds,
            estimatedStartTime: c.estimatedStartTime.toISOString(),
            estimatedEndTime: c.estimatedEndTime.toISOString(),
            totalDuration: c.totalDuration,
            timestamp: new Date().toISOString(),
          },
        })),
      );
    } catch (err) {
      console.warn('[Kafka] publish skipped:', (err as Error).message);
    }

    return perServiceAssignments;
  }

  async updateStatusForPatientInRoom(
    request: UpdateStatusRequest,
    status: PatientStatus,
  ): Promise<{
    ok: true;
    status: PatientStatus;
    patientProfileId: string;
    patientName: string | null;
    roomId: string;
    roomCode: string;
    doctorId: string | null;
    doctorCode: string | null;
    timestamp: string;
  }> {
    // Validate patient profile and get display name
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id: request.patientProfileId },
      include: { patient: { include: { auth: true } } },
    });
    if (!profile) throw new NotFoundException('Patient profile not found');
    const patientName =
      profile.name && profile.name.trim().length > 0
        ? profile.name
        : (profile.patient?.auth?.name ?? null);

    // Resolve room by id or code
    let room: ClinicRoomWithBooths | null = null;
    if (request.roomId) {
      room = await this.prisma.clinicRoom.findUnique({
        where: { id: request.roomId },
        include: {
          booth: {
            where: { isActive: true },
            include: {
              workSessions: {
                where: {
                  startTime: { lte: new Date() },
                  endTime: { gte: new Date() },
                },
                include: {
                  doctor: {
                    include: { auth: true }
                  },
                  technician: {
                    include: { auth: true }
                  }
                },
              },
            },
          },
        },
      });
    } else if (request.roomCode) {
      room = await this.prisma.clinicRoom.findUnique({
        where: { roomCode: request.roomCode },
        include: {
          booth: {
            where: { isActive: true },
            include: {
              workSessions: {
                where: {
                  startTime: { lte: new Date() },
                  endTime: { gte: new Date() },
                },
                include: {
                  doctor: {
                    include: { auth: true }
                  },
                  technician: {
                    include: { auth: true }
                  }
                },
              },
            },
          },
        },
      });
    }
    if (!room) throw new NotFoundException('Clinic room not found');

    // Get current doctor from active work session
    let currentDoctorId: string | null = null;
    let currentDoctorCode: string | null = null;
    
    for (const booth of room.booth) {
      for (const workSession of booth.workSessions) {
        currentDoctorId = workSession.doctorId;
        currentDoctorCode = workSession.doctor?.doctorCode || null;
        break; // Take the first active doctor
      }
      if (currentDoctorId) break;
    }

    const timestamp = new Date().toISOString();

    const topic = process.env.KAFKA_TOPIC_ASSIGNMENTS || 'clinic.assignments';
    const event = {
      type: 'PATIENT_STATUS' as const,
      status,
      patientProfileId: request.patientProfileId,
      patientName,
      roomId: room.id,
      roomCode: room.roomCode,
      doctorId: currentDoctorId,
      doctorCode: currentDoctorCode,
      timestamp,
    };

    try {
      await this.kafka.publish(topic, [
        {
          key: room.id,
          value: event,
        },
      ]);
    } catch (err) {
      console.warn('[Kafka] publish skipped:', (err as Error).message);
    }

    return {
      ok: true,
      status,
      patientProfileId: event.patientProfileId,
      patientName: event.patientName,
      roomId: event.roomId,
      roomCode: event.roomCode,
      doctorId: event.doctorId,
      doctorCode: event.doctorCode,
      timestamp,
    };
  }

  async debugWorkSessions() {
    const currentTime = new Date();
    console.log('Current time:', currentTime.toISOString());

    const workSessions = await this.prisma.workSession.findMany({
      where: {
        startTime: { lte: currentTime },
        endTime: { gte: currentTime },
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
      orderBy: {
        startTime: 'asc',
      },
    });

    return {
      currentTime: currentTime.toISOString(),
      activeWorkSessions: workSessions.map((ws) => ({
        id: ws.id,
        boothId: ws.boothId,
        boothCode: ws.booth?.boothCode || 'N/A',
        roomCode: ws.booth?.room.roomCode || 'N/A',
        roomName: ws.booth?.room.roomName || 'N/A',
        specialtyName: ws.booth?.room.specialty?.name || 'N/A',
        doctorId: ws.doctorId,
        doctorCode: ws.doctor?.doctorCode || 'N/A',
        doctorName: ws.doctor?.auth.name || 'N/A',
        startTime: ws.startTime.toISOString(),
        endTime: ws.endTime.toISOString(),
        nextAvailableAt: ws.nextAvailableAt?.toISOString(),
      })),
      totalActive: workSessions.length,
    };
  }
}
