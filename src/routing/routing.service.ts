import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka.producer';

export type AssignRequest = {
  patientProfileId: string;
  serviceIds: string[];
};

export type AssignedRoom = {
  roomId: string;
  roomCode: string;
  roomName: string;
  doctorId: string;
  doctorCode: string;
  serviceIds: string[];
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
    const patientName = (profile.name && profile.name.trim().length > 0)
      ? profile.name
      : profile.patient?.auth?.name ?? null;
    const status = 'WAITING';

    // Find all rooms that can serve given services
    const roomServices = await this.prisma.clinicRoomService.findMany({
      where: { serviceId: { in: request.serviceIds } },
      include: {
        clinicRoom: {
          include: {
            doctor: true,
          },
        },
      },
    });

    // Group services by room
    const roomIdToServices = new Map<string, string[]>();
    const roomMeta = new Map<string, { roomCode: string; roomName: string; doctorId: string; doctorCode: string }>();
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
        });
      }
    }

    if (roomIdToServices.size === 0) {
      throw new NotFoundException('No clinic rooms can fulfill the selected services');
    }

    // Strategy: choose minimal set of rooms that covers all services
    // Simple greedy: pick room covering most remaining services, repeat
    const remaining = new Set(request.serviceIds);
    const chosen: AssignedRoom[] = [];
    while (remaining.size > 0) {
      let bestRoomId: string | null = null;
      let bestCoverage = 0;
      for (const [roomId, services] of roomIdToServices) {
        const coverage = services.filter((s) => remaining.has(s)).length;
        if (coverage > bestCoverage) {
          bestCoverage = coverage;
          bestRoomId = roomId;
        }
      }
      if (!bestRoomId || bestCoverage === 0) {
        // cannot cover remaining services
        break;
      }
      const meta = roomMeta.get(bestRoomId)!;
      const serviceIds = roomIdToServices
        .get(bestRoomId)!
        .filter((s) => remaining.has(s));
      serviceIds.forEach((s) => remaining.delete(s));
      chosen.push({
        roomId: bestRoomId,
        roomCode: meta.roomCode,
        roomName: meta.roomName,
        doctorId: meta.doctorId,
        doctorCode: meta.doctorCode,
        serviceIds,
      });
    }

    if (remaining.size > 0) {
      throw new NotFoundException('Some services cannot be assigned to any clinic room');
    }

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
            doctorId: c.doctorId,
            doctorCode: c.doctorCode,
            serviceIds: c.serviceIds,
            timestamp: new Date().toISOString(),
          },
        })),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[Kafka] publish skipped:', (err as Error).message);
    }

    return chosen;
  }
}


