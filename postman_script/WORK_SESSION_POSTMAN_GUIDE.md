# Work Session API - Postman Testing Guide

## Cài đặt

### 1. Import Collection và Environment

1. **Import Collection:**
   - Mở Postman
   - Click "Import" 
   - Chọn file `work-session-api.postman_collection.json`

2. **Import Environment:**
   - Click "Import"
   - Chọn file `revita-local-environment.json`
   - Chọn environment "Revita Local Environment"

### 2. Cấu hình Environment Variables

Đảm bảo các biến sau được cấu hình đúng trong environment:

```json
{
  "baseUrl": "http://localhost:3000/api",
  "doctorIdentifier": "nguyenminhduc@clinic.com",
  "doctorPassword": "123456",
  "technicianIdentifier": "technician@clinic.com", 
  "technicianPassword": "123456",
  "adminIdentifier": "admin@clinic.com",
  "adminPassword": "123456",
  "boothId": "booth-uuid-1",
  "serviceId1": "service-uuid-1",
  "serviceId2": "service-uuid-2",
  "serviceId3": "service-uuid-3",
  "serviceId4": "service-uuid-4",
  "serviceId5": "service-uuid-5"
}
```

## Quy trình Test

### Bước 1: Authentication
Chạy các request authentication theo thứ tự:

1. **Login as Doctor** - Lấy token cho bác sĩ
2. **Login as Technician** - Lấy token cho kỹ thuật viên  
3. **Login as Admin** - Lấy token cho admin

> **Lưu ý:** Các token sẽ được tự động lưu vào environment variables

### Bước 2: Tạo Work Sessions

#### 2.1. Doctor tạo lịch cho chính mình
- **Create Work Sessions (Doctor)**
- Tạo 2 phiên làm việc: 8h-12h và 14h-18h ngày 15/1/2025

#### 2.2. Technician tạo lịch cho chính mình  
- **Create Work Sessions (Technician)**
- Tạo 1 phiên làm việc: 9h-13h ngày 15/1/2025

#### 2.3. Admin tạo lịch cho doctor
- **Create Work Sessions (Admin for Doctor)**
- Admin tạo lịch cho doctor: 8h-12h ngày 16/1/2025

#### 2.4. Test validation trùng lịch
- **Test Conflict Validation (Should Fail)**
- Thử tạo phiên 9h-13h cho doctor (trùng với phiên 8h-12h đã tạo)
- **Kết quả mong đợi:** Lỗi 400 Bad Request

### Bước 3: Xem Work Sessions

#### 3.1. Xem lịch của bản thân
- **Get My Schedule (Doctor)** - Bác sĩ xem lịch của mình
- **Get My Schedule (Technician)** - Kỹ thuật viên xem lịch của mình

#### 3.2. Admin xem lịch của người khác
- **Get User Work Sessions (Admin)** - Admin xem lịch của doctor
- **Get All Work Sessions (Admin)** - Admin xem tất cả lịch với filter

#### 3.3. Xem lịch theo các tiêu chí khác
- **Get Work Session by ID** - Xem chi tiết 1 phiên làm việc
- **Get Work Sessions by Booth** - Xem lịch theo booth
- **Get Work Sessions by Date** - Xem lịch theo ngày

### Bước 4: Cập nhật Work Sessions

#### 4.1. Doctor cập nhật lịch của mình
- **Update Work Session (Doctor)**
- Thay đổi thời gian và status thành APPROVED

#### 4.2. Admin cập nhật lịch
- **Update Work Session (Admin)**
- Admin duyệt lịch (status = APPROVED)

#### 4.3. Test validation khi cập nhật
- **Test Update Conflict (Should Fail)**
- Thử cập nhật tạo conflict với phiên khác
- **Kết quả mong đợi:** Lỗi 400 Bad Request

### Bước 5: Xóa Work Sessions

#### 5.1. Doctor xóa lịch của mình
- **Delete Work Session (Doctor)**

#### 5.2. Admin xóa lịch
- **Delete Work Session (Admin)**

### Bước 6: Test Phân quyền

#### 6.1. Test quyền tạo lịch
- **Doctor tries to create for another doctor (Should Fail)**
- Doctor thử tạo lịch cho technician khác
- **Kết quả mong đợi:** Lỗi 400 Bad Request

#### 6.2. Test quyền xem lịch
- **Technician tries to view doctor's schedule (Should Fail)**
- Technician thử xem lịch của doctor
- **Kết quả mong đợi:** Lỗi 400 Bad Request

#### 6.3. Test quyền cập nhật lịch
- **Doctor tries to update technician's session (Should Fail)**
- Doctor thử cập nhật lịch của technician
- **Kết quả mong đợi:** Lỗi 400 Bad Request

## Kết quả mong đợi

### ✅ Thành công (200/201)
- Tạo, xem, cập nhật, xóa work sessions thành công
- Validation trùng lịch hoạt động đúng
- Phân quyền hoạt động đúng

### ❌ Lỗi mong đợi (400/403)
- **400 Bad Request:** Trùng lịch, dữ liệu không hợp lệ
- **403 Forbidden:** Không có quyền thực hiện hành động
- **404 Not Found:** Không tìm thấy work session/user/booth/service

## Troubleshooting

### 1. Lỗi 401 Unauthorized
- Kiểm tra token có được lưu đúng không
- Chạy lại các request authentication

### 2. Lỗi 404 Not Found
- Kiểm tra các ID trong environment variables
- Đảm bảo database đã có dữ liệu test

### 3. Lỗi 500 Internal Server Error
- Kiểm tra server có đang chạy không
- Xem logs của server để debug

## Dữ liệu Test

### Users cần có trong database:
- **Doctor:** nguyenminhduc@clinic.com / 123456
- **Technician:** technician@clinic.com / 123456  
- **Admin:** admin@clinic.com / 123456

### Dữ liệu cần có:
- **Booth:** booth-uuid-1
- **Services:** service-uuid-1, service-uuid-2, service-uuid-3, service-uuid-4, service-uuid-5

## Chạy Collection tự động

1. Click vào collection "Work Session Management API"
2. Click "Run" 
3. Chọn environment "Revita Local Environment"
4. Click "Run Work Session Management API"

> **Lưu ý:** Chạy theo đúng thứ tự để test đầy đủ các tính năng

