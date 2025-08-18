/*
  Usage:
    KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_ASSIGNMENTS=clinic.assignments node kafka/room-listener.js <ROOM_ID>

  Example:
    node kafka/room-listener.js 5a2f3c2e-...-room-id
*/

const { Kafka } = require('kafkajs');

async function main() {
  const roomId = process.argv[2];
  if (!roomId) {
    console.error('Missing argument: ROOM_ID');
    console.error('Example: node kafka/room-listener.js <ROOM_ID>');
    process.exit(1);
  }

  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  const topic = process.env.KAFKA_TOPIC_ASSIGNMENTS || 'clinic.assignments';

  const kafka = new Kafka({ clientId: 'revita-room-listener', brokers });
  const consumer = kafka.consumer({ groupId: `revita-room-${roomId}` });

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

  console.log(`Listening for assignments on topic "${topic}" for roomId=${roomId}`);

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
      if (!payload || payload.type !== 'PATIENT_ASSIGNED') return;
      if (payload.roomId !== roomId) return;

      const info = {
        receivedAt: now,
        patientProfileId: payload.patientProfileId,
        patientName: payload.patientName || null,
        status: payload.status || null,
        roomId: payload.roomId,
        roomCode: payload.roomCode,
        doctorId: payload.doctorId,
        doctorCode: payload.doctorCode,
        serviceIds: payload.serviceIds,
        eventTime: payload.timestamp,
      };
      console.log(JSON.stringify(info));
    },
  });
}

main().catch((err) => {
  console.error('Listener failed to start:', err);
  process.exit(1);
});


