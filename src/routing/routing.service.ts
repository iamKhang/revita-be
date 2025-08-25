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

type ClinicRoomWithDoctor = {
  id: string;
  roomCode: string;
  doctorId: string | null;
  doctor: { doctorCode: string } | null;
};

@Injectable()
export class RoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaProducerService,
  ) {}

  async listRooms() {
    const rooms = await this.prisma.clinicRoom.findMany({
      include: {
        specialty: true,
        doctor: {
          include: { auth: true },
        },
        services: {
          include: { service: true },
        },
      },
      orderBy: { roomCode: 'asc' },
    });
    return rooms;
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
            doctor: {
              include: { auth: true },
            },
            booth: {
              where: { isActive: true },
              include: {
                workSessions: {
                  where: {
                    startTime: { lte: currentTime },
                    endTime: { gte: currentTime },
                  },
                  include: { doctor: { include: { auth: true } } },
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
        doctorId: string;
        doctorCode: string;
        doctorName: string;
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
      const room = rs.clinicRoom;
      if (!roomIdToServices.has(room.id)) roomIdToServices.set(room.id, []);
      roomIdToServices.get(room.id)!.push(rs.serviceId);

      if (!roomMeta.has(room.id)) {
        roomMeta.set(room.id, {
          roomCode: room.roomCode,
          roomName: room.roomName,
          doctorId: room.doctorId,
          doctorCode: room.doctor.doctorCode,
          doctorName: room.doctor.auth.name,
          booths: room.booth,
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
      throw new NotFoundException(
        'No available doctors or booths for the requested services at this time',
      );
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
    let room: ClinicRoomWithDoctor | null = null;
    if (request.roomId) {
      room = await this.prisma.clinicRoom.findUnique({
        where: { id: request.roomId },
        include: { doctor: true },
      });
    } else if (request.roomCode) {
      room = await this.prisma.clinicRoom.findUnique({
        where: { roomCode: request.roomCode },
        include: { doctor: true },
      });
    }
    if (!room) throw new NotFoundException('Clinic room not found');

    const timestamp = new Date().toISOString();

    const topic = process.env.KAFKA_TOPIC_ASSIGNMENTS || 'clinic.assignments';
    const event = {
      type: 'PATIENT_STATUS' as const,
      status,
      patientProfileId: request.patientProfileId,
      patientName,
      roomId: room.id,
      roomCode: room.roomCode,
      doctorId: room.doctorId ?? null,
      doctorCode: room.doctor?.doctorCode ?? null,
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
}
