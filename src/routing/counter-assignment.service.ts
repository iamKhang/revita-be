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
    status: 'BUSY' | 'AVAILABLE';
    assignedReceptionist?: {
      id: string;
      name: string;
    };
  }>> {
    const counters = await this.prisma.counter.findMany({
      where: { isActive: true },
      orderBy: { counterCode: 'asc' },
      select: {
        id: true,
        counterCode: true,
        counterName: true,
        location: true,
        assignments: {
          where: {
            status: 'ACTIVE'
          },
          select: {
            id: true,
            receptionist: {
              select: {
                id: true,
                auth: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          take: 1
        }
      },
    });

    return counters.map(({ id, counterCode, counterName, location, assignments }) => {
      const activeAssignment = assignments[0];
      const isBusy = activeAssignment !== undefined;
      
      return {
        counterId: id,
        counterCode,
        counterName,
        location: location ?? '',
        status: isBusy ? 'BUSY' : 'AVAILABLE',
        assignedReceptionist: isBusy ? {
          id: activeAssignment.receptionist.id,
          name: activeAssignment.receptionist.auth.name
        } : undefined,
      };
    });
  }

  async findReceptionistByAuthId(authId: string): Promise<{ id: string } | null> {
    try {
      const receptionist = await this.prisma.receptionist.findFirst({
        where: {
          authId: authId,
        },
        select: {
          id: true,
        },
      });
      return receptionist;
    } catch (error) {
      console.error('Error finding receptionist by authId:', error);
      return null;
    }
  }

  async assignReceptionistToCounter(
    counterId: string,
    authId: string,
    notes?: string,
  ): Promise<{
    success: boolean;
    message: string;
    assignment?: {
      id: string;
      counterId: string;
      receptionistId: string;
      assignedAt: Date;
      status: string;
      notes?: string;
    };
  }> {
    try {
      // Kiểm tra counter có tồn tại và active không
      const counter = await this.prisma.counter.findFirst({
        where: {
          id: counterId,
          isActive: true,
        },
      });

      if (!counter) {
        return {
          success: false,
          message: 'Counter not found or inactive',
        };
      }

      // Kiểm tra receptionist có tồn tại không (tìm bằng authId)
      const receptionist = await this.prisma.receptionist.findFirst({
        where: {
          authId: authId,
        },
        include: {
          auth: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!receptionist) {
        return {
          success: false,
          message: 'Receptionist not found',
        };
      }

      // Tìm tất cả assignments ACTIVE của counter này
      const activeAssignments = await this.prisma.counterAssignment.findMany({
        where: {
          counterId: counterId,
          status: 'ACTIVE',
        },
      });

      // Cập nhật tất cả assignments ACTIVE thành COMPLETED
      if (activeAssignments.length > 0) {
        await this.prisma.counterAssignment.updateMany({
          where: {
            counterId: counterId,
            status: 'ACTIVE',
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        console.log(`Updated ${activeAssignments.length} active assignments to COMPLETED for counter ${counterId}`);
      }

      // Tạo assignment mới với status ACTIVE
      const newAssignment = await this.prisma.counterAssignment.create({
        data: {
          counterId: counterId,
          receptionistId: receptionist.id,
          status: 'ACTIVE',
          notes: notes,
          assignedAt: new Date(),
        },
      });

      // Cập nhật counter với receptionist mới
      await this.prisma.counter.update({
        where: {
          id: counterId,
        },
        data: {
          receptionistId: receptionist.id,
        },
      });

      console.log(`Successfully assigned receptionist ${receptionist.auth.name} to counter ${counter.counterName}`);

      return {
        success: true,
        message: `Successfully assigned ${receptionist.auth.name} to ${counter.counterName}`,
        assignment: {
          id: newAssignment.id,
          counterId: newAssignment.counterId,
          receptionistId: newAssignment.receptionistId,
          assignedAt: newAssignment.assignedAt,
          status: newAssignment.status,
          notes: newAssignment.notes || undefined,
        },
      };
    } catch (error) {
      console.error('Error assigning receptionist to counter:', error);
      return {
        success: false,
        message: 'Failed to assign receptionist to counter',
      };
    }
  }

  async checkoutReceptionistFromCounter(
    counterId: string,
    authId: string,
  ): Promise<{
    success: boolean;
    message: string;
    assignment?: {
      id: string;
      counterId: string;
      receptionistId: string;
      completedAt: Date;
      status: string;
    };
  }> {
    try {
      // Tìm receptionist từ authId trước
      const receptionist = await this.prisma.receptionist.findFirst({
        where: {
          authId: authId,
        },
      });

      if (!receptionist) {
        return {
          success: false,
          message: 'Receptionist not found',
        };
      }

      // Tìm assignment ACTIVE của receptionist này với counter cụ thể
      const activeAssignment = await this.prisma.counterAssignment.findFirst({
        where: {
          counterId: counterId,
          receptionistId: receptionist.id,
          status: 'ACTIVE',
        },
        include: {
          counter: {
            select: {
              counterName: true,
            },
          },
          receptionist: {
            select: {
              auth: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!activeAssignment) {
        return {
          success: false,
          message: 'No active assignment found for this receptionist at the specified counter',
        };
      }

      // Cập nhật assignment thành COMPLETED
      const updatedAssignment = await this.prisma.counterAssignment.update({
        where: {
          id: activeAssignment.id,
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Cập nhật counter để loại bỏ receptionist
      await this.prisma.counter.update({
        where: {
          id: activeAssignment.counterId,
        },
        data: {
          receptionistId: null,
        },
      });

      console.log(`Successfully checked out receptionist ${activeAssignment.receptionist.auth.name} from counter ${activeAssignment.counter.counterName}`);

      return {
        success: true,
        message: `Successfully checked out ${activeAssignment.receptionist.auth.name} from ${activeAssignment.counter.counterName}`,
        assignment: {
          id: updatedAssignment.id,
          counterId: updatedAssignment.counterId,
          receptionistId: updatedAssignment.receptionistId,
          completedAt: updatedAssignment.completedAt!,
          status: updatedAssignment.status,
        },
      };
    } catch (error) {
      console.error('Error checking out receptionist from counter:', error);
      return {
        success: false,
        message: 'Failed to checkout receptionist from counter',
      };
    }
  }

  async skipCurrentPatient(counterId: string): Promise<{
    ok: true;
    patient?: any;
    message?: string;
    status?: string;
    callCount?: number;
  }> {
    const startTime = Date.now();
    
    // Lấy queue và current trước khi thay đổi
    const oldQueue = await this.getCurrentQueue(counterId);
    
    // Step 1: Skip patient using optimized Redis method
    const step1Start = Date.now();
    const result = await this.redis.skipCurrentPatientSimple(counterId);
    const step1Duration = Date.now() - step1Start;

    if (!result.success) {
      const totalDuration = Date.now() - startTime;
      return {
        ok: true,
        message: result.message || 'No current patient to skip',
      };
    }

    // Step 2: Call next patient (B becomes SERVING)
    const step2Start = Date.now();
    const nextResult = await this.redis.callNextPatientOptimized(counterId);
    const step2Duration = Date.now() - step2Start;

    if (!nextResult.success) {
      const totalDuration = Date.now() - startTime;
      return {
        ok: true,
        patient: result.patient,
        message: 'Patient skipped, but no next patient to call',
      };
    }

    const skippedTicketId = (result.patient as any)?.ticketId as string | undefined;
    const skipCallCount = Number((result.patient as any)?.callCount || 0);

    if (skippedTicketId && skipCallCount < 4) {
      await this.removeTicketFromQueue(counterId, skippedTicketId);

      const skipOrder = await this.redis.incrementSkipOrder(counterId);
      const queuePriority = 200000 + skipOrder;
      const reinsertionPayload = {
        ...(result.patient as any),
        status: TicketStatus.SKIPPED,
        callCount: skipCallCount,
        skipOrder,
        queuePriority,
        priorityScore: queuePriority,
        skippedAt: new Date().toISOString(),
      };

      await this.redis.addToCounterQueueWithScore(counterId, reinsertionPayload, -queuePriority);
    }

    // Step 3: Set next patient as preparing (C becomes PREPARING)
    const prepareStart = Date.now();
    const queueStatus = await this.redis.getQueueStatusWithCleanup(counterId);
    
    if (queueStatus.queue && queueStatus.queue.length > 0) {
      const nextNextPatient = queueStatus.queue[0];
      
      // Set this patient as preparing with special status
      const preparingPatient = {
        ...nextNextPatient,
        status: 'PREPARING',
        isPriority: true,
        preparingAt: new Date().toISOString(),
      };

      // Update the patient in the queue with PREPARING status
      await this.redis.removeFromCounterQueue(counterId, nextNextPatient);
      const maxPriorityScore = Number.MAX_SAFE_INTEGER;
      await this.redis.addToCounterQueueWithScore(counterId, preparingPatient, maxPriorityScore);
      
    }
    console.log(`[SKIP_PERF] Step 3 (prepare) completed in ${Date.now() - prepareStart}ms`);

    // Send WebSocket notification directly
    try {
      await this.webSocket.sendToCounter(counterId, 'patient_skipped', {
        type: 'PATIENT_SKIPPED_AND_NEXT_CALLED',
        data: {
          counterId,
          skippedPatient: result.patient,
          currentPatient: nextResult.patient,
        },
        timestamp: new Date().toISOString(),
      });
      console.log('⏭️ [WebSocket] Sent PATIENT_SKIPPED_AND_NEXT_CALLED notification directly');
    } catch (err) {
      console.warn('[WebSocket] Patient skipped notification failed:', (err as Error).message);
    }

    // Step 4: Publish to Redis Stream
    const streamPublishStart = Date.now();
    const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
    const enableStreams = process.env.ENABLE_REDIS_STREAMS !== 'false';
    
    if (enableStreams) {
      try {
        const messageId = await this.redisStream.publishEventWithTimeout(streamKey, {
          type: 'PATIENT_SKIPPED_AND_NEXT_CALLED',
          counterId,
          skippedPatient: JSON.stringify(result.patient),
          currentPatient: JSON.stringify(nextResult.patient),
          timestamp: new Date().toISOString(),
        }, 100);
        
        const streamPublishDuration = Date.now() - streamPublishStart;
        console.log(`[SKIP_PERF] Step 4 completed in ${streamPublishDuration}ms (stream published: ${messageId ? 'success' : 'timeout'})`);
      } catch (err) {
        const streamPublishDuration = Date.now() - streamPublishStart;
        console.warn(
          `[SKIP_PERF] Step 4 completed in ${streamPublishDuration}ms (stream publish failed):`,
          (err as Error).message,
        );
      }
    } else {
      const streamPublishDuration = Date.now() - streamPublishStart;
      console.log(`[SKIP_PERF] Step 4 skipped in ${streamPublishDuration}ms (Redis Streams disabled)`);
    }

    // Step 5: Process response and handle callCount logic
    const processingStart = Date.now();
    const callCount = skipCallCount;
    const patientTicketId = skippedTicketId;
    
    // Nếu callCount >= 4, xóa khỏi queue hoàn toàn
    if (callCount >= 4 && patientTicketId) {
      await this.removeTicketFromQueue(counterId, patientTicketId);
      await this.updateNextPatientInQueue(counterId);

      const processingDuration = Date.now() - processingStart;
      const totalDuration = Date.now() - startTime;
      console.log(`[SKIP_PERF] Step 5 completed in ${processingDuration}ms`);
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

      // 2. Cập nhật bệnh nhân tiếp theo trong queue thành NEXT
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

    const processingDuration = Date.now() - processingStart;
    console.log(`[SKIP_PERF] Step 5 completed in ${processingDuration}ms`);

    // Step 6: Gửi sự kiện WebSocket về thay đổi queue
    const notifyStart = Date.now();
    console.log(`[SKIP_PERF] Step 6: Sending WebSocket events...`);
    const newQueue = await this.getCurrentQueue(counterId);
    await this.compareQueueAndNotify(counterId, 'SKIP_PATIENT', oldQueue, newQueue);
    const notifyDuration = Date.now() - notifyStart;
    console.log(`[SKIP_PERF] Step 6 completed in ${notifyDuration}ms`);

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
              delete (ticket as any).skipOrder;
            } else if (status === TicketStatus.NEXT) {
              newPriority = 100000; // Ưu tiên cao thứ 2
              delete (ticket as any).skipOrder;
            } else if (status === TicketStatus.SKIPPED) {
              if ((ticket as any).skipOrder === undefined) {
                (ticket as any).skipOrder = await this.redis.incrementSkipOrder(counterId);
              }
              const skipOrder = Number((ticket as any).skipOrder) || 1;
              newPriority = 200000 + skipOrder;
            } else if (status === TicketStatus.COMPLETED) {
              newPriority = -1000000; // Ưu tiên thấp nhất (sẽ bị xóa)
              delete (ticket as any).skipOrder;
            } else {
              // Các trường hợp khác (WAITING), tính theo logic ban đầu
              delete (ticket as any).skipOrder;
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
            (ticket as any).priorityScore = newPriority;
            
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
      let preparingTicketId: string | null = null;
      let nextTicketId: string | null = null;

      for (const member of members) {
        try {
          const ticket = JSON.parse(member);
          if (ticket.status === TicketStatus.NEXT) {
            nextCandidates.push(ticket.ticketId);
          }
          if (!preparingTicketId && ticket.status === 'PREPARING') {
            preparingTicketId = ticket.ticketId;
          }
          if (!nextTicketId && (ticket.status === TicketStatus.WAITING || ticket.status === TicketStatus.SKIPPED)) {
            nextTicketId = ticket.ticketId;
          }
        } catch (e) {
          console.warn('Error parsing ticket when normalizing NEXT:', e);
        }
      }

      const targetTicketId = preparingTicketId || nextTicketId;

      for (const ticketId of nextCandidates) {
        if (ticketId !== targetTicketId) {
          await this.updateTicketStatus(counterId, ticketId, TicketStatus.WAITING);
        }
      }

      if (targetTicketId) {
        await this.updateTicketStatus(counterId, targetTicketId, TicketStatus.NEXT);
        console.log(`Updated next patient in queue: ${targetTicketId}`);
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
    
    // Lấy queue trước khi thay đổi
    const oldQueue = await this.getCurrentQueue(counterId);
    const previousCurrent = await this.redis.getCurrentPatient(counterId);
    const enableStreams = process.env.ENABLE_REDIS_STREAMS !== 'false';
    
    // Step 1: Call optimized Redis method
    const step1Start = Date.now();
    const currentServing = await this.redis.getCurrentPatient(counterId);
    if (currentServing) {
      // Clear current patient (mark as served)
      await this.redis.setCurrentPatient(counterId, null);
      
      // Send WebSocket notification directly
      try {
        await this.webSocket.notifyTicketCompleted(counterId, currentServing);
        console.log('✅ [WebSocket] Sent PATIENT_SERVED notification directly');
      } catch (err) {
        console.warn('[WebSocket] Patient served notification failed:', (err as Error).message);
      }
      
      // Publish patient served event
      if (enableStreams) {
        const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
        try {
          await this.redisStream.publishEventWithTimeout(streamKey, {
            type: 'PATIENT_SERVED',
            counterId,
            patient: JSON.stringify(currentServing),
            timestamp: new Date().toISOString(),
          }, 100);
        } catch (err) {
          console.warn('[Redis Stream] Patient served publish failed:', (err as Error).message);
        }
      }
    } else {
    }
    const step1Duration = Date.now() - step1Start;
    
    // Step 2: Set next patient as preparing (priority status - cannot be jumped)
    const step2Start = Date.now();
    const queueStatus = await this.redis.getQueueStatusWithCleanup(counterId);
    
    if (!queueStatus.queue || queueStatus.queue.length === 0) {
      const step2Duration = Date.now() - step2Start;
      
      const totalDuration = Date.now() - startTime;
      
      return {
        ok: true,
        message: 'No patients in queue',
      };
    }

    // Get the next patient (highest priority)
    const nextPatient = queueStatus.queue[0];
    
    // Set this patient as preparing with special status
    const preparingPatient = {
      ...nextPatient,
      status: 'PREPARING',
      isPriority: true,
      preparingAt: new Date().toISOString(),
    };

    // Update the patient in the queue with PREPARING status
    // Remove and re-add with maximum priority score to ensure no one can jump
    await this.redis.removeFromCounterQueue(counterId, nextPatient);
    const maxPriorityScore = Number.MAX_SAFE_INTEGER;
    await this.redis.addToCounterQueueWithScore(counterId, preparingPatient, maxPriorityScore);

    // Send WebSocket notification directly
    try {
      await this.webSocket.sendToCounter(counterId, 'patient_preparing', {
        type: 'PATIENT_PREPARING',
        data: {
          counterId,
          patient: preparingPatient,
        },
        timestamp: new Date().toISOString(),
      });
      console.log('🔄 [WebSocket] Sent PATIENT_PREPARING notification directly');
    } catch (err) {
      console.warn('[WebSocket] Patient preparing notification failed:', (err as Error).message);
    }

    // Publish preparing event
    if (enableStreams) {
      const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
      try {
        await this.redisStream.publishEventWithTimeout(streamKey, {
          type: 'PATIENT_PREPARING',
          counterId,
          patient: JSON.stringify(preparingPatient),
          timestamp: new Date().toISOString(),
        }, 100);
      } catch (err) {
        console.warn('[Redis Stream] Patient preparing publish failed:', (err as Error).message);
      }
    }

    const step2Duration = Date.now() - step2Start;
    
    // Step 3: Call optimized Redis method to get the preparing patient as current
    const nextCallStart = Date.now();
    const result = await this.redis.callNextPatientOptimized(counterId);
    const nextCallDuration = Date.now() - nextCallStart;
    console.log(`[PERF] Step 3 callNextPatientOptimized completed in ${nextCallDuration}ms`);
    
    if (!result.success) {
      // Step 4: Check and reset sequence if queue empty
      const step4Start = Date.now();
      await this.redis.checkAndResetSequenceIfEmpty(counterId);
      const step4Duration = Date.now() - step4Start;
      
      const totalDuration = Date.now() - startTime;
      
      return {
        ok: true,
        message: result.message || 'No patients in queue, sequence reset if queue was empty',
      };
    }

    // Step 4: Update patient statuses in queue
    const statusUpdateStart = Date.now();
    console.log(`[PERF] Step 4: Updating patient statuses...`);
    
    // 1. Cập nhật bệnh nhân đang phục vụ thành COMPLETED (nếu có)
    const updatedCurrent = await this.redis.getCurrentPatient(counterId);

    const previousTicketId = (previousCurrent as any)?.ticketId as string | undefined;
    const currentTicketId = (updatedCurrent as any)?.ticketId as string | undefined;

    if (previousTicketId && (!currentTicketId || previousTicketId !== currentTicketId)) {
      try {
        await this.redis.addPatientToHistory(counterId, previousCurrent as any);
      } catch (err) {
        console.warn('Error adding previous patient to history:', (err as Error).message);
      }
    }

    if (!currentTicketId) {
      await this.promoteNextPatientAsCurrent(counterId);
    } else if ((updatedCurrent as any)?.status !== TicketStatus.SERVING) {
      const normalizedCurrent = {
        ...(updatedCurrent as any),
        status: TicketStatus.SERVING,
      };
      await this.redis.setCurrentPatient(counterId, normalizedCurrent);
    }

    // 2. Chuẩn hóa lại trạng thái NEXT trong queue và chọn bệnh nhân tiếp theo
    await this.updateNextPatientInQueue(counterId);
    
    const statusUpdateDuration = Date.now() - statusUpdateStart;
    console.log(`[PERF] Step 4 completed in ${statusUpdateDuration}ms`);

    // Step 5: Publish to Redis Stream
    const streamPublishStart = Date.now();
    if (enableStreams) {
      console.log(`[PERF] Step 5: Publishing to Redis Stream with timeout...`);
      const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
      try {
        const messageId = await this.redisStream.publishEventWithTimeout(streamKey, {
          type: 'NEXT_PATIENT_CALLED',
          counterId,
          patient: JSON.stringify(result.patient),
          timestamp: new Date().toISOString(),
        }, 100); // Reduced timeout to 100ms
        
        const streamPublishDuration = Date.now() - streamPublishStart;
        console.log(`[PERF] Step 5 completed in ${streamPublishDuration}ms (stream published: ${messageId ? 'success' : 'timeout'})`);
      } catch (err) {
        const streamPublishDuration = Date.now() - streamPublishStart;
        console.warn(
          `[PERF] Step 5 completed in ${streamPublishDuration}ms (stream publish failed):`,
          (err as Error).message,
        );
      }
    } else {
      const streamPublishDuration = Date.now() - streamPublishStart;
      console.log(`[PERF] Step 5 skipped in ${streamPublishDuration}ms (Redis Streams disabled)`);
    }

    // Step 6: Gửi sự kiện WebSocket về thay đổi queue
    const notifyStart = Date.now();
    console.log(`[PERF] Step 6: Sending WebSocket events...`);
    const newQueue = await this.getCurrentQueue(counterId);
    await this.compareQueueAndNotify(counterId, 'NEXT_PATIENT', oldQueue, newQueue);
    const notifyDuration = Date.now() - notifyStart;
    console.log(`[PERF] Step 6 completed in ${notifyDuration}ms`);

    void this.logQueueSnapshot(counterId, newQueue, 'After callNextPatient').catch((err) =>
      console.warn('[queue-debug] Failed to log queue after next:', (err as Error).message),
    );

    const totalDuration = Date.now() - startTime;
    
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

  async getQueueStatus(counterId: string): Promise<{
    counterId: string;
    current: any | null;
    queue: any[];
    queueCount: number;
    skippedCount: number;
    isOnline: boolean;
    cleanedDuplicates: number;
  }> {
    const status = await this.redis.getQueueStatusWithCleanup(counterId);

    const current = this.mapTicketForFrontend(
      status.current
        ? {
            ...status.current,
            status: (status.current as any).status || TicketStatus.SERVING,
          }
        : null,
    );

    const queueRaw = (status.queue ?? []) as any[];
    const queue = queueRaw
      .map((ticket) =>
        this.mapTicketForFrontend({
          ...ticket,
          status: ticket?.status || TicketStatus.WAITING,
        }),
      )
      .filter(Boolean);

    return {
      counterId,
      current,
      queue,
      queueCount: status.queueCount ?? queue.length,
      skippedCount: status.skippedCount ?? 0,
      isOnline: status.isOnline ?? false,
      cleanedDuplicates: status.cleanedDuplicates ?? 0,
    };
  }

  async getCurrentPatient(counterId: string): Promise<any | null> {
    const currentRaw = await this.redis.getCurrentPatient(counterId);
    return this.mapTicketForFrontend(
      currentRaw
        ? {
            ...currentRaw,
            status: (currentRaw as any).status || TicketStatus.SERVING,
          }
        : null,
    );
  }

  async rollbackPreviousPatient(counterId: string): Promise<{
    ok: boolean;
    patient?: any;
    message?: string;
  }> {
    const startTime = Date.now();
    const oldQueue = await this.getCurrentQueue(counterId);

    const [currentRaw, lastServedRaw] = await Promise.all([
      this.redis.getCurrentPatient(counterId),
      this.redis.getLastServedPatient(counterId),
    ]);

    if (!lastServedRaw) {
      return {
        ok: false,
        message: 'No previous patient available for rollback',
      };
    }

    if (currentRaw && (currentRaw as any)?.ticketId) {
      const queuedCurrent = {
        ...currentRaw,
        status: TicketStatus.WAITING,
      };
      await this.redis.pushToCounterQueue(counterId, queuedCurrent as any);
    }

    await this.redis.setCurrentPatient(counterId, null);

    // Normalize previous patient and remove any stale queue entries
    await this.redis.removeFromCounterQueue(counterId, lastServedRaw as any);

    const normalizedPrevious = {
      ...lastServedRaw,
      status: TicketStatus.SERVING,
      callCount: (lastServedRaw as any)?.callCount ?? 0,
    };

    await this.redis.setCurrentPatient(counterId, normalizedPrevious as any);
    await this.redis.setLastServedPatient(counterId, null);

    await this.updateNextPatientInQueue(counterId);

    const newQueue = await this.getCurrentQueue(counterId);
    await this.compareQueueAndNotify(counterId, 'NEXT_PATIENT', oldQueue, newQueue);

    const enableStreams = process.env.ENABLE_REDIS_STREAMS !== 'false';
    const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';

    try {
      await this.webSocket.sendToCounter(counterId, 'patient_rollback', {
        type: 'PATIENT_ROLLBACK',
        data: {
          counterId,
          currentPatient: normalizedPrevious,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[WebSocket] Patient rollback notification failed:', (err as Error).message);
    }

    if (enableStreams) {
      try {
        await this.redisStream.publishEventWithTimeout(streamKey, {
          type: 'PATIENT_ROLLBACK',
          counterId,
          currentPatient: JSON.stringify(normalizedPrevious),
          timestamp: new Date().toISOString(),
        }, 100);
      } catch (err) {
        console.warn('[Redis Stream] Patient rollback publish failed:', (err as Error).message);
      }
    }

    const patient = this.mapTicketForFrontend(normalizedPrevious);
    const totalDuration = Date.now() - startTime;
    console.log(`[ROLLBACK_PERF] rollbackPreviousPatient completed in ${totalDuration}ms`);

    return {
      ok: true,
      patient,
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
