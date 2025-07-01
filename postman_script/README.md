# Revita Registration API - Postman Test Scripts

Thư mục này chứa các script Postman để test đầy đủ quy trình đăng ký người dùng trong hệ thống Revita.

## Files

1. **revita-registration-api.postman_collection.json** - Collection chứa tất cả API endpoints
2. **revita-local-environment.postman_environment.json** - Environment variables cho môi trường local
3. **README.md** - File hướng dẫn này

## Cách sử dụng

### 1. Import vào Postman

1. Mở Postman
2. Click **Import** 
3. Chọn cả 2 files:
   - `revita-registration-api.postman_collection.json`
   - `revita-local-environment.postman_environment.json`
4. Chọn environment "Revita Local Environment" ở góc trên bên phải

### 2. Quy trình test

#### Bước 1: Đăng ký với số điện thoại hoặc email
- **Endpoint**: `POST /register/step1`
- **Chọn một trong hai requests**:
  - "1. Register Step 1 - Phone" (đăng ký bằng số điện thoại)
  - "1. Register Step 1 - Email" (đăng ký bằng email)
- **Kết quả**: Nhận được `sessionId` và OTP sẽ được in ra console của server

#### Bước 2: Xác thực OTP
- **Endpoint**: `POST /register/verify-otp`
- **Request**: "2. Verify OTP"
- **Lưu ý**: Thay đổi giá trị `otp` trong body request bằng OTP nhận được từ console
- **Kết quả**: Xác thực thành công, có thể tiến hành bước tiếp theo

#### Bước 3: Hoàn tất đăng ký
- **Endpoint**: `POST /register/complete`
- **Request**: "3. Complete Registration"
- **Kết quả**: Tạo user thành công, nhận được `userId`

#### Bước 4 (Tùy chọn): Gửi lại OTP
- **Endpoint**: `POST /register/resend-otp`
- **Request**: "4. Resend OTP"
- **Sử dụng**: Khi cần gửi lại OTP trước khi xác thực

### 3. Lưu ý quan trọng

1. **OTP từ Console**: OTP sẽ được in ra console của server, không gửi qua SMS/Email thật
2. **Session Management**: `sessionId` được tự động lưu vào environment variables
3. **Thứ tự thực hiện**: Phải thực hiện theo đúng thứ tự từ bước 1 đến 3
4. **Timeout**: 
   - OTP có thời hạn 5 phút
   - Session có thời hạn 30 phút sau khi xác thực OTP

### 4. Test Cases

#### Test Case 1: Đăng ký thành công với số điện thoại
1. Chạy "1. Register Step 1 - Phone"
2. Lấy OTP từ console server
3. Chạy "2. Verify OTP" với OTP vừa lấy
4. Chạy "3. Complete Registration"

#### Test Case 2: Đăng ký thành công với email
1. Chạy "1. Register Step 1 - Email"
2. Lấy OTP từ console server
3. Chạy "2. Verify OTP" với OTP vừa lấy
4. Chạy "3. Complete Registration"

#### Test Case 3: Test Resend OTP
1. Chạy "1. Register Step 1 - Phone"
2. Chạy "4. Resend OTP"
3. Lấy OTP mới từ console
4. Chạy "2. Verify OTP" với OTP mới
5. Chạy "3. Complete Registration"

### 5. Error Cases để test

1. **Duplicate Registration**: Thử đăng ký lại với cùng phone/email
2. **Invalid OTP**: Nhập sai OTP
3. **Expired OTP**: Đợi quá 5 phút rồi verify OTP
4. **Invalid Session**: Sử dụng sessionId không tồn tại
5. **Duplicate Citizen ID**: Thử đăng ký với cùng số CMND/CCCD

### 6. Environment Variables

- `baseUrl`: URL của server (mặc định: http://localhost:3000)
- `sessionId`: Được tự động set sau bước 1
- `userId`: Được tự động set sau bước 3

## Cấu trúc API

### POST /register/step1
```json
{
  "phone": "0987654321"  // hoặc "email": "test@example.com"
}
```

### POST /register/verify-otp
```json
{
  "otp": "123456",
  "sessionId": "{{sessionId}}"
}
```

### POST /register/complete
```json
{
  "name": "Nguyễn Văn A",
  "dateOfBirth": "1990-01-01",
  "gender": "Nam",
  "address": "123 Đường ABC, Quận 1, TP.HCM",
  "citizenId": "123456789012",
  "avatar": "https://example.com/avatar.jpg",
  "password": "password123",
  "sessionId": "{{sessionId}}"
}
```

### POST /register/resend-otp
```json
{
  "sessionId": "{{sessionId}}"
}
```
