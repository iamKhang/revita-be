// @ts-nocheck
const { Kafka } = require('kafkajs');

/*
  Usage:
    KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js <COUNTER_ID>

  Example:
    node kafka/counter-listener.js 5a2f3c2e-...-counter-id
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

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    try {
      await consumer.disconnect();
    } finally {
      process.exit(0);
    }
  });

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  console.log(`Listening for counter assignments on topic "${topic}" for counterId=${counterId}`);

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
      
      if (!payload || payload.type !== 'PATIENT_ASSIGNED_TO_COUNTER') return;
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
      
      console.log(JSON.stringify(info, null, 2));
      
      // Ở đây có thể thêm logic để:
      // 1. Hiển thị thông báo trên màn hình quầy
      // 2. Phát âm thanh thông báo
      // 3. Cập nhật giao diện người dùng
      // 4. Gửi thông báo đến ứng dụng Electron
    },
  });
}

main().catch((err) => {
  console.error('Counter listener failed to start:', err);
  process.exit(1);
});
