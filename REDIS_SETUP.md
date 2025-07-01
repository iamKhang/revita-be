# Hướng dẫn cài đặt Redis

## Cài đặt Redis trên macOS

### Sử dụng Homebrew (Khuyến nghị)
```bash
# Cài đặt Redis
brew install redis

# Khởi động Redis service
brew services start redis

# Kiểm tra Redis đang chạy
redis-cli ping
# Kết quả mong đợi: PONG
```

### Sử dụng Docker
```bash
# Chạy Redis container
docker run -d --name redis-revita -p 6379:6379 redis:latest

# Kiểm tra container đang chạy
docker ps

# Kiểm tra kết nối
docker exec -it redis-revita redis-cli ping
# Kết quả mong đợi: PONG
```

## Cài đặt Redis trên Ubuntu/Debian

```bash
# Cập nhật package list
sudo apt update

# Cài đặt Redis
sudo apt install redis-server

# Khởi động Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Kiểm tra status
sudo systemctl status redis-server

# Kiểm tra kết nối
redis-cli ping
# Kết quả mong đợi: PONG
```

## Cài đặt Redis trên Windows

### Sử dụng WSL (Khuyến nghị)
1. Cài đặt WSL2
2. Làm theo hướng dẫn Ubuntu/Debian ở trên

### Sử dụng Docker Desktop
```bash
# Chạy Redis container
docker run -d --name redis-revita -p 6379:6379 redis:latest
```

## Cấu hình Redis cho dự án

Sau khi cài đặt Redis, cập nhật file `.env`:

```env
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
REDIS_DB="0"
```

## Kiểm tra kết nối

Sau khi cài đặt và cấu hình, khởi động lại ứng dụng:

```bash
npm run start:dev
```

Nếu không còn lỗi Redis connection, có nghĩa là đã cài đặt thành công.

## Lệnh Redis hữu ích

```bash
# Kết nối đến Redis CLI
redis-cli

# Xem tất cả keys
KEYS *

# Xem giá trị của một key
GET key_name

# Xóa một key
DEL key_name

# Xóa tất cả dữ liệu
FLUSHALL

# Thoát Redis CLI
exit
```

## Troubleshooting

### Lỗi "Connection refused"
- Kiểm tra Redis service có đang chạy không
- Kiểm tra port 6379 có bị block không
- Kiểm tra cấu hình firewall

### Lỗi "Authentication failed"
- Kiểm tra REDIS_PASSWORD trong file .env
- Nếu Redis không có password, để trống REDIS_PASSWORD

### Redis không khởi động
```bash
# Kiểm tra log Redis
sudo journalctl -u redis-server

# Hoặc với Homebrew
brew services list | grep redis
```
