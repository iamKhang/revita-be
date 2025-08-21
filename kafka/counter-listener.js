// @ts-nocheck
const { Kafka } = require('kafkajs');
const Redis = require('ioredis');

/*
  Usage:
    KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js <COUNTER_ID>
  
  Example:
    node kafka/counter-listener.js 2fbcb7a8-8d35-4eed-83f5-864ad4c876ed
    node kafka/counter-listener.js aab4c3a1-5bad-4ac0-941e-b8eb54d3df94
    node kafka/counter-listener.js a7f3fb78-6be0-496d-a979-4ef9d7d7c6c8
    node kafka/counter-listener.js 594b8989-8f21-4f3f-add7-337d31d87ff7
    node kafka/counter-listener.js bf5a33ed-3ee1-4520-a670-138074a48026
*/

async function main() {
  const counterId = process.argv[2];
  if (!counterId) {
    console.error('Missing argument: COUNTER_ID');
    console.error('Example: node kafka/counter-listener.js <COUNTER_ID>');
    process.exit(1);
  }

  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  const topic = process.env.KAFKA_TOPIC_COUNTER_ASSIGNMENTS || 'counter.assignments';

  const kafka = new Kafka({ clientId: 'revita-counter-listener', brokers });
  const consumer = kafka.consumer({ groupId: `revita-counter-${counterId}` });

  // Redis heartbeat to keep this counter online
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
  });

  const ttl = parseInt(process.env.COUNTER_HEARTBEAT_TTL || '30');
  const intervalMs = parseInt(process.env.COUNTER_HEARTBEAT_INTERVAL_MS || '10000');

  const heartbeat = async () => {
    try {
      await redis.setex(`counterOnline:${counterId}`, ttl, '1');
    } catch (_) {
      // ignore
    }
  };

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    try {
      await consumer.disconnect();
      await redis.disconnect();
    } finally {
      process.exit(0);
    }
  });

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  console.log(`🎧 Listening for counter assignments on topic "${topic}" for counterId=${counterId}`);
  console.log(`💓 Heartbeat interval: ${intervalMs}ms, TTL: ${ttl}s`);

  // Start heartbeat interval
  await heartbeat();
  const interval = setInterval(heartbeat, intervalMs);

  await consumer.run({
    eachMessage: async ({ topic: t, partition, message }) => {
      const now = new Date().toISOString();
      let payload;
      try {
        payload = message.value ? JSON.parse(message.value.toString()) : null;
      } catch (err) {
        console.warn(`[${now}] Skipped non-JSON message`, err);
        return;
      }
      
      if (!payload) return;

      // Handle different event types
      switch (payload.type) {
        case 'PATIENT_ASSIGNED_TO_COUNTER':
          if (payload.assignedCounter.counterId !== counterId) return;
          
          const info = {
            receivedAt: now,
            eventType: payload.type,
            appointmentId: payload.appointmentId,
            patientProfileId: payload.patientProfileId,
            invoiceId: payload.invoiceId,
            patientName: payload.patientName,
            patientAge: payload.patientAge,
            patientGender: payload.patientGender,
            priorityScore: payload.priorityScore,
            serviceName: payload.serviceName,
            servicePrice: payload.servicePrice,
            assignedCounter: {
              counterId: payload.assignedCounter.counterId,
              counterCode: payload.assignedCounter.counterCode,
              counterName: payload.assignedCounter.counterName,
              receptionistName: payload.assignedCounter.receptionistName,
              estimatedWaitTime: payload.assignedCounter.estimatedWaitTime,
            },
            metadata: payload.metadata,
            eventTime: payload.timestamp,
          };
          
          console.log('\n🎯 NEW PATIENT ASSIGNED!');
          console.log(JSON.stringify(info, null, 2));
          
          // Ở đây có thể thêm logic để:
          // - Phát âm thanh thông báo
          // - Hiển thị thông báo trên màn hình
          // - Cập nhật UI
          break;

        case 'NEXT_PATIENT_CALLED':
          if (payload.counterId !== counterId) return;
          
          console.log('\n📢 CALLING NEXT PATIENT!');
          console.log(JSON.stringify({
            receivedAt: now,
            eventType: payload.type,
            counterId: payload.counterId,
            patient: payload.patient,
            timestamp: payload.timestamp,
          }, null, 2));
          
          // Ở đây có thể thêm logic để:
          // - Phát âm thanh gọi số
          // - Hiển thị thông tin bệnh nhân tiếp theo
          break;

        case 'RETURN_PREVIOUS_PATIENT':
          if (payload.counterId !== counterId) return;
          
          console.log('\n🔄 RETURNING TO PREVIOUS PATIENT!');
          console.log(JSON.stringify({
            receivedAt: now,
            eventType: payload.type,
            counterId: payload.counterId,
            timestamp: payload.timestamp,
          }, null, 2));
          
          // Ở đây có thể thêm logic để:
          // - Quay lại bệnh nhân trước đó
          // - Cập nhật UI
          break;

        default:
          console.log(`[${now}] Unknown event type: ${payload.type}`);
      }
    },
  });
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
