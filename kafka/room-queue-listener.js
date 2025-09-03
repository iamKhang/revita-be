/*
  Usage:
    KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_ASSIGNMENTS=clinic.assignments node kafka/room-queue-listener.js <ROOM_CODE>

  Example:
    node kafka/room-queue-listener.js NOI-104
    node kafka/room-queue-listener.js NHI-201
*/

const { Kafka } = require('kafkajs');

class RoomQueueListener {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.patientQueue = new Map(); // patientProfileId -> patient info
    this.boothQueues = new Map(); // boothId -> queue for that booth
    this.currentPatients = new Map(); // boothId -> current patient
    this.nextPatients = new Map(); // boothId -> next patient
    
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
    const topic = process.env.KAFKA_TOPIC_ASSIGNMENTS || 'clinic.assignments';

    this.kafka = new Kafka({ clientId: `revita-room-queue-${roomCode}`, brokers });
    this.consumer = this.kafka.consumer({ groupId: `revita-room-queue-${roomCode}` });
    this.topic = topic;
  }

  async start() {
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down room queue listener...');
      try {
        await this.consumer.disconnect();
      } finally {
        process.exit(0);
      }
    });

    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });

    console.log(`🎧 Listening for patient queue on topic "${this.topic}" for roomCode=${this.roomCode}`);
    console.log(`📋 Queue status: ${this.patientQueue.size} patients waiting`);
    this.displayQueue();

    await this.consumer.run({
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

        await this.handleMessage(payload, now);
      },
    });
  }

  async handleMessage(payload, timestamp) {
    switch (payload.type) {
      case 'PATIENT_ASSIGNED':
        if (payload.roomCode === this.roomCode) {
          await this.handlePatientAssigned(payload, timestamp);
        }
        break;
      
      case 'PATIENT_STATUS':
        if (payload.roomCode === this.roomCode) {
          await this.handlePatientStatus(payload, timestamp);
        }
        break;
      
      case 'SERVICE_STATUS_UPDATE':
        // Handle service status updates from prescription
        await this.handleServiceStatusUpdate(payload, timestamp);
        break;
      
      case 'PRESCRIPTION_COMPLETED':
        // This is for doctor's waiting list, not room queue
        break;
      
      default:
        // Ignore other message types
        break;
    }
  }

  async handlePatientAssigned(payload, timestamp) {
    const patientInfo = {
      patientProfileId: payload.patientProfileId,
      patientName: payload.patientName,
      status: payload.status || 'WAITING',
      roomId: payload.roomId,
      roomCode: payload.roomCode,
      roomName: payload.roomName,
      boothId: payload.boothId,
      boothCode: payload.boothCode,
      boothName: payload.boothName,
      doctorId: payload.doctorId,
      doctorCode: payload.doctorCode,
      doctorName: payload.doctorName,
      serviceIds: payload.serviceIds || [],
      prescriptionId: payload.prescriptionId,
      prescriptionCode: payload.prescriptionCode,
      assignedAt: timestamp,
    };

    this.patientQueue.set(payload.patientProfileId, patientInfo);

    // Add to booth-specific queue
    if (payload.boothId) {
      if (!this.boothQueues.has(payload.boothId)) {
        this.boothQueues.set(payload.boothId, new Map());
      }
      this.boothQueues.get(payload.boothId).set(payload.patientProfileId, patientInfo);
    }

    console.log(`\n✅ Patient assigned to booth:`);
    console.log(`   👤 ${patientInfo.patientName} (${patientInfo.patientProfileId})`);
    console.log(`   🏥 Room: ${patientInfo.roomName} (${patientInfo.roomCode})`);
    console.log(`   🚪 Booth: ${patientInfo.boothName} (${patientInfo.boothCode})`);
    console.log(`   👨‍⚕️ Doctor: ${patientInfo.doctorName || 'N/A'}`);
    console.log(`   📋 Status: ${patientInfo.status}`);
    console.log(`   ⏰ Assigned: ${new Date(timestamp).toLocaleTimeString()}`);

    this.updateQueueStatus();
    this.displayQueue();
  }

  async handlePatientStatus(payload, timestamp) {
    const patientInfo = this.patientQueue.get(payload.patientProfileId);
    if (!patientInfo) return;

    const oldStatus = patientInfo.status;
    patientInfo.status = payload.status;
    patientInfo.lastStatusUpdate = timestamp;

    console.log(`\n🔄 Patient status updated:`);
    console.log(`   👤 ${patientInfo.patientName}`);
    console.log(`   🚪 Booth: ${patientInfo.boothName} (${patientInfo.boothCode})`);
    console.log(`   📊 Status: ${oldStatus} → ${payload.status}`);
    console.log(`   ⏰ Updated: ${new Date(timestamp).toLocaleTimeString()}`);

    // Handle status transitions
    switch (payload.status) {
      case 'SERVING':
        this.currentPatients.set(patientInfo.boothId, patientInfo);
        console.log(`   🎯 Now serving at booth ${patientInfo.boothCode}: ${patientInfo.patientName}`);
        break;
      
      case 'LEFT_TEMPORARILY':
        console.log(`   🚶 Patient left temporarily: ${patientInfo.patientName}`);
        break;
      
      case 'RETURNED':
        console.log(`   🔄 Patient returned: ${patientInfo.patientName}`);
        break;
      
      case 'WAITING_RESULT':
        console.log(`   ⏳ Patient waiting for result: ${patientInfo.patientName}`);
        // Remove patient from queue when waiting for result
        this.patientQueue.delete(payload.patientProfileId);
        if (patientInfo.boothId) {
          this.boothQueues.get(patientInfo.boothId)?.delete(payload.patientProfileId);
          if (this.currentPatients.get(patientInfo.boothId)?.patientProfileId === payload.patientProfileId) {
            this.currentPatients.delete(patientInfo.boothId);
          }
        }
        break;
      
      case 'COMPLETED':
        console.log(`   ✅ Service completed: ${patientInfo.patientName}`);
        this.patientQueue.delete(payload.patientProfileId);
        if (patientInfo.boothId) {
          this.boothQueues.get(patientInfo.boothId)?.delete(payload.patientProfileId);
          if (this.currentPatients.get(patientInfo.boothId)?.patientProfileId === payload.patientProfileId) {
            this.currentPatients.delete(patientInfo.boothId);
          }
        }
        break;
      
      case 'SKIPPED':
        console.log(`   ⏭️ Patient skipped: ${patientInfo.patientName}`);
        this.patientQueue.delete(payload.patientProfileId);
        if (patientInfo.boothId) {
          this.boothQueues.get(patientInfo.boothId)?.delete(payload.patientProfileId);
          if (this.currentPatients.get(patientInfo.boothId)?.patientProfileId === payload.patientProfileId) {
            this.currentPatients.delete(patientInfo.boothId);
          }
        }
        break;
    }

    this.updateQueueStatus();
    this.displayQueue();
  }

  async handleServiceStatusUpdate(payload, timestamp) {
    const patientInfo = this.patientQueue.get(payload.patientProfileId);
    if (!patientInfo) return;

    const oldStatus = patientInfo.status;
    patientInfo.status = payload.status;
    patientInfo.lastStatusUpdate = timestamp;
    patientInfo.currentService = payload.serviceName;

    console.log(`\n🔬 Service status updated:`);
    console.log(`   👤 ${patientInfo.patientName}`);
    console.log(`   🚪 Booth: ${patientInfo.boothName} (${patientInfo.boothCode})`);
    console.log(`   🏥 Service: ${payload.serviceName} (${payload.serviceCode})`);
    console.log(`   📊 Status: ${oldStatus} → ${payload.status}`);
    console.log(`   ⏰ Updated: ${new Date(timestamp).toLocaleTimeString()}`);

    // Handle status transitions
    switch (payload.status) {
      case 'SERVING':
        this.currentPatients.set(patientInfo.boothId, patientInfo);
        console.log(`   🎯 Now serving at booth ${patientInfo.boothCode}: ${patientInfo.patientName} - ${payload.serviceName}`);
        break;
      
      case 'WAITING_RESULT':
        console.log(`   ⏳ Patient waiting for result: ${patientInfo.patientName} - ${payload.serviceName}`);
        // Remove patient from queue when waiting for result
        this.patientQueue.delete(payload.patientProfileId);
        if (patientInfo.boothId) {
          this.boothQueues.get(patientInfo.boothId)?.delete(payload.patientProfileId);
          if (this.currentPatients.get(patientInfo.boothId)?.patientProfileId === payload.patientProfileId) {
            this.currentPatients.delete(patientInfo.boothId);
          }
        }
        break;
      
      case 'COMPLETED':
        console.log(`   ✅ Service completed: ${patientInfo.patientName} - ${payload.serviceName}`);
        this.patientQueue.delete(payload.patientProfileId);
        if (patientInfo.boothId) {
          this.boothQueues.get(patientInfo.boothId)?.delete(payload.patientProfileId);
          if (this.currentPatients.get(patientInfo.boothId)?.patientProfileId === payload.patientProfileId) {
            this.currentPatients.delete(patientInfo.boothId);
          }
        }
        break;
    }

    this.updateQueueStatus();
    this.displayQueue();
  }

  updateQueueStatus() {
    // Clear next patients
    this.nextPatients.clear();
    
    // Find next patient for each booth
    for (const [boothId, boothQueue] of this.boothQueues) {
      for (const [patientId, patient] of boothQueue) {
        if (patient.status === 'WAITING') {
          this.nextPatients.set(boothId, patient);
          break;
        }
      }
    }
  }

  displayQueue() {
    console.log(`\n📋 Queue Status for ${this.roomCode}:`);
    console.log(`   📊 Total patients in queue: ${this.patientQueue.size}`);
    console.log(`   🚪 Total booths with patients: ${this.boothQueues.size}`);
    
    // Display current patients by booth
    if (this.currentPatients.size > 0) {
      console.log(`\n   🎯 Currently serving by booth:`);
      for (const [boothId, patient] of this.currentPatients) {
        const serviceInfo = patient.currentService ? ` - ${patient.currentService}` : '';
        console.log(`      🚪 ${patient.boothCode}: ${patient.patientName} (${patient.status})${serviceInfo}`);
      }
    } else {
      console.log(`\n   🎯 Currently serving: None`);
    }
    
    // Display next patients by booth
    if (this.nextPatients.size > 0) {
      console.log(`\n   ⏭️ Next patients by booth:`);
      for (const [boothId, patient] of this.nextPatients) {
        const serviceInfo = patient.currentService ? ` - ${patient.currentService}` : '';
        console.log(`      🚪 ${patient.boothCode}: ${patient.patientName}${serviceInfo}`);
      }
    } else {
      console.log(`\n   ⏭️ Next patients: None`);
    }

    // Display queue by booth
    if (this.boothQueues.size > 0) {
      console.log(`\n   📝 Queue by booth:`);
      for (const [boothId, boothQueue] of this.boothQueues) {
        if (boothQueue.size > 0) {
          const boothInfo = Array.from(boothQueue.values())[0];
          console.log(`      🚪 ${boothInfo.boothCode} (${boothInfo.boothName}):`);
          let index = 1;
          for (const [patientId, patient] of boothQueue) {
            const statusIcon = this.getStatusIcon(patient.status);
            const serviceInfo = patient.currentService ? ` - ${patient.currentService}` : '';
            console.log(`         ${index}. ${statusIcon} ${patient.patientName} - ${patient.status}${serviceInfo}`);
            index++;
          }
        }
      }
    } else {
      console.log(`\n   📝 Queue by booth: Empty`);
    }
    
    console.log(`\n${'='.repeat(60)}`);
  }

  getStatusIcon(status) {
    switch (status) {
      case 'WAITING': return '⏳';
      case 'SERVING': return '🎯';
      case 'LEFT_TEMPORARILY': return '🚶';
      case 'RETURNED': return '🔄';
      case 'WAITING_RESULT': return '🔬';
      case 'COMPLETED': return '✅';
      case 'SKIPPED': return '⏭️';
      default: return '❓';
    }
  }
}

async function main() {
  const roomCode = process.argv[2];
  if (!roomCode) {
    console.error('❌ Missing argument: ROOM_CODE');
    console.error('Example: node kafka/room-queue-listener.js <ROOM_CODE>');
    console.error('Example: node kafka/room-queue-listener.js NOI-104');
    process.exit(1);
  }

  const listener = new RoomQueueListener(roomCode);
  await listener.start();
}

main().catch((err) => {
  console.error('❌ Room queue listener failed to start:', err);
  process.exit(1);
});
