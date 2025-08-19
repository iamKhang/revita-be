# Hướng dẫn Test Counter Assignment với Postman

## 🚀 Chuẩn bị

### 1. Khởi động hệ thống
```bash
# Khởi động Kafka
cd kafka && docker compose up -d

# Khởi động API server
npm run start:dev
```

### 2. Chạy Counter Listeners (mỗi terminal một quầy)

**Terminal 1 - Quầy 1:**
```bash
KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js c9d215bc-a273-4dac-99c2-0ef6031889b2
```

**Terminal 2 - Quầy 2:**
```bash
KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js f394ccaa-9e0c-4293-94bc-041334d040d8
```

**Terminal 3 - Quầy 3:**
```bash
KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js a427fbdd-fd6c-41d8-84d3-1e23ba91263b
```

**Terminal 4 - Quầy 4:**
```bash
KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js 418f439e-5b01-4c36-8a22-02abd3227ce4
```

**Terminal 5 - Quầy 5:**
```bash
KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js ef9db3e2-9f73-4fad-94c9-122d258981ef
```

## 📥 Import Postman Collection

1. Mở Postman
2. Click "Import"
3. Chọn file: `postman_script/counter-assignment-collection.json`
4. Collection sẽ được import với tên "Counter Assignment API"

## ⚙️ Cấu hình Variables

### 1. Cập nhật Variables
Trong collection, click vào tab "Variables" và cập nhật:

- **baseUrl**: `http://localhost:3000`
- **token**: JWT token của receptionist (lấy từ login API)
- **receptionistId**: ID của receptionist (có thể thay đổi để test)

### 2. Lấy JWT Token
```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "identifier": "receptionist@gmail.com",
  "password": "password"
}
```

## 🧪 Test Cases

### Test Case 1: Kiểm tra hệ thống
1. **Get Available Counters** - Xem danh sách quầy có sẵn
2. **Get System Status** - Xem tổng quan hệ thống

### Test Case 2: Bốc số đơn thuần
1. **Simple Assignment** - Test bốc số không cần thông tin
2. Xem thông báo xuất hiện trong terminal counter listener

### Test Case 3: Phân bổ với thông tin chi tiết
1. **Test Case 1: Bệnh nhân cao tuổi** - Ưu tiên cao
2. **Test Case 2: Phụ nữ có thai** - Ưu tiên cao
3. **Test Case 3: Bệnh nhân cấp cứu** - Ưu tiên cao nhất
4. **Test Case 4: Bệnh nhân thường** - Ưu tiên trung bình

### Test Case 4: Test nhiều quầy
1. Thay đổi `receptionistId` trong variables
2. Gửi request phân bổ
3. Xem thông báo xuất hiện ở quầy tương ứng

## 🎯 Kịch bản Test Realtime

### Kịch bản 1: Phân bổ tuần tự
1. Gửi **Simple Assignment** → Xem quầy nào nhận
2. Gửi **Bệnh nhân cao tuổi** → Xem quầy nào nhận
3. Gửi **Bệnh nhân cấp cứu** → Xem quầy nào nhận
4. Gửi **Bệnh nhân thường** → Xem quầy nào nhận

### Kịch bản 2: Phân bổ đồng thời
1. Mở nhiều tab Postman
2. Gửi cùng lúc nhiều request phân bổ
3. Xem hệ thống phân bổ thông minh

### Kịch bản 3: Test ưu tiên
1. Gửi **Bệnh nhân thường** trước
2. Gửi **Bệnh nhân cấp cứu** sau
3. Xem bệnh nhân cấp cứu có được ưu tiên không

## 📊 Monitoring

### 1. Xem hàng đợi
```http
GET {{baseUrl}}/counter-assignment/counters/{{receptionistId}}/queue
```

### 2. Xem trạng thái hệ thống
```http
GET {{baseUrl}}/counter-assignment/counters/status
```

## 🔍 Expected Results

### 1. Counter Listener Output
Mỗi terminal sẽ hiển thị:
```json
{
  "receivedAt": "2025-08-19T06:30:00.000Z",
  "eventType": "PATIENT_ASSIGNED_TO_COUNTER",
  "patientName": "Nguyễn Văn A",
  "patientAge": 75,
  "priorityScore": 675,
  "assignedCounter": {
    "counterId": "c9d215bc-a273-4dac-99c2-0ef6031889b2",
    "counterName": "Counter Lê Hoàng Khang",
    "estimatedWaitTime": 30
  }
}
```

### 2. API Response
```json
{
  "success": true,
  "assignment": {
    "counterId": "c9d215bc-a273-4dac-99c2-0ef6031889b2",
    "counterCode": "CTR123456",
    "counterName": "Counter Lê Hoàng Khang",
    "receptionistName": "Lê Hoàng Khang",
    "priorityScore": 675,
    "estimatedWaitTime": 30
  },
  "queueNumber": "Q123456"
}
```

## 🚨 Troubleshooting

### 1. Kafka không kết nối
```bash
# Kiểm tra Kafka status
docker compose ps

# Restart Kafka
docker compose restart
```

### 2. Counter listener không nhận thông báo
- Kiểm tra counterId có đúng không
- Kiểm tra topic name
- Kiểm tra Kafka connection

### 3. API trả về lỗi
- Kiểm tra JWT token
- Kiểm tra quyền truy cập
- Kiểm tra request body format

## 🎉 Success Criteria

✅ **Test thành công khi:**
- Counter listener nhận được thông báo real-time
- Hệ thống phân bổ đúng quầy dựa trên ưu tiên
- Nhiều quầy có thể hoạt động đồng thời
- Thông báo xuất hiện đúng ở quầy được phân bổ
- API trả về response đúng format
