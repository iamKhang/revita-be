import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly saltLength = 64; // 512 bits
  private readonly tagLength = 16; // 128 bits
  private readonly key: Buffer;
  private readonly logger = new Logger(EncryptionService.name);
  private readonly isUsingDefaultKey: boolean;

  constructor() {
    // Lấy encryption key từ biến môi trường
    let encryptionKey = process.env.MEDICAL_RECORD_ENCRYPTION_KEY;

    // Nếu không có key, sử dụng key mặc định cho development (với cảnh báo)
    if (!encryptionKey) {
      encryptionKey =
        'revita-medical-record-default-encryption-key-development-only-change-in-production';
      this.isUsingDefaultKey = true;
      this.logger.warn(
        'WARNING: Using default encryption key for medical records!',
      );
      this.logger.warn(
        'This is UNSAFE for production. Please set MEDICAL_RECORD_ENCRYPTION_KEY in your .env file.',
      );
      this.logger.warn('⚠️  Generate a secure key: openssl rand -base64 32');
    } else {
      this.isUsingDefaultKey = false;
      this.logger.log(
        '✓ Medical record encryption key loaded from environment',
      );
    }

    // Tạo key từ string (sử dụng PBKDF2 để tạo key 256-bit)
    this.key = crypto.pbkdf2Sync(
      encryptionKey,
      'medical-record-salt', // Salt cố định cho key derivation
      100000, // Iterations
      this.keyLength,
      'sha256',
    );
  }

  /**
   * Mã hóa dữ liệu JSON
   * @param data - Dữ liệu cần mã hóa (object hoặc string)
   * @returns Chuỗi đã mã hóa dạng base64
   */
  encrypt(data: any): string {
    try {
      // Chuyển đổi dữ liệu thành JSON string nếu là object
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

      // Tạo IV (Initialization Vector) ngẫu nhiên
      const iv = crypto.randomBytes(this.ivLength);

      // Tạo cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Mã hóa dữ liệu
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Lấy authentication tag
      const tag = cipher.getAuthTag();

      // Kết hợp IV + tag + encrypted data
      // Format: base64(iv) + ':' + base64(tag) + ':' + base64(encrypted)
      const result = [
        iv.toString('base64'),
        tag.toString('base64'),
        encrypted,
      ].join(':');

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Lỗi khi mã hóa dữ liệu: ${errorMessage}`);
    }
  }

  /**
   * Giải mã dữ liệu đã mã hóa
   * @param encryptedData - Chuỗi đã mã hóa dạng base64
   * @returns Dữ liệu đã giải mã (object hoặc string)
   */
  decrypt(encryptedData: string): any {
    try {
      // Kiểm tra format
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Dữ liệu mã hóa không hợp lệ');
      }

      // Tách các phần: IV, tag, encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Format dữ liệu mã hóa không đúng');
      }

      const [ivBase64, tagBase64, encrypted] = parts;

      // Chuyển đổi từ base64 về Buffer
      const iv = Buffer.from(ivBase64, 'base64');
      const tag = Buffer.from(tagBase64, 'base64');

      // Tạo decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(tag);

      // Giải mã
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      // Thử parse JSON, nếu không được thì trả về string
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (error) {
      // Nếu lỗi giải mã, có thể là dữ liệu cũ chưa được mã hóa
      // Trả về dữ liệu gốc để tương thích ngược
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `Lỗi khi giải mã dữ liệu, trả về dữ liệu gốc: ${errorMessage}`,
      );
      try {
        // Thử parse JSON nếu là string JSON
        return JSON.parse(encryptedData);
      } catch {
        // Nếu không phải JSON, trả về string gốc
        return encryptedData;
      }
    }
  }

  /**
   * Kiểm tra xem dữ liệu có được mã hóa không
   * @param data - Dữ liệu cần kiểm tra
   * @returns true nếu dữ liệu có format mã hóa (có 3 phần cách nhau bởi ':')
   */
  isEncrypted(data: any): boolean {
    if (typeof data !== 'string') {
      return false;
    }
    const parts = data.split(':');
    return parts.length === 3;
  }
}
