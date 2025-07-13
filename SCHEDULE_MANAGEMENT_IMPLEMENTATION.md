# Hệ thống Quản lý Lịch Làm việc Bác sĩ - Thiết kế Cải tiến

## Tổng quan

Đã hoàn thành việc xây dựng hệ thống quản lý lịch làm việc của bác sĩ với thiết kế cải tiến, hỗ trợ:

1. **Lịch theo ngày cụ thể**: Bác sĩ có thể đặt lịch cho từng ngày cụ thể thay vì theo pattern tuần
2. **Nhiều ca trong ngày**: Mỗi ngày có thể có nhiều ca làm việc (sáng, chiều, tối)
3. **Lịch không đều đặn**: Không bắt buộc theo quy luật tuần cố định
4. **Yêu cầu đột xuất**: Bác sĩ có thể tạo yêu cầu thêm giờ, hủy giờ, nghỉ nguyên ngày
5. **Xử lý xung đột**: Hệ thống kiểm tra và xử lý xung đột với lịch hẹn bệnh nhân

## Cấu trúc Database Mới

### Models được thiết kế lại:

#### 1. MonthlyScheduleSubmission (Đơn gửi lịch hàng tháng)
```prisma
model MonthlyScheduleSubmission {
  id          String      @id @default(uuid())
  doctorId    String      @map("doctor_id")
  month       Int         // Tháng (1-12)
  year        Int         // Năm
  status      ScheduleStatus @default(PENDING)
  submittedAt DateTime    @default(now()) @map("submitted_at")
  approvedAt  DateTime?   @map("approved_at")
  approvedBy  String?     @map("approved_by")
  rejectedReason String?  @map("rejected_reason")
  workingDays DoctorWorkingDay[] // Các ngày làm việc trong tháng

  @@unique([doctorId, month, year])
}
```

#### 2. DoctorWorkingDay (Ngày làm việc cụ thể)
```prisma
model DoctorWorkingDay {
  id          String      @id @default(uuid())
  doctorId    String      @map("doctor_id")
  submissionId String     @map("submission_id")
  workingDate DateTime    @map("working_date") // Ngày cụ thể
  isActive    Boolean     @default(true) @map("is_active")
  sessions    WorkingSession[] // Các ca làm việc trong ngày

  @@unique([doctorId, workingDate])
}
```

#### 3. WorkingSession (Ca làm việc trong ngày)
```prisma
model WorkingSession {
  id          String      @id @default(uuid())
  workingDayId String     @map("working_day_id")
  startTime   String      @map("start_time") // HH:mm
  endTime     String      @map("end_time")   // HH:mm
  sessionType String?     @map("session_type") // morning, afternoon, evening, night
  description String?     // Mô tả ca làm việc
  isActive    Boolean     @default(true) @map("is_active")
}
```

#### 2. ScheduleRequest (Yêu cầu thay đổi lịch)
```prisma
model ScheduleRequest {
  id            String      @id @default(uuid())
  requestCode   String      @unique @map("request_code")
  doctorId      String      @map("doctor_id")
  requestType   RequestType @map("request_type")
  status        RequestStatus @default(PENDING)
  requestDate   DateTime    @map("request_date")
  startTime     String?     @map("start_time")
  endTime       String?     @map("end_time")
  reason        String?
  description   String?
  createdAt     DateTime    @default(now()) @map("created_at")
  processedAt   DateTime?   @map("processed_at")
  processedBy   String?     @map("processed_by")
  adminNote     String?     @map("admin_note")
}
```

#### 3. Enums mới:
- `ScheduleStatus`: PENDING, APPROVED, REJECTED
- `RequestType`: MONTHLY_SCHEDULE, ADD_HOURS, CANCEL_HOURS, FULL_DAY_OFF
- `RequestStatus`: PENDING, APPROVED, REJECTED

## API Endpoints

### Endpoints cho Bác sĩ (Doctor)

#### 1. Tạo lịch cố định hàng tháng
```
POST /doctor/schedule/monthly
```
**Body:**
```json
{
  "month": 12,
  "year": 2024,
  "workingDays": [
    {
      "workingDate": "2024-12-03",
      "sessions": [
        {
          "startTime": "08:00",
          "endTime": "12:00",
          "sessionType": "morning",
          "description": "Khám bệnh tổng quát"
        },
        {
          "startTime": "14:00",
          "endTime": "17:00",
          "sessionType": "afternoon",
          "description": "Khám chuyên khoa"
        }
      ]
    },
    {
      "workingDate": "2024-12-05",
      "sessions": [
        {
          "startTime": "09:00",
          "endTime": "11:00",
          "sessionType": "morning"
        }
      ]
    }
  ]
}
```

#### 2. Tạo yêu cầu thay đổi lịch đột xuất
```
POST /doctor/schedule/request
```
**Body:**
```json
{
  "requestType": "ADD_HOURS", // hoặc "CANCEL_HOURS", "FULL_DAY_OFF"
  "requestDate": "2024-12-15",
  "startTime": "18:00", // không cần cho FULL_DAY_OFF
  "endTime": "20:00",   // không cần cho FULL_DAY_OFF
  "reason": "Có ca cấp cứu cần hỗ trợ",
  "description": "Mô tả chi tiết"
}
```

#### 3. Xem đơn gửi lịch cố định của mình
```
GET /doctor/schedule/monthly?month=12&year=2024&status=PENDING
```

#### 4. Xem ngày làm việc cụ thể của mình
```
GET /doctor/schedule/working-days?startDate=2024-12-01&endDate=2024-12-31&activeOnly=true
```

#### 5. Xem yêu cầu thay đổi lịch của mình
```
GET /doctor/schedule/requests?status=PENDING&page=1&limit=10
```

### Endpoints cho Clinic Admin

#### 1. Xem tất cả đơn gửi lịch cố định trong phòng khám
```
GET /clinic-admin/schedule/monthly?month=12&year=2024&doctorId=uuid
```

#### 2. Xem tất cả ngày làm việc cụ thể trong phòng khám
```
GET /clinic-admin/schedule/working-days?startDate=2024-12-01&endDate=2024-12-31&doctorId=uuid
```

#### 3. Xem tất cả yêu cầu thay đổi lịch trong phòng khám
```
GET /clinic-admin/schedule/requests?status=PENDING&doctorId=uuid&page=1&limit=10
```

#### 4. Duyệt đơn gửi lịch cố định hàng tháng
```
PUT /clinic-admin/schedule/monthly/:submissionId/approve
```

#### 5. Từ chối đơn gửi lịch cố định hàng tháng
```
PUT /clinic-admin/schedule/monthly/:submissionId/reject
```
**Body:**
```json
{
  "reason": "Lý do từ chối"
}
```

#### 6. Xử lý yêu cầu thay đổi lịch
```
PUT /clinic-admin/schedule/requests/:requestId/process
```
**Body:**
```json
{
  "status": "APPROVED", // hoặc "REJECTED"
  "adminNote": "Ghi chú của admin",
  "conflictAction": "CANCEL_APPOINTMENTS", // khi có xung đột
  "affectedAppointments": ["appointment-id-1", "appointment-id-2"]
}
```

## Tính năng chính

### 1. Validation và Business Logic
- Kiểm tra xung đột thời gian giữa các ca làm việc trong cùng ngày
- Validate format thời gian (HH:mm) và logic thời gian
- Không cho phép tạo yêu cầu cho ngày trong quá khứ
- Mỗi bác sĩ chỉ có 1 đơn gửi lịch cho mỗi tháng
- Kiểm tra ngày làm việc phải thuộc tháng/năm được gửi
- Mỗi ngày phải có ít nhất một ca làm việc
- Không cho phép trùng lặp ngày làm việc trong cùng đơn gửi

### 2. Xử lý xung đột với lịch hẹn bệnh nhân
Khi admin duyệt yêu cầu CANCEL_HOURS hoặc FULL_DAY_OFF:
- **CANCEL_APPOINTMENTS**: Hủy tất cả lịch hẹn bị ảnh hưởng
- **RESCHEDULE_APPOINTMENTS**: Đánh dấu cần dời lịch
- **REJECT_REQUEST**: Từ chối yêu cầu để giữ nguyên lịch hẹn

### 3. Phân quyền và bảo mật
- JWT authentication cho tất cả endpoints
- Bác sĩ chỉ có thể xem/tạo lịch của mình
- Clinic admin chỉ có thể quản lý lịch của bác sĩ trong phòng khám của mình
- Middleware tự động load thông tin doctor/clinicAdmin vào request

### 4. Audit Trail
- Lưu thông tin người duyệt và thời gian duyệt
- Lưu ghi chú của admin khi xử lý yêu cầu
- Tracking trạng thái thay đổi

## Cấu trúc Code

```
src/schedule/
├── controllers/
│   ├── doctor-schedule.controller.ts
│   └── clinic-admin-schedule.controller.ts
├── services/
│   └── schedule.service.ts
├── dto/
│   ├── create-monthly-schedule.dto.ts
│   ├── create-schedule-request.dto.ts
│   ├── process-schedule-request.dto.ts
│   ├── query-schedule.dto.ts
│   └── index.ts
├── middleware/
│   └── user-context.middleware.ts
└── schedule.module.ts
```

## Test Scripts

Đã tạo bộ test Postman hoàn chỉnh:
- `postman_script/schedule/doctor-schedule-tests.json`
- `postman_script/schedule/clinic-admin-schedule-tests.json`
- `postman_script/schedule/README.md`

## Migration Database

Đã tạo migration: `20250711124553_add_doctor_schedule_management`

## Cách sử dụng

1. **Import Postman collections** từ thư mục `postman_script/schedule/`
2. **Cấu hình variables**: baseUrl, accessToken
3. **Lấy JWT token** bằng cách login với tài khoản doctor/clinic_admin
4. **Chạy test scenarios** theo thứ tự trong README

## Lưu ý

- Tất cả thời gian sử dụng format 24h (HH:mm)
- Ngày sử dụng format ISO (YYYY-MM-DD)
- Hệ thống hỗ trợ pagination cho danh sách yêu cầu
- Có thể filter theo nhiều tiêu chí (tháng, năm, trạng thái, bác sĩ)
- Middleware tự động load context user để tối ưu performance
