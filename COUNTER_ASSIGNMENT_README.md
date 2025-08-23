# Counter Assignment System - Enhanced Features

## Overview
Hệ thống phân bổ quầy đã được cải thiện với các tính năng mới để quản lý queue hiệu quả hơn.

## Enhanced Features

### 1. Return Previous Patient Logic
- **Endpoint**: `POST /counter-assignment/return-previous/:counterId`
- **Chức năng**: Trả lại patient hiện tại về đầu queue
- **Logic**:
  - Lấy patient hiện tại đang được phục vụ (patient đầu tiên trong queue)
  - Nếu không có patient nào, trả về thông báo
  - Nếu có patient, đặt lại patient đó vào vị trí đầu queue với priority cao nhất
  - Publish event đến Kafka để thông báo
- **Response**:
  ```json
  {
    "ok": true,
    "patient": {
      "appointmentId": "...",
      "patientName": "...",
      "priorityScore": 100,
      "queueNumber": "A-001",
      "sequence": 1,
      "isPriority": true
    },
    "message": "Patient returned to queue successfully"
  }
  ```

### 2. Queue Number Reset Logic
- **Tự động reset**: Khi queue rỗng, sequence number sẽ được reset về 0
- **Manual reset**: Khi clear queue, sequence cũng được reset
- **Logic**:
  - Mỗi counter có sequence riêng theo ngày (format: `counterSeq:{counterId}:{YYYYMMDD}`)
  - Khi `callNextPatient` và queue rỗng → tự động reset sequence
  - Khi `clearCounterQueue` → reset sequence
  - Queue number format: `{counterCode}-{sequence}` (ví dụ: A-001, B-015)

### 3. Current Patient Management
- **Endpoint**: `GET /counter-assignment/counters/:counterId/current-patient`
- **Chức năng**: Lấy thông tin patient hiện tại đang được phục vụ
- **Response**:
  ```json
  {
    "success": true,
    "patient": {
      "appointmentId": "...",
      "patientName": "...",
      "priorityScore": 100,
      "queueNumber": "A-001",
      "sequence": 1,
      "isPriority": true,
      "assignedAt": "2024-01-01T10:00:00.000Z"
    },
    "hasPatient": true
  }
  ```

### 4. Enhanced Call Next Patient
- **Endpoint**: `POST /counter-assignment/next-patient/:counterId`
- **Cải thiện**:
  - Tự động reset sequence khi queue rỗng
  - Trả về thông báo rõ ràng hơn
- **Response khi có patient**:
  ```json
  {
    "ok": true,
    "patient": {
      "appointmentId": "...",
      "patientName": "...",
      "priorityScore": 100,
      "queueNumber": "A-001"
    }
  }
  ```
- **Response khi queue rỗng**:
  ```json
  {
    "ok": true,
    "message": "No patients in queue, sequence reset if queue was empty"
  }
  ```

## Redis Data Structure

### Queue Storage (ZSET)
- **Key**: `counterQueueZ:{counterId}`
- **Score**: Priority-based scoring
  - Priority patients: `1,000,000,000 - sequence`
  - Normal patients: `0 - sequence`
- **Member**: JSON string của patient data

### Sequence Storage (String)
- **Key**: `counterSeq:{counterId}:{YYYYMMDD}`
- **Value**: Incremental number
- **TTL**: Không có (reset manual)

### Counter Online Status (String)
- **Key**: `counterOnline:{counterId}`
- **Value**: "1"
- **TTL**: 30 seconds (auto-refresh)

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/counters/:counterId/current-patient` | Lấy patient hiện tại |
| POST | `/return-previous/:counterId` | Trả lại patient về queue |
| POST | `/next-patient/:counterId` | Gọi patient tiếp theo |
| DELETE | `/counters/:counterId/queue` | Clear queue + reset sequence |
| GET | `/counters/:counterId/queue` | Lấy danh sách queue |

## Kafka Events

### Return Previous Patient Event
```json
{
  "type": "RETURN_PREVIOUS_PATIENT",
  "counterId": "counter-123",
  "patient": {
    "appointmentId": "...",
    "patientName": "...",
    "priorityScore": 100
  },
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

### Next Patient Called Event
```json
{
  "type": "NEXT_PATIENT_CALLED",
  "counterId": "counter-123",
  "patient": {
    "appointmentId": "...",
    "patientName": "...",
    "priorityScore": 100
  },
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

## Usage Examples

### 1. Return Previous Patient
```bash
curl -X POST http://localhost:3000/counter-assignment/return-previous/counter-123
```

### 2. Get Current Patient
```bash
curl -X GET http://localhost:3000/counter-assignment/counters/counter-123/current-patient
```

### 3. Call Next Patient
```bash
curl -X POST http://localhost:3000/counter-assignment/next-patient/counter-123
```

### 4. Clear Queue (with sequence reset)
```bash
curl -X DELETE http://localhost:3000/counter-assignment/counters/counter-123/queue
```

## Priority Logic

### Priority Score Calculation
1. **Emergency**: +1000 points
2. **Elderly (>70)**: +500 points
3. **Pregnant**: +400 points
4. **Disabled**: +300 points
5. **VIP**: +200 points
6. **Age-based**: +25-100 points
7. **Priority Level**: +25-150 points

### Queue Ordering
- Priority patients được xử lý trước
- Trong cùng priority level, FIFO (First In, First Out)
- Score cao hơn = ưu tiên cao hơn