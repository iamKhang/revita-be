```markdown
# REVITADB BACKUP TOOL (Phiên bản cuối – 25/11/2025)

Thư mục này chỉ dùng để backup/restore database RevitA  
Tất cả file backup đều nằm trong `./backups/`  
Lịch sử backup nằm trong `./backup-list.txt`  
Mật khẩu chỉ nằm trong `.env.backup` (không bao giờ commit lên Git)

## CÁCH DÙNG NHANH NHẤT (TỰ ĐỘNG – khuyến khích)

```bash
cd ~/backup-tool        # hoặc đường dẫn bạn đã đặt thư mục này

# 1. Backup mới ngay lập tức
./tools/backup.sh

# 2. Restore + ghi đè hoàn toàn
./tools/restore.sh
```

## CÁCH LÀM THỦ CÔNG 100% (khi script lỗi hoặc muốn làm nhanh bằng tay)

### 1. Backup thủ công (chỉ 1 lệnh – copy-paste)
```bash
# Đứng trong thư mục ~/backup-tool
PGPASSWORD=root pg_dump -h localhost -p 5432 -U postgres -Fc revitatb \
  > backups/revitatb_backup_$(date +%Y%m%d_%H%M%S).dump
```

### 2. Restore thủ công + ghi đè hoàn toàn (3 lệnh copy-paste lần lượt)
```bash
# Thay tên file backup của bạn vào dòng cuối cùng
export PGPASSWORD=root

dropdb    -h 159.65.182.204 -p 5433 -U postgres --if-exists revitadb
createdb  -h 159.65.182.204 -p 5433 -U postgres revitadb

pg_restore -h 159.65.182.204 -p 5433 -U postgres -d revitadb \
  --verbose --clean --no-owner --no-acl -j 8 \
  backups/revitatb_backup_20251125_1054.dump
```

→ Chỉ cần copy-paste 3 lệnh trên là database `revitadb` trên server `159.65.182.204:5433`  
sẽ bị **thay thế hoàn toàn 100%** bởi file backup bạn chọn.

### 3. Kiểm tra nhanh sau khi restore
```bash
psql -h 159.65.182.204 -p 5433 -U postgres -d revitadb -c "\dt"
```
→ Thấy danh sách bảng → thành công!

## Tóm tắt 1 dòng nhớ mãi mãi (thủ công siêu nhanh)

**Backup:**
```bash
PGPASSWORD=root pg_dump -Fc -U postgres revitatb > backups/revitatb_$(date +%Y%m%d_%H%M).dump
```

**Restore + ghi đè:**
```bash
PGPASSWORD=root dropdb -h 159.65.182.204 -p 5433 -U postgres --if-exists revitadb && \
PGPASSWORD=root createdb -h 159.65.182.204 -p 5433 -U postgres revitadb && \
PGPASSWORD=root pg_restore -h 159.65.182.204 -p 5433 -U postgres -d revitadb --clean -j 8 backups/revitatb_XXXXXX.dump
```

Xong! Giờ bạn có cả tự động lẫn thủ công – không bao giờ bị kẹt nữa.
```

Bây giờ bạn chỉ cần thay nội dung file `README.md` hiện tại bằng đoạn trên là hoàn hảo 100%.

Bạn muốn mình gói nguyên thư mục `backup-tool` thành file `.zip` sẵn (đã có đầy đủ mọi file + README mới nhất) để bạn tải về dùng luôn không? Mình làm trong 10 giây thôi!