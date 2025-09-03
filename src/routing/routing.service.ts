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
  doctorId: string;
  doctorCode: string;
  doctorName: string;
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
  | 'SKIPPED';

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
      doctorId: string;
      doctor: { doctorCode: string; auth: { name: string } };
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
          doctorCode: ws?.doctor.doctorCode ?? null,
          doctorName: ws?.doctor.auth.name ?? null,
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

    // Calculate total duration needed
    const totalDuration = services.reduce(
      (sum, service) => sum + service.timePerPatient,
      0,
    );

    // Find all rooms that can serve given services
    const roomServices = await this.prisma.clinicRoomService.findMany({
      where: { serviceId: { in: request.serviceIds } },
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
                    doctor: { 
                      include: { auth: true } 
                    } 
                  },
                },
              },
            },
          },
        },
      },
    });

    // Group services by room and find available booths
    const roomIdToServices = new Map<string, string[]>();
    const roomMeta = new Map<
      string,
      {
        roomCode: string;
        roomName: string;
        booths: Array<{
          id: string;
          boothCode: string;
          name: string;
          workSessions: Array<{
            id: string;
            doctorId: string;
            doctor: { doctorCode: string; auth: { name: string } };
            startTime: Date;
            endTime: Date;
            nextAvailableAt: Date | null;
          }>;
        }>;
      }
    >();

    for (const rs of roomServices) {
      const roomId = rs.clinicRoomId;
      if (!roomIdToServices.has(roomId)) roomIdToServices.set(roomId, []);
      roomIdToServices.get(roomId)!.push(rs.serviceId);

      if (!roomMeta.has(roomId)) {
        roomMeta.set(roomId, {
          roomCode: rs.clinicRoom.roomCode,
          roomName: rs.clinicRoom.roomName,
          booths: rs.clinicRoom.booth,
        });
      }
    }

    if (roomIdToServices.size === 0) {
      throw new NotFoundException(
        'No clinic rooms can fulfill the selected services',
      );
    }

    // Find available booths with doctors
    const availableAssignments: Array<{
      roomId: string;
      roomCode: string;
      roomName: string;
      boothId: string;
      boothCode: string;
      boothName: string;
      doctorId: string;
      doctorCode: string;
      doctorName: string;
      serviceIds: string[];
      estimatedStartTime: Date;
      estimatedEndTime: Date;
      totalDuration: number;
    }> = [];

    for (const [roomId, services] of roomIdToServices) {
      const meta = roomMeta.get(roomId)!;

      for (const booth of meta.booths) {
        for (const workSession of booth.workSessions) {
          // Check if doctor has enough time
          const sessionEndTime = new Date(workSession.endTime);
          const availableTime =
            sessionEndTime.getTime() - currentTime.getTime();
          const requiredTimeMs = totalDuration * 60 * 1000; // Convert minutes to milliseconds

          if (availableTime >= requiredTimeMs) {
            const estimatedStartTime = new Date(currentTime);
            const estimatedEndTime = new Date(
              currentTime.getTime() + requiredTimeMs,
            );

            availableAssignments.push({
              roomId,
              roomCode: meta.roomCode,
              roomName: meta.roomName,
              boothId: booth.id,
              boothCode: booth.boothCode,
              boothName: booth.name,
              doctorId: workSession.doctorId,
              doctorCode: workSession.doctor.doctorCode,
              doctorName: workSession.doctor.auth.name,
              serviceIds: services,
              estimatedStartTime,
              estimatedEndTime,
              totalDuration,
            });
          }
        }
      }
    }

    if (availableAssignments.length === 0) {
      // Return empty array instead of throwing error
      // This allows payment to succeed even when routing fails
      console.warn('No available doctors or booths for the requested services at this time');
      return [];
    }

    // Sort by earliest available time and return the best option
    availableAssignments.sort(
      (a, b) => a.estimatedStartTime.getTime() - b.estimatedStartTime.getTime(),
    );

    const chosen = availableAssignments.slice(0, 1); // Return the best option

    // Publish to Kafka for each room assignment
    const topic = process.env.KAFKA_TOPIC_ASSIGNMENTS || 'clinic.assignments';
    try {
      await this.kafka.publish(
        topic,
        chosen.map((c) => ({
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

    return chosen;
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
        currentDoctorCode = workSession.doctor.doctorCode;
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
        doctorCode: ws.doctor.doctorCode,
        doctorName: ws.doctor.auth.name,
        startTime: ws.startTime.toISOString(),
        endTime: ws.endTime.toISOString(),
        nextAvailableAt: ws.nextAvailableAt?.toISOString(),
      })),
      totalActive: workSessions.length,
    };
  }
}
