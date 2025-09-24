import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStreamService } from '../cache/redis-stream.service';
import { AssignCounterDto } from './dto/assign-counter.dto';
import { ScanInvoiceDto } from './dto/scan-invoice.dto';
import { DirectAssignmentDto } from './dto/direct-assignment.dto';
import { SimpleAssignmentDto } from './dto/simple-assignment.dto';
import { RedisService } from '../cache/redis.service';

export type AssignedCounter = {
  counterId: string;
  counterCode: string;
  counterName: string;
  receptionistId?: string;
  receptionistName?: string;
  priorityScore: number;
  estimatedWaitTime: number; // phút
};

export type CounterStatus = {
  counterId: string;
  counterCode: string;
  counterName: string;
  location?: string;
  isAvailable: boolean;
  currentQueueLength: number;
  averageProcessingTime: number; // phút
  lastAssignedAt?: string;
  receptionistId?: string;
  receptionistName?: string;
  isOnline: boolean;
};

@Injectable()
export class CounterAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisStream: RedisStreamService,
    private readonly redis: RedisService,
  ) {}

  async setCounterOnline(counterId: string): Promise<{ ok: true }> {
    await this.redis.setCounterOnline(counterId, 60);
    return { ok: true };
  }

  async setCounterOffline(counterId: string): Promise<{ ok: true }> {
    await this.redis.setCounterOffline(counterId);
    return { ok: true };
  }

  async clearCounterQueue(counterId: string): Promise<{ ok: true }> {
    await this.redis.clearCounterQueue(counterId);
    // Reset sequence khi clear queue
    await this.redis.resetCounterSequence(counterId);
    return { ok: true };
  }

  async assignReceptionistToCounter(
    counterId: string,
    receptionistId: string,
  ): Promise<{ ok: true }> {
    const counter = await this.prisma.counter.findUnique({
      where: { id: counterId },
    });

    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    const receptionist = await this.prisma.receptionist.findUnique({
      where: { id: receptionistId },
      include: { auth: true },
    });

    if (!receptionist) {
      throw new NotFoundException('Receptionist not found');
    }

    await this.prisma.counter.update({
      where: { id: counterId },
      data: { receptionistId },
    });

    return { ok: true };
  }

  async unassignReceptionistFromCounter(
    counterId: string,
  ): Promise<{ ok: true }> {
    const counter = await this.prisma.counter.findUnique({
      where: { id: counterId },
    });

    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    await this.prisma.counter.update({
      where: { id: counterId },
      data: { receptionistId: null },
    });

    return { ok: true };
  }

  async getCounterQueue(counterId: string): Promise<any[]> {
    // Use cleanup method to remove duplicates and get clean data
    const status = await this.redis.getQueueStatusWithCleanup(counterId);
    
    // Log if duplicates were found and cleaned
    if (status.cleanedDuplicates > 0) {
      console.log(`[Counter ${counterId}] Cleaned ${status.cleanedDuplicates} duplicate entries from queue`);
    }
    
    return status.queue;
  }

  async getCurrentPatient(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    // Use fallback method for better performance
    return await this.redis.getCurrentPatientWithFallback(counterId);
  }

  async getQueueStatus(counterId: string): Promise<{
    current: Record<string, unknown> | null;
    queue: Record<string, unknown>[];
    history: Record<string, unknown>[];
    skipped: Record<string, unknown>[];
    queueCount: number;
    skippedCount: number;
    isOnline: boolean;
    cleanedDuplicates?: number;
  }> {
    // Use cleanup method to remove duplicates and get clean data
    const status = await this.redis.getQueueStatusWithCleanup(counterId);
    
    // Log if duplicates were found and cleaned
    if (status.cleanedDuplicates > 0) {
      console.log(`[Counter ${counterId}] Cleaned ${status.cleanedDuplicates} duplicate entries from queue status`);
    }
    
    // Get skipped patients
    const skipped = await this.redis.getSkippedQueue(counterId);
    
    return {
      current: status.current,
      queue: status.queue,
      history: [], // TODO: Implement history if needed
      skipped,
      queueCount: status.queueCount,
      skippedCount: status.skippedCount,
      isOnline: status.isOnline,
      cleanedDuplicates: status.cleanedDuplicates,
    };
  }

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

    // Step 3: Process response
    const step3Start = Date.now();
    const callCount = Number((result.patient as any)?.callCount || 0);
    const status = (result.patient as any)?.status || 'MISSED';
    
    // Use the message from Redis operation
    const message = result.message || 
      (callCount >= 5
        ? 'Current patient cancelled after 5 calls'
        : 'Current patient marked MISSED and will be reinserted after 3 turns');

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

  async recallSkippedPatient(counterId: string): Promise<{
    ok: true;
    patient?: any;
    message?: string;
  }> {
    const recalledPatient = await this.redis.recallSkippedPatient(counterId);

    if (!recalledPatient) {
      return {
        ok: true,
        message: 'No skipped patients to recall',
      };
    }

    // Publish to Redis Stream
    const topic =
      process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
    try {
      await this.redisStream.publishEvent(topic, {
        type: 'SKIPPED_PATIENT_RECALLED',
        counterId,
        patient: JSON.stringify(recalledPatient),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn(
        '[Redis Stream] Skipped patient recall publish failed:',
        (err as Error).message,
      );
    }

    return {
      ok: true,
            patient: JSON.stringify(recalledPatient),
      message: 'Skipped patient recalled successfully',
    };
  }

  async returnCurrentPatientToQueue(counterId: string): Promise<{
    ok: true;
    patient?: any;
    message?: string;
  }> {
    const returnedPatient =
      await this.redis.returnCurrentPatientToQueue(counterId);

    if (!returnedPatient) {
      return {
        ok: true,
        message: 'No current patient to return to queue',
      };
    }

    // Publish to Redis Stream
    const topic =
      process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
    try {
      await this.redisStream.publishEvent(topic, {
            type: 'CURRENT_PATIENT_RETURNED',
            counterId,
            patient: returnedPatient,
            timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn(
        '[Redis Stream] Current patient return publish failed:',
        (err as Error).message,
      );
    }

    return {
      ok: true,
      patient: returnedPatient,
      message: 'Current patient returned to queue successfully',
    };
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

    // Step 3: Publish to Redis Stream
    const step3Start = Date.now();
    // Step 3: Publish to Redis Stream (with option to disable)
    const enableStreams = process.env.ENABLE_REDIS_STREAMS !== 'false';
    if (enableStreams) {
      console.log(`[PERF] Step 3: Publishing to Redis Stream with timeout...`);
      const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
      try {
        const messageId = await this.redisStream.publishEventWithTimeout(streamKey, {
          type: 'NEXT_PATIENT_CALLED',
          counterId,
          patient: JSON.stringify(result.patient),
          timestamp: new Date().toISOString(),
        }, 100); // Reduced timeout to 100ms
        
        const step3Duration = Date.now() - step3Start;
        console.log(`[PERF] Step 3 completed in ${step3Duration}ms (stream published: ${messageId ? 'success' : 'timeout'})`);
      } catch (err) {
        const step3Duration = Date.now() - step3Start;
        console.warn(
          `[PERF] Step 3 completed in ${step3Duration}ms (stream publish failed):`,
          (err as Error).message,
        );
      }
    } else {
      const step3Duration = Date.now() - step3Start;
      console.log(`[PERF] Step 3 skipped in ${step3Duration}ms (Redis Streams disabled)`);
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[PERF] callNextPatient completed in ${totalDuration}ms (patient found: ${result.patient?.patientName || 'Unknown'})`);
    
    return { ok: true, patient: result.patient };
  }

  async returnPreviousPatient(counterId: string): Promise<{
    ok: true;
    patient?: any;
    message?: string;
  }> {
    // Use optimized method for better performance
    const result = await this.redis.returnToPreviousPatientOptimized(counterId);

    if (!result.success) {
      return {
        ok: true,
        message: result.message || 'No current patient to return to queue',
      };
    }

    // Publish to Redis Stream
    const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
    try {
      await this.redisStream.publishEvent(streamKey, {
        type: 'CURRENT_PATIENT_RETURNED',
        counterId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn(
        '[Redis Stream] Current patient return publish failed:',
        (err as Error).message,
      );
    }

    return {
      ok: true,
      message: 'Current patient returned to queue successfully',
    };
  }

  /**
   * Rollback: Gọi lại bệnh nhân trước đó (nếu có lỗi khi nhấn next)
   */
  async rollbackPreviousPatient(counterId: string): Promise<{ ok: true; patient?: any; message?: string }> {
    const startTime = Date.now();
    console.log(`[PERF] rollbackPreviousPatient started for counter ${counterId} at ${new Date().toISOString()}`);
    
    // Step 1: Check if there's a current patient
    const currentPatient = await this.redis.getCurrentPatient(counterId);
    
    if (currentPatient) {
      const totalDuration = Date.now() - startTime;
      console.log(`[PERF] rollbackPreviousPatient completed in ${totalDuration}ms (already has current patient)`);
      return { 
        ok: true, 
        message: 'Counter already has a current patient. Use skip or mark-served first.',
        patient: currentPatient 
      };
    }

    // Step 2: Get the last served patient from history
    const lastServed = await this.redis.getLastServedPatient(counterId);
    
    if (!lastServed) {
      const totalDuration = Date.now() - startTime;
      console.log(`[PERF] rollbackPreviousPatient completed in ${totalDuration}ms (no previous patient)`);
      return { 
        ok: true, 
        message: 'No previous patient found to rollback to' 
      };
    }

    // Step 3: Set the last served patient as current again
    await this.redis.setCurrentPatient(counterId, lastServed);
    
    // Step 4: Publish rollback event
    const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
    try {
      await this.redisStream.publishEventWithTimeout(streamKey, {
        type: 'PATIENT_ROLLBACK',
        counterId,
        patient: JSON.stringify(lastServed),
        timestamp: new Date().toISOString(),
      }, 100);
    } catch (err) {
      console.warn('Failed to publish rollback event:', (err as Error).message);
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[PERF] rollbackPreviousPatient completed in ${totalDuration}ms (patient: ${lastServed?.patientName || 'Unknown'})`);

    return { 
      ok: true, 
      patient: lastServed,
      message: 'Successfully rolled back to previous patient'
    };
  }

  async goBackToPreviousPatient(counterId: string): Promise<{
    ok: true;
    patient?: any;
    message?: string;
  }> {
    // Quay lại bệnh nhân trước đó từ history
    const previousPatient = await this.redis.goBackToPreviousPatient(counterId);

    if (!previousPatient) {
      return {
        ok: true,
        message: 'No previous patients in history',
      };
    }

    // Publish to Redis Stream
    const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
    try {
      await this.redisStream.publishEvent(streamKey, {
        type: 'GO_BACK_PREVIOUS_PATIENT',
        counterId,
        patient: JSON.stringify(previousPatient),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn(
        '[Redis Stream] Go back previous patient publish failed:',
        (err as Error).message,
      );
    }

    return {
      ok: true,
      patient: previousPatient,
      message: 'Previous patient recalled successfully',
    };
  }

  /**
   * Mark current patient as served/completed
   */
  async markPatientServed(counterId: string): Promise<{
    ok: true;
    patient?: any;
    message?: string;
  }> {
    const currentPatient = await this.redis.getCurrentPatient(counterId);
    
    if (!currentPatient) {
      return {
        ok: true,
        message: 'No current patient to mark as served',
      };
    }

    // Clear current patient
    await this.redis.setCurrentPatient(counterId, null);

    // Publish to Redis Stream
    const streamKey = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
    try {
      await this.redisStream.publishEvent(streamKey, {
        type: 'PATIENT_SERVED',
        counterId,
        patient: JSON.stringify(currentPatient),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn(
        '[Redis Stream] Patient served publish failed:',
        (err as Error).message,
      );
    }

    return {
      ok: true,
      patient: currentPatient,
      message: 'Patient marked as served successfully',
    };
  }

  /**
   * Clean up duplicate entries in queue
   */
  async cleanupQueue(counterId: string): Promise<{
    ok: true;
    cleanedDuplicates: number;
    message: string;
  }> {
    const cleanedDuplicates = await this.redis.cleanupCounterQueueDuplicates(counterId);
    
    return {
      ok: true,
      cleanedDuplicates,
      message: `Cleaned ${cleanedDuplicates} duplicate entries from queue`,
    };
  }

  /**
   * Debug queue information
   */
  async debugQueue(counterId: string): Promise<{
    queueCount: number;
    rawQueueData: any[];
    currentPatient: any;
    isOnline: boolean;
    duplicates: string[];
  }> {
    const key = `counterQueueZ:${counterId}`;
    const rawMembers = await this.redis['redis'].zrange(key, 0, -1);
    
    // Analyze duplicates
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    
    const rawQueueData = rawMembers.map(member => {
      try {
        const item = JSON.parse(member);
        const uniqueId = item.ticketId || item.appointmentId || `${item.patientName}-${item.sequence}`;
        
        if (seen.has(uniqueId)) {
          duplicates.push(uniqueId);
          seen.set(uniqueId, seen.get(uniqueId)! + 1);
        } else {
          seen.set(uniqueId, 1);
        }
        
        return item;
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    const currentPatient = await this.redis.getCurrentPatient(counterId);
    const isOnline = await this.redis.isCounterOnline(counterId);
    
    return {
      queueCount: rawQueueData.length,
      rawQueueData,
      currentPatient,
      isOnline,
      duplicates,
    };
  }

  /**
   * Test skip logic
   */
  async testSkipLogic(counterId: string): Promise<{
    beforeSkip: any;
    afterSkip: any;
    skipResult: any;
  }> {
    // Get status before skip
    const beforeSkip = await this.debugQueue(counterId);
    
    // Try to skip current patient
    const skipResult = await this.skipCurrentPatient(counterId);
    
    // Get status after skip
    const afterSkip = await this.debugQueue(counterId);
    
    return {
      beforeSkip,
      afterSkip,
      skipResult,
    };
  }

  /**
   * Check Redis health and performance
   */
  async checkRedisHealth(counterId: string): Promise<{
    redisPing: number;
    queueLength: number;
    queueLengthTime: number;
    simpleSetGet: number;
    pipelineTest: number;
    streamTest: number;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    // Test 1: Redis PING
    const pingStart = Date.now();
    await this.redis['redis'].ping();
    const redisPing = Date.now() - pingStart;
    
    // Test 2: Queue length check
    const queueStart = Date.now();
    const queueLength = await this.redis.getCounterQueueLength(counterId);
    const queueLengthTime = Date.now() - queueStart;
    
    // Test 3: Simple SET/GET
    const setGetStart = Date.now();
    const testKey = `health_test:${counterId}:${Date.now()}`;
    await this.redis['redis'].set(testKey, 'test_value');
    await this.redis['redis'].get(testKey);
    await this.redis['redis'].del(testKey);
    const simpleSetGet = Date.now() - setGetStart;
    
    // Test 4: Pipeline test
    const pipelineStart = Date.now();
    const pipeline = this.redis['redis'].pipeline();
    pipeline.ping();
    pipeline.ping();
    pipeline.ping();
    await pipeline.exec();
    const pipelineTest = Date.now() - pipelineStart;
    
    // Test 5: Stream test
    const streamStart = Date.now();
    const streamKey = `health_test_stream:${counterId}`;
    try {
      await this.redis['redis'].xadd(streamKey, '*', 'test', 'value');
      await this.redis['redis'].xtrim(streamKey, 'MAXLEN', 0); // Clear stream
    } catch (err) {
      console.warn('Stream test failed:', err);
    }
    const streamTest = Date.now() - streamStart;
    
    // Generate recommendations
    if (redisPing > 100) {
      recommendations.push('Redis PING is slow (>100ms) - check network connection');
    }
    if (queueLengthTime > 500) {
      recommendations.push('Queue length check is very slow (>500ms) - Redis may be overloaded');
    }
    if (simpleSetGet > 200) {
      recommendations.push('Simple Redis operations are slow (>200ms) - Redis server issues');
    }
    if (pipelineTest > 300) {
      recommendations.push('Pipeline operations are slow (>300ms) - Redis performance issues');
    }
    if (streamTest > 500) {
      recommendations.push('Stream operations are slow (>500ms) - Redis Streams performance issues');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Redis performance looks good!');
    }
    
    return {
      redisPing,
      queueLength,
      queueLengthTime,
      simpleSetGet,
      pipelineTest,
      streamTest,
      recommendations,
    };
  }

  /**
   * Test performance with different configurations
   */
  async testPerformance(counterId: string): Promise<{
    withStreams: number;
    withoutStreams: number;
    withTimeout: number;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    // Test 1: With Redis Streams enabled
    const withStreamsStart = Date.now();
    const originalStreams = process.env.ENABLE_REDIS_STREAMS;
    process.env.ENABLE_REDIS_STREAMS = 'true';
    
    try {
      await this.callNextPatient(counterId);
    } catch (err) {
      console.warn('Test with streams failed:', err);
    }
    const withStreams = Date.now() - withStreamsStart;
    
    // Test 2: Without Redis Streams
    const withoutStreamsStart = Date.now();
    process.env.ENABLE_REDIS_STREAMS = 'false';
    
    try {
      await this.callNextPatient(counterId);
    } catch (err) {
      console.warn('Test without streams failed:', err);
    }
    const withoutStreams = Date.now() - withoutStreamsStart;
    
    // Test 3: With timeout (already implemented in callNextPatient)
    const withTimeoutStart = Date.now();
    process.env.ENABLE_REDIS_STREAMS = 'true';
    
    try {
      await this.callNextPatient(counterId);
    } catch (err) {
      console.warn('Test with timeout failed:', err);
    }
    const withTimeout = Date.now() - withTimeoutStart;
    
    // Restore original setting
    process.env.ENABLE_REDIS_STREAMS = originalStreams;
    
    // Generate recommendations
    if (withStreams > withoutStreams * 2) {
      recommendations.push('Redis Streams are significantly slowing down the API. Consider disabling them temporarily.');
    }
    if (withTimeout < withStreams * 0.8) {
      recommendations.push('Timeout mechanism is helping. Consider reducing timeout further.');
    }
    if (withoutStreams < 500) {
      recommendations.push('Performance without Redis Streams is good. Streams may be the bottleneck.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Performance looks acceptable across all configurations.');
    }
    
    return {
      withStreams,
      withoutStreams,
      withTimeout,
      recommendations,
    };
  }

  /**
   * Redis benchmark test
   */
  async redisBenchmark(): Promise<{
    simplePing: number;
    simpleSetGet: number;
    pipelineTest: number;
    streamTest: number;
    luaScriptTest: number;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    // Test 1: Simple PING
    const pingStart = Date.now();
    await this.redis['redis'].ping();
    const simplePing = Date.now() - pingStart;
    
    // Test 2: Simple SET/GET
    const setGetStart = Date.now();
    const testKey = `benchmark_test:${Date.now()}`;
    await this.redis['redis'].set(testKey, 'test_value');
    await this.redis['redis'].get(testKey);
    await this.redis['redis'].del(testKey);
    const simpleSetGet = Date.now() - setGetStart;
    
    // Test 3: Pipeline test
    const pipelineStart = Date.now();
    const pipeline = this.redis['redis'].pipeline();
    for (let i = 0; i < 10; i++) {
      pipeline.ping();
    }
    await pipeline.exec();
    const pipelineTest = Date.now() - pipelineStart;
    
    // Test 4: Stream test
    const streamStart = Date.now();
    const streamKey = `benchmark_stream:${Date.now()}`;
    try {
      await this.redis['redis'].xadd(streamKey, '*', 'test', 'value');
      await this.redis['redis'].xtrim(streamKey, 'MAXLEN', 0); // Clear stream
    } catch (err) {
      console.warn('Stream benchmark failed:', err);
    }
    const streamTest = Date.now() - streamStart;
    
    // Test 5: Lua script test
    const luaStart = Date.now();
    await this.redis['redis'].eval(`
      return redis.call('PING')
    `, 0);
    const luaScriptTest = Date.now() - luaStart;
    
    // Generate recommendations
    if (simplePing > 10) {
      recommendations.push(`Simple PING is slow (${simplePing}ms) - check Redis connection`);
    }
    if (simpleSetGet > 20) {
      recommendations.push(`Simple SET/GET is slow (${simpleSetGet}ms) - check Redis performance`);
    }
    if (pipelineTest > 50) {
      recommendations.push(`Pipeline test is slow (${pipelineTest}ms) - check Redis pipeline performance`);
    }
    if (streamTest > 100) {
      recommendations.push(`Stream test is slow (${streamTest}ms) - check Redis Streams performance`);
    }
    if (luaScriptTest > 30) {
      recommendations.push(`Lua script test is slow (${luaScriptTest}ms) - check Redis Lua performance`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Redis performance looks good for basic operations');
    }
    
    return {
      simplePing,
      simpleSetGet,
      pipelineTest,
      streamTest,
      luaScriptTest,
      recommendations,
    };
  }

  private calculatePriorityScore(patient: AssignCounterDto): number {
    let score = 0;

    // Ưu tiên cao cho Khám VIP
    if (patient.isVIP) {
      score += 800;
    }

    // Ưu tiên cho người cao tuổi (>70)
    if (patient.isElderly || (patient.patientAge && patient.patientAge > 70)) {
      score += 500;
    }

    // Ưu tiên cho phụ nữ có thai
    if (patient.isPregnant) {
      score += 400;
    }

    // Ưu tiên cho người khuyết tật
    if (patient.isDisabled) {
      score += 300;
    }

    // Ưu tiên cho VIP
    if (patient.isVIP) {
      score += 200;
    }

    // Ưu tiên theo độ tuổi (người già hơn)
    if (patient.patientAge) {
      if (patient.patientAge >= 60) score += 100;
      else if (patient.patientAge >= 50) score += 50;
      else if (patient.patientAge >= 40) score += 25;
    }

    // Ưu tiên theo priority level
    switch (patient.priorityLevel) {
      case 'HIGH':
        score += 150;
        break;
      case 'MEDIUM':
        score += 75;
        break;
      case 'LOW':
        score += 25;
        break;
    }

    return score;
  }

  async getAllCounters(): Promise<any[]> {
    const counters = await this.prisma.counter.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        counterCode: 'asc',
      },
    });

    return counters.map(counter => ({
      counterId: counter.id,
      counterCode: counter.counterCode,
      counterName: counter.counterName,
      location: counter.location,
    }));
  }

  async getAvailableCounters(): Promise<CounterStatus[]> {
    // Lấy danh sách tất cả counters
    const counters = await this.prisma.counter.findMany({
      include: {
        receptionist: {
          include: {
            auth: true,
          },
        },
      },
    });

    const counterStatuses: CounterStatus[] = [];

    for (const counter of counters) {
      const isOnline = await this.redis.isCounterOnline(counter.id);
      const currentQueueLength = await this.redis.getCounterQueueLength(
        counter.id,
      );
      const isAvailable = isOnline && currentQueueLength < counter.maxQueue;
      const averageProcessingTime = 15; // có thể tinh chỉnh theo thực tế

      counterStatuses.push({
        counterId: counter.id,
        counterCode: counter.counterCode,
        counterName: counter.counterName,
        location: counter.location || undefined,
        isAvailable,
        currentQueueLength,
        averageProcessingTime,
        lastAssignedAt: undefined,
        receptionistId: counter.receptionistId || undefined,
        receptionistName: counter.receptionist?.auth?.name || undefined,
        isOnline,
      });
    }

    return counterStatuses;
  }

  async assignPatientToCounter(
    request: AssignCounterDto,
  ): Promise<AssignedCounter> {
    // Verify appointment exists
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: request.appointmentId },
      include: {
        patientProfile: true,
        service: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Verify invoice exists
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: request.invoiceId },
      include: {
        patientProfile: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Find appointment for this patient profile
    const appointmentForProfile = await this.prisma.appointment.findFirst({
      where: {
        patientProfileId: invoice.patientProfileId,
        id: request.appointmentId,
      },
      include: {
        patientProfile: true,
        service: true,
      },
    });

    if (!appointmentForProfile) {
      throw new NotFoundException('Appointment not found for this invoice');
    }

    // Lấy thông tin bệnh nhân
    const patientName =
      request.patientName ||
      appointmentForProfile.patientProfile.name ||
      'Unknown';

    const patientAge =
      request.patientAge ||
      this.calculateAge(appointmentForProfile.patientProfile.dateOfBirth);

    // Tính điểm ưu tiên
    const priorityScore = this.calculatePriorityScore({
      ...request,
      patientAge,
    });

    // Lấy danh sách quầy có sẵn (dựa trên online + queue hiện tại)
    const availableCounters = await this.getAvailableCounters();
    const availableCountersFiltered = availableCounters.filter(
      (c) => c.isAvailable,
    );

    if (availableCountersFiltered.length === 0) {
      throw new NotFoundException('No available counters at the moment');
    }

    // Chấm điểm và chọn ngẫu nhiên trong các quầy có điểm cao nhất
    let bestScore = -1;
    const scored: Array<{ score: number; counter: CounterStatus }> = [];
    for (const counter of availableCountersFiltered) {
      const queueScore = Math.max(0, 10 - counter.currentQueueLength) * 10; // Ít hàng đợi = điểm cao hơn
      const processingScore =
        Math.max(0, 30 - counter.averageProcessingTime) * 2; // Xử lý nhanh = điểm cao hơn
      const totalScore = queueScore + processingScore;
      scored.push({ score: totalScore, counter });
      if (totalScore > bestScore) bestScore = totalScore;
    }
    const bestCandidates = scored
      .filter((s) => s.score === bestScore)
      .map((s) => s.counter);
    const bestCounter =
      bestCandidates[Math.floor(Math.random() * bestCandidates.length)];

    // Lấy thông tin counter
    const counter = await this.prisma.counter.findUnique({
      where: { id: bestCounter.counterId },
      include: {
        receptionist: {
          include: { auth: true },
        },
      },
    });

    if (!counter) {
      throw new NotFoundException('Selected counter not found');
    }

    // Tạo assignment
    const assignedCounter: AssignedCounter = {
      counterId: counter.id,
      counterCode: counter.counterCode,
      counterName: counter.counterName,
      receptionistId: counter.receptionistId || undefined,
      receptionistName: counter.receptionist?.auth?.name || undefined,
      priorityScore,
      estimatedWaitTime:
        bestCounter.currentQueueLength * bestCounter.averageProcessingTime,
    };

    // Publish to Redis Stream
    const topic =
      process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
    try {
      await this.redisStream.publishEvent(topic, {
            type: 'PATIENT_ASSIGNED_TO_COUNTER',
            appointmentId: request.appointmentId,
            patientProfileId: request.patientProfileId,
            invoiceId: request.invoiceId,
            patientName,
            patientAge: patientAge.toString(),
            patientGender:
              request.patientGender ||
              appointmentForProfile.patientProfile.gender,
            priorityScore: priorityScore.toString(),
            assignedCounter,
            serviceName: appointmentForProfile.service?.name || 'Unknown',
            servicePrice: (appointmentForProfile.service?.price || 0).toString(),
            timestamp: new Date().toISOString(),
            isPregnant: request.isPregnant?.toString() || 'false',
            isElderly: request.isElderly?.toString() || 'false',
            isDisabled: request.isDisabled?.toString() || 'false',
            isVIP: request.isVIP?.toString() || 'false',
            priorityLevel: request.priorityLevel || 'MEDIUM',
            notes: request.notes || '',
      });
    } catch (err) {
      console.warn(
        '[Redis Stream] Counter assignment publish failed:',
        (err as Error).message,
      );
    }

    // Push to runtime queue (optional for real appointments)
    const sequence = await this.redis.getNextCounterSequence(counter.id);
    await this.redis.pushToCounterQueue(counter.id, {
      appointmentId: request.appointmentId,
      patientName,
      priorityScore,
      estimatedWaitTime: assignedCounter.estimatedWaitTime,
      assignedAt: new Date().toISOString(),
      sequence: sequence,
      isPriority:
        request.isVIP ||
        request.isPregnant ||
        request.isElderly ||
        request.isDisabled ||
        request.priorityLevel === 'HIGH',
    });

    return assignedCounter;
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  private extractInvoiceIdFromQr(qrCode: string): string | null {
    try {
      const obj = JSON.parse(qrCode) as Record<string, unknown>;
      const idLike = (obj['invoiceId'] || obj['id'] || obj['invoice_id']) as
        | string
        | undefined;
      if (idLike && typeof idLike === 'string') return idLike;
    } catch {
      // ignore parse error and fallback to regex
    }
    const match = qrCode.match(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/,
    );
    return match ? match[0] : null;
  }

  private async buildQueueNumberForCounter(
    counterCode: string,
    counterId: string,
  ): Promise<string> {
    const seq = await this.redis.getNextCounterSequence(counterId);
    const padded = String(seq).padStart(3, '0');
    return `${counterCode}-${padded}`;
  }

  async scanInvoiceAndAssign(request: ScanInvoiceDto): Promise<{
    success: true;
    assignment: AssignedCounter;
    queueNumber: string;
    patientInfo: {
      name: string;
      age: number;
      gender: string;
      appointmentDetails: any;
    };
  }> {
    // Lấy invoiceId từ QR
    const invoiceId = this.extractInvoiceIdFromQr(request.qrCode);
    if (!invoiceId) {
      throw new BadRequestException('QR code không hợp lệ');
    }

    // Tìm hóa đơn
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        patientProfile: {
          include: {
            patient: {
              include: { auth: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.paymentStatus !== 'PAID') {
      throw new BadRequestException('Invoice must be paid before assignment');
    }

    // Find appointment for this patient profile
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        patientProfileId: invoice.patientProfileId,
      },
      include: {
        patientProfile: {
          include: {
            patient: {
              include: { auth: true },
            },
          },
        },
        service: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found for this invoice');
    }

    // Tính tuổi bệnh nhân
    const patientAge = this.calculateAge(
      appointment.patientProfile.dateOfBirth,
    );
    const patientName =
      appointment.patientProfile.name ||
      appointment.patientProfile.patient?.auth?.name ||
      'Unknown';

    // Tự động xác định các đặc điểm ưu tiên
    const isElderly = patientAge > 70;
    const emergencyContact = appointment.patientProfile
      .emergencyContact as unknown as { pregnancyStatus?: string } | null;
    const isPregnant =
      appointment.patientProfile.gender === 'FEMALE' &&
      emergencyContact?.pregnancyStatus === 'PREGNANT';

    // Tạo request assignment
    const assignmentRequest: AssignCounterDto = {
      appointmentId: appointment.id,
      patientProfileId: appointment.patientProfileId,
      invoiceId: invoice.id,
      patientName,
      patientAge,
      patientGender: appointment.patientProfile.gender,
      isElderly,
      isPregnant,
      isDisabled: false, // Cần logic để xác định
      isVIP: false, // Cần logic để xác định
      priorityLevel: isElderly || isPregnant ? 'HIGH' : 'MEDIUM',
      notes: `Scanned by: ${request.scannedBy || 'Unknown'}`,
    };

    // Thực hiện phân bổ (hàm này đã push queue nếu cần)
    const assignment = await this.assignPatientToCounter(assignmentRequest);

    // Sinh số thứ tự theo quầy và lưu kèm vào queue item
    const sequence = await this.redis.getNextCounterSequence(
      assignment.counterId,
    );
    const queueNumber = `${assignment.counterCode}-${String(sequence).padStart(3, '0')}`;
    await this.redis.pushToCounterQueue(assignment.counterId, {
      appointmentId: assignmentRequest.appointmentId,
      patientName,
      priorityScore: assignment.priorityScore,
      estimatedWaitTime: assignment.estimatedWaitTime,
      assignedAt: new Date().toISOString(),
      queueNumber,
      sequence: sequence,
      isPriority:
        assignmentRequest.isVIP ||
        assignmentRequest.isPregnant ||
        assignmentRequest.isElderly ||
        assignmentRequest.isDisabled ||
        assignmentRequest.priorityLevel === 'HIGH',
    });

    return {
      success: true,
      assignment,
      queueNumber,
      patientInfo: {
        name: patientName,
        age: patientAge,
        gender: appointment.patientProfile.gender,
        appointmentDetails: {
          serviceName: appointment.service?.name || 'Unknown',
          servicePrice: appointment.service?.price || 0,
          appointmentDate: appointment.date,
          appointmentTime: appointment.startTime,
        },
      },
    };
  }

  async assignDirectPatient(request: DirectAssignmentDto): Promise<{
    success: true;
    assignment: AssignedCounter;
    patientInfo: {
      name: string;
      age: number;
      gender: string;
      serviceName?: string;
      servicePrice?: number;
    };
  }> {
    // Tự động xác định các đặc điểm ưu tiên
    const isElderly = request.isElderly || request.patientAge > 70;
    const isPregnant = request.isPregnant || false;

    // Tính điểm ưu tiên
    const priorityScore = this.calculatePriorityScore({
      appointmentId: `direct-${Date.now()}`,
      patientProfileId: `direct-${Date.now()}`,
      invoiceId: `direct-${Date.now()}`,
      patientName: request.patientName,
      patientAge: request.patientAge,
      patientGender: request.patientGender,
      isElderly,
      isPregnant,
      isDisabled: request.isDisabled || false,
      isVIP: request.isVIP || false,
      priorityLevel:
        request.priorityLevel || (isElderly || isPregnant ? 'HIGH' : 'MEDIUM'),
      notes: `Direct assignment by: ${request.assignedBy || 'Unknown'}`,
    });

    // Lấy danh sách quầy và chọn quầy tốt nhất (dựa trên online + queue)
    const availableCounters = await this.getAvailableCounters();
    const availableCountersFiltered = availableCounters.filter(
      (c) => c.isAvailable,
    );
    if (availableCountersFiltered.length === 0) {
      throw new NotFoundException('No available counters at the moment');
    }
    let bestScore = -1;
    const scoredDirect: Array<{ score: number; counter: CounterStatus }> = [];
    for (const counter of availableCountersFiltered) {
      const queueScore = Math.max(0, 10 - counter.currentQueueLength) * 10;
      const processingScore =
        Math.max(0, 30 - counter.averageProcessingTime) * 2;
      const totalScore = queueScore + processingScore;
      scoredDirect.push({ score: totalScore, counter });
      if (totalScore > bestScore) bestScore = totalScore;
    }
    const bestDirectCandidates = scoredDirect
      .filter((s) => s.score === bestScore)
      .map((s) => s.counter);
    const bestCounter =
      bestDirectCandidates[
        Math.floor(Math.random() * bestDirectCandidates.length)
      ];

    // Lấy thông tin counter
    const counter = await this.prisma.counter.findUnique({
      where: { id: bestCounter.counterId },
      include: {
        receptionist: {
          include: { auth: true },
        },
      },
    });
    if (!counter) {
      throw new NotFoundException('Selected counter not found');
    }

    // Tạo assignment
    const assignment: AssignedCounter = {
      counterId: counter.id,
      counterCode: counter.counterCode,
      counterName: counter.counterName,
      receptionistId: counter.receptionistId || undefined,
      receptionistName: counter.receptionist?.auth?.name || undefined,
      priorityScore,
      estimatedWaitTime:
        bestCounter.currentQueueLength * bestCounter.averageProcessingTime,
    };

    // Publish to Redis Stream
    const topic =
      process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
    try {
      await this.redisStream.publishEvent(topic, {
            type: 'PATIENT_ASSIGNED_TO_COUNTER',
            appointmentId: `direct-${Date.now()}`,
            patientProfileId: `direct-${Date.now()}`,
            invoiceId: `direct-${Date.now()}`,
            patientName: request.patientName,
            patientAge: request.patientAge,
            patientGender: request.patientGender,
            priorityScore: priorityScore.toString(),
            assignedCounter: JSON.stringify(assignment),
            serviceName: request.serviceName,
            servicePrice: (request.servicePrice || 0).toString(),
            timestamp: new Date().toISOString(),
            isPregnant: isPregnant.toString(),
            isElderly: isElderly.toString(),
            isDisabled: (request.isDisabled || false).toString(),
            isVIP: (request.isVIP || false).toString(),
            priorityLevel: request.priorityLevel || (isElderly || isPregnant ? 'HIGH' : 'MEDIUM'),
            notes: `Direct assignment by: ${request.assignedBy || 'Unknown'}`,
      });
    } catch (err) {
      console.warn(
        '[Redis Stream] Counter direct assignment publish failed:',
        (err as Error).message,
      );
    }

    // Push runtime queue entry
    const sequence = await this.redis.getNextCounterSequence(counter.id);
    await this.redis.pushToCounterQueue(counter.id, {
      appointmentId: `direct-${Date.now()}`,
      patientName: request.patientName,
      priorityScore,
      estimatedWaitTime: assignment.estimatedWaitTime,
      assignedAt: new Date().toISOString(),
      sequence: sequence,
      isPriority:
        request.isVIP ||
        request.isPregnant ||
        request.isElderly ||
        request.isDisabled ||
        request.priorityLevel === 'HIGH',
    });

    return {
      success: true,
      assignment,
      patientInfo: {
        name: request.patientName,
        age: request.patientAge,
        gender: request.patientGender,
        serviceName: request.serviceName,
        servicePrice: request.servicePrice,
      },
    };
  }

  async assignSimplePatient(request: SimpleAssignmentDto): Promise<{
    success: true;
    assignment: AssignedCounter;
    queueNumber: string;
  }> {
    const generatedAppointmentId = `simple-${Date.now()}`;
    const generatedProfileId = `simple-${Date.now()}`;
    const patientName = `Khách lẻ`;
    const patientAge = 0;
    const patientGender = 'UNKNOWN';

    const chosenPriority: 'HIGH' | 'MEDIUM' | 'LOW' =
      request.priorityLevel || 'LOW';

    // Điểm ưu tiên thấp nhất cho bốc số đơn thuần
    const priorityScore = this.calculatePriorityScore({
      appointmentId: generatedAppointmentId,
      patientProfileId: generatedProfileId,
      invoiceId: `simple-${Date.now()}`,
      patientName,
      patientAge,
      patientGender,
      isElderly: request.isElderly ?? false,
      isPregnant: request.isPregnant ?? false,
      isDisabled: request.isDisabled ?? false,
      isVIP: request.isVIP ?? false,
      priorityLevel: chosenPriority,
      notes: `Simple assignment by: ${request.assignedBy || 'Unknown'}`,
    });

    // Lấy danh sách quầy có sẵn và chọn quầy tốt nhất (dựa trên online + queue)
    const availableCounters = await this.getAvailableCounters();
    const availableCountersFiltered = availableCounters.filter(
      (c) => c.isAvailable,
    );
    if (availableCountersFiltered.length === 0) {
      throw new NotFoundException('No available counters at the moment');
    }
    let bestScore = -1;
    const scoredSimple: Array<{ score: number; counter: CounterStatus }> = [];
    for (const counter of availableCountersFiltered) {
      const queueScore = Math.max(0, 10 - counter.currentQueueLength) * 10;
      const processingScore =
        Math.max(0, 30 - counter.averageProcessingTime) * 2;
      const totalScore = queueScore + processingScore;
      scoredSimple.push({ score: totalScore, counter });
      if (totalScore > bestScore) bestScore = totalScore;
    }
    const bestSimpleCandidates = scoredSimple
      .filter((s) => s.score === bestScore)
      .map((s) => s.counter);
    const bestCounter =
      bestSimpleCandidates[
        Math.floor(Math.random() * bestSimpleCandidates.length)
      ];

    // Lấy thông tin counter
    const counter = await this.prisma.counter.findUnique({
      where: { id: bestCounter.counterId },
      include: {
        receptionist: {
          include: { auth: true },
        },
      },
    });
    if (!counter) {
      throw new NotFoundException('Selected counter not found');
    }

    // Get sequence once and use for both queueNumber and queue item
    const sequence = await this.redis.getNextCounterSequence(counter.id);
    const queueNumber = `${counter.counterCode}-${String(sequence).padStart(3, '0')}`;

    const assignment: AssignedCounter = {
      counterId: counter.id,
      counterCode: counter.counterCode,
      counterName: counter.counterName,
      receptionistId: counter.receptionistId || undefined,
      receptionistName: counter.receptionist?.auth?.name || undefined,
      priorityScore,
      estimatedWaitTime:
        bestCounter.currentQueueLength * bestCounter.averageProcessingTime,
    };

    // Publish to Redis Stream
    const topic =
      process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
    try {
      await this.redisStream.publishEvent(topic, {
            type: 'PATIENT_ASSIGNED_TO_COUNTER',
            appointmentId: generatedAppointmentId,
            patientProfileId: generatedProfileId,
            invoiceId: `simple-${Date.now()}`,
            patientName,
            patientAge: patientAge.toString(),
            patientGender,
            priorityScore: priorityScore.toString(),
            assignedCounter: JSON.stringify(assignment),
            timestamp: new Date().toISOString(),
            isPregnant: (request.isPregnant ?? false).toString(),
            isElderly: (request.isElderly ?? false).toString(),
            isDisabled: (request.isDisabled ?? false).toString(),
            isVIP: (request.isVIP ?? false).toString(),
            priorityLevel: chosenPriority,
            notes: `Simple assignment by: ${request.assignedBy || 'Unknown'}`,
      });
    } catch (err) {
      console.warn(
        '[Redis Stream] Counter simple assignment publish failed:',
        (err as Error).message,
      );
    }

    // Push runtime queue entry
    await this.redis.pushToCounterQueue(counter.id, {
      appointmentId: generatedAppointmentId,
      patientName,
      priorityScore,
      estimatedWaitTime: assignment.estimatedWaitTime,
      assignedAt: new Date().toISOString(),
      queueNumber,
      sequence: sequence,
      isPriority:
        (request.isVIP ?? false) ||
        (request.isPregnant ?? false) ||
        (request.isElderly ?? false) ||
        (request.isDisabled ?? false) ||
        chosenPriority === 'HIGH',
    });

    return {
      success: true,
      assignment,
      queueNumber,
    };
  }
}
