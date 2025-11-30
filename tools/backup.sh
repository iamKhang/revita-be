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

# Tạo thư mục backup nếu chưa có
mkdir -p "$BACKUP_DIR"

# Kiểm tra các biến cần thiết
if [[ -z "${SRC_HOST:-}" ]] || [[ -z "${SRC_PORT:-}" ]] || [[ -z "${SRC_USER:-}" ]] || [[ -z "${SRC_PASS:-}" ]] || [[ -z "${SRC_DB:-}" ]]; then
    echo "ERROR: Thiếu thông tin kết nối database nguồn trong .env.backup"
    echo "Cần có: SRC_HOST, SRC_PORT, SRC_USER, SRC_PASS, SRC_DB"
    exit 1
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
FILENAME="${SRC_DB}_backup_$(date '+%Y%m%d_%H%M%S').dump"
FILEPATH="$BACKUP_DIR/$FILENAME"

echo "=================================================="
echo "Bắt đầu backup: $TIMESTAMP"
echo "Database nguồn: $SRC_HOST:$SRC_PORT/$SRC_DB"
echo "File backup: $FILEPATH"
echo ""

# Thực hiện backup
if PGPASSWORD="$SRC_PASS" pg_dump -h "$SRC_HOST" -p "$SRC_PORT" -U "$SRC_USER" -Fc "$SRC_DB" > "$FILEPATH"; then
SIZE=$(du -h "$FILEPATH" | cut -f1)
    echo "HOÀN TẤT! Kích thước: $SIZE"

    # Ghi log
echo "$TIMESTAMP | $FILENAME | $SIZE | SUCCESS" >> "$LOG_FILE"

    echo ""
echo "Đã ghi log vào $LOG_FILE"
echo "Nội dung log hiện tại:"
    tail -5 "$LOG_FILE" 2>/dev/null || echo "(File log trống)"
else
    echo "ERROR: Backup thất bại!"
    exit 1
fi

echo "=================================================="