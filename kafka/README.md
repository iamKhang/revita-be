# Kafka Listeners for Revita Clinic System

## Overview
This directory contains Kafka listeners for monitoring patient assignments and queue management in the Revita clinic system.

## Setup

### 1. Start Kafka Infrastructure
```bash
cd kafka
docker-compose up -d
```

### 2. Available Listeners

#### Room Queue Listener
Monitors patient queue for a specific room. Shows real-time updates of patient status and queue management.

**Usage:**
```bash
# Listen to a specific room
node kafka/room-queue-listener.js <ROOM_CODE>

# Examples:
node kafka/room-queue-listener.js NOI-104
node kafka/room-queue-listener.js NHI-201
node kafka/room-queue-listener.js CAPCU-301
```

**Features:**
- Real-time patient queue monitoring
- Status updates (WAITING, SERVING, LEFT_TEMPORARILY, RETURNED, COMPLETED, SKIPPED)
- Current patient and next patient tracking
- Visual queue display with status icons

#### Room Assignment Listener
Monitors patient assignments to specific rooms.

**Usage:**
```bash
# Listen to a specific room ID
node kafka/room-listener.js <ROOM_ID>

# Example:
node kafka/room-listener.js 5a2f3c2e-...-room-id
```

#### Counter Assignment Listener
Monitors patient assignments to counters.

**Usage:**
```bash
# Listen to a specific counter
node kafka/counter-listener.js <COUNTER_ID>

# Example:
node kafka/counter-listener.js 2fbcb7a8-8d35-4eed-83f5-864ad4c876ed
```

## Event Types

### PATIENT_ASSIGNED
Sent when a patient is assigned to a room after successful payment.

**Payload:**
```json
{
  "type": "PATIENT_ASSIGNED",
  "patientProfileId": "profile-uuid-1",
  "patientName": "Vũ Tuấn Anh",
  "status": "WAITING",
  "roomId": "room-uuid",
  "roomCode": "NOI-104",
  "roomName": "Phòng Nội 104",
  "doctorId": "doctor-uuid",
  "doctorCode": "DOC-001",
  "doctorName": "Nguyễn Minh Đức",
  "serviceIds": ["service-uuid-1", "service-uuid-2"],
  "prescriptionId": "prescription-uuid",
  "prescriptionCode": "PR1756395297923T66ON9",
  "timestamp": "2025-08-28T15:30:00.000Z"
}
```

### PATIENT_STATUS
Sent when patient status changes in a room.

**Payload:**
```json
{
  "type": "PATIENT_STATUS",
  "status": "SERVING",
  "patientProfileId": "profile-uuid-1",
  "patientName": "Vũ Tuấn Anh",
  "roomId": "room-uuid",
  "roomCode": "NOI-104",
  "doctorId": "doctor-uuid",
  "doctorCode": "DOC-001",
  "timestamp": "2025-08-28T15:30:00.000Z"
}
```

### SERVICE_STATUS_UPDATE
Sent when doctor updates service status in prescription.

**Payload:**
```json
{
  "type": "SERVICE_STATUS_UPDATE",
  "prescriptionId": "prescription-uuid",
  "prescriptionCode": "PR1756395297923T66ON9",
  "serviceId": "service-uuid-1",
  "serviceCode": "CONSULT_STD",
  "serviceName": "Khám nội tổng quát (lần đầu)",
  "patientProfileId": "profile-uuid-1",
  "patientName": "Vũ Tuấn Anh",
  "status": "SERVING",
  "timestamp": "2025-08-28T15:30:00.000Z"
}
```

### PRESCRIPTION_COMPLETED
Sent when all services in a prescription are completed.

**Payload:**
```json
{
  "type": "PRESCRIPTION_COMPLETED",
  "prescriptionId": "prescription-uuid",
  "prescriptionCode": "PR1756395297923T66ON9",
  "patientProfileId": "profile-uuid-1",
  "patientName": "Vũ Tuấn Anh",
  "doctorId": "doctor-uuid",
  "doctorName": "Nguyễn Minh Đức",
  "timestamp": "2025-08-28T15:30:00.000Z"
}
```

## Patient Status Flow

1. **WAITING** - Patient is in queue, waiting to be called
2. **SERVING** - Patient is currently being served by doctor
3. **LEFT_TEMPORARILY** - Patient left for tests/examinations
4. **RETURNED** - Patient returned from tests/examinations
5. **WAITING_RESULT** - Patient waiting for test results, removed from queue
6. **COMPLETED** - Service completed, patient removed from queue
7. **SKIPPED** - Patient skipped, removed from queue

## Queue Management Logic

- **Patient assigned** → Added to booth-specific queue with status `WAITING`
- **Doctor starts service** → Status changes to `SERVING`, patient becomes "Currently serving" at specific booth
- **Service completed, waiting result** → Status changes to `WAITING_RESULT`, patient removed from booth queue
- **Next patient** → Automatically becomes "Currently serving" at the same booth if no one is currently being served
- **Queue display** → Shows current patients by booth, next patients by booth, and full queue list organized by booth with service information

## Booth-Based Queue Management

Each room can have multiple booths with different doctors:
- **NOI-104** might have 4 booths: NOI-104-A, NOI-104-B, NOI-104-C, NOI-104-D
- Each booth has its own queue and current patient
- Patients are assigned to specific booths based on doctor availability
- Queue display shows status per booth, not per room

## Environment Variables

- `KAFKA_BROKERS` - Kafka broker addresses (default: localhost:9092)
- `KAFKA_TOPIC_ASSIGNMENTS` - Topic for patient assignments (default: clinic.assignments)
- `KAFKA_TOPIC_COUNTER_ASSIGNMENTS` - Topic for counter assignments (default: counter.assignments)

## Room Codes Reference

Common room codes from the system:
- `NOI-104` - Phòng Nội 104 (Internal Medicine)
- `NHI-201` - Phòng Nhi 201 (Pediatrics)
- `CAPCU-301` - Phòng Cấp cứu 301 (Emergency)
- `XQUANG-401` - Phòng X-quang 401 (X-ray)
- `SIEUAM-501` - Phòng Siêu âm 501 (Ultrasound)

## Troubleshooting

### Kafka Connection Issues
1. Ensure Kafka is running: `docker-compose ps`
2. Check broker address: `echo $KAFKA_BROKERS`
3. Test connection: `telnet localhost 9092`

### No Messages Received
1. Verify topic name: `echo $KAFKA_TOPIC_ASSIGNMENTS`
2. Check if events are being published from the API
3. Ensure room code matches exactly

### Queue Not Updating
1. Verify patient assignments are being sent to correct room
2. Check if status updates are being published
3. Restart listener if needed
