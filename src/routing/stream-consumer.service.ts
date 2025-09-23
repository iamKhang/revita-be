import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisStreamService } from '../cache/redis-stream.service';
import { WebSocketService } from '../websocket/websocket.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreamConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly STREAM_KEY = 'queue:tickets';
  private readonly GROUP_NAME = 'ticket-processors';
  private readonly CONSUMER_NAME = `consumer-${process.pid}-${Date.now()}`;
  private isRunning = false;
  private consumerInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly redisStream: RedisStreamService,
    private readonly webSocket: WebSocketService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.initializeConsumerGroup();
    this.startConsumer();
  }

  async onModuleDestroy() {
    this.stopConsumer();
  }

  /**
   * Khởi tạo consumer group
   */
  private async initializeConsumerGroup() {
    try {
      await this.redisStream.createConsumerGroup(
        this.STREAM_KEY,
        this.GROUP_NAME,
        '0',
      );
      console.log(`Consumer group ${this.GROUP_NAME} initialized`);
    } catch (error) {
      console.log(`Consumer group ${this.GROUP_NAME} already exists or error:`, error.message);
    }
  }

  /**
   * Bắt đầu consumer
   */
  private startConsumer() {
    this.isRunning = true;
    this.consumerInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.processMessages();
      }
    }, 1000); // Xử lý mỗi giây

    console.log(`Stream consumer ${this.CONSUMER_NAME} started`);
  }

  /**
   * Dừng consumer
   */
  private stopConsumer() {
    this.isRunning = false;
    if (this.consumerInterval) {
      clearInterval(this.consumerInterval);
      this.consumerInterval = null;
    }
    console.log(`Stream consumer ${this.CONSUMER_NAME} stopped`);
  }

  /**
   * Xử lý messages từ stream
   */
  private async processMessages() {
    try {
      const messages = await this.redisStream.readFromConsumerGroup(
        this.STREAM_KEY,
        this.GROUP_NAME,
        this.CONSUMER_NAME,
        10, // Đọc tối đa 10 messages
        1000, // Block 1 giây
      );

      if (messages.length > 0) {
        console.log(`[${this.CONSUMER_NAME}] Received ${messages.length} messages`);
        // Có thể bật debug chi tiết khi cần
        // console.debug('Messages:', JSON.stringify(messages, null, 2));
      }

      for (const message of messages) {
        await this.processMessage(message);
      }
    } catch (error) {
      console.error(`[${this.CONSUMER_NAME}] Error processing messages:`, error);
    }
  }

  /**
   * Xử lý một message cụ thể
   */
  private async processMessage(message: any) {
    try {
      const ticketData = this.parseMessageData(message);
      
      // Lưu vào database (optional)
      await this.saveTicketToDatabase(ticketData);

      // Gửi thông báo WebSocket
      await this.notifyWebSocketClients(ticketData);

      // Xác nhận message đã xử lý
      await this.redisStream.acknowledgeMessage(
        this.STREAM_KEY,
        this.GROUP_NAME,
        message.id,
      );

      console.log(`Processed ticket ${ticketData.queueNumber} for counter ${ticketData.counterId}`);
    } catch (error) {
      console.error(`Error processing message ${message.id}:`, error);
      // Có thể implement retry logic hoặc dead letter queue ở đây
    }
  }

  /**
   * Parse message data từ Redis Stream
   */
  private parseMessageData(message: any): any {
    console.log('Processing message:', JSON.stringify(message, null, 2));

    // Kiểm tra cấu trúc message
    if (!message) {
      throw new Error('Message is null or undefined');
    }

    if (!message.id) {
      console.warn('Message missing id:', message);
      return {
        id: 'unknown',
        error: 'Missing message id',
      };
    }

    // Redis Stream trả về message với fields đã được flatten trực tiếp
    // { id: 'message-id', field1: 'value1', field2: 'value2', ... }
    const data: any = {
      id: message.id,
    };

    // Copy tất cả fields từ message (trừ id)
    Object.keys(message).forEach(key => {
      if (key !== 'id') {
        const value = message[key];

        // Convert string numbers back to numbers
        if (['patientAge', 'priorityScore', 'sequence', 'estimatedWaitTime'].includes(key)) {
          data[key] = parseInt(value) || 0;
        } else if (['isPregnant', 'isDisabled', 'isElderly', 'isEmergency', 'isVIP'].includes(key)) {
          data[key] = value === 'true' || value === true;
        } else if (key === 'metadata' && typeof value === 'string') {
          // Parse metadata JSON string nếu có
          try {
            data[key] = JSON.parse(value);
          } catch (e) {
            data[key] = value;
          }
        } else {
          data[key] = value;
        }
      }
    });

    console.log('Parsed data:', data);

    return data;
  }

  /**
   * Lưu ticket vào database (optional)
   */
  private async saveTicketToDatabase(ticketData: any) {
    try {
      // Lưu thông tin ticket vào Redis (thay vì database)
      // Thông tin queue được lưu trong Redis Stream, không cần lưu vào database
      console.log(`📝 Ticket ${ticketData.ticketId} đã được lưu vào Redis Stream`);
      
      // Có thể tạo log record nếu cần thiết
      // await this.prisma.counterAssignment.create({
      //   data: {
      //     counterId: ticketData.counterId,
      //     receptionistId: null, // Sẽ được cập nhật khi receptionist nhận ticket
      //     assignedAt: new Date(),
      //     status: 'ACTIVE',
      //     notes: `Ticket ${ticketData.ticketId} - ${ticketData.patientName}`,
      //   },
      // });
    } catch (error) {
      console.error('Error processing ticket:', error);
      // Không throw error để không làm gián đoạn quá trình xử lý
    }
  }

  /**
   * Gửi thông báo WebSocket
   */
  private async notifyWebSocketClients(ticketData: any) {
    try {
      // Gửi thông báo đến counter cụ thể
      await this.webSocket.sendToCounter(
        ticketData.counterId,
        'ticket_processed',
        {
          type: 'TICKET_PROCESSED',
          data: {
            ticketId: ticketData.ticketId,
            queueNumber: ticketData.queueNumber,
            patientName: ticketData.patientName,
            priorityLevel: ticketData.priorityLevel,
            estimatedWaitTime: ticketData.estimatedWaitTime,
          },
          timestamp: new Date().toISOString(),
        },
      );

      // Gửi thông báo tổng quát đến tất cả counter
      await this.webSocket.broadcastToAllCounters({
        type: 'NEW_TICKET',
        data: {
          counterId: ticketData.counterId,
          counterCode: ticketData.counterCode,
          queueNumber: ticketData.queueNumber,
          priorityLevel: ticketData.priorityLevel,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error sending WebSocket notification:', error);
    }
  }

  /**
   * Lấy thông tin consumer
   */
  getConsumerInfo() {
    return {
      consumerName: this.CONSUMER_NAME,
      groupName: this.GROUP_NAME,
      streamKey: this.STREAM_KEY,
      isRunning: this.isRunning,
    };
  }

  /**
   * Restart consumer
   */
  async restartConsumer() {
    this.stopConsumer();
    await this.initializeConsumerGroup();
    this.startConsumer();
  }
}
