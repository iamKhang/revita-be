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
      // Performance optimizations
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      // Connection pool
      family: 4, // IPv4
      keepAlive: 30000,
      // Command timeout
      commandTimeout: 5000,
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
    
    // Get unique identifier for the patient (ticketId, appointmentId, or patientName + sequence)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const ticketId = (item as any)?.ticketId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const appointmentId = (item as any)?.appointmentId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const patientName = (item as any)?.patientName;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const sequence = (item as any)?.sequence;
    
    const uniqueId = ticketId || appointmentId || `${patientName}-${sequence}`;
    
    // First, remove any existing entries with the same unique identifier
    if (uniqueId) {
      const existingMembers = await this.redis.zrange(key, 0, -1);
      for (const member of existingMembers) {
        try {
          const existingItem = JSON.parse(member) as Record<string, unknown>;
          const existingUniqueId = (existingItem as any)?.ticketId || 
                                 (existingItem as any)?.appointmentId || 
                                 `${(existingItem as any)?.patientName}-${(existingItem as any)?.sequence}`;
          
          if (existingUniqueId === uniqueId) {
            await this.redis.zrem(key, member);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
    
    // Compute composite score: priority score first, then FIFO by sequence (lower sequence = earlier)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const priorityScore = Number((item as any)?.priorityScore) || 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const sequenceNum = Number((item as any)?.sequence) || 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const assignedAt = (item as any)?.assignedAt;
    
    // Score calculation: higher priority score = higher score, earlier time = higher score
    // Use priority score as primary factor, then time as secondary factor
    let timeScore = 0;
    if (assignedAt) {
      // Convert assignedAt to timestamp for comparison (earlier = higher score)
      const assignedTime = new Date(assignedAt).getTime();
      const now = Date.now();
      // Invert time so earlier times get higher scores (but smaller impact than priority)
      timeScore = (now - assignedTime) / 1000; // seconds difference, max ~86400 for 1 day
    }
    
    // Primary: priority score (0-100+), Secondary: time score (smaller range)
    // This ensures priority is the main factor, but time breaks ties
    const score = (priorityScore * 10000) + (timeScore / 1000);
    
    await this.redis.zadd(key, score, JSON.stringify(item));
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

  async getLastServedPatient(counterId: string): Promise<Record<string, unknown> | null> {
    const key = `counterServed:${counterId}`;
    const served = await this.redis.get(key);
    if (!served) return null;
    try {
      return JSON.parse(served) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async setLastServedPatient(counterId: string, patient: Record<string, unknown> | null): Promise<void> {
    const key = `counterServed:${counterId}`;
    if (patient) {
      await this.redis.set(key, JSON.stringify(patient));
    } else {
      await this.redis.del(key);
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
    const startTime = Date.now();
    
    // Use pipeline to combine operations
    const pipeline = this.redis.pipeline();
    
    // Check queue length and reset sequence in one pipeline
    pipeline.eval(`
      local queueKey = KEYS[1]
      local sequenceKey = KEYS[2]
      
      -- Get queue length
      local queueLength = redis.call('ZCARD', queueKey)
      
      -- If queue is empty, reset sequence
      if queueLength == 0 then
        redis.call('DEL', sequenceKey)
        return {1, 0}  -- Reset performed, queue length 0
      else
        return {0, queueLength}  -- No reset needed, queue length
      end
    `, 2,
    `counterQueueZ:${counterId}`,
    `counterSequence:${counterId}`
    );
    
    const results = await pipeline.exec();
    const result = results?.[0]?.[1] as [number, number];
    
    const wasReset = result[0] === 1;
    const queueLength = result[1];
    
    const totalDuration = Date.now() - startTime;
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

  // ------------------ Optimized Queue Operations ------------------
  
  /**
   * Get queue with minimal processing - returns raw data for better performance
   */
  async getCounterQueueRaw(counterId: string): Promise<string[]> {
    const key = `counterQueueZ:${counterId}`;
    return await this.redis.zrevrange(key, 0, -1);
  }

  /**
   * Get queue status with optimized single Redis call
   */
  async getQueueStatusOptimized(counterId: string): Promise<{
    current: Record<string, unknown> | null;
    queueCount: number;
    skippedCount: number;
    isOnline: boolean;
  }> {
    const pipeline = this.redis.pipeline();
    
    // Get current patient
    pipeline.get(`counterCurrent:${counterId}`);
    
    // Get queue count
    pipeline.zcard(`counterQueueZ:${counterId}`);
    
    // Get skipped count
    pipeline.llen(`counterSkipped:${counterId}`);
    
    // Check if counter is online
    pipeline.exists(`counterOnline:${counterId}`);
    
    const results = await pipeline.exec();
    
    const currentStr = results?.[0]?.[1] as string | null;
    const current = currentStr ? JSON.parse(currentStr) : null;
    
    return {
      current,
      queueCount: results?.[1]?.[1] as number || 0,
      skippedCount: results?.[2]?.[1] as number || 0,
      isOnline: Boolean(results?.[3]?.[1]),
    };
  }

  /**
   * Optimized next patient call with atomic operations
   */
  async callNextPatientOptimized(counterId: string): Promise<{
    success: boolean;
    patient?: Record<string, unknown>;
    message?: string;
  }> {
    const startTime = Date.now();
    
    // Step 1: Create pipeline
    const pipelineStart = Date.now();
    const pipeline = this.redis.pipeline();
    const pipelineDuration = Date.now() - pipelineStart;
    
    // Step 2: Execute Lua script
    const scriptStart = Date.now();
    pipeline.eval(`
      local queueKey = KEYS[1]
      local currentKey = KEYS[2]
      local turnKey = KEYS[3]
      local servedKey = KEYS[4]
      
      -- Save current patient as last served before getting new one
      local current = redis.call('GET', currentKey)
      if current then
        redis.call('SET', servedKey, current)
      end
      
      -- Get next patient
      local result = redis.call('ZPOPMAX', queueKey, 1)
      if #result == 0 then
        return {0}  -- No patients in queue
      end
      
      local patient = result[1]
      
      -- Parse and update patient status when moving from queue to current
      local patientData = cjson.decode(patient)
      patientData.status = 'SERVING'
      patientData.callCount = (patientData.callCount or 0) + 1
      local updatedPatient = cjson.encode(patientData)
      
      -- Set as current patient
      redis.call('SET', currentKey, updatedPatient)
      
      -- Increment turn counter
      redis.call('INCR', turnKey)
      
      return {1, updatedPatient}
    `, 4, 
    `counterQueueZ:${counterId}`,
    `counterCurrent:${counterId}`,
    `counterTurn:${counterId}`,
    `counterServed:${counterId}`
    );
    
    const scriptDuration = Date.now() - scriptStart;
    
    // Step 3: Execute pipeline
    const execStart = Date.now();
    const results = await pipeline.exec();
    const execDuration = Date.now() - execStart;
    
    // Step 4: Process results
    const processStart = Date.now();
    const result = results?.[0]?.[1] as [number, string?];
    
    if (result[0] === 0) {
      const totalDuration = Date.now() - startTime;

      return { success: false, message: 'No patients in queue' };
    }
    
    // Step 5: Parse JSON
    const jsonStart = Date.now();
    const patient = JSON.parse(result[1]!);
    const jsonDuration = Date.now() - jsonStart;
    
    const processDuration = Date.now() - processStart;
    const totalDuration = Date.now() - startTime;
    
    return { success: true, patient };
  }

  /**
   * Optimized skip patient with atomic operations
   */
  async skipCurrentPatientSimple(counterId: string): Promise<{
    success: boolean;
    patient?: Record<string, unknown>;
    message?: string;
  }> {
    try {
      // Step 1: Get current patient
      const currentKey = `counterCurrent:${counterId}`;
      const current = await this.redis.get(currentKey);
      
      if (!current) {
        return { success: false, message: 'No current patient to skip' };
      }
      
      // Step 2: Parse and update patient data
      const patientData = JSON.parse(current);
      patientData.callCount = (patientData.callCount || 0) + 1;
      patientData.status = 'MISSED';
      
      // Step 3: Add to skipped list for tracking
      const skippedKey = `counterSkipped:${counterId}`;
      await this.redis.lpush(skippedKey, JSON.stringify(patientData));
      
      // Step 4: Clear current patient
      await this.redis.del(currentKey);
      
      // Step 5: If callCount > 3, remove patient completely (don't add back to queue)
      if (patientData.callCount > 3) {
        return { 
          success: true, 
          patient: patientData, 
          message: 'patient_removed_callcount_exceeded' 
        };
      }
      
      // Step 6: Get queue length
      const queueKey = `counterQueueZ:${counterId}`;
      const queueLength = await this.redis.zcard(queueKey);
      
      // Step 7: Always insert after 3rd position (3 people will be called before this patient)
      if (queueLength >= 3) {
        // Get the score of the 3rd patient
        const queueOrdered = await this.redis.zrevrange(queueKey, 0, 2, 'WITHSCORES');
        const thirdPatientScore = parseFloat(queueOrdered[5]); // 3rd patient score
        
        // Insert after 3rd patient with slightly lower score
        const insertScore = thirdPatientScore - 0.001;
        
        // Add back to queue with new score
        await this.redis.zadd(queueKey, insertScore, JSON.stringify(patientData));
        
        return { 
          success: true, 
          patient: patientData, 
          message: 'inserted_after_3rd_patient' 
        };
      } else {
        // If queue has less than 3 people, insert at the end (lowest priority)
        let minScore = 0;
        if (queueLength > 0) {
          const allScores = await this.redis.zrange(queueKey, 0, 0, 'WITHSCORES');
          if (allScores.length >= 2) {
            minScore = parseFloat(allScores[1]) - 1;
          }
        }
        
        await this.redis.zadd(queueKey, minScore, JSON.stringify(patientData));
        
        return { 
          success: true, 
          patient: patientData, 
          message: 'inserted_at_end' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Error in skipCurrentPatientSimple: ${(error as Error).message}` 
      };
    }
  }

  async skipCurrentPatientOptimized(counterId: string): Promise<{
    success: boolean;
    patient?: Record<string, unknown>;
    message?: string;
  }> {
    const startTime = Date.now();
    
    // Step 1: Create pipeline
    const pipelineStart = Date.now();
    const pipeline = this.redis.pipeline();
    const pipelineDuration = Date.now() - pipelineStart;
    
    // Step 2: Execute Lua script
    const scriptStart = Date.now();
    pipeline.eval(`
      local currentKey = KEYS[1]
      local queueKey = KEYS[2]
      local skippedKey = KEYS[3]
      
      -- Get current patient
      local current = redis.call('GET', currentKey)
      if not current then
        return {0, '', ''}  -- No current patient
      end
      
      -- Parse current patient to update callCount
      local patientData = cjson.decode(current)
      patientData.callCount = (patientData.callCount or 0) + 1
      patientData.status = 'MISSED'
      local updatedCurrent = cjson.encode(patientData)
      
      -- Add to skipped list for tracking
      redis.call('LPUSH', skippedKey, updatedCurrent)
      
      -- Clear current patient
      redis.call('DEL', currentKey)
      
      -- If callCount > 3, remove patient completely (don't add back to queue)
      if patientData.callCount > 3 then
        return {1, updatedCurrent, 'patient_removed_callcount_exceeded'}
      end
      
      -- Get queue ordered by priority (highest to lowest score)
      local queueOrdered = redis.call('ZREVRANGE', queueKey, 0, -1, 'WITHSCORES')
      local queueLength = #queueOrdered / 2  -- WITHSCORES returns [member, score, member, score, ...]
      
      -- Always insert after 3rd position (3 people will be called before this patient)
      if queueLength >= 3 then
        -- Find the score of the 3rd patient (index 5 in WITHSCORES: 0,1,2,3,4,5)
        local thirdPatientScore = tonumber(queueOrdered[5])
        
        -- Insert after 3rd patient with slightly lower score
        local insertScore = thirdPatientScore - 0.001
        
        -- Add back to queue with new score
        redis.call('ZADD', queueKey, insertScore, updatedCurrent)
        
        return {1, updatedCurrent, 'inserted_after_3rd_patient'}
      else
        -- If queue has less than 3 people, insert at the end (lowest priority)
        local minScore = 0
        if queueLength > 0 then
          local allScores = redis.call('ZRANGE', queueKey, 0, 0, 'WITHSCORES')
          if #allScores >= 2 then
            minScore = tonumber(allScores[2]) - 1
          end
        end
        
        redis.call('ZADD', queueKey, minScore, updatedCurrent)
        
        return {1, updatedCurrent, 'inserted_at_end'}
      end
    `, 3,
    `counterCurrent:${counterId}`,
    `counterQueueZ:${counterId}`,
    `counterSkipped:${counterId}`
    );
    
    const scriptDuration = Date.now() - scriptStart;
    
    // Step 3: Execute pipeline
    const execStart = Date.now();
    const results = await pipeline.exec();
    const execDuration = Date.now() - execStart;
    
    // Step 4: Process results
    const processStart = Date.now();
    
    // Check if results exist and have the expected structure
    // Handle case where pipeline.exec() returns null (Redis connection issues)
    if (results === null) {
      const totalDuration = Date.now() - startTime;
      return { success: false, message: 'Redis pipeline returned null - connection issue' };
    }
    
    if (!results || !Array.isArray(results) || results.length === 0) {
      const totalDuration = Date.now() - startTime;
      return { success: false, message: 'No results from Redis pipeline' };
    }
    
    const firstResult = results[0];
    
    // Redis pipeline returns [error, result] format
    
    if (!firstResult || firstResult.length < 2) {
      const totalDuration = Date.now() - startTime;
      return { success: false, message: 'Invalid result structure from Redis' };
    }
    
    // firstResult[0] is error, firstResult[1] is the actual result
    if (firstResult[0]) {
      const totalDuration = Date.now() - startTime;
      return { success: false, message: `Redis error: ${firstResult[0]}` };
    }
    
    const result = firstResult[1];
    
    if (!Array.isArray(result)) {
      const totalDuration = Date.now() - startTime;
      return { success: false, message: 'Result is not an array from Redis' };
    }
    
    if (!result || result[0] === 0) {
      const totalDuration = Date.now() - startTime;
      return { success: false, message: 'No current patient to skip' };
    }
    
    // Step 5: Parse JSON
    const jsonStart = Date.now();
    if (!result[1]) {
      const totalDuration = Date.now() - startTime;
      return { success: false, message: 'No patient data returned' };
    }
    
    const patient = JSON.parse(result[1]);
    const insertionType = result[2];
    const jsonDuration = Date.now() - jsonStart;
    
    const processDuration = Date.now() - processStart;
    const totalDuration = Date.now() - startTime;
    
    return { 
      success: true, 
      patient,
      message: insertionType === 'inserted_after_3' 
        ? 'Patient skipped and will be called after 3 people'
        : 'Patient skipped and added to end of queue'
    };
  }

  /**
   * Optimized return to previous patient
   */
  async returnToPreviousPatientOptimized(counterId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    const pipeline = this.redis.pipeline();
    
    pipeline.eval(`
      local currentKey = KEYS[1]
      local queueKey = KEYS[2]
      
      -- Get current patient
      local current = redis.call('GET', currentKey)
      if not current then
        return {0}  -- No current patient
      end
      
      -- Remove current patient
      redis.call('DEL', currentKey)
      
      -- Add back to front of queue with high priority
      local patientData = cjson.decode(current)
      patientData.priorityScore = 1000000  -- Very high priority
      local patientJson = cjson.encode(patientData)
      
      redis.call('ZADD', queueKey, 1000000, patientJson)
      
      return {1}
    `, 2,
    `counterCurrent:${counterId}`,
    `counterQueueZ:${counterId}`
    );
    
    const results = await pipeline.exec();
    const result = results?.[0]?.[1] as [number];
    
    if (result[0] === 0) {
      return { success: false, message: 'No current patient to return' };
    }
    
    return { success: true };
  }

  /**
   * Get current patient with fallback to queue
   */
  async getCurrentPatientWithFallback(counterId: string): Promise<Record<string, unknown> | null> {
    const current = await this.getCurrentPatient(counterId);
    if (current) return current;
    
    // If no current patient, get next from queue
    const next = await this.popNextFromCounterQueue(counterId);
    if (next) {
      // Update status when moving from queue to current
      (next as any).status = 'SERVING';
      const calls = Number((next as any).callCount || 0) + 1;
      (next as any).callCount = calls;
      await this.setCurrentPatient(counterId, next);
      return next;
    }
    
    return null;
  }

  /**
   * Clean up duplicate entries in counter queue
   */
  async cleanupCounterQueueDuplicates(counterId: string): Promise<number> {
    const key = `counterQueueZ:${counterId}`;
    const members = await this.redis.zrange(key, 0, -1);
    
    const seen = new Set<string>();
    const toRemove: string[] = [];
    let cleanedCount = 0;
    
    for (const member of members) {
      try {
        const item = JSON.parse(member) as Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const ticketId = (item as any)?.ticketId;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const appointmentId = (item as any)?.appointmentId;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const patientName = (item as any)?.patientName;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const sequence = (item as any)?.sequence;
        
        const uniqueId = ticketId || appointmentId || `${patientName}-${sequence}`;
        
        if (seen.has(uniqueId)) {
          toRemove.push(member);
          cleanedCount++;
        } else {
          seen.add(uniqueId);
        }
      } catch {
        // Remove invalid entries
        toRemove.push(member);
        cleanedCount++;
      }
    }
    
    // Remove duplicates
    if (toRemove.length > 0) {
      await this.redis.zrem(key, ...toRemove);
    }
    
    return cleanedCount;
  }

  /**
   * Clear all queue data for a counter (for testing)
   */
  async clearCounterQueue(counterId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    // Clear all queue-related keys
    pipeline.del(`counterQueueZ:${counterId}`);
    pipeline.del(`counterCurrent:${counterId}`);
    pipeline.del(`counterSkipped:${counterId}`);
    pipeline.del(`counterSequence:${counterId}`);
    pipeline.del(`counterLastServed:${counterId}`);
    
    await pipeline.exec();
  }

  async removeFromCounterQueue(counterId: string, patient: any): Promise<void> {
    const key = `counterQueueZ:${counterId}`;
    const patientString = JSON.stringify(patient);
    await this.redis.zrem(key, patientString);
  }

  async addToCounterQueueWithScore(counterId: string, patient: any, score: number): Promise<void> {
    const key = `counterQueueZ:${counterId}`;
    const patientString = JSON.stringify(patient);
    await this.redis.zadd(key, score, patientString);
  }

  /**
   * Get queue status with duplicate cleanup
   */
  async getQueueStatusWithCleanup(counterId: string): Promise<{
    current: Record<string, unknown> | null;
    queue: Record<string, unknown>[];
    queueCount: number;
    skippedCount: number;
    isOnline: boolean;
    cleanedDuplicates: number;
  }> {
    // Clean up duplicates first
    const cleanedDuplicates = await this.cleanupCounterQueueDuplicates(counterId);
    
    // Get optimized status
    const status = await this.getQueueStatusOptimized(counterId);
    
    // Get clean queue data
    const rawData = await this.getCounterQueueRaw(counterId);
    const queue = rawData.map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    return {
      current: status.current,
      queue,
      queueCount: status.queueCount,
      skippedCount: status.skippedCount,
      isOnline: status.isOnline,
      cleanedDuplicates,
    };
  }

  /**
   * Thêm entry vào Redis Stream
   */
  async xadd(streamKey: string, id: string, ...fields: string[]): Promise<string> {
    const result = await this.redis.xadd(streamKey, id, ...fields);
    return result || '';
  }

  /**
   * Lấy entries từ Redis Stream
   */
  async xrange(streamKey: string, start: string, end: string): Promise<Array<[string, Array<[string, string]>]>> {
    const result = await this.redis.xrange(streamKey, start, end);
    return result.map(([id, fields]) => [id, Array.from(fields).map(([key, value]) => [key, value])]);
  }

  /**
   * Lấy entries từ Redis Stream (reverse)
   */
  async xrevrange(streamKey: string, end: string, start: string, count?: number): Promise<Array<[string, Array<[string, string]>]>> {
    let result;
    if (count) {
      result = await this.redis.xrevrange(streamKey, end, start, 'COUNT', count);
    } else {
      result = await this.redis.xrevrange(streamKey, end, start);
    }
    return result.map(([id, fields]) => [id, Array.from(fields).map(([key, value]) => [key, value])]);
  }

  /**
   * Lấy length của Redis Stream
   */
  async xlen(streamKey: string): Promise<number> {
    return await this.redis.xlen(streamKey);
  }

  /**
   * Xóa entries từ Redis Stream
   */
  async xdel(streamKey: string, ...ids: string[]): Promise<number> {
    return await this.redis.xdel(streamKey, ...ids);
  }
}
