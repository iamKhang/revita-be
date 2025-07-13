# Schedule Management API Tests

Bộ test Postman cho hệ thống quản lý lịch làm việc của bác sĩ.

## Cấu trúc Files

- `doctor-schedule-tests.json`: Test cases cho endpoints của bác sĩ
- `clinic-admin-schedule-tests.json`: Test cases cho endpoints của clinic admin

## Cách sử dụng

### 1. Import vào Postman

1. Mở Postman
2. Click "Import" 
3. Chọn file JSON tương ứng
4. Import collection

### 2. Cấu hình Variables

Trước khi chạy test, cần cấu hình các biến:

#### Doctor Tests:
- `baseUrl`: URL của API server (mặc định: http://localhost:3000)
- `doctorAccessToken`: JWT token của bác sĩ
- `doctorId`: ID của bác sĩ (lấy từ response khi login)

#### Clinic Admin Tests:
- `baseUrl`: URL của API server (mặc định: http://localhost:3000)
- `clinicAdminAccessToken`: JWT token của clinic admin
- `clinicId`: ID của phòng khám (lấy từ response khi login)
- `submissionId`: ID của đơn gửi lịch cần duyệt/từ chối
- `requestId`: ID của yêu cầu cần xử lý

### 3. Lấy Access Token

Sử dụng endpoint login để lấy access token:

```bash
POST /auth/login
{
  "phoneOrEmail": "doctor@example.com",
  "password": "password123"
}
```

Copy `accessToken` từ response và paste vào biến tương ứng.

### 4. Chạy Tests

#### Quy trình test cho Doctor:
1. **Create Monthly Schedule**: Tạo lịch cố định hàng tháng
2. **Create Schedule Request**: Tạo các loại yêu cầu thay đổi lịch
3. **Get My Schedules**: Xem lịch của mình
4. **Get My Requests**: Xem yêu cầu của mình

#### Quy trình test cho Clinic Admin:
1. **Get Clinic Schedules**: Xem tất cả lịch trong phòng khám
2. **Get Clinic Requests**: Xem tất cả yêu cầu trong phòng khám
3. **Approve/Reject Schedule**: Duyệt/từ chối lịch cố định
4. **Process Requests**: Xử lý yêu cầu thay đổi lịch

## Test Scenarios

### Doctor Endpoints

#### 1. Tạo lịch cố định hàng tháng
- **Endpoint**: `POST /doctor/schedule/monthly`
- **Mục đích**: Bác sĩ gửi lịch làm việc cố định cho tháng tiếp theo
- **Test data**: Danh sách các ngày làm việc cụ thể với các ca làm việc trong ngày

#### 2. Tạo yêu cầu thay đổi lịch
- **Endpoint**: `POST /doctor/schedule/request`
- **Các loại yêu cầu**:
  - `ADD_HOURS`: Thêm giờ làm việc
  - `CANCEL_HOURS`: Hủy giờ làm việc
  - `FULL_DAY_OFF`: Nghỉ cả ngày

#### 3. Xem lịch và yêu cầu
- **Endpoints**:
  - `GET /doctor/schedule/monthly` - Xem đơn gửi lịch hàng tháng
  - `GET /doctor/schedule/working-days` - Xem ngày làm việc cụ thể
  - `GET /doctor/schedule/requests` - Xem yêu cầu thay đổi lịch
- **Filters**: Có thể filter theo tháng, năm, trạng thái, khoảng thời gian

### Clinic Admin Endpoints

#### 1. Quản lý lịch cố định
- **Endpoints**:
  - `GET /clinic-admin/schedule/monthly`
  - `PUT /clinic-admin/schedule/monthly/:id/approve`
  - `PUT /clinic-admin/schedule/monthly/:id/reject`

#### 2. Xử lý yêu cầu thay đổi lịch
- **Endpoint**: `PUT /clinic-admin/schedule/requests/:id/process`
- **Xử lý xung đột**: Khi có xung đột với lịch bệnh nhân:
  - `CANCEL_APPOINTMENTS`: Hủy lịch hẹn
  - `RESCHEDULE_APPOINTMENTS`: Dời lịch hẹn
  - `REJECT_REQUEST`: Từ chối yêu cầu

## Error Cases

### Common Errors:
- `401 Unauthorized`: Token không hợp lệ hoặc hết hạn
- `403 Forbidden`: Không có quyền truy cập
- `400 Bad Request`: Dữ liệu không hợp lệ
- `404 Not Found`: Không tìm thấy resource

### Business Logic Errors:
- Tạo lịch trùng lặp cho cùng tháng
- Yêu cầu thay đổi lịch cho ngày trong quá khứ
- Xung đột thời gian trong lịch làm việc
- Xung đột với lịch hẹn bệnh nhân

## Notes

- Tất cả endpoints đều yêu cầu JWT authentication
- Bác sĩ chỉ có thể xem/tạo lịch của mình
- Clinic admin chỉ có thể quản lý lịch của bác sĩ trong phòng khám của mình
- Thời gian phải theo format HH:mm (24h)
- Ngày phải theo format YYYY-MM-DD
