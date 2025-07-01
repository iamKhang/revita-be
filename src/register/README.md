# Register Module

Module đăng ký người dùng cho hệ thống Revita với quy trình 3 bước:

## Quy trình đăng ký

### Bước 1: Đăng ký với số điện thoại hoặc email
- **Endpoint**: `POST /register/step1`
- **Mô tả**: Người dùng nhập số điện thoại hoặc email để bắt đầu quá trình đăng ký
- **Input**: 
  ```json
  {
    "phone": "0987654321", // Tùy chọn
    "email": "user@example.com" // Tùy chọn
  }
  ```
- **Output**:
  ```json
  {
    "sessionId": "uuid-session-id",
    "message": "Mã OTP đã được gửi đến số điện thoại 0987654321"
  }
  ```
- **Lưu ý**: Phải cung cấp ít nhất một trong hai: số điện thoại hoặc email

### Bước 2: Xác thực OTP
- **Endpoint**: `POST /register/verify-otp`
- **Mô tả**: Xác thực mã OTP được gửi đến số điện thoại hoặc email
- **Input**:
  ```json
  {
    "otp": "123456",
    "sessionId": "uuid-session-id"
  }
  ```
- **Output**:
  ```json
  {
    "sessionId": "uuid-session-id",
    "message": "Xác thực OTP thành công. Vui lòng hoàn tất thông tin đăng ký."
  }
  ```

### Bước 3: Hoàn tất đăng ký
- **Endpoint**: `POST /register/complete`
- **Mô tả**: Nhập thông tin cá nhân để hoàn tất đăng ký
- **Input**:
  ```json
  {
    "name": "Nguyễn Văn A",
    "dateOfBirth": "1990-01-01",
    "gender": "Nam",
    "address": "123 Đường ABC, Quận 1, TP.HCM",
    "citizenId": "123456789012", // Tùy chọn
    "avatar": "https://example.com/avatar.jpg", // Tùy chọn
    "password": "password123",
    "sessionId": "uuid-session-id"
  }
  ```
- **Output**:
  ```json
  {
    "message": "Đăng ký thành công",
    "userId": "uuid-user-id"
  }
  ```

### Gửi lại OTP
- **Endpoint**: `POST /register/resend-otp`
- **Mô tả**: Gửi lại mã OTP cho session đang hoạt động
- **Input**:
  ```json
  {
    "sessionId": "uuid-session-id"
  }
  ```

## Cấu hình Redis

Cần cấu hình Redis trong file `.env`:

```env
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
REDIS_DB="0"
```

## Cấu trúc dữ liệu

### Session Data (Redis)
```json
{
  "phone": "0987654321",
  "email": "user@example.com",
  "step": 1,
  "verified": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### OTP Storage (Redis)
- **Key**: `otp:{sessionId}`
- **Value**: "123456"
- **TTL**: 300 seconds (5 phút)

### Session Storage (Redis)
- **Key**: `session:{sessionId}`
- **Value**: JSON session data
- **TTL**: 1800 seconds (30 phút)

## Quy tắc nghiệp vụ

1. **Role mặc định**: Tất cả người dùng đăng ký sẽ có role `PATIENT`
2. **Xác thực bắt buộc**: Phải xác thực OTP trước khi hoàn tất đăng ký
3. **Duy nhất**: Số điện thoại, email và CMND/CCCD phải duy nhất trong hệ thống
4. **Tự động tạo Patient**: Sau khi đăng ký thành công, hệ thống tự động tạo record Patient
5. **Mã bệnh nhân**: Tự động tạo với format `PAT{timestamp}`

## Lưu ý kỹ thuật

1. **OTP hiện tại**: In ra console thay vì gửi SMS/Email thực tế
2. **Session timeout**: Session hết hạn sau 30 phút
3. **OTP timeout**: OTP hết hạn sau 5 phút
4. **Transaction**: Sử dụng Prisma transaction để đảm bảo tính nhất quán dữ liệu
5. **Password hashing**: Sử dụng bcryptjs với salt rounds = 10

## Tích hợp tương lai

- **Resend**: Để gửi email OTP thực tế
- **AWS SNS**: Để gửi SMS OTP thực tế
- **File upload**: Để upload avatar
- **Validation**: Thêm validation cho số CMND/CCCD Việt Nam
