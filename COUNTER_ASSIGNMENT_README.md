# Hệ thống Phân bổ Quầy Khám với Kafka

## Tổng quan

Hệ thống phân bổ quầy khám tự động sử dụng Kafka để quản lý việc phân bổ bệnh nhân đến các quầy (receptionist) dựa trên hệ thống ưu tiên thông minh.

## Tính năng chính

### 1. Hệ thống Ưu tiên
- **Cấp cứu**: Ưu tiên cao nhất (1000 điểm)
- **Người cao tuổi (>70)**: 500 điểm
- **Phụ nữ có thai**: 400 điểm
- **Người khuyết tật**: 300 điểm
- **VIP**: 200 điểm
- **Độ tuổi**: 60+ (100 điểm), 50+ (50 điểm), 40+ (25 điểm)

### 2. Thuật toán Phân bổ
- Tính điểm ưu tiên cho bệnh nhân
- Đánh giá tải trọng của từng quầy
- Chọn quầy tối ưu dựa trên:
  - Độ dài hàng đợi hiện tại
  - Thời gian xử lý trung bình
  - Điểm ưu tiên của bệnh nhân

### 3. Real-time Communication
- Sử dụng Kafka để gửi thông báo real-time
- Các quầy nhận được thông báo ngay lập tức
- Hỗ trợ ứng dụng Electron

## API Endpoints

### 1. Phân bổ bệnh nhân
```http
POST /api/counter-assignment/assign
Content-Type: application/json
Authorization: Bearer <token>

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
```

### 2. Quét hóa đơn và phân bổ tự động
```http
POST /api/counter-assignment/scan-invoice
Content-Type: application/json
Authorization: Bearer <token>

{
  "invoiceId": "uuid",
  "qrCode": "optional-qr-code",
  "scannedBy": "receptionist-id",
  "deviceId": "electron-app-id"
}
```

### 3. Phân bổ trực tiếp (không cần hóa đơn)
```http
POST /api/counter-assignment/direct-assignment
Content-Type: application/json
Authorization: Bearer <token>

{
  "patientName": "Nguyễn Văn A",
  "patientAge": 75,
  "patientGender": "MALE",
  "patientPhone": "0901234567",
  "serviceName": "Khám tổng quát",
  "servicePrice": 200000,
  "isElderly": true,
  "isPregnant": false,
  "isEmergency": false,
  "isDisabled": false,
  "isVIP": false,
  "priorityLevel": "HIGH",
  "notes": "Bệnh nhân cao tuổi, cần ưu tiên",
  "assignedBy": "receptionist-id"
}
```

### 4. Xem trạng thái quầy
```http
GET /api/counter-assignment/counters/available
Authorization: Bearer <token>
```

### 5. Xem hàng đợi của quầy
```http
GET /api/counter-assignment/counters/{counterId}/queue
Authorization: Bearer <token>
```

### 6. Xem tổng quan hệ thống
```http
GET /api/counter-assignment/counters/status
Authorization: Bearer <token>
```

### 7. Bật/Tắt quầy (thiết bị hoặc web receptionist)
```http
POST /api/counter-assignment/counters/{counterId}/online
POST /api/counter-assignment/counters/{counterId}/offline
```

### 8. Gọi số tiếp theo (Realtime Kafka)
```http
POST /api/counter-assignment/next-patient/{counterId}
```

### 9. Xóa hàng đợi của quầy
```http
DELETE /api/counter-assignment/counters/{counterId}/queue
```

## Kafka Topics

### 1. Counter Assignments
- **Topic**: `counter.assignments`
- **Event Type**: `PATIENT_ASSIGNED_TO_COUNTER`
- **Message Format**:
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
    "counterCode": "CTR123456",
    "counterName": "Counter Nguyễn Thị B",
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

## Cách sử dụng

### 1. Khởi động Kafka
```bash
cd kafka
docker-compose up -d
```

### 2. Chạy Counter Listener
```bash
# Lắng nghe cho một quầy cụ thể
KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js <COUNTER_ID>
```

### 3. Quét hóa đơn từ ứng dụng Electron
```javascript
// Trong ứng dụng Electron
const response = await fetch('http://localhost:3000/api/counter-assignment/scan-invoice', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    invoiceId: scannedInvoiceId,
    scannedBy: currentReceptionistId,
    deviceId: electronAppId
  })
});

const result = await response.json();
console.log('Patient assigned to:', result.assignment.counterName);
```

### 4. Phân bổ trực tiếp từ ứng dụng Electron
```javascript
// Trong ứng dụng Electron - nút "Bốc số"
const response = await fetch('http://localhost:3000/api/counter-assignment/direct-assignment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    patientName: formData.patientName,
    patientAge: formData.patientAge,
    patientGender: formData.patientGender,
    patientPhone: formData.patientPhone,
    serviceName: formData.serviceName,
    servicePrice: formData.servicePrice,
    isElderly: formData.isElderly,
    isPregnant: formData.isPregnant,
    isEmergency: formData.isEmergency,
    isDisabled: formData.isDisabled,
    isVIP: formData.isVIP,
    priorityLevel: formData.priorityLevel,
    notes: formData.notes,
    assignedBy: currentReceptionistId
  })
});

const result = await response.json();
console.log('Patient assigned to:', result.assignment.counterName);
```

## Luồng hoạt động

### Luồng 1: Bệnh nhân có hóa đơn
1. **Bệnh nhân đến quầy** với hóa đơn đã thanh toán
2. **Quét mã QR/hóa đơn** bằng ứng dụng Electron
3. **Hệ thống tự động**:
   - Xác định thông tin bệnh nhân
   - Tính điểm ưu tiên
   - Chọn quầy tối ưu
   - Gửi thông báo qua Kafka
4. **Quầy nhận thông báo** và hiển thị thông tin bệnh nhân
5. **Bệnh nhân được hướng dẫn** đến quầy được phân bổ

### Luồng 2: Bệnh nhân không đặt trước
1. **Bệnh nhân đến quầy** không có hóa đơn
2. **Receptionist nhập thông tin** vào form Electron
3. **Nhấn nút "Bốc số"** để phân bổ trực tiếp
4. **Hệ thống tự động**:
   - Tính điểm ưu tiên dựa trên thông tin nhập
   - Chọn quầy tối ưu
   - Gửi thông báo qua Kafka
5. **Quầy nhận thông báo** và hiển thị thông tin bệnh nhân
6. **Bệnh nhân được hướng dẫn** đến quầy được phân bổ

## Cấu hình Environment Variables

```bash
# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments

# Counter Assignment Settings
COUNTER_MAX_QUEUE=10
COUNTER_HEARTBEAT_TTL=30
COUNTER_HEARTBEAT_INTERVAL_MS=10000
```

## Monitoring và Logging

- Tất cả events được log qua Kafka
- Có thể monitor real-time qua counter listener
- API endpoints trả về thông tin chi tiết về trạng thái hệ thống

## Tích hợp với Electron App

Hệ thống được thiết kế để tích hợp dễ dàng với ứng dụng Electron:

1. **QR Code Scanner**: Quét mã QR từ hóa đơn
2. **Real-time Updates**: Nhận thông báo qua Kafka
3. **UI Updates**: Cập nhật giao diện người dùng real-time
4. **Sound Notifications**: Phát âm thanh thông báo

## Troubleshooting

### Kafka không kết nối được
```bash
# Kiểm tra Kafka status
docker-compose ps

# Restart Kafka
docker-compose restart
```

### Counter không nhận được thông báo
```bash
# Kiểm tra topic
kafka-topics --list --bootstrap-server localhost:9092

# Kiểm tra consumer group
kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group revita-counter-<counter-id>
```

### Lỗi phân bổ
- Kiểm tra quầy có available không
- Kiểm tra thông tin appointment và invoice
- Kiểm tra quyền truy cập API

Luồng xử lý (Counter Assignment)
Online/Offline:
Mỗi quầy (receptionist) online khi Redis có key counterOnline:{counterId} còn TTL.
Heartbeat từ listener Kafka tự gia hạn TTL theo chu kỳ để giữ online.
Offline khi TTL hết hoặc gọi endpoint offline.
Điều kiện available:
isAvailable = isOnline && currentQueueLength < COUNTER_MAX_QUEUE
COUNTER_MAX_QUEUE có thể cấu hình qua biến môi trường (mặc định 10).
Phân bổ bệnh nhân:
Hệ thống tính điểm ưu tiên (cấp cứu, cao tuổi, thai sản, khuyết tật, VIP, độ tuổi, priority level).
Chọn quầy tối ưu dựa trên online + độ dài queue + thời gian xử lý trung bình.
Publish sự kiện Kafka để listener nhận realtime.
Gọi số tiếp theo:
Lấy bệnh nhân đầu queue, loại khỏi queue, publish Kafka sự kiện NEXT_PATIENT_CALLED.
Endpoint (có prefix /api)
Nhóm trạng thái quầy
GET /counter-assignment/counters/available → danh sách quầy và trạng thái available
GET /counter-assignment/counters/status → tổng quan hệ thống
GET /counter-assignment/counters/:counterId/queue → xem queue của quầy
POST /counter-assignment/counters/:counterId/online → set quầy online (thủ công)
POST /counter-assignment/counters/:counterId/offline → set quầy offline (thủ công)
DELETE /counter-assignment/counters/:counterId/queue → xóa queue của quầy
Nhóm phân bổ
POST /counter-assignment/assign → phân bổ theo appointment/invoice (chuẩn)
POST /counter-assignment/scan-invoice → quét hóa đơn rồi phân bổ
POST /counter-assignment/direct-assignment → phân bổ trực tiếp không cần hóa đơn
POST /counter-assignment/simple-assignment → bốc số đơn giản (tạo record runtime + publish)
Gọi số tiếp theo
POST /counter-assignment/next-patient/:counterId → gọi bệnh nhân tiếp theo (publish Kafka realtime)
Lưu ý: Nếu bạn muốn dùng đúng 3 quầy hoạt động, chỉ chạy 3 listener Kafka (mỗi máy quầy một listener). Không dùng các script auto-online cho tất cả.
Biến môi trường quan trọng
COUNTER_MAX_QUEUE: ngưỡng hàng đợi để coi là bận (mặc định 10)
COUNTER_HEARTBEAT_TTL: TTL Redis (mặc định 30s)
COUNTER_HEARTBEAT_INTERVAL_MS: chu kỳ heartbeat (mặc định 10s)
KAFKA_BROKERS, KAFKA_TOPIC_COUNTER_ASSIGNMENTS
REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB