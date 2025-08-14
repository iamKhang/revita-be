# Hướng dẫn sử dụng biến trong Postman Collection

## Các biến có sẵn

### 1. **Biến cơ bản**
- `baseUrl`: URL cơ sở của API (mặc định: `http://localhost:3000/api`)
- `sessionId`: ID session cho quá trình đăng ký
- `userId`: ID của user hiện tại

### 2. **Biến xác thực**
- `token`: Access token JWT
- `refreshToken`: Refresh token để làm mới access token
- `googleCode`: Authorization code từ Google OAuth

### 3. **Biến ID các entity**
- `patientId`: ID của patient
- `patientProfileId`: ID của patient profile
- `doctorId`: ID của doctor

- `specialtyId`: ID của specialty
- `serviceId`: ID của service
- `templateId`: ID của template
- `medicalRecordId`: ID của medical record
- `appointmentId`: ID của appointment

## Cách sử dụng

### 1. **Import Collection**
1. Mở Postman
2. Click "Import"
3. Chọn file `revita-full-api-with-variables.postman_collection.json`

### 2. **Thiết lập biến**
1. Click vào collection "Revita Full API"
2. Click tab "Variables"
3. Điền các giá trị cần thiết

### 3. **Workflow test cơ bản**

#### **Bước 1: Đăng ký/Đăng nhập**
```bash
# Đăng ký
POST {{baseUrl}}/register/step1
# Lấy sessionId từ response

POST {{baseUrl}}/register/verify-otp
# Sử dụng sessionId

POST {{baseUrl}}/register/complete
# Sử dụng sessionId

# Hoặc đăng nhập
POST {{baseUrl}}/auth/login
# Lấy token từ response
```

#### **Bước 2: Lấy thông tin cần thiết**
```bash
# Lấy danh sách specialties
GET {{baseUrl}}/admin/specialties
# Copy specialtyId vào biến

# Lấy danh sách templates
GET {{baseUrl}}/admin/templates
# Copy templateId vào biến

# Lấy danh sách services
GET {{baseUrl}}/admin/services
# Copy serviceId vào biến
```

#### **Bước 3: Tạo Patient Profile**
```bash
# Tạo patient profile
POST {{baseUrl}}/patient-profiles
{
  "patientId": "{{patientId}}",
  "name": "Tên người khám",
  "dateOfBirth": "1990-01-01",
  "gender": "Nam",
  "address": "123 Đường ABC, Quận 1, TP.HCM",
  "emergencyContact": {
    "name": "Nguyễn Thị B",
    "phone": "0123456789",
    "relationship": "Vợ"
  }
}
# Copy patientProfileId từ response vào biến
```

#### **Bước 4: Tạo Medical Record**
```bash
# Tạo medical record
POST {{baseUrl}}/medical-records
{
  "patientProfileId": "{{patientProfileId}}",
  "templateId": "{{templateId}}",
  "content": {
    "symptoms": "Đau đầu",
    "diagnosis": "Migraine"
  }
}
# Copy medicalRecordId từ response vào biến
```

## Lợi ích của việc sử dụng biến

### 1. **Dễ dàng test**
- Chỉ cần điền biến một lần
- Tất cả endpoint sẽ tự động sử dụng giá trị đã điền

### 2. **Tránh lỗi**
- Không cần copy-paste ID
- Giảm thiểu lỗi typo

### 3. **Quản lý tập trung**
- Tất cả biến ở một nơi
- Dễ dàng thay đổi giá trị

### 4. **Tái sử dụng**
- Có thể export/import collection với biến
- Chia sẻ dễ dàng với team

## Ví dụ thực tế

### **Test flow hoàn chỉnh**

1. **Điền biến cơ bản:**
   ```
   baseUrl: http://localhost:3000/api
   token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Lấy ID cần thiết:**
   ```
   specialtyId: 456e7890-e89b-12d3-a456-426614174001
   templateId: 789e0123-e89b-12d3-a456-426614174002
   ```

3. **Test các endpoint:**
   - Tất cả endpoint sẽ tự động sử dụng các ID đã điền
   - Không cần thay đổi gì thêm

## Lưu ý

1. **Cập nhật biến sau mỗi response:**
   - Sau khi tạo entity mới, copy ID từ response vào biến tương ứng

2. **Kiểm tra biến trước khi test:**
   - Đảm bảo các biến cần thiết đã được điền

3. **Backup collection:**
   - Export collection định kỳ để backup
   - Có thể chia sẻ với team members
