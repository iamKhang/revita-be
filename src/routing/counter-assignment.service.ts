import {
  Injectable,
} from '@nestjs/common';
import { RedisStreamService, TicketStatus } from '../cache/redis-stream.service';
import { RedisService } from '../cache/redis.service';

@Injectable()
export class CounterAssignmentService {
  constructor(
    private readonly redisStream: RedisStreamService,
    private readonly redis: RedisService,
  ) {}


  async skipCurrentPatient(counterId: string): Promise<{
    ok: true;
    patient?: any;
    message?: string;
  }> {
    const startTime = Date.now();
    console.log(`[SKIP_PERF] skipCurrentPatient started for counter ${counterId} at ${new Date().toISOString()}`);
    
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
      const step3Duration = Date.now() - step3Start;
      const totalDuration = Date.now() - startTime;
      console.log(`[SKIP_PERF] Step 3 completed in ${step3Duration}ms`);
      console.log(`[SKIP_PERF] skipCurrentPatient completed in ${totalDuration}ms (patient removed after ${callCount} calls)`);
      
      return {
        ok: true,
        message: `Patient removed from queue after ${callCount} calls`,
        callCount,
      } as any;
    }
    
    // Nếu callCount <= 4, đánh dấu là SKIPPED và tăng callCount
    if (patientTicketId) {
      await this.updateTicketStatus(counterId, patientTicketId, TicketStatus.SKIPPED, callCount + 1);
    }
    
    const status = (result.patient as any)?.status || 'SKIPPED';
    const message = result.message ||
      (callCount >= 3
        ? 'Current patient will be removed after next skip'
        : 'Current patient marked SKIPPED and will be reinserted after 3 turns');

    const step3Duration = Date.now() - step3Start;
    const totalDuration = Date.now() - startTime;
    console.log(`[SKIP_PERF] Step 3 completed in ${step3Duration}ms`);
    console.log(`[SKIP_PERF] skipCurrentPatient completed in ${totalDuration}ms (patient: ${result.patient?.patientName || 'Unknown'})`);

    return {
      ok: true,
      patient: result.patient,
      message,
      // expose extended fields for client if needed
      ...(status ? { status } : {}),
      ...(callCount ? { callCount } : {}),
    } as any;
  }


  /**
   * Cập nhật status của ticket
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
      const members = await this.redis['redis'].zrange(queueKey, 0, -1);
      
      for (const member of members) {
        try {
          const ticket = JSON.parse(member);
          if (ticket.ticketId === ticketId) {
            // Cập nhật status và callCount
            ticket.status = status;
            if (callCount !== undefined) {
              ticket.callCount = callCount;
            }
            
            // Xóa ticket cũ và thêm ticket mới với status đã cập nhật
            await this.redis['redis'].zrem(queueKey, member);
            await this.redis['redis'].zadd(queueKey, -ticket.sequence, JSON.stringify(ticket));
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
   * Xóa ticket khỏi queue
   */
  private async removeTicketFromQueue(
    counterId: string,
    ticketId: string,
  ): Promise<void> {
    try {
      const queueKey = `counterQueueZ:${counterId}`;
      const members = await this.redis['redis'].zrange(queueKey, 0, -1);
      
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

    // Step 3: Update current patient status to COMPLETED (if any) and new patient to NEXT
    const step3Start = Date.now();
    console.log(`[PERF] Step 3: Updating patient status...`);
    
    // Cập nhật bệnh nhân hiện tại thành COMPLETED (nếu có)
    const currentPatient = await this.redis.getCurrentPatient(counterId);
    if (currentPatient) {
      const currentTicketId = (currentPatient as any)?.ticketId;
      if (currentTicketId) {
        await this.updateTicketStatus(counterId, currentTicketId, TicketStatus.COMPLETED);
      }
    }
    
    // Cập nhật bệnh nhân mới thành NEXT
    const patientTicketId = (result.patient as any)?.ticketId;
    if (patientTicketId) {
      await this.updateTicketStatus(counterId, patientTicketId, TicketStatus.NEXT);
    }
    
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

    const totalDuration = Date.now() - startTime;
    console.log(`[PERF] callNextPatient completed in ${totalDuration}ms (patient found: ${result.patient?.patientName || 'Unknown'})`);
    
    return { ok: true, patient: result.patient };
  }

}
