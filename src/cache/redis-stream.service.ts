import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export enum TicketStatus {
  WAITING = 'WAITING',      // Đang chờ
  SKIPPED = 'SKIPPED',      // Bỏ qua
  NEXT = 'NEXT',           // Tiếp theo
  SERVING = 'SERVING',     // Đang phục vụ
  COMPLETED = 'COMPLETED'   // Hoàn thành
}

export interface QueueTicket {
  ticketId: string;
  patientProfileCode?: string;
  appointmentCode?: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  counterId: string;
  counterCode: string;
  counterName: string;
  queueNumber: string;
  sequence: number;
  assignedAt: string;
  isOnTime?: boolean;
  status: TicketStatus;
  callCount: number;
  queuePriority: number;
  metadata: {
    isPregnant?: boolean;
    isDisabled?: boolean;
  };
}

@Injectable()
export class RedisStreamService {
  private readonly STREAM_KEY = 'queue:tickets';
  private readonly COUNTER_STREAM_PREFIX = 'counter:stream:';

  constructor(private readonly redis: RedisService) {}

  /**
   * Publish general events to Redis Stream
   */
  async publishEvent(streamKey: string, eventData: Record<string, any>): Promise<string> {
    const startTime = Date.now();
    
    // Step 1: Prepare data
    const prepareStart = Date.now();
    const flatData = Object.entries(eventData).flat();
    const prepareDuration = Date.now() - prepareStart;
    
    // Step 2: Use pipeline for Redis Stream publish
    const publishStart = Date.now();
    
    const pipeline = this.redis['redis'].pipeline();
    pipeline.xadd(streamKey, '*', ...flatData);
    
    const results = await pipeline.exec();
    const messageId = results?.[0]?.[1] as string;
    
    const publishDuration = Date.now() - publishStart;
    
    const totalDuration = Date.now() - startTime;
    
    return messageId;
  }

  /**
   * Publish event asynchronously (non-blocking)
   */
  async publishEventAsync(streamKey: string, eventData: Record<string, any>): Promise<void> {
    // Don't await - let it run in background
    setImmediate(async () => {
      try {
        const flatData = Object.entries(eventData).flat();
        await this.redis['redis'].xadd(streamKey, '*', ...flatData);
      } catch (err) {
        console.error(`[STREAM_ASYNC] Failed to publish to ${streamKey}:`, err);
      }
    });
  }

  /**
   * Publish event with timeout
   */
  async publishEventWithTimeout(streamKey: string, eventData: Record<string, any>, timeoutMs: number = 500): Promise<string | null> {
    const startTime = Date.now();
    
    try {
      const flatData = Object.entries(eventData).flat();
      
      // Use Promise.race to implement timeout
      const publishPromise = this.redis['redis'].xadd(streamKey, '*', ...flatData);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Stream publish timeout')), timeoutMs);
      });
      
      const messageId = await Promise.race([publishPromise, timeoutPromise]) as string;
      
      const duration = Date.now() - startTime;
      
      return messageId;
    } catch (err) {
      const duration = Date.now() - startTime;
      console.warn(`[STREAM_TIMEOUT] publishEventWithTimeout failed after ${duration}ms:`, (err as Error).message);
      
      // Auto-disable streams if they're consistently slow
      if (duration > timeoutMs * 0.8) {
        console.warn(`[STREAM_TIMEOUT] Streams are consistently slow. Consider setting ENABLE_REDIS_STREAMS=false`);
      }
      
      return null;
    }
  }

  /**
   * Thêm ticket vào Redis Stream
   */
  async addTicketToStream(ticket: QueueTicket): Promise<string> {
    const streamData = {
      ticketId: ticket.ticketId,
      patientProfileCode: ticket.patientProfileCode || '',
      appointmentCode: ticket.appointmentCode || '',
      patientName: ticket.patientName,
      patientAge: ticket.patientAge.toString(),
      patientGender: ticket.patientGender,
      counterId: ticket.counterId,
      counterCode: ticket.counterCode,
      counterName: ticket.counterName,
      queueNumber: ticket.queueNumber,
      sequence: ticket.sequence.toString(),
      assignedAt: ticket.assignedAt,
      isOnTime: ticket.isOnTime?.toString() || 'false',
      status: ticket.status,
      callCount: ticket.callCount.toString(),
      queuePriority: ticket.queuePriority.toString(),
      isPregnant: ticket.metadata.isPregnant?.toString() || 'false',
      isDisabled: ticket.metadata.isDisabled?.toString() || 'false',
    };

    // Thêm vào main stream
    const messageId = await this.redis['redis'].xadd(
      this.STREAM_KEY,
      '*',
      ...Object.entries(streamData).flat(),
    ) as string;

    // Thêm vào counter-specific stream
    const counterStreamKey = `${this.COUNTER_STREAM_PREFIX}${ticket.counterId}`;
    await this.redis['redis'].xadd(
      counterStreamKey,
      '*',
      ...Object.entries(streamData).flat(),
    );

    return messageId;
  }

  /**
   * Lấy danh sách tickets từ stream
   */
  async getTicketsFromStream(
    streamKey: string = this.STREAM_KEY,
    count: number = 10,
    startId: string = '-',
  ): Promise<any[]> {
    const result = await this.redis['redis'].xrange(
      streamKey,
      startId,
      '+',
      'COUNT',
      count,
    );

    return result.map(([id, fields]) => {
      const ticket: any = { id };
      for (let i = 0; i < fields.length; i += 2) {
        ticket[fields[i]] = fields[i + 1];
      }
      return ticket;
    });
  }

  /**
   * Lấy tickets mới từ stream (cho real-time)
   */
  async getNewTickets(
    streamKey: string = this.STREAM_KEY,
    lastId: string = '$',
    blockTime: number = 1000,
  ): Promise<any[]> {
    const result = await this.redis['redis'].xread(
      'BLOCK',
      blockTime,
      'STREAMS',
      streamKey,
      lastId,
    ) as any[];

    if (!result || result.length === 0) {
      return [];
    }

    const [, messages] = result[0] as [string, any[]];
    return messages.map(([id, fields]: [string, string[]]) => {
      const ticket: any = { id };
      for (let i = 0; i < fields.length; i += 2) {
        ticket[fields[i]] = fields[i + 1];
      }
      return ticket;
    });
  }

  /**
   * Lấy tickets của một counter cụ thể
   */
  async getCounterTickets(
    counterId: string,
    count: number = 10,
  ): Promise<any[]> {
    const counterStreamKey = `${this.COUNTER_STREAM_PREFIX}${counterId}`;
    return this.getTicketsFromStream(counterStreamKey, count);
  }

  /**
   * Lấy tickets mới của một counter (cho real-time)
   */
  async getNewCounterTickets(
    counterId: string,
    lastId: string = '$',
  ): Promise<any[]> {
    const counterStreamKey = `${this.COUNTER_STREAM_PREFIX}${counterId}`;
    return this.getNewTickets(counterStreamKey, lastId);
  }

  /**
   * Tạo consumer group cho stream
   */
  async createConsumerGroup(
    streamKey: string,
    groupName: string,
    startId: string = '0',
  ): Promise<void> {
    try {
      await this.redis['redis'].xgroup(
        'CREATE',
        streamKey,
        groupName,
        startId,
        'MKSTREAM',
      );
    } catch (error) {
      // Group đã tồn tại, bỏ qua lỗi
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  /**
   * Đọc messages từ consumer group
   */
  async readFromConsumerGroup(
    streamKey: string,
    groupName: string,
    consumerName: string,
    count: number = 1,
    blockTime: number = 1000,
  ): Promise<any[]> {
    const result = await this.redis['redis'].xreadgroup(
      'GROUP',
      groupName,
      consumerName,
      'COUNT',
      count,
      'BLOCK',
      blockTime,
      'STREAMS',
      streamKey,
      '>',
    ) as any[];

    if (!result || result.length === 0) {
      return [];
    }

    const [, messages] = result[0] as [string, any[]];
    return messages.map(([id, fields]: [string, string[]]) => {
      const ticket: any = { id };
      for (let i = 0; i < fields.length; i += 2) {
        ticket[fields[i]] = fields[i + 1];
      }
      return ticket;
    });
  }

  /**
   * Xác nhận message đã xử lý
   */
  async acknowledgeMessage(
    streamKey: string,
    groupName: string,
    messageId: string,
  ): Promise<void> {
    await this.redis['redis'].xack(streamKey, groupName, messageId);
  }

  /**
   * Lấy thông tin stream
   */
  async getStreamInfo(streamKey: string): Promise<any> {
    return await this.redis['redis'].xinfo('STREAM', streamKey);
  }

  /**
   * Lấy thông tin consumer groups
   */
  async getConsumerGroups(streamKey: string): Promise<any[]> {
    return await this.redis['redis'].xinfo('GROUPS', streamKey) as any[];
  }
}
