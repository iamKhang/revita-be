import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisStreamService } from '../cache/redis-stream.service';
import { WebSocketService } from '../websocket/websocket.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreamConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly STREAM_KEY = process.env.REDIS_STREAM_COUNTER_ASSIGNMENTS || 'counter:assignments';
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
    } catch (error) {
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
        console.log(`📨 [StreamConsumer] Received ${messages.length} messages from Redis Stream:`, this.STREAM_KEY);
        console.log('📨 [StreamConsumer] Messages:', JSON.stringify(messages, null, 2));
      }

      for (const message of messages) {
        console.log(`📨 [StreamConsumer] Processing message ID: ${message.id}`);
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

    } catch (error) {
      console.error(`Error processing message ${message.id}:`, error);
      // Có thể implement retry logic hoặc dead letter queue ở đây
    }
  }

  /**
   * Parse message data từ Redis Stream
   */
  private parseMessageData(message: any): any {

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
        } else if (['isPregnant', 'isDisabled', 'isElderly', 'isVIP'].includes(key)) {
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


    return data;
  }

  /**
   * Lưu ticket vào database (optional)
   */
  private async saveTicketToDatabase(ticketData: any) {
    try {
      // Lưu thông tin ticket vào Redis (thay vì database)
      // Thông tin queue được lưu trong Redis Stream, không cần lưu vào database
      
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
      console.log('🔔 [WebSocket] Processing event:', ticketData.type, 'for counter:', ticketData.counterId);
      console.log('🔔 [WebSocket] Full ticketData:', JSON.stringify(ticketData, null, 2));
      
      // Xử lý các loại events khác nhau
      switch (ticketData.type) {
        case 'NEW_TICKET':
        case 'TICKET_ASSIGNED':
          await this.handleNewTicketEvent(ticketData);
          break;
          
        case 'NEXT_PATIENT_CALLED':
          await this.handleNextPatientEvent(ticketData);
          break;
          
        case 'PATIENT_SKIPPED_AND_NEXT_CALLED':
          await this.handleSkipPatientEvent(ticketData);
          break;
          
        case 'PATIENT_PREPARING':
          await this.handlePatientPreparingEvent(ticketData);
          break;
          
        case 'PATIENT_SERVED':
          await this.handlePatientServedEvent(ticketData);
          break;
          
        default:
          console.log('🔔 [WebSocket] Unknown event type, using legacy handler:', ticketData.type);
          // Gửi thông báo đến counter cụ thể (legacy)
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
          break;
      }
    } catch (error) {
      console.error('Error sending WebSocket notification:', error);
    }
  }

  /**
   * Xử lý event NEW_TICKET
   */
  private async handleNewTicketEvent(ticketData: any) {
    console.log('🎫 [WebSocket] Sending NEW_TICKET event to counter:', ticketData.counterId);
    
    const message = {
      type: 'NEW_TICKET',
      data: {
        ticketId: ticketData.ticketId,
        queueNumber: ticketData.queueNumber,
        patientName: ticketData.patientName,
        priorityLevel: ticketData.priorityLevel,
        estimatedWaitTime: ticketData.estimatedWaitTime,
      },
      timestamp: new Date().toISOString(),
    };
    
    console.log('🎫 [WebSocket] NEW_TICKET message:', JSON.stringify(message, null, 2));
    
    // Gửi thông báo đến counter cụ thể
    await this.webSocket.sendToCounter(ticketData.counterId, 'new_ticket', message);

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
    
    console.log('🎫 [WebSocket] NEW_TICKET event sent successfully');
  }

  /**
   * Xử lý event NEXT_PATIENT_CALLED
   */
  private async handleNextPatientEvent(ticketData: any) {
    console.log('📞 [WebSocket] Sending NEXT_PATIENT_CALLED event to counter:', ticketData.counterId);
    console.log('📞 [WebSocket] Raw patient data:', ticketData.patient);
    
    const patient = JSON.parse(ticketData.patient || '{}');
    console.log('📞 [WebSocket] Parsed patient:', JSON.stringify(patient, null, 2));
    
    const message = {
      type: 'NEXT_PATIENT_CALLED',
      data: {
        counterId: ticketData.counterId,
        patient: patient,
      },
      timestamp: ticketData.timestamp,
    };
    
    console.log('📞 [WebSocket] NEXT_PATIENT_CALLED message:', JSON.stringify(message, null, 2));
    
    // Gửi thông báo đến counter cụ thể
    await this.webSocket.sendToCounter(ticketData.counterId, 'next_patient_called', message);

    // Gửi thông báo tổng quát đến tất cả counter
    await this.webSocket.broadcastToAllCounters({
      type: 'NEXT_PATIENT_CALLED',
      data: {
        counterId: ticketData.counterId,
        patient: patient,
      },
      timestamp: ticketData.timestamp,
    });

    console.log(`📞 [WebSocket] NEXT_PATIENT_CALLED event sent successfully to counter ${ticketData.counterId}`);
  }

  /**
   * Xử lý event PATIENT_SKIPPED_AND_NEXT_CALLED
   */
  private async handleSkipPatientEvent(ticketData: any) {
    console.log('⏭️ [WebSocket] Sending PATIENT_SKIPPED_AND_NEXT_CALLED event to counter:', ticketData.counterId);
    console.log('⏭️ [WebSocket] Raw skippedPatient data:', ticketData.skippedPatient);
    console.log('⏭️ [WebSocket] Raw currentPatient data:', ticketData.currentPatient);
    
    const skippedPatient = JSON.parse(ticketData.skippedPatient || '{}');
    const currentPatient = JSON.parse(ticketData.currentPatient || '{}');
    
    console.log('⏭️ [WebSocket] Parsed skippedPatient:', JSON.stringify(skippedPatient, null, 2));
    console.log('⏭️ [WebSocket] Parsed currentPatient:', JSON.stringify(currentPatient, null, 2));
    
    const message = {
      type: 'PATIENT_SKIPPED_AND_NEXT_CALLED',
      data: {
        counterId: ticketData.counterId,
        skippedPatient: skippedPatient,
        currentPatient: currentPatient,
      },
      timestamp: ticketData.timestamp,
    };
    
    console.log('⏭️ [WebSocket] PATIENT_SKIPPED_AND_NEXT_CALLED message:', JSON.stringify(message, null, 2));
    
    // Gửi thông báo đến counter cụ thể
    await this.webSocket.sendToCounter(ticketData.counterId, 'patient_skipped', message);

    // Gửi thông báo tổng quát đến tất cả counter
    await this.webSocket.broadcastToAllCounters({
      type: 'PATIENT_SKIPPED_AND_NEXT_CALLED',
      data: {
        counterId: ticketData.counterId,
        skippedPatient: skippedPatient,
        currentPatient: currentPatient,
      },
      timestamp: ticketData.timestamp,
    });

    console.log(`⏭️ [WebSocket] PATIENT_SKIPPED_AND_NEXT_CALLED event sent successfully to counter ${ticketData.counterId}`);
  }

  /**
   * Xử lý event PATIENT_PREPARING
   */
  private async handlePatientPreparingEvent(ticketData: any) {
    console.log('🔄 [WebSocket] Sending PATIENT_PREPARING event to counter:', ticketData.counterId);
    console.log('🔄 [WebSocket] Raw patient data:', ticketData.patient);
    
    const patient = JSON.parse(ticketData.patient || '{}');
    console.log('🔄 [WebSocket] Parsed patient:', JSON.stringify(patient, null, 2));
    
    const message = {
      type: 'PATIENT_PREPARING',
      data: {
        counterId: ticketData.counterId,
        patient: patient,
      },
      timestamp: ticketData.timestamp,
    };
    
    console.log('🔄 [WebSocket] PATIENT_PREPARING message:', JSON.stringify(message, null, 2));
    
    // Gửi thông báo đến counter cụ thể
    await this.webSocket.sendToCounter(ticketData.counterId, 'patient_preparing', message);

    // Gửi thông báo tổng quát đến tất cả counter
    await this.webSocket.broadcastToAllCounters({
      type: 'PATIENT_PREPARING',
      data: {
        counterId: ticketData.counterId,
        patient: patient,
      },
      timestamp: ticketData.timestamp,
    });

    console.log(`🔄 [WebSocket] PATIENT_PREPARING event sent successfully to counter ${ticketData.counterId}`);
  }

  /**
   * Xử lý event PATIENT_SERVED
   */
  private async handlePatientServedEvent(ticketData: any) {
    console.log('✅ [WebSocket] Sending PATIENT_SERVED event to counter:', ticketData.counterId);
    console.log('✅ [WebSocket] Raw patient data:', ticketData.patient);
    
    const patient = JSON.parse(ticketData.patient || '{}');
    console.log('✅ [WebSocket] Parsed patient:', JSON.stringify(patient, null, 2));
    
    const message = {
      type: 'PATIENT_SERVED',
      data: {
        counterId: ticketData.counterId,
        patient: patient,
      },
      timestamp: ticketData.timestamp,
    };
    
    console.log('✅ [WebSocket] PATIENT_SERVED message:', JSON.stringify(message, null, 2));
    
    // Gửi thông báo đến counter cụ thể
    await this.webSocket.sendToCounter(ticketData.counterId, 'patient_served', message);

    // Gửi thông báo tổng quát đến tất cả counter
    await this.webSocket.broadcastToAllCounters({
      type: 'PATIENT_SERVED',
      data: {
        counterId: ticketData.counterId,
        patient: patient,
      },
      timestamp: ticketData.timestamp,
    });

    console.log(`✅ [WebSocket] PATIENT_SERVED event sent successfully to counter ${ticketData.counterId}`);
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
