# Postman Collections - Updated for New API

## 🔄 Thay đổi chính

### ✅ **Environment Variables được cập nhật**
- Thêm `technicianAuthId` và `adminAuthId` 
- Sử dụng đúng email từ database: `technician@clinic.com`, `admin@clinic.com`

### ✅ **Login Scripts được cải thiện**
- Lưu đầy đủ thông tin: `token`, `id`, `authId`
- Thêm error handling với console logs
- Hiển thị tên user khi login thành công

### ✅ **API Requests được cập nhật**
- Loại bỏ `userId` và `userType` khỏi request body
- Chỉ cần `startTime`, `endTime`, `serviceIds`
- Sử dụng `authId` thay vì `userId` trong URLs

## 📁 Files đã cập nhật

### 1. `revita-local-environment.json`
```json
{
  "technicianIdentifier": "technician@clinic.com",
  "technicianPassword": "123456", 
  "technicianAuthId": "auth-uuid-21",
  "adminIdentifier": "admin@clinic.com",
  "adminPassword": "123456",
  "adminAuthId": "auth-uuid-20"
}
```

### 2. `work-session-api.postman_collection.json`
- ✅ Cập nhật login scripts cho tất cả roles
- ✅ Thêm error handling và console logs
- ✅ Cập nhật permission tests
- ✅ Sử dụng authId trong URLs

### 3. `work-session-quick-test.postman_collection.json`
- ✅ Thêm technician login step
- ✅ Cập nhật login scripts
- ✅ Thêm error handling

## 🚀 Cách sử dụng

### 1. Import Collections
```bash
# Import vào Postman
work-session-api.postman_collection.json
work-session-quick-test.postman_collection.json
revita-local-environment.json
```

### 2. Chọn Environment
- Chọn "Revita Local Environment"

### 3. Chạy Test

#### Quick Test (9 steps)
1. ✅ Login Doctor
2. ✅ Create Doctor Schedule  
3. ✅ Test Conflict Validation
4. ✅ View My Schedule
5. ✅ Update Schedule
6. ✅ Login Technician
7. ✅ Login Admin
8. ✅ Admin View All Schedules
9. ✅ Admin Approve Schedule

#### Full Test (25+ requests)
- Authentication (3 requests)
- Create Work Sessions (4 requests)
- View Work Sessions (7 requests)
- Update Work Sessions (3 requests)
- Delete Work Sessions (2 requests)
- Permission Tests (3 requests)

## 🔧 Environment Variables

### Auto-generated (saved during login)
```json
{
  "doctorToken": "jwt_token_here",
  "doctorId": "doctor_uuid",
  "doctorAuthId": "auth_uuid",
  "technicianToken": "jwt_token_here", 
  "technicianId": "technician_uuid",
  "technicianAuthId": "auth_uuid",
  "adminToken": "jwt_token_here",
  "adminId": "admin_uuid", 
  "adminAuthId": "auth_uuid",
  "workSessionId": "work_session_uuid"
}
```

### Pre-configured
```json
{
  "baseUrl": "http://localhost:3000/api",
  "doctorIdentifier": "nguyenminhduc@clinic.com",
  "doctorPassword": "123456",
  "technicianIdentifier": "technician@clinic.com",
  "technicianPassword": "123456",
  "adminIdentifier": "admin@clinic.com", 
  "adminPassword": "123456"
}
```

## 📊 Test Scenarios

### ✅ **Success Cases**
- Login với tất cả roles
- Tạo work sessions với auto-assignment
- Xem lịch của bản thân
- Admin xem tất cả lịch
- Cập nhật và xóa work sessions

### ❌ **Expected Failures**
- Conflict validation (400) - **Đúng behavior**
- Permission violations (403/400) - **Đúng behavior**
- Invalid data (400) - **Đúng behavior**

## 🎯 Console Output

### Login Success
```
✅ Doctor logged in: Dr. Nguyen Minh Duc
Doctor token saved: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Login Failure
```
❌ Doctor login failed: {"message": "Invalid credentials"}
```

### API Success
```
✅ Doctor schedule created: 2 sessions
✅ Conflict validation works - correctly rejected overlapping schedule
✅ Admin can view all schedules: 3 sessions
```

### API Failure
```
❌ Failed to create schedule: {"message": "Không tìm được phòng khám phù hợp..."}
❌ Permission validation failed - technician should not access doctor schedule
```

## 🔍 Debugging

### 1. Check Environment Variables
- Đảm bảo environment được chọn đúng
- Kiểm tra các biến đã được lưu sau login

### 2. Check Console Logs
- Xem console để debug login issues
- Kiểm tra token có được lưu không

### 3. Check Database
- Đảm bảo có dữ liệu test users
- Kiểm tra services và booths có tồn tại

## 📝 Notes

- **Base URL:** `http://localhost:3000/api`
- **Authentication:** JWT Bearer tokens
- **Auto-assignment:** Hệ thống tự tìm booth phù hợp
- **Permission:** Role-based access control
- **Validation:** Real-time conflict detection

---

**🎉 Collections đã được cập nhật và sẵn sàng test!**
