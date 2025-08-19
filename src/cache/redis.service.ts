import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  /**
   * Lưu OTP với thời gian hết hạn
   * @param key - Key để lưu OTP
   * @param otp - Mã OTP
   * @param ttl - Thời gian hết hạn (giây), mặc định 5 phút
   */
  async setOtp(key: string, otp: string, ttl: number = 300): Promise<void> {
    await this.redis.setex(key, ttl, otp);
  }

  /**
   * Lấy OTP từ Redis
   * @param key - Key của OTP
   * @returns OTP hoặc null nếu không tồn tại
   */
  async getOtp(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  /**
   * Xóa OTP khỏi Redis
   * @param key - Key của OTP
   */
  async deleteOtp(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Lưu thông tin session đăng ký
   * @param sessionId - ID của session
   * @param data - Dữ liệu session
   * @param ttl - Thời gian hết hạn (giây), mặc định 30 phút
   */
  async setSession(
    sessionId: string,
    data: any,
    ttl: number = 1800,
  ): Promise<void> {
    await this.redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
  }

  /**
   * Lấy thông tin session đăng ký
   * @param sessionId - ID của session
   * @returns Dữ liệu session hoặc null nếu không tồn tại
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  async getSession(sessionId: string): Promise<any | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Xóa session
   * @param sessionId - ID của session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  /**
   * Kiểm tra xem key có tồn tại không
   * @param key - Key cần kiểm tra
   * @returns true nếu tồn tại, false nếu không
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * Lấy thời gian còn lại của key (TTL)
   * @param key - Key cần kiểm tra
   * @returns Thời gian còn lại (giây) hoặc -1 nếu không có TTL, -2 nếu key không tồn tại
   */
  async getTtl(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  // ------------------ Queue helpers for counters ------------------
  async pushToCounterQueue(
    counterId: string,
    item: Record<string, unknown>,
  ): Promise<void> {
    await this.redis.rpush(`counterQueue:${counterId}`, JSON.stringify(item));
  }

  async getCounterQueue(counterId: string): Promise<Record<string, unknown>[]> {
    const items = await this.redis.lrange(`counterQueue:${counterId}`, 0, -1);
    return items.map((s) => JSON.parse(s) as Record<string, unknown>);
  }

  async clearCounterQueue(counterId: string): Promise<void> {
    await this.redis.del(`counterQueue:${counterId}`);
  }

  async getCounterQueueLength(counterId: string): Promise<number> {
    return await this.redis.llen(`counterQueue:${counterId}`);
  }

  // ------------------ Presence helpers for counters ------------------
  async setCounterOnline(counterId: string, ttlSeconds = 30): Promise<void> {
    await this.redis.setex(`counterOnline:${counterId}`, ttlSeconds, '1');
  }

  async setCounterOffline(counterId: string): Promise<void> {
    await this.redis.del(`counterOnline:${counterId}`);
  }

  async isCounterOnline(counterId: string): Promise<boolean> {
    return await this.exists(`counterOnline:${counterId}`);
  }
}
