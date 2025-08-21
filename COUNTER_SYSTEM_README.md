# Hệ thống Quản lý Quầy (Counter Management System)

## Tổng quan

Hệ thống quản lý quầy đã được cải tiến để tách biệt khái niệm **Counter** (quầy) và **Receptionist** (lễ tân), cho phép quản lý độc lập và linh hoạt hơn.

## Kiến trúc mới

### 1. Model Counter
- **Counter**: Đại diện cho một quầy vật lý trong bệnh viện
- **Receptionist**: Nhân viên lễ tân có thể được gán vào counter
- **CounterQueueItem**: Lưu trữ queue của từng counter
- **CounterAssignment**: Lịch sử phân bổ bệnh nhân

### 2. Quan hệ
- Một Counter có thể có hoặc không có Receptionist
- Một Receptionist có thể được gán vào nhiều Counter (theo thời gian)
- Counter hoạt động độc lập với Receptionist

## Tính năng chính

### 1. Quản lý Counter
- ✅ Tạo và quản lý các counter
- ✅ Gán/bỏ gán receptionist cho counter
- ✅ Bật/tắt trạng thái online/offline
- ✅ Quản lý queue của từng counter

### 2. Phân bổ bệnh nhân
- ✅ Phân bổ theo appointment/invoice
- ✅ Quét hóa đơn và phân bổ tự động
- ✅ Phân bổ trực tiếp không cần hóa đơn
- ✅ Bốc số đơn giản

### 3. Quản lý Queue
- ✅ Gọi bệnh nhân tiếp theo
- ✅ Trả về bệnh nhân trước đó
- ✅ Xem queue của từng counter
- ✅ Xóa queue của counter

### 4. Real-time Communication
- ✅ Kafka events cho real-time updates
- ✅ Heartbeat system để duy trì trạng thái online
- ✅ Event types: PATIENT_ASSIGNED_TO_COUNTER, NEXT_PATIENT_CALLED, RETURN_PREVIOUS_PATIENT

## API Endpoints

### Quản lý Counter
```http
# Lấy danh sách counter có sẵn
GET /api/counter-assignment/counters/available

# Lấy trạng thái tổng quan hệ thống
GET /api/counter-assignment/counters/status

# Xem queue của counter
GET /api/counter-assignment/counters/:counterId/queue

# Bật counter online
POST /api/counter-assignment/counters/:counterId/online

# Tắt counter offline
POST /api/counter-assignment/counters/:counterId/offline

# Xóa queue của counter
DELETE /api/counter-assignment/counters/:counterId/queue

# Gán receptionist cho counter
POST /api/counter-assignment/counters/:counterId/assign-receptionist
{
  "receptionistId": "uuid"
}

# Bỏ gán receptionist khỏi counter
POST /api/counter-assignment/counters/:counterId/unassign-receptionist
```

### Phân bổ bệnh nhân
```http
# Phân bổ theo appointment/invoice
POST /api/counter-assignment/assign
{
  "appointmentId": "uuid",
  "patientProfileId": "uuid",
  "invoiceId": "uuid",
  "patientName": "Nguyễn Văn A",
  "patientAge": 75,
  "patientGender": "MALE",
  "isPregnant": false,
  "isEmergency": false,
  "isElderly": true,
  "isDisabled": false,
  "isVIP": false,
  "priorityLevel": "HIGH",
  "notes": "Bệnh nhân cao tuổi"
}

# Quét hóa đơn và phân bổ
POST /api/counter-assignment/scan-invoice
{
  "invoiceId": "uuid",
  "qrCode": "optional-qr-code",
  "scannedBy": "receptionist-id",
  "deviceId": "electron-app-id"
}

# Phân bổ trực tiếp
POST /api/counter-assignment/direct-assignment
{
  "patientName": "Nguyễn Văn A",
  "patientAge": 30,
  "patientGender": "MALE",
  "isElderly": false,
  "isPregnant": false,
  "isEmergency": false,
  "isDisabled": false,
  "isVIP": false,
  "priorityLevel": "MEDIUM",
  "serviceName": "Khám tổng quát",
  "servicePrice": 200000,
  "assignedBy": "receptionist-id"
}

# Bốc số đơn giản
POST /api/counter-assignment/simple-assignment
{
  "assignedBy": "receptionist-id"
}
```

### Quản lý Queue
```http
# Gọi bệnh nhân tiếp theo
POST /api/counter-assignment/next-patient/:counterId

# Trả về bệnh nhân trước đó
POST /api/counter-assignment/return-previous/:counterId
```

## Kafka Events

### 1. PATIENT_ASSIGNED_TO_COUNTER
```json
{
  "type": "PATIENT_ASSIGNED_TO_COUNTER",
  "appointmentId": "uuid",
  "patientProfileId": "uuid",
  "invoiceId": "uuid",
  "patientName": "Nguyễn Văn A",
  "patientAge": 75,
  "patientGender": "MALE",
  "priorityScore": 600,
  "assignedCounter": {
    "counterId": "uuid",
    "counterCode": "CTR001",
    "counterName": "Quầy 1",
    "receptionistName": "Nguyễn Thị B",
    "estimatedWaitTime": 30
  },
  "serviceName": "Khám tổng quát",
  "servicePrice": 200000,
  "timestamp": "2024-01-15T10:30:00Z",
  "metadata": {
    "isPregnant": false,
    "isEmergency": false,
    "isElderly": true,
    "isDisabled": false,
    "isVIP": false,
    "priorityLevel": "HIGH"
  }
}
```

### 2. NEXT_PATIENT_CALLED
```json
{
  "type": "NEXT_PATIENT_CALLED",
  "counterId": "uuid",
  "patient": {
    "appointmentId": "uuid",
    "patientName": "Nguyễn Văn A",
    "priorityScore": 600,
    "estimatedWaitTime": 30,
    "assignedAt": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:35:00Z"
}
```

### 3. RETURN_PREVIOUS_PATIENT
```json
{
  "type": "RETURN_PREVIOUS_PATIENT",
  "counterId": "uuid",
  "timestamp": "2024-01-15T10:40:00Z"
}
```

## Cách sử dụng

### 1. Khởi tạo hệ thống
```bash
# Tạo counters
node create-test-counters.js

# Gán receptionist cho counters
node assign-receptionists-to-counters.js
```

### 2. Khởi động Kafka
```bash
cd kafka
docker-compose up -d
```

### 3. Chạy Counter Listener
```bash
# Terminal 1 - Quầy 1
KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js 2fbcb7a8-8d35-4eed-83f5-864ad4c876ed

# Terminal 2 - Quầy 2
KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js aab4c3a1-5bad-4ac0-941e-b8eb54d3df94

# Terminal 3 - Quầy 3
KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js a7f3fb78-6be0-496d-a979-4ef9d7d7c6c8

# Terminal 4 - Quầy 4
KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js 594b8989-8f21-4f3f-add7-337d31d87ff7

# Terminal 5 - Quầy Cấp cứu
KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js bf5a33ed-3ee1-4520-a670-138074a48026
```

### 4. Test API
```bash
# Bật counter online
curl -X POST http://localhost:3000/api/counter-assignment/counters/2fbcb7a8-8d35-4eed-83f5-864ad4c876ed/online

# Phân bổ bệnh nhân
curl -X POST http://localhost:3000/api/counter-assignment/simple-assignment \
  -H "Content-Type: application/json" \
  -d '{"assignedBy": "receptionist-id"}'

# Gọi bệnh nhân tiếp theo
curl -X POST http://localhost:3000/api/counter-assignment/next-patient/2fbcb7a8-8d35-4eed-83f5-864ad4c876ed
```

## Tích hợp với Electron App

### 1. Desktop App (Bảng điều khiển chung)
- **Scan hóa đơn**: Quét mã QR và gửi request đến `/api/counter-assignment/scan-invoice`
- **Bốc số**: Gửi request đến `/api/counter-assignment/simple-assignment`
- **Bốc số theo ưu tiên**: Gửi request đến `/api/counter-assignment/direct-assignment`

### 2. Counter App (Bảng đếm số)
- **Hiển thị số đang đến**: Lắng nghe Kafka events `PATIENT_ASSIGNED_TO_COUNTER`
- **Nút chuyển số**: Gửi request đến `/api/counter-assignment/next-patient/:counterId`
- **Nút trả về số trước**: Gửi request đến `/api/counter-assignment/return-previous/:counterId`
- **Nút active**: Gửi request đến `/api/counter-assignment/counters/:counterId/online`

## Lợi ích của hệ thống mới

### 1. Linh hoạt
- Counter có thể hoạt động mà không cần receptionist
- Receptionist có thể được gán vào counter khác nhau
- Dễ dàng thêm/bớt counter mà không ảnh hưởng đến receptionist

### 2. Mở rộng
- Có thể thêm nhiều counter mà không cần thêm receptionist
- Hỗ trợ counter tự động (không cần receptionist)
- Dễ dàng scale theo nhu cầu

### 3. Quản lý
- Quản lý counter và receptionist độc lập
- Theo dõi hiệu suất từng counter
- Phân tích queue và thời gian chờ

### 4. Real-time
- Cập nhật real-time qua Kafka
- Heartbeat system đảm bảo trạng thái chính xác
- Event-driven architecture

## Troubleshooting

### Counter không online
```bash
# Kiểm tra Redis
redis-cli get counterOnline:2fbcb7a8-8d35-4eed-83f5-864ad4c876ed

# Bật counter online thủ công
curl -X POST http://localhost:3000/api/counter-assignment/counters/2fbcb7a8-8d35-4eed-83f5-864ad4c876ed/online
```

### Kafka không nhận được events
```bash
# Kiểm tra Kafka status
docker-compose ps

# Kiểm tra consumer group
kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group revita-counter-2fbcb7a8-8d35-4eed-83f5-864ad4c876ed
```

### Counter không có receptionist
```bash
# Gán receptionist cho counter
curl -X POST http://localhost:3000/api/counter-assignment/counters/2fbcb7a8-8d35-4eed-83f5-864ad4c876ed/assign-receptionist \
  -H "Content-Type: application/json" \
  -d '{"receptionistId": "receptionist-uuid"}'
```
