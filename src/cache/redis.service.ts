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

  // ------------------ Queue helpers for counters (priority via ZSET) ------------------
  // Store queue as a sorted set where score = priorityScore (higher is better)
  // Key format: counterQueueZ:<counterId>
  async pushToCounterQueue(
    counterId: string,
    item: Record<string, unknown>,
  ): Promise<void> {
    const key = `counterQueueZ:${counterId}`;
    // Compute composite score: priority bucket first, then FIFO by sequence
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const hasSequence = (item as any)?.sequence !== undefined;
    if (hasSequence) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const isPriority = Boolean((item as any)?.isPriority);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const sequence = Number((item as any)?.sequence) || 0;
      const base = isPriority ? 1_000_000_000 : 0;
      const score = base - sequence;
      await this.redis.zadd(key, 'NX', score, JSON.stringify(item));
      return;
    }
    // Fallback: use priorityScore only
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const priority = Number((item as any)?.priorityScore ?? 0);
    await this.redis.zadd(key, 'NX', priority, JSON.stringify(item));
  }

  /**
   * Đếm lượt gọi (turn) để phục vụ logic chèn lại sau N lượt
   */
  async incrementTurn(counterId: string): Promise<number> {
    const key = `counterTurn:${counterId}`;
    return await this.redis.incr(key);
  }

  async getTurn(counterId: string): Promise<number> {
    const key = `counterTurn:${counterId}`;
    const val = await this.redis.get(key);
    return val ? parseInt(val) : 0;
  }

  /**
   * Lên lịch chèn lại bệnh nhân bị bỏ lỡ sau một số lượt
   * Sử dụng ZSET: score = dueTurn
   */
  async scheduleReinsert(
    counterId: string,
    patient: Record<string, unknown>,
    dueTurn: number,
  ): Promise<void> {
    const key = `counterSkippedZ:${counterId}`;
    await this.redis.zadd(key, dueTurn, JSON.stringify(patient));
  }

  /**
   * Xử lý những bệnh nhân đến hạn được chèn lại vào queue theo priority
   */
  async processDueReinserts(counterId: string): Promise<number> {
    const key = `counterSkippedZ:${counterId}`;
    const currentTurn = await this.getTurn(counterId);
    const due = await this.redis.zrangebyscore(key, '-inf', currentTurn);
    if (!due || due.length === 0) return 0;
    await this.redis.zremrangebyscore(key, '-inf', currentTurn);
    let count = 0;
    for (const s of due) {
      try {
        const patient = JSON.parse(s) as Record<string, unknown>;
        (patient as any).status = 'READY';
        await this.pushToCounterQueue(counterId, patient);
        count++;
      } catch {
        // ignore
      }
    }
    return count;
  }

  async popNextFromCounterQueue(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    const key = `counterQueueZ:${counterId}`;
    // Pop highest priority first
    // zpopmax returns [member, score] pairs in RESP; ioredis returns array
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const res = (await (this.redis as any).zpopmax(key, 1)) as Array<string>;
    if (!res || res.length === 0) return null;
    const member = res[0];
    try {
      return JSON.parse(member) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async getCounterQueue(counterId: string): Promise<Record<string, unknown>[]> {
    const key = `counterQueueZ:${counterId}`;
    // Highest score first
    const items = await this.redis.zrevrange(key, 0, -1);
    return items.map((s) => JSON.parse(s) as Record<string, unknown>);
  }

  async clearCounterQueue(counterId: string): Promise<void> {
    const key = `counterQueueZ:${counterId}`;
    await this.redis.del(key);
  }

  async getCounterQueueLength(counterId: string): Promise<number> {
    const key = `counterQueueZ:${counterId}`;
    return await this.redis.zcard(key);
  }

  // ------------------ Enhanced Queue Management ------------------
  // Sử dụng 3 phần riêng biệt để hỗ trợ Previous operation

  /**
   * Lấy patient hiện tại đang được phục vụ
   * @param counterId - ID của counter
   * @returns Patient hiện tại hoặc null nếu không có
   */
  async getCurrentPatient(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    const key = `counterCurrent:${counterId}`;
    const current = await this.redis.get(key);
    if (!current) return null;
    try {
      return JSON.parse(current) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Set patient hiện tại đang được phục vụ
   * @param counterId - ID của counter
   * @param patient - Patient cần set làm current
   */
  async setCurrentPatient(
    counterId: string,
    patient: Record<string, unknown> | null,
  ): Promise<void> {
    const key = `counterCurrent:${counterId}`;
    if (patient) {
      await this.redis.set(key, JSON.stringify(patient));
    } else {
      await this.redis.del(key);
    }
  }

  /**
   * Lấy patient tiếp theo từ queue (không xóa khỏi queue)
   * @param counterId - ID của counter
   * @returns Patient tiếp theo hoặc null nếu queue rỗng
   */
  async getNextPatientFromQueue(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    const key = `counterQueueZ:${counterId}`;
    // Lấy patient có priority cao nhất (score cao nhất) nhưng không xóa
    const items = await this.redis.zrevrange(key, 0, 0);
    if (items.length === 0) return null;
    try {
      const patient = JSON.parse(items[0]) as Record<string, unknown>;
      return patient;
    } catch {
      return null;
    }
  }

  /**
   * Xóa patient khỏi queue (sau khi đã được xử lý)
   * @param counterId - ID của counter
   * @param patient - Patient cần xóa
   */
  async removePatientFromQueue(
    counterId: string,
    patient: Record<string, unknown>,
  ): Promise<void> {
    const key = `counterQueueZ:${counterId}`;
    await this.redis.zrem(key, JSON.stringify(patient));
  }

  /**
   * Thêm patient vào history (để có thể quay lại)
   * @param counterId - ID của counter
   * @param patient - Patient cần thêm vào history
   */
  async addPatientToHistory(
    counterId: string,
    patient: Record<string, unknown>,
  ): Promise<void> {
    const key = `counterHistory:${counterId}`;
    // Thêm vào cuối history (LIFO - Last In First Out)
    await this.redis.rpush(key, JSON.stringify(patient));
  }

  /**
   * Lấy patient cuối cùng từ history (để quay lại)
   * @param counterId - ID của counter
   * @returns Patient cuối cùng hoặc null nếu history rỗng
   */
  async getLastPatientFromHistory(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    const key = `counterHistory:${counterId}`;
    const last = await this.redis.rpop(key);
    if (!last) return null;
    try {
      return JSON.parse(last) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Trả lại patient về đầu queue (đặt lại vào vị trí đầu tiên)
   * @param counterId - ID của counter
   * @param patient - Thông tin patient cần trả lại
   */
  async returnPatientToQueue(
    counterId: string,
    patient: Record<string, unknown>,
  ): Promise<void> {
    const key = `counterQueueZ:${counterId}`;

    // Tạo score cao nhất để đặt patient lên đầu queue
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const isPriority = Boolean((patient as any)?.isPriority);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const sequence = Number((patient as any)?.sequence) || 0;
    const base = isPriority ? 1_000_000_000 : 0;
    const score = base - sequence;

    // Cập nhật trạng thái READY khi trả về queue
    (patient as any).status = 'READY';
    // Thêm lại vào queue với score cao nhất
    await this.redis.zadd(key, 'XX', score, JSON.stringify(patient));
  }

  /**
   * Enhanced Next operation - lấy patient từ queue và xóa khỏi queue
   * @param counterId - ID của counter
   * @returns Patient tiếp theo hoặc null nếu queue rỗng
   */
  async callNextPatientEnhanced(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    // Tăng turn và xử lý các bệnh nhân đến hạn chèn lại
    await this.incrementTurn(counterId);
    await this.processDueReinserts(counterId);

    // Lấy patient hiện tại
    const currentPatient = await this.getCurrentPatient(counterId);

    // Lấy patient tiếp theo từ queue
    const nextPatient = await this.getNextPatientFromQueue(counterId);

    if (nextPatient) {
      // Nếu có patient hiện tại, lưu vào history để có thể return
      if (currentPatient) {
        await this.addPatientToHistory(counterId, currentPatient);
      }

      // Set trạng thái và làm current patient
      (nextPatient as any).status = 'SERVING';
      const calls = Number((nextPatient as any).callCount || 0) + 1;
      (nextPatient as any).callCount = calls;
      await this.setCurrentPatient(counterId, nextPatient);
      // Xóa khỏi queue
      await this.removePatientFromQueue(counterId, nextPatient);
      return nextPatient;
    }

    return null;
  }

  /**
   * Enhanced Previous operation - đưa current patient quay lại queue
   * @param counterId - ID của counter
   * @returns Patient đã được return hoặc null nếu không có current patient
   */
  async callPreviousPatientEnhanced(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    // Lấy patient hiện tại
    const currentPatient = await this.getCurrentPatient(counterId);

    if (!currentPatient) {
      return null;
    }

    // Đưa current patient quay lại queue (đầu queue)
    await this.returnPatientToQueue(counterId, currentPatient);

    // Xóa current patient
    await this.setCurrentPatient(counterId, null);

    return currentPatient;
  }

  /**
   * Skip current patient - chuyển vào skipped queue
   * @param counterId - ID của counter
   * @returns Patient đã skip hoặc null nếu không có current patient
   */
  async skipCurrentPatient(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    // Lấy patient hiện tại
    const currentPatient = await this.getCurrentPatient(counterId);

    if (!currentPatient) {
      return null;
    }

    // Tăng số lần gọi đã có và xác định trạng thái
    const callCount = Number((currentPatient as any).callCount || 1);
    (currentPatient as any).callCount = callCount;

    if (callCount >= 5) {
      // Nếu đã bị gọi đến lần thứ 5 thì hủy
      (currentPatient as any).status = 'CANCELLED';
      await this.addPatientToHistory(counterId, currentPatient);
    } else {
      // Đánh dấu MISSED và lên lịch chèn lại sau 3 lượt
      (currentPatient as any).status = 'MISSED';
      const currentTurn = await this.getTurn(counterId);
      await this.scheduleReinsert(counterId, currentPatient, currentTurn + 3);
    }

    // Xóa current patient
    await this.setCurrentPatient(counterId, null);

    return currentPatient;
  }

  /**
   * Recall skipped patient - lấy từ skipped queue
   * @param counterId - ID của counter
   * @returns Patient đã recall hoặc null nếu không có skipped patient
   */
  async recallSkippedPatient(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    // Lấy patient từ skipped queue
    const recalledPatient = await this.getFromSkippedQueue(counterId);

    if (recalledPatient) {
      // Set làm current patient
      await this.setCurrentPatient(counterId, recalledPatient);
      return recalledPatient;
    }

    return null;
  }

  /**
   * Return current patient to queue - đưa current patient quay lại queue
   * @param counterId - ID của counter
   * @returns Patient đã return hoặc null nếu không có current patient
   */
  async returnCurrentPatientToQueue(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    // Lấy patient hiện tại
    const currentPatient = await this.getCurrentPatient(counterId);

    if (!currentPatient) {
      return null;
    }

    // Đưa current patient quay lại queue (đầu queue)
    await this.returnPatientToQueue(counterId, currentPatient);

    // Xóa current patient
    await this.setCurrentPatient(counterId, null);

    return currentPatient;
  }

  /**
   * Go back to previous patient from history
   * @param counterId - ID của counter
   * @returns Patient trước đó hoặc null nếu không có history
   */
  async goBackToPreviousPatient(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    // Lấy patient hiện tại
    const currentPatient = await this.getCurrentPatient(counterId);

    // Lấy patient cuối cùng từ history
    const previousPatient = await this.getLastPatientFromHistory(counterId);

    if (previousPatient) {
      // Nếu có patient hiện tại, trả về queue
      if (currentPatient) {
        await this.returnPatientToQueue(counterId, currentPatient);
      }

      // Set patient trước đó làm current
      await this.setCurrentPatient(counterId, previousPatient);
      return previousPatient;
    }

    return null;
  }

  /**
   * Lấy trạng thái đầy đủ của queue
   * @param counterId - ID của counter
   * @returns Trạng thái queue bao gồm current, queue, history, và skipped
   */
  async getQueueStatus(counterId: string): Promise<{
    current: Record<string, unknown> | null;
    queue: Record<string, unknown>[];
    history: Record<string, unknown>[];
    skipped: Record<string, unknown>[];
  }> {
    const [current, queue, history, skipped] = await Promise.all([
      this.getCurrentPatient(counterId),
      this.getCounterQueue(counterId),
      this.getHistory(counterId),
      this.getSkippedQueue(counterId),
    ]);

    return {
      current,
      queue,
      history,
      skipped,
    };
  }

  /**
   * Lấy history của counter
   * @param counterId - ID của counter
   * @returns Danh sách patients trong history
   */
  async getHistory(counterId: string): Promise<Record<string, unknown>[]> {
    const key = `counterHistory:${counterId}`;
    const history = await this.redis.lrange(key, 0, -1);
    return history.map((item) => JSON.parse(item) as Record<string, unknown>);
  }

  /**
   * Xóa history của counter
   * @param counterId - ID của counter
   */
  async clearHistory(counterId: string): Promise<void> {
    const key = `counterHistory:${counterId}`;
    await this.redis.del(key);
  }

  /**
   * Xóa current patient
   * @param counterId - ID của counter
   */
  async clearCurrentPatient(counterId: string): Promise<void> {
    await this.setCurrentPatient(counterId, null);
  }

  /**
   * Thêm patient vào skipped queue
   * @param counterId - ID của counter
   * @param patient - Patient cần thêm vào skipped queue
   */
  async addToSkippedQueue(
    counterId: string,
    patient: Record<string, unknown>,
  ): Promise<void> {
    const key = `counterSkipped:${counterId}`;
    // Thêm vào cuối skipped queue (FIFO)
    await this.redis.rpush(key, JSON.stringify(patient));
  }

  /**
   * Lấy patient từ skipped queue
   * @param counterId - ID của counter
   * @returns Patient từ skipped queue hoặc null nếu rỗng
   */
  async getFromSkippedQueue(
    counterId: string,
  ): Promise<Record<string, unknown> | null> {
    const key = `counterSkipped:${counterId}`;
    const skipped = await this.redis.lpop(key);
    if (!skipped) return null;

    try {
      return JSON.parse(skipped) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Lấy danh sách patients trong skipped queue
   * @param counterId - ID của counter
   * @returns Danh sách patients trong skipped queue
   */
  async getSkippedQueue(counterId: string): Promise<Record<string, unknown>[]> {
    const key = `counterSkipped:${counterId}`;
    const skipped = await this.redis.lrange(key, 0, -1);
    return skipped.map((item) => JSON.parse(item) as Record<string, unknown>);
  }

  /**
   * Xóa skipped queue
   * @param counterId - ID của counter
   */
  async clearSkippedQueue(counterId: string): Promise<void> {
    const key = `counterSkipped:${counterId}`;
    await this.redis.del(key);
  }

  /**
   * Reset queue number sequence khi queue rỗng
   * @param counterId - ID của counter
   */
  async resetCounterSequence(counterId: string): Promise<void> {
    const now = new Date();
    const y = now.getFullYear();
    const m = `${now.getMonth() + 1}`.padStart(2, '0');
    const d = `${now.getDate()}`.padStart(2, '0');
    const key = `counterSeq:${counterId}:${y}${m}${d}`;

    // Xóa sequence key để reset về 0
    await this.redis.del(key);
  }

  /**
   * Kiểm tra và reset sequence nếu queue rỗng
   * @param counterId - ID của counter
   */
  async checkAndResetSequenceIfEmpty(counterId: string): Promise<void> {
    const queueLength = await this.getCounterQueueLength(counterId);
    if (queueLength === 0) {
      await this.resetCounterSequence(counterId);
    }
  }

  // ------------------ Queue number helpers (per counter, per day) ------------------
  // Generate an incremental sequence per counter per day, used to build ticket numbers
  async getNextCounterSequence(counterId: string): Promise<number> {
    const now = new Date();
    const y = now.getFullYear();
    const m = `${now.getMonth() + 1}`.padStart(2, '0');
    const d = `${now.getDate()}`.padStart(2, '0');
    const key = `counterSeq:${counterId}:${y}${m}${d}`;
    return await this.redis.incr(key);
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
