# 🚀 HƯỚNG DẪN TRIỂN KHAI DESKTOP COUNTER APP

## 📋 TỔNG QUAN

**Desktop Counter App** chỉ **lắng nghe** và **phục vụ** bệnh nhân được kiosk phân công tự động.

---

## 🔗 **1. WEBSOCKET CONNECTION**

### **Kết nối:**
- **URL**: `ws://localhost:3000/counters`
- **Namespace**: `/counters`
- **Library**: `socket.io-client`

### **Events gửi lên server:**
```javascript
// Tham gia counter
socket.emit('join_counter', { counterId: 'CTR001' });

// Rời khỏi counter
socket.emit('leave_counter');

// Ping kiểm tra kết nối
socket.emit('ping');
```

### **Events lắng nghe từ server:**
```javascript
socket.on('joined_counter', (data) => {
    // data: { counterId: 'CTR001', message: 'Connected to counter CTR001' }
});

socket.on('left_counter', (data) => {
    // data: { message: 'Left counter' }
});

socket.on('new_ticket', (data) => {
    // data: { ticketId, patientName, priorityLevel, counterId, queueNumber, ... }
});

socket.on('ticket_processed', (data) => {
    // data: { ticketId, counterId, patientId, processedAt }
});

socket.on('pong', (data) => {
    // data: { timestamp: '2024-01-01T10:30:00Z' }
});
```

---

## 📡 **2. REST API CALLS**

### **2.1 Lấy danh sách counters:**

#### **GET `/api/counter-assignment/counters`**
- **Truyền vào**: Không có parameters
- **Nhận được**:
```json
{
  "counters": [
    {
      "counterId": "2e7f1f80-c063-4bbd-9092-777a82926e25",
      "counterCode": "CTR001",
      "counterName": "Quầy Tiếp Nhận 1",
      "location": "Tầng 1 - Khu A"
    },
    {
      "counterId": "f424b25b-f164-4115-8d30-6602418ee046",
      "counterCode": "CTR002",
      "counterName": "Quầy Tiếp Nhận 2",
      "location": "Tầng 1 - Khu B"
    }
  ]
}
```

### **2.2 Lấy dữ liệu ban đầu:**

#### **GET `/api/counter-assignment/counters/{counterId}/current-patient`**
- **Truyền vào**: `counterId` (path parameter)
- **Nhận được**:
```json
{
  "success": true,
  "patient": {
    "ticketId": "T001",
    "patientName": "Nguyễn Văn A",
    "patientPhone": "0912345678",
    "priorityLevel": "NORMAL",
    "queueNumber": "T001",
    "startedAt": "2024-01-01T10:30:00Z"
  },
  "hasPatient": true
}
```

#### **GET `/api/counter-assignment/counters/{counterId}/queue`**
- **Truyền vào**: `counterId` (path parameter)
- **Nhận được**:
```json
{
  "queue": [
    {
      "ticketId": "T002",
      "patientName": "Trần Thị B",
      "patientPhone": "0987654321",
      "priorityLevel": "EMERGENCY",
      "queueNumber": "T002",
      "createdAt": "2024-01-01T10:25:00Z"
    }
  ]
}
```

### **2.2 Gọi bệnh nhân tiếp theo:**

#### **POST `/api/counter-assignment/next-patient/{counterId}`**
- **Truyền vào**: `counterId` (path parameter), body rỗng
- **Nhận được**:
```json
{
  "patient": {
    "ticketId": "T002",
    "patientName": "Trần Thị B",
    "patientPhone": "0987654321",
    "priorityLevel": "EMERGENCY",
    "queueNumber": "T002",
    "startedAt": "2024-01-01T10:35:00Z"
  },
  "message": "Next patient called successfully"
}
```

### **2.3 Bỏ qua bệnh nhân hiện tại:**

#### **POST `/api/counter-assignment/skip-current/{counterId}`**
- **Truyền vào**: `counterId` (path parameter), body rỗng
- **Nhận được**:
```json
{
  "patient": {
    "ticketId": "T003",
    "patientName": "Lê Văn C",
    "patientPhone": "0123456789",
    "priorityLevel": "NORMAL",
    "queueNumber": "T003",
    "startedAt": "2024-01-01T10:36:00Z"
  },
  "skippedPatient": {
    "ticketId": "T002",
    "patientName": "Trần Thị B"
  },
  "message": "Patient skipped, next patient called"
}
```

### **2.4 Hoàn thành phục vụ:**

#### **POST `/api/routing/status/completed`**
- **Truyền vào**: body JSON
```json
{
  "patientProfileId": "patient-uuid-1",
  "roomId": "room-uuid-1"
}
```
- **Nhận được**:
```json
{
  "message": "Patient status updated to COMPLETED"
}
```

---

## 🔄 **3. LUỒNG HOẠT ĐỘNG**

### **Khởi động:**
1. Kết nối WebSocket đến `ws://localhost:3000/counters`
2. Load counterId đã lưu từ localStorage
3. Gửi `join_counter` event
4. Gọi API lấy current patient + queue
5. Lắng nghe WebSocket events

### **Nhận ticket mới:**
1. Kiosk gọi `POST /api/take-number/take`
2. Server tính ưu tiên, tạo ticket, ghi Redis Stream, và CHÈN NGAY ticket vào hàng đợi ưu tiên ZSET của quầy (status = `READY`, `callCount` = 0)
3. Server broadcast `new_ticket` event
4. Desktop app nhận event và cập nhật hiển thị

### **Phục vụ bệnh nhân:**
1. User click "Call Next"
2. Gọi `POST /api/counter-assignment/next-patient/{counterId}`
3. Server tăng "turn", xử lý các ticket đến hạn được chèn lại (MISSED sau 3 lượt), lấy ticket có ưu tiên cao nhất từ ZSET, set `status = SERVING`, tăng `callCount`, di chuyển vào current
4. Server broadcast `ticket_processed` và `ticket_status`
5. Desktop app update UI

### **Bỏ qua/nhỡ lịch:**
- Bấm Skip: `POST /api/counter-assignment/skip-current/{counterId}`
- Server sẽ:
  - Nếu `callCount >= 5`: đặt `status = CANCELLED` (không chèn lại), ghi history
  - Ngược lại: đặt `status = MISSED`, lên lịch chèn lại sau 3 lượt (khi gọi Next tăng turn và tái chèn), không mất ưu tiên
  - Xóa current
  - Phát `ticket_status`

---

## ⚙️ **4. XỬ LÝ EVENTS**

### **WebSocket Events:**

#### **joined_counter:**
- Lưu counterId
- Load initial data
- Update UI status

#### **new_ticket:**
- Check `data.counterId === currentCounterId`
- Thêm vào patientQueue array
- Update queue UI
- Show notification

#### **ticket_processed:**
- Check `data.counterId === currentCounterId`
- Refresh current patient + queue data
- Update UI

### **Error Handling:**
- WebSocket disconnect → Auto reconnect
- API call fail → Show error message
- Invalid counter → Prompt re-enter counterId

---

## 📋 **5. THỰC HIỆN THEO BƯỚC**

### **Bước 1: Lấy danh sách counters**
```javascript
// GET /api/counter-assignment/counters
// Hiển thị dropdown để user chọn counter
```

### **Bước 2: Setup WebSocket**
```javascript
const socket = io('ws://localhost:3000/counters');
// Setup event listeners
```

### **Bước 3: Join Counter**
```javascript
socket.emit('join_counter', { counterId: selectedCounterId });
```

### **Bước 4: Load Data**
```javascript
// GET /api/counter-assignment/counters/CTR001/current-patient
// GET /api/counter-assignment/counters/CTR001/queue
```

### **Bước 5: Handle Actions**
```javascript
// Call next: POST /api/counter-assignment/next-patient/CTR001
// Skip current: POST /api/counter-assignment/skip-current/CTR001
```

### **Bước 6: Listen Events**
```javascript
socket.on('new_ticket', handleNewTicket);
socket.on('ticket_processed', handleTicketProcessed);
```

### **❓ Tại sao console logs in liên tục?**
```bash
[consumer-58464-xxx] Reading messages from stream...
[consumer-58464-xxx] Found 0 messages
```

**ĐÚNG! NestJS server POLLING Redis liên tục (internal mechanism)**

#### **NestJS Redis Consumer thực sự:**
- Gọi `redis.xreadgroup()` liên tục trong vòng lặp
- Mỗi giây polling Redis stream để check messages mới
- Khi có message → xử lý logic → broadcast WebSocket

#### **Desktop app hoàn toàn khác:**
- **KHÔNG** polling gì cả
- Chỉ connect WebSocket 1 lần
- Nhận push notifications real-time

**Polling là cần thiết cho Redis Streams architecture!**

---

## ⚠️ **LƯU Ý QUAN TRỌNG**

- **KHÔNG** gọi `POST /api/take-number/take` (để kiosk làm)
- **KHÔNG** gọi các manual assignment endpoints (đã xóa)
- **KHÔNG** polling liên tục như Redis consumer (đó là server-side)
- **CHỈ** connect WebSocket 1 lần và lắng nghe events
- **CHỈ** call next/skip khi nhân viên nhấn button
- Luôn check `counterId` trong events để đảm bảo đúng counter
- Handle network errors và auto-reconnect
