import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, Partitioners } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private producer: Producer | null = null;
  private isConnected = false;

  async onModuleInit(): Promise<void> {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    const kafka = new Kafka({
      clientId: 'revita-api',
      brokers,
    });
    this.producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });
    try {
      await this.producer.connect();
      this.isConnected = true;
    } catch (err) {
      this.isConnected = false;
      // Do not crash app if Kafka is not available
      // eslint-disable-next-line no-console
      console.warn('[Kafka] Failed to connect on init. Will try on first publish.', err);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
      }
    } finally {
      this.producer = null;
      this.isConnected = false;
    }
  }

  async publish(topic: string, messages: Array<{ key?: string; value: unknown }>): Promise<void> {
    if (!this.producer) {
      throw new Error('Kafka producer not initialized');
    }
    if (!this.isConnected) {
      try {
        await this.producer.connect();
        this.isConnected = true;
      } catch (err) {
        throw new Error(`Kafka not available: ${(err as Error).message}`);
      }
    }
    await this.producer.send({
      topic,
      messages: messages.map((m) => ({ key: m.key, value: JSON.stringify(m.value) })),
    });
  }
}


