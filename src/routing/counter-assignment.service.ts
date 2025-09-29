import {
  Injectable,
} from '@nestjs/common';
import { RedisStreamService, TicketStatus } from '../cache/redis-stream.service';
import { RedisService } from '../cache/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketService } from '../websocket/websocket.service';

@Injectable()
export class CounterAssignmentService {
  constructor(
    private readonly redisStream: RedisStreamService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly webSocket: WebSocketService,
  ) {}

  async getCounters(): Promise<Array<{
    counterId: string;
    counterCode: string;
    counterName: string;
    location: string;
  }>> {
    const counters = await this.prisma.counter.findMany({
      where: { isActive: true },
      orderBy: { counterCode: 'asc' },
      select: {
        id: true,
        counterCode: true,
        counterName: true,
        location: true,
      },
    });

    return counters.map(({ id, counterCode, counterName, location }) => ({
      counterId: id,
      counterCode,
      counterName,
      location: location ?? '',
    }));
  }


  async skipCurrentPatient(counterId: string): Promise<{
    ok: true;
    patient?: any;
    message?: string;
    status?: string;
    callCount?: number;
  }> {
    const startTime = Date.now();
    console.log(`[SKIP_PERF] skipCurrentPatient started for counter ${counterId} at ${new Date().toISOString()}`);
    
    // Lấy queue và current trước khi thay đổi
    const oldQueue = await this.getCurrentQueue(counterId);
    
    // Step 1: Skip patient using optimized Redis method
    const step1Start = Date.now();
    console.log(`[SKIP_PERF] Step 1: Calling skipCurrentPatientOptimized...`);
    const result = await this.redis.skipCurrentPatientOptimized(counterId);
    const step1Duration = Date.now() - step1Start;
    console.log(`[SKIP_PERF] Step 1 completed in ${step1Duration}ms. Success: ${result.success}`);

    if (!result.success) {
      const totalDuration = Date.now() - startTime;
      console.log(`[SKIP_PERF] skipCurrentPatient completed in ${totalDuration}ms (no patient to skip)`);
      return {
        ok: true,
        message: result.message || 'No current patient to skip',
      };
    }

    // Step 2: Publish to Redis Stream
    const step2Start = Date.now();
    console.log(`[SKIP_PERF] Step 2: Publishing to Redis Stream...`);
    const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
    const enableStreams = process.env.ENABLE_REDIS_STREAMS !== 'false';
    
    if (enableStreams) {
      try {
        const messageId = await this.redisStream.publishEventWithTimeout(streamKey, {
          type: 'PATIENT_SKIPPED',
          counterId,
          patient: JSON.stringify(result.patient),
          timestamp: new Date().toISOString(),
        }, 100); // 100ms timeout
        
        const step2Duration = Date.now() - step2Start;
        console.log(`[SKIP_PERF] Step 2 completed in ${step2Duration}ms (stream published: ${messageId ? 'success' : 'timeout'})`);
      } catch (err) {
        const step2Duration = Date.now() - step2Start;
        console.warn(
          `[SKIP_PERF] Step 2 completed in ${step2Duration}ms (stream publish failed):`,
          (err as Error).message,
        );
      }
    } else {
      const step2Duration = Date.now() - step2Start;
      console.log(`[SKIP_PERF] Step 2 skipped in ${step2Duration}ms (Redis Streams disabled)`);
    }

    // Step 3: Process response and handle callCount logic
    const step3Start = Date.now();
    const callCount = Number((result.patient as any)?.callCount || 0);
    const patientTicketId = (result.patient as any)?.ticketId;
    
    // Nếu callCount >= 4, xóa khỏi queue hoàn toàn
    if (callCount >= 4 && patientTicketId) {
      await this.removeTicketFromQueue(counterId, patientTicketId);
      await this.promoteNextPatientAsCurrent(counterId);
      await this.updateNextPatientInQueue(counterId);

      const step3Duration = Date.now() - step3Start;
      const totalDuration = Date.now() - startTime;
      console.log(`[SKIP_PERF] Step 3 completed in ${step3Duration}ms`);
      console.log(`[SKIP_PERF] skipCurrentPatient completed in ${totalDuration}ms (patient removed after ${callCount} calls)`);

      const responsePatient = this.mapTicketForFrontend({
        ...(result.patient as any),
        status: TicketStatus.SKIPPED,
        callCount,
      });

      return {
        ok: true,
        patient: responsePatient,
        message: `Patient removed from queue after ${callCount} calls`,
        status: TicketStatus.SKIPPED,
        callCount,
      } as any;
    }
    
    // Nếu callCount <= 4, xử lý skip logic
    if (patientTicketId) {
      // 1. Cập nhật bệnh nhân hiện tại thành SKIPPED với callCount mới
      await this.updateTicketStatus(counterId, patientTicketId, TicketStatus.SKIPPED, callCount);

      // 2. Thăng bệnh nhân ưu tiên tiếp theo lên phục vụ
      await this.promoteNextPatientAsCurrent(counterId);

      // 3. Cập nhật bệnh nhân tiếp theo trong queue thành NEXT
      await this.updateNextPatientInQueue(counterId);
    }
    
    if (result.patient) {
      (result.patient as any).status = TicketStatus.SKIPPED;
      (result.patient as any).callCount = callCount;
    }

    const status = (result.patient as any)?.status || TicketStatus.SKIPPED;
    const message = result.message ||
      (callCount >= 3
        ? 'Current patient will be removed after next skip'
        : 'Current patient marked SKIPPED and will be reinserted after 3 turns');

    const step3Duration = Date.now() - step3Start;
    console.log(`[SKIP_PERF] Step 3 completed in ${step3Duration}ms`);

    // Step 4: Gửi sự kiện WebSocket về thay đổi queue
    const step4Start = Date.now();
    console.log(`[SKIP_PERF] Step 4: Sending WebSocket events...`);
    const newQueue = await this.getCurrentQueue(counterId);
    await this.compareQueueAndNotify(counterId, 'SKIP_PATIENT', oldQueue, newQueue);
    const step4Duration = Date.now() - step4Start;
    console.log(`[SKIP_PERF] Step 4 completed in ${step4Duration}ms`);

    void this.logQueueSnapshot(counterId, newQueue, 'After skipCurrentPatient').catch((err) =>
      console.warn('[queue-debug] Failed to log queue after skip:', (err as Error).message),
    );

    const totalDuration = Date.now() - startTime;
    console.log(`[SKIP_PERF] skipCurrentPatient completed in ${totalDuration}ms (patient: ${result.patient?.patientName || 'Unknown'})`);

    const responsePatient = this.mapTicketForFrontend(result.patient ? { ...(result.patient as any) } : null);

    return {
      ok: true,
      patient: responsePatient,
      message,
      status,
      callCount,
    };
  }


  /**
   * Cập nhật status của ticket và sắp xếp lại queue
   */
  private async updateTicketStatus(
    counterId: string,
    ticketId: string,
    status: TicketStatus,
    callCount?: number,
  ): Promise<void> {
    try {
      // Cập nhật trong Redis queue
      const queueKey = `counterQueueZ:${counterId}`;
      const members = await this.redis['redis'].zrevrange(queueKey, 0, -1);
      
      for (const member of members) {
        try {
          const ticket = JSON.parse(member);
          if (ticket.ticketId === ticketId) {
            // Cập nhật status và callCount
            ticket.status = status;
            if (callCount !== undefined) {
              ticket.callCount = callCount;
            }
            
            // Tính lại queuePriority dựa trên status mới và callCount
            let newPriority = 0;
            
            // Điều chỉnh priority dựa trên status
            if (status === TicketStatus.SERVING) {
              newPriority = 0; // Ưu tiên cao nhất
            } else if (status === TicketStatus.NEXT) {
              newPriority = 100000; // Ưu tiên cao thứ 2
            } else if (status === TicketStatus.SKIPPED) {
              // Miss patients: ai gọi nhiều lần hơn thì trôi về sau
              newPriority = 200000 + ((callCount || 0) * 10000);
            } else if (status === TicketStatus.COMPLETED) {
              newPriority = -1000000; // Ưu tiên thấp nhất (sẽ bị xóa)
            } else {
              // Các trường hợp khác (WAITING), tính theo logic ban đầu
              const patientAge = ticket.patientAge || 0;
              const isDisabled = ticket.metadata?.isDisabled || false;
              const isPregnant = ticket.metadata?.isPregnant || false;
              const hasAppointment = !!ticket.appointmentCode;
              const sequence = ticket.sequence || 0;
              
              // Tính priority theo logic ban đầu
              if (patientAge > 75) {
                newPriority = 10000000 - patientAge;
              } else if (patientAge < 6) {
                newPriority = 20000000 - patientAge;
              } else if (isDisabled) {
                newPriority = 30000000;
              } else if (isPregnant) {
                newPriority = 40000000;
              } else if (hasAppointment) {
                newPriority = 50000000;
              } else {
                newPriority = 60000000;
              }
              newPriority = newPriority - sequence;
            }
            
            ticket.queuePriority = newPriority;
            
            // Xóa ticket cũ và thêm ticket mới với priority đã cập nhật
            await this.redis['redis'].zrem(queueKey, member);
            await this.redis['redis'].zadd(queueKey, -newPriority, JSON.stringify(ticket));
            break;
          }
        } catch (e) {
          console.warn('Error updating ticket status:', e);
        }
      }
    } catch (error) {
      console.warn('Error updating ticket status:', error);
    }
  }

  /**
   * Cập nhật bệnh nhân tiếp theo trong queue thành NEXT
   */
  private async updateNextPatientInQueue(counterId: string): Promise<void> {
    try {
      const queueKey = `counterQueueZ:${counterId}`;
      const members = await this.redis['redis'].zrevrange(queueKey, 0, -1);

      const nextCandidates: string[] = [];
      let nextTicketId: string | null = null;

      for (const member of members) {
        try {
          const ticket = JSON.parse(member);
          if (ticket.status === TicketStatus.NEXT) {
            nextCandidates.push(ticket.ticketId);
          }
          if (!nextTicketId && (ticket.status === TicketStatus.WAITING || ticket.status === TicketStatus.SKIPPED)) {
            nextTicketId = ticket.ticketId;
          }
        } catch (e) {
          console.warn('Error parsing ticket when normalizing NEXT:', e);
        }
      }

      for (const ticketId of nextCandidates) {
        if (ticketId !== nextTicketId) {
          await this.updateTicketStatus(counterId, ticketId, TicketStatus.WAITING);
        }
      }

      if (nextTicketId) {
        await this.updateTicketStatus(counterId, nextTicketId, TicketStatus.NEXT);
        console.log(`Updated next patient in queue: ${nextTicketId}`);
      }
    } catch (error) {
      console.warn('Error updating next patient in queue:', error);
    }
  }

  /**
   * So sánh queue và phát hiện thay đổi vị trí
   */
  private async compareQueueAndNotify(
    counterId: string,
    eventType: 'NEXT_PATIENT' | 'SKIP_PATIENT' | 'NEW_TICKET',
    oldQueue: any[],
    newQueue: any[],
  ): Promise<void> {
    try {
      const changes = {
        newPatients: [] as any[],
        movedPatients: [] as any[],
        removedPatients: [] as any[],
        currentServing: null as any,
        currentNext: null as any,
      };

      // Tìm bệnh nhân mới
      const oldTicketIds = new Set(oldQueue.map(p => p.ticketId));
      const newTicketIds = new Set(newQueue.map(p => p.ticketId));
      
      for (const patient of newQueue) {
        if (!oldTicketIds.has(patient.ticketId)) {
          changes.newPatients.push(patient);
        }
      }

      // Tìm bệnh nhân bị xóa
      for (const patient of oldQueue) {
        if (!newTicketIds.has(patient.ticketId)) {
          changes.removedPatients.push(patient);
        }
      }

      // Tìm bệnh nhân bị thay đổi vị trí
      for (let i = 0; i < newQueue.length; i++) {
        const newPatient = newQueue[i];
        const oldPatient = oldQueue.find(p => p.ticketId === newPatient.ticketId);
        
        if (oldPatient && oldPatient.queuePriority !== newPatient.queuePriority) {
          changes.movedPatients.push({
            ...newPatient,
            oldPosition: oldQueue.indexOf(oldPatient),
            newPosition: i,
          } as any);
        }
      }

      // Tìm bệnh nhân đang phục vụ và tiếp theo
      changes.currentServing = newQueue.find(p => p.status === TicketStatus.SERVING);
      changes.currentNext = newQueue.find(p => p.status === TicketStatus.NEXT);

      const mapFrontend = (ticket: any) => this.mapTicketForFrontend(ticket);
      changes.newPatients = changes.newPatients.map(mapFrontend).filter(Boolean);
      changes.movedPatients = changes.movedPatients.map(mapFrontend).filter(Boolean);
      changes.removedPatients = changes.removedPatients.map(mapFrontend).filter(Boolean);
      changes.currentServing = mapFrontend(changes.currentServing);
      changes.currentNext = mapFrontend(changes.currentNext);

      // Gửi sự kiện WebSocket
      await this.webSocket.notifyQueuePositionChanges(counterId, eventType, changes);
      
      console.log(`[Queue Changes] ${eventType} - New: ${changes.newPatients.length}, Moved: ${changes.movedPatients.length}, Removed: ${changes.removedPatients.length}`);
    } catch (error) {
      console.warn('Error comparing queue and notifying:', error);
    }
  }

  /**
   * Lấy queue hiện tại
   */
  private async getCurrentQueue(counterId: string): Promise<any[]> {
    try {
      const queueKey = `counterQueueZ:${counterId}`;
      const members = await this.redis['redis'].zrevrange(queueKey, 0, -1);
      return members.map(member => {
        try {
          return JSON.parse(member);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.warn('Error getting current queue:', error);
      return [];
    }
  }

  /**
   * Xóa ticket khỏi queue
   */
  private async removeTicketFromQueue(
    counterId: string,
    ticketId: string,
  ): Promise<void> {
    try {
      const queueKey = `counterQueueZ:${counterId}`;
      const members = await this.redis['redis'].zrevrange(queueKey, 0, -1);
      
      for (const member of members) {
        try {
          const ticket = JSON.parse(member);
          if (ticket.ticketId === ticketId) {
            await this.redis['redis'].zrem(queueKey, member);
            console.log(`Removed ticket ${ticketId} from queue after ${ticket.callCount} calls`);
            break;
          }
        } catch (e) {
          console.warn('Error removing ticket from queue:', e);
        }
      }
    } catch (error) {
      console.warn('Error removing ticket from queue:', error);
    }
  }

  async callNextPatient(
    counterId: string,
  ): Promise<{ ok: true; patient?: any; message?: string }> {
    const startTime = Date.now();
    console.log(`[PERF] callNextPatient started for counter ${counterId} at ${new Date().toISOString()}`);
    
    // Lấy queue trước khi thay đổi
    const oldQueue = await this.getCurrentQueue(counterId);
    const previousCurrent = await this.redis.getCurrentPatient(counterId);
    
    // Step 1: Call optimized Redis method
    const step1Start = Date.now();
    console.log(`[PERF] Step 1: Calling callNextPatientOptimized...`);
    const result = await this.redis.callNextPatientOptimized(counterId);
    const step1Duration = Date.now() - step1Start;
    console.log(`[PERF] Step 1 completed in ${step1Duration}ms. Success: ${result.success}`);
    
    if (!result.success) {
      // Step 2: Check and reset sequence if queue empty
      const step2Start = Date.now();
      console.log(`[PERF] Step 2: Checking and resetting sequence...`);
      await this.redis.checkAndResetSequenceIfEmpty(counterId);
      const step2Duration = Date.now() - step2Start;
      console.log(`[PERF] Step 2 completed in ${step2Duration}ms`);
      
      const totalDuration = Date.now() - startTime;
      console.log(`[PERF] callNextPatient completed in ${totalDuration}ms (no patient found)`);
      
      return {
        ok: true,
        message: result.message || 'No patients in queue, sequence reset if queue was empty',
      };
    }

    // Step 3: Update patient statuses in queue
    const step3Start = Date.now();
    console.log(`[PERF] Step 3: Updating patient statuses...`);
    
    // 1. Cập nhật bệnh nhân đang phục vụ thành COMPLETED (nếu có)
    const currentPatient = await this.redis.getCurrentPatient(counterId);

    const previousTicketId = (previousCurrent as any)?.ticketId as string | undefined;
    const currentTicketId = (currentPatient as any)?.ticketId as string | undefined;

    if (previousTicketId && (!currentTicketId || previousTicketId !== currentTicketId)) {
      try {
        await this.redis.addPatientToHistory(counterId, previousCurrent as any);
      } catch (err) {
        console.warn('Error adding previous patient to history:', (err as Error).message);
      }
    }

    if (!currentTicketId) {
      await this.promoteNextPatientAsCurrent(counterId);
    } else if ((currentPatient as any)?.status !== TicketStatus.SERVING) {
      const normalizedCurrent = {
        ...(currentPatient as any),
        status: TicketStatus.SERVING,
      };
      await this.redis.setCurrentPatient(counterId, normalizedCurrent);
    }

    // 2. Chuẩn hóa lại trạng thái NEXT trong queue và chọn bệnh nhân tiếp theo
    await this.updateNextPatientInQueue(counterId);
    
    const step3Duration = Date.now() - step3Start;
    console.log(`[PERF] Step 3 completed in ${step3Duration}ms`);

    // Step 4: Publish to Redis Stream
    const step4Start = Date.now();
    // Step 4: Publish to Redis Stream (with option to disable)
    const enableStreams = process.env.ENABLE_REDIS_STREAMS !== 'false';
    if (enableStreams) {
      console.log(`[PERF] Step 4: Publishing to Redis Stream with timeout...`);
      const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
      try {
        const messageId = await this.redisStream.publishEventWithTimeout(streamKey, {
          type: 'NEXT_PATIENT_CALLED',
          counterId,
          patient: JSON.stringify(result.patient),
          timestamp: new Date().toISOString(),
        }, 100); // Reduced timeout to 100ms
        
        const step4Duration = Date.now() - step4Start;
        console.log(`[PERF] Step 4 completed in ${step4Duration}ms (stream published: ${messageId ? 'success' : 'timeout'})`);
      } catch (err) {
        const step4Duration = Date.now() - step4Start;
        console.warn(
          `[PERF] Step 4 completed in ${step4Duration}ms (stream publish failed):`,
          (err as Error).message,
        );
      }
    } else {
      const step4Duration = Date.now() - step4Start;
      console.log(`[PERF] Step 4 skipped in ${step4Duration}ms (Redis Streams disabled)`);
    }

    // Step 5: Gửi sự kiện WebSocket về thay đổi queue
    const step5Start = Date.now();
    console.log(`[PERF] Step 5: Sending WebSocket events...`);
    const newQueue = await this.getCurrentQueue(counterId);
    await this.compareQueueAndNotify(counterId, 'NEXT_PATIENT', oldQueue, newQueue);
    const step5Duration = Date.now() - step5Start;
    console.log(`[PERF] Step 5 completed in ${step5Duration}ms`);

    void this.logQueueSnapshot(counterId, newQueue, 'After callNextPatient').catch((err) =>
      console.warn('[queue-debug] Failed to log queue after next:', (err as Error).message),
    );

    const totalDuration = Date.now() - startTime;
    console.log(`[PERF] callNextPatient completed in ${totalDuration}ms (patient found: ${result.patient?.patientName || 'Unknown'})`);
    
    const responsePatient = this.mapTicketForFrontend(result.patient);

    return { ok: true, patient: responsePatient };
  }

  private async logQueueSnapshot(
    counterId: string,
    queue: any[] | null,
    context: string,
  ): Promise<void> {
    const snapshot = queue ?? await this.redis.getCounterQueueSnapshot(counterId);
    const currentRaw = await this.redis.getCurrentPatient(counterId);
    const current = this.mapTicketForFrontend(
      currentRaw
        ? {
            ...currentRaw,
            status: (currentRaw as any).status || TicketStatus.SERVING,
          }
        : null,
    );

    const waiting = (snapshot || [])
      .filter((ticket) => !current || ticket.ticketId !== (current as any).ticketId)
      .map((ticket) => this.mapTicketForFrontend({
        ...ticket,
        status: ticket.status || TicketStatus.WAITING,
      }))
      .filter(Boolean);

    const combined = current ? [current, ...waiting] : [...waiting];

    const rows = combined.map((ticket, index) => ({
      pos: index + 1,
      ticket: ticket.ticketId,
      qNum: ticket.queueNumber,
      name: ticket.patientName,
      arr: typeof ticket.assignedAt === 'string'
        ? (ticket.assignedAt.split('T')[1]?.slice(0, 8) || ticket.assignedAt)
        : '',
      st: ticket.status,
      stLbl: ticket.statusText || ticket.statusLabel || '',
      prio: ticket.queuePriority,
      calls: ticket.callCount ?? 0,
      age: ticket.patientAge,
      preg: ticket?.isPregnant ? 'Y' : '',
      dis: ticket?.isDisabled ? 'Y' : '',
      eld: ticket?.isElderly ? 'Y' : '',
    }));

    console.log(`[queue-debug] ${context} - counter ${counterId}`);
    if (rows.length > 0) {
      console.table(rows);
    } else {
      console.log('[queue-debug] Queue is currently empty');
    }
  }

  private async promoteNextPatientAsCurrent(counterId: string): Promise<void> {
    try {
      const nextPatient = await this.redis.getNextPatientFromQueue(counterId);
      if (nextPatient && nextPatient.ticketId) {
        await this.removeTicketFromQueue(counterId, nextPatient.ticketId as string);
        const normalizedCurrent = {
          ...nextPatient,
          status: TicketStatus.SERVING,
          callCount: nextPatient.callCount ?? 0,
          metadata: nextPatient.metadata || {},
        };
        await this.redis.setCurrentPatient(counterId, normalizedCurrent as any);
      } else {
        await this.redis.setCurrentPatient(counterId, null as any);
      }
    } catch (error) {
      console.warn('Error promoting next patient to current:', error);
    }
  }

  private mapTicketForFrontend(ticket: any | null): any | null {
    if (!ticket) {
      return null;
    }

    const metadata = ticket.metadata && typeof ticket.metadata === 'object'
      ? ticket.metadata
      : {};

    const age = typeof ticket.patientAge === 'number' ? ticket.patientAge : undefined;
    const isElderly = typeof age === 'number' ? age >= 75 : false;

    return {
      ...ticket,
      metadata,
      isOnTime: Boolean(ticket.isOnTime),
      isPregnant: Boolean(metadata.isPregnant),
      isDisabled: Boolean(metadata.isDisabled),
      isElderly,
    };
  }

  async getQueueSnapshot(counterId: string): Promise<{
    counterId: string;
    current: any | null;
    next: any | null;
    queue: any[];
    ordered: any[];
  }> {
    const [currentRaw, queueRaw] = await Promise.all([
      this.redis.getCurrentPatient(counterId),
      this.redis.getCounterQueueSnapshot(counterId),
    ]);

    const current = this.mapTicketForFrontend(
      currentRaw
        ? {
            ...currentRaw,
            status: (currentRaw as any).status || TicketStatus.SERVING,
          }
        : null,
    );

    const waiting = queueRaw
      .filter((ticket) => !current || ticket.ticketId !== (current as any).ticketId)
      .map((ticket) => this.mapTicketForFrontend({
        ...ticket,
        status: ticket.status || TicketStatus.WAITING,
      }));

    const next = waiting.find((ticket) => ticket?.status === TicketStatus.NEXT) || null;

    const ordered = current ? [current, ...waiting] : [...waiting];

    return {
      counterId,
      current,
      next,
      queue: waiting,
      ordered,
    };
  }

}
