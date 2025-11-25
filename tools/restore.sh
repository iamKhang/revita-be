#!/bin/bash
set -euo pipefail

# Lấy đường dẫn tuyệt đối của thư mục chứa script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source file .env.backup
if [[ ! -f "$SCRIPT_DIR/.env.backup" ]]; then
    echo "ERROR: Không tìm thấy file .env.backup trong $SCRIPT_DIR"
    exit 1
fi

source "$SCRIPT_DIR/.env.backup"

# Resolve đường dẫn backup và log từ thư mục tools
if [[ "$BACKUP_DIR" == ./* ]] || [[ "$BACKUP_DIR" != /* ]]; then
    BACKUP_DIR="$SCRIPT_DIR/${BACKUP_DIR#./}"
fi
if [[ "$LOG_FILE" == ./* ]] || [[ "$LOG_FILE" != /* ]]; then
    LOG_FILE="$SCRIPT_DIR/${LOG_FILE#./}"
fi

# Kiểm tra các biến cần thiết
if [[ -z "${DST_HOST:-}" ]] || [[ -z "${DST_PORT:-}" ]] || [[ -z "${DST_USER:-}" ]] || [[ -z "${DST_PASS:-}" ]] || [[ -z "${DST_DB:-}" ]]; then
    echo "ERROR: Thiếu thông tin kết nối database đích trong .env.backup"
    echo "Cần có: DST_HOST, DST_PORT, DST_USER, DST_PASS, DST_DB"
    exit 1
fi

echo "=== DANH SÁCH BACKUP ĐÃ CÓ ==="
if [[ -f "$LOG_FILE" ]] && [[ -s "$LOG_FILE" ]]; then
    echo "Lịch sử backup (từ $LOG_FILE):"
    cat "$LOG_FILE"
    echo ""
fi

echo "Danh sách file backup trong $BACKUP_DIR:"
if ls -lh "$BACKUP_DIR"/*.dump 2>/dev/null | head -10; then
    echo ""
else
    echo "Chưa có file backup nào!"
    exit 1
fi

echo
read -p "Nhập đúng tên file backup muốn restore (ví dụ: revitatb_backup_20251125_1054.dump): " FILENAME

# Xử lý trường hợp người dùng nhập đường dẫn đầy đủ hoặc chỉ tên file
if [[ "$FILENAME" == */* ]]; then
    FILEPATH="$FILENAME"
else
    FILEPATH="$BACKUP_DIR/$FILENAME"
fi

if [[ ! -f "$FILEPATH" ]]; then
    echo "ERROR: Không tìm thấy file: $FILEPATH"
    exit 1
fi

FILE_SIZE=$(du -h "$FILEPATH" | cut -f1)
echo ""
echo "=================================================="
echo "THÔNG TIN RESTORE:"
echo "   File backup: $FILENAME"
echo "   Kích thước: $FILE_SIZE"
echo "   Server đích: $DST_HOST:$DST_PORT"
echo "   Database: $DST_DB"
echo "=================================================="
echo ""
echo "⚠️  CẢNH BÁO: Hành động này sẽ XÓA HOÀN TOÀN database $DST_DB"
echo "   và thay thế bằng dữ liệu từ file backup!"
echo ""
read -p "GÕ CHÍNH XÁC 'REPLACE ALL' để xác nhận ghi đè hoàn toàn: " CONFIRM
if [[ "$CONFIRM" != "REPLACE ALL" ]]; then
    echo "Đã hủy."
    exit 0
fi

echo ""
echo "Đang xóa database cũ (nếu có)..."
if PGPASSWORD="$DST_PASS" dropdb -h "$DST_HOST" -p "$DST_PORT" -U "$DST_USER" --if-exists "$DST_DB"; then
    echo "✓ Đã xóa database cũ"
else
    echo "⚠️  Không thể xóa database (có thể chưa tồn tại, tiếp tục...)"
fi

echo "Đang tạo database mới..."
if PGPASSWORD="$DST_PASS" createdb -h "$DST_HOST" -p "$DST_PORT" -U "$DST_USER" "$DST_DB"; then
    echo "✓ Đã tạo database mới"
else
    echo "ERROR: Không thể tạo database mới"
    exit 1
fi

echo ""
echo "Đang restore dữ liệu (có thể mất vài phút)..."
if PGPASSWORD="$DST_PASS" pg_restore -h "$DST_HOST" -p "$DST_PORT" -U "$DST_USER" \
    -d "$DST_DB" --verbose --clean --no-owner --no-acl -j 8 "$FILEPATH"; then
    echo ""
    echo "=================================================="
    echo "✓ HOÀN TẤT 100%!"
    echo "   Database $DST_DB đã được thay thế hoàn toàn bằng dữ liệu từ $FILENAME"
    echo "=================================================="
else
    echo ""
    echo "ERROR: Restore thất bại!"
    exit 1
fi