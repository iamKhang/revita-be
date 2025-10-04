/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  Logger,
  BadRequestException,
  Scope,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

interface DatabaseQueryResult {
  success: boolean;
  data?: unknown[];
  error?: string;
  query?: string;
  explanation?: string;
}

interface SystemInfo {
  tables: string[];
  relationships: string[];
  sampleQueries: string[];
}

interface QueryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedQuery?: string;
}

interface WhitelistedFields {
  [tableName: string]: string[];
}

interface TimeRange {
  start: Date;
  end: Date;
}

// JWT user is available via request.user; derive context on demand

@Injectable({ scope: Scope.REQUEST })
export class DatabaseQueryService {
  private readonly logger = new Logger(DatabaseQueryService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  // Whitelisted fields for PATIENT role
  private readonly patientWhitelistedFields: WhitelistedFields = {
    appointment: [
      'id',
      'date',
      'startTime',
      'endTime',
      'status',
      'appointmentCode',
    ],
    patientProfile: ['id', 'name', 'dateOfBirth', 'gender', 'relationship'],
    medicalRecord: ['id', 'status', 'createdAt', 'updatedAt'],
    prescription: ['id', 'status', 'createdAt', 'updatedAt'],
    invoice: ['id', 'invoiceCode', 'totalAmount', 'paymentStatus', 'createdAt'],
    doctor: ['id', 'doctorCode', 'yearsExperience', 'rating'],
    specialty: ['id', 'specialtyCode', 'name'],
    service: ['id', 'serviceCode', 'name', 'price'],
    auth: ['id', 'name', 'avatar'], // Only for own data
  };

  // Personal tables that require strict scoping
  private readonly personalTables = new Set([
    'appointment',
    'patientProfile',
    'medicalRecord',
    'prescription',
    'invoice',
  ]);

  // Dangerous keywords
  private readonly dangerousKeywords = [
    'DROP',
    'DELETE',
    'UPDATE',
    'INSERT',
    'CREATE',
    'ALTER',
    'TRUNCATE',
    'EXEC',
    'EXECUTE',
    'SP_',
    'xp_',
    'cmdshell',
    'bulk',
    'openrowset',
    'xp_cmdshell',
    'sp_executesql',
  ];

  // Allowed Prisma methods
  private readonly allowedMethods = new Set([
    'findMany',
    'findFirst',
    'findUnique',
    'count',
    'aggregate',
    'groupBy',
  ]);

  // Valid table names
  private readonly validTableNames = new Set([
    'doctor',
    'patient',
    'patientProfile',
    'appointment',
    'invoice',
    'specialty',
    'clinicRoom',
    'service',
    'medicalRecord',
    'prescription',
    'auth',
    'receptionist',
    'admin',
    'cashier',
    'technician',
    'counter',
    'template',
    'workSession',
    'booth',
  ]);

  constructor(
    private prismaService: PrismaService,
    private configService: ConfigService,
    @Inject(REQUEST) private readonly request: Request,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });
  }

  async processDatabaseQuery(
    userQuestion: string,
  ): Promise<DatabaseQueryResult> {
    try {
      // Phân loại câu hỏi
      const isDatabaseQuery = this.isDatabaseRelatedQuestion(userQuestion);

      if (!isDatabaseQuery) {
        // Không phải câu hỏi dữ liệu hệ thống -> để tầng service trả lời
        return { success: false };
      }

      // Tạo Prisma query từ câu hỏi
      const prismaQuery = await this.generatePrismaQuery(userQuestion);

      if (!prismaQuery) {
        return {
          success: false,
          error: 'Không thể tạo query từ câu hỏi này',
        };
      }

      // Thực thi query
      const result = await this.executePrismaQuery(prismaQuery);

      return {
        success: true,
        data: Array.isArray(result) ? result : [result],
        query: prismaQuery,
        explanation: await this.generateExplanation(userQuestion, result, true),
      };
    } catch (error) {
      this.logger.error('Error processing database query:', error);
      return {
        success: false,
        error: 'Lỗi khi xử lý truy vấn cơ sở dữ liệu',
      };
    }
  }

  private isDatabaseRelatedQuestion(question: string): boolean {
    const systemKeywords = [
      'bác sĩ',
      'doctor',
      'bệnh nhân',
      'patient',
      'lịch hẹn',
      'appointment',
      'dịch vụ',
      'service',
      'phòng khám',
      'room',
      'chuyên khoa',
      'specialty',
      'hóa đơn',
      'invoice',
      'thanh toán',
      'payment',
      'bệnh án',
      'medical record',
      'phiếu chỉ định',
      'prescription',
      'kỹ thuật viên',
      'technician',
      'lễ tân',
      'receptionist',
      'thu ngân',
      'cashier',
      'admin',
      'số lượng',
      'tổng',
      'thống kê',
      'báo cáo',
      'danh sách',
      'tìm kiếm',
      'hôm nay',
      'tuần này',
      'tháng này',
      'năm này',
      'thời gian',
      'trạng thái',
      'status',
      'đang chờ',
      'hoàn thành',
      'đã hủy',
    ];

    const lowerQuestion = question.toLowerCase();
    return systemKeywords.some((keyword) => lowerQuestion.includes(keyword));
  }

  private validateQueryFormat(queryString: string): QueryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Chỉ kiểm tra cơ bản - bỏ validation format nghiêm ngặt
    if (!queryString.includes('await this.prismaService.')) {
      errors.push('Query phải chứa await this.prismaService');
    }

    // Cho phép nhiều dấu ; vì AI có thể tạo nhiều câu lệnh (khai báo biến, tính toán, ...)
    // Không giới hạn số lượng ; miễn là có ít nhất một Prisma call hợp lệ ở cuối cùng

    // (b) Kiểm tra bảng & method
    const tableMatch = queryString.match(
      /this\.prismaService\.([a-zA-Z0-9_]+)\./,
    );
    if (!tableMatch || !this.validTableNames.has(tableMatch[1])) {
      errors.push(`Bảng '${tableMatch?.[1] || 'unknown'}' không hợp lệ`);
    }

    // Kiểm tra method Prisma (không kiểm tra method JavaScript thông thường)
    const prismaMethodMatch = queryString.match(
      /this\.prismaService\.[a-zA-Z0-9_]+\.([a-zA-Z0-9_]+)\(/,
    );
    if (prismaMethodMatch && !this.allowedMethods.has(prismaMethodMatch[1])) {
      errors.push(`Prisma method '${prismaMethodMatch[1]}' không được phép`);
    }
    console.log('queryString', queryString);
    // (c) Kiểm tra dangerous keywords - chỉ kiểm tra từ khóa độc lập
    const upperQuery = queryString.toUpperCase();
    for (const keyword of this.dangerousKeywords) {
      // Escape ký tự đặc biệt trong regex
      const escapedKeyword = keyword
        .toUpperCase()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Kiểm tra từ khóa có phải là từ độc lập không
      const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'g');
      if (keywordRegex.test(upperQuery)) {
        // Kiểm tra xem có phải là field hợp lệ không (createdAt, updatedAt, etc.)
        const validFieldRegex = new RegExp(
          `\\b${escapedKeyword}(?:AT|ON|BY|FROM|TO|IN|OF|FOR|WITH|AS|IS|ARE|WAS|WERE)\\b`,
          'i',
        );

        // Nếu không phải là field hợp lệ, thì mới báo lỗi
        if (!validFieldRegex.test(upperQuery)) {
          errors.push(`Từ khóa nguy hiểm: ${keyword}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private extractTimeRange(question: string): TimeRange | null {
    const now = new Date();
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('hôm nay')) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (lowerQuestion.includes('tuần này')) {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (lowerQuestion.includes('tháng này')) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      return { start, end };
    }

    if (lowerQuestion.includes('năm này')) {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end };
    }

    if (lowerQuestion.includes('gần đây')) {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }

    return null;
  }

  private sanitizeQueryForPatient(
    queryString: string,
    userRole: string,
  ): string {
    if (userRole !== 'PATIENT') return queryString;

    // Tự động thêm pagination nếu thiếu
    if (queryString.includes('findMany') && !queryString.includes('take:')) {
      queryString = queryString.replace(
        /findMany\(/,
        'findMany({ take: 50, orderBy: { createdAt: "desc" }, ',
      );
    }

    return queryString;
  }

  private async generatePrismaQuery(question: string): Promise<string | null> {
    const systemInfo = this.getSystemInfo();
    const jwtUser = (this.request as any)?.user as
      | {
          id?: string;
          role?: string;
          doctor?: { id?: string };
          patient?: { id?: string };
        }
      | undefined;
    const contextInfo = {
      user: jwtUser || {},
      scopingRules:
        'Đối với dữ liệu cá nhân (Appointment, PatientProfile, MedicalRecord, Prescription, Invoice), BẮT BUỘC filter theo người dùng hiện tại (PATIENT → theo patientProfileId/patientId/authId; DOCTOR → theo doctorId). Các vai trò khác linh hoạt hơn khi câu hỏi yêu cầu.',
    };

    const timeRange = this.extractTimeRange(question);
    const userRole = jwtUser?.role || 'UNKNOWN';

    const prompt = `
Bạn là một chuyên gia Prisma ORM. Nhiệm vụ của bạn là tạo ra Prisma query từ câu hỏi tiếng Việt về hệ thống phòng khám.

THÔNG TIN HỆ THỐNG:
${JSON.stringify(systemInfo, null, 2)}

NGỮ CẢNH NGƯỜI DÙNG (dùng để filter dữ liệu cá nhân):
${JSON.stringify(contextInfo, null, 2)}

CÂU HỎI: "${question}"
${timeRange ? `\nKHUNG THỜI GIAN: ${timeRange.start.toISOString()} - ${timeRange.end.toISOString()}` : ''}

QUAN TRỌNG:
- CHỈ tạo query SELECT (findMany, findFirst, findUnique, count, aggregate, groupBy)
- KHÔNG được tạo query INSERT, UPDATE, DELETE, DROP
- Sử dụng await this.prismaService
- Trả về đúng format, không có dấu ngoặc kép bao quanh
- Ưu tiên query đơn giản và dễ hiểu
- Ưu tiên dùng select để chỉ lấy các trường cần thiết, chỉ dùng include khi thật sự cần
- Nếu câu hỏi liên quan đến dữ liệu cá nhân (ví dụ: lịch hẹn của tôi, hồ sơ của tôi, hoá đơn của tôi), BẮT BUỘC phải thêm điều kiện where theo id của người dùng  (ưu tiên patientProfileId -> patientId -> authId cho bệnh nhân; doctorId hoặc authId cho bác sĩ).
- Đối với PATIENT: Một bệnh nhân có thể có nhiều hồ sơ (PatientProfile), mỗi hồ sơ có nhiều lịch hẹn. Khi hỏi "lịch hẹn của tôi", cần lấy TẤT CẢ lịch hẹn của TẤT CẢ hồ sơ thuộc bệnh nhân đó. Hệ thống sẽ tự động scope theo patientId hoặc authId.
- Nếu hỏi về trường cụ thể, chỉ select các trường đó khi có thể.
- Nếu người dùng là PATIENT, không được truy vấn dữ liệu cá nhân của người khác. Nếu là DOCTOR, chỉ truy vấn dữ liệu liên quan tới chính bác sĩ đó (doctorId). Các vai trò khác có thể linh hoạt hơn tuỳ câu hỏi.
- Luôn thêm take ≤ 50, skip mặc định 0, orderBy khi có take/skip
- Tự động áp khung thời gian nếu câu hỏi có "hôm nay/tuần này/tháng này/năm nay/gần đây"
- Cấm truy vấn "full scan" không where trên bảng nhạy cảm (personal tables)
- Nếu thiếu where, tự động thêm scope cá nhân

 LUẬT RÀNG BUỘC VỀ TRƯỜNG (bắt buộc tuân thủ):
 - WorkSession: KHÔNG có trường "date". Dùng startTime/endTime để filter/order theo thời gian. Các trường chính: id, doctorId, technicianId, startTime, endTime, nextAvailableAt, status, createdAt, updatedAt; có thể select doctor{ auth{ name } }.
 - Appointment: có trường date, startTime, endTime, status, patientProfileId, doctorId, specialtyId, createdAt, updatedAt.
 - Doctor: có auth{name}, doctorCode, yearsExperience, rating; KHÔNG có trường "date".
 - Nếu field không tồn tại trong model, TUYỆT ĐỐI không sử dụng trong where/orderBy/select.
 - Khi cần tên bác sĩ từ WorkSession, dùng: select { doctor: { select: { id: true, auth: { select: { name: true } } } } }.
 - Tránh chèn comment trong object trả về. Hãy trả về object JSON hợp lệ cho Prisma.

VÍ DỤ CHI TIẾT:
- "Có bao nhiêu bác sĩ?" → await this.prismaService.doctor.count()
 - "Danh sách tất cả bác sĩ" → await this.prismaService.doctor.findMany({ select: { id: true, doctorCode: true, yearsExperience: true, rating: true, workHistory: true, description: true, auth: { select: { id: true, name: true, avatar: true } } } })
- "Tìm bác sĩ có tên Nguyễn" → await this.prismaService.doctor.findMany({where: {auth: {name: {contains: "Nguyễn", mode: "insensitive"}}}, include: {auth: true}})
- "Lịch hẹn hôm nay" → await this.prismaService.appointment.findMany({where: {date: {gte: new Date(new Date().setHours(0,0,0,0)), lt: new Date(new Date().setHours(23,59,59,999))}}, include: {patientProfile: true, doctor: {include: {auth: true}}}})
- "Tổng doanh thu tháng này" → await this.prismaService.invoice.aggregate({where: {createdAt: {gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)}}, _sum: {totalAmount: true}})
- "Số lịch hẹn theo trạng thái" → await this.prismaService.appointment.groupBy({by: ["status"], _count: {status: true}})
- "Lịch hẹn của tôi" (patientProfileId = 123) → await this.prismaService.appointment.findMany({where: {patientProfileId: 123}})
 - "Các lịch hẹn của tôi trong tháng" (auto-scope bệnh nhân) → await this.prismaService.appointment.findMany({ where: { date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) } }, select: { id: true, date: true, startTime: true, endTime: true, status: true, doctor: { select: { id: true, auth: { select: { name: true } } } }, specialty: { select: { id: true, name: true } }, patientProfile: { select: { id: true, name: true } } } })
 - "Hồ sơ của tôi" (authId = 45) → await this.prismaService.patientProfile.findMany({where: {patient: {authId: 45}}})
 - "Tất cả lịch hẹn của tôi" (lấy tất cả lịch hẹn của tất cả hồ sơ) → await this.prismaService.appointment.findMany({ include: { patientProfile: { select: { id: true, name: true } }, doctor: { select: { id: true, auth: { select: { name: true } } } }, specialty: { select: { id: true, name: true } } } })
 - "Lịch hẹn của bác sĩ Kiên tuần này" (doctorId = 9) → await this.prismaService.appointment.findMany({where: {doctorId: 9, date: {gte: new Date(new Date().setDate(new Date().getDate()-new Date().getDay()+1)).setHours(0,0,0,0)}}, select: { id: true, date: true, startTime: true, endTime: true, specialty: { select: { name: true } }, patientProfile: { select: { id: true, name: true } } }})
 - "Lịch làm việc bác sĩ trong tuần này" (WorkSession) → await this.prismaService.workSession.findMany({ where: { startTime: { gte: new Date(new Date().setDate(new Date().getDate()-new Date().getDay()+1)), lt: new Date(new Date().setDate(new Date().getDate()-new Date().getDay()+8)) } }, select: { id: true, startTime: true, endTime: true, doctor: { select: { id: true, auth: { select: { name: true } } } } }, orderBy: [{ startTime: 'asc' }], take: 50, skip: 0 })
 - "Bác sĩ Kiên thuộc chuyên khoa gì" → await this.prismaService.appointment.findMany({ where: { doctor: { auth: { name: { contains: "Kiên", mode: "insensitive" } } } }, select: { specialty: { select: { id: true, name: true } } }, distinct: ["specialtyId"] })
 - "Bệnh viện có bao nhiêu chuyên khoa?, liệt kê ra" → await this.prismaService.specialty.findMany({ select: { id: true, specialtyCode: true, name: true } })

QUERY:`;

    try {
      const result = await this.model.generateContent(prompt);
      const raw = result.response.text().trim();
      const query = this.cleanGeneratedQuery(raw);

      // Validate query format và bảo mật
      const validation = this.validateQueryFormat(query);
      if (!validation.isValid) {
        this.logger.warn('Query validation failed:', validation.errors);
        return null;
      }

      // Sanitize query for patient role
      const sanitizedQuery = this.sanitizeQueryForPatient(query, userRole);

      // Additional security checks
      if (
        sanitizedQuery.includes('await this.prismaService.') &&
        this.isQuerySafe(sanitizedQuery) &&
        this.validateQueryStructure(sanitizedQuery)
      ) {
        return sanitizedQuery;
      }

      return null;
    } catch (error) {
      this.logger.error('Error generating Prisma query:', error);
      return null;
    }
  }

  private cleanGeneratedQuery(input: string): string {
    // Remove Markdown code fences and language hints
    let text = input;
    // If fenced block, extract inner content
    const fenceStart = text.indexOf('```');
    if (fenceStart !== -1) {
      const fenceEnd = text.indexOf('```', fenceStart + 3);
      if (fenceEnd !== -1) {
        // Slice out the content inside the first fenced block
        const inner = text.slice(fenceStart + 3, fenceEnd);
        // Drop optional language tag at the start of the fence content (e.g., javascript)
        const lines = inner.split('\n');
        if (lines.length > 0 && /^\s*[a-zA-Z]+\s*$/.test(lines[0])) {
          lines.shift();
        }
        text = lines.join('\n');
      } else {
        // If unmatched fence, remove all backticks just in case
        text = text.replace(/```/g, '');
      }
    }

    // Trim whitespace
    text = text.trim();

    // If the entire output is quoted, unquote it
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1);
    }

    // Remove stray backticks wrapping a template literal with no interpolations
    if (text.startsWith('`') && text.endsWith('`') && !/\$\{/.test(text)) {
      text = text.slice(1, -1);
    }

    // Remove leading/trailing zero-width/formatting characters
    text = text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

    return text;
  }

  private async executePrismaQuery(queryString: string): Promise<unknown> {
    const startTime = Date.now();
    const jwtUser = (this.request as any)?.user;
    const userId = jwtUser?.id || 'anonymous';
    const userRole = jwtUser?.role || 'UNKNOWN';

    try {
      // Kiểm tra bảo mật query
      this.logger.log(
        `Executing query for user ${userId} (${userRole}): ${this.redactPII(queryString)}`,
      );

      if (!this.isQuerySafe(queryString)) {
        this.logger.warn(
          `Query blocked for user ${userId}: Security violation`,
        );
        throw new BadRequestException(
          'Query không được phép thực thi vì lý do bảo mật',
        );
      }

      // Thực thi query trực tiếp với Prisma service
      const result = await this.executeSafeQuery(queryString);

      const executionTime = Date.now() - startTime;
      this.logger.log(
        `Query executed successfully for user ${userId} in ${executionTime}ms`,
      );

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(
        `Query execution failed for user ${userId} after ${executionTime}ms:`,
        error,
      );
      throw new BadRequestException('Lỗi khi thực thi truy vấn cơ sở dữ liệu');
    }
  }

  private redactPII(queryString: string): string {
    // Redact PII từ query string để log an toàn
    return queryString
      .replace(/patientProfileId:\s*\d+/g, 'patientProfileId: [REDACTED]')
      .replace(/patientId:\s*\d+/g, 'patientId: [REDACTED]')
      .replace(/authId:\s*\d+/g, 'authId: [REDACTED]')
      .replace(/doctorId:\s*\d+/g, 'doctorId: [REDACTED]')
      .replace(/id:\s*\d+/g, 'id: [REDACTED]');
  }

  private isQuerySafe(queryString: string): boolean {
    // Chuyển thành chữ hoa để kiểm tra
    const upperQuery = queryString.toUpperCase();

    // Kiểm tra các từ khóa nguy hiểm (word boundary + context-aware)
    for (const keyword of this.dangerousKeywords) {
      const escapedKeyword = keyword
        .toUpperCase()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match từ khóa độc lập
      const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'g');
      if (keywordRegex.test(upperQuery)) {
        // Cho phép các trường hợp field hợp lệ như createdAt/updatedAt/... (CREATE + AT, BY, ...)
        const validFieldRegex = new RegExp(
          `\\b${escapedKeyword}(?:AT|ON|BY|FROM|TO|IN|OF|FOR|WITH|AS|IS|ARE|WAS|WERE)\\b`,
          'i',
        );
        if (!validFieldRegex.test(upperQuery)) {
          this.logger.warn(`Dangerous keyword detected: ${keyword}`);
          return false;
        }
      }
    }

    // Kiểm tra xem query có chứa method được phép không
    const hasAllowedMethod = Array.from(this.allowedMethods).some((method) =>
      queryString.includes(method),
    );

    if (!hasAllowedMethod) {
      this.logger.warn('Query does not contain any allowed Prisma methods');
      return false;
    }

    return true;
  }

  private validateQueryStructure(queryString: string): boolean {
    // Kiểm tra xem query có chứa tên bảng hợp lệ không
    const hasValidTable = Array.from(this.validTableNames).some((table) =>
      queryString.includes(`this.prismaService.${table}`),
    );

    if (!hasValidTable) {
      this.logger.warn('Query does not contain valid table name');
      return false;
    }

    // Kiểm tra syntax cơ bản
    const hasValidMethod = Array.from(this.allowedMethods).some((method) =>
      queryString.includes(`.${method}(`),
    );

    if (!hasValidMethod) {
      this.logger.warn('Query does not contain valid Prisma method');
      return false;
    }

    return true;
  }

  private enforceUserScopeCompliance(queryString: string): boolean {
    const usesPersonalTable = Array.from(this.personalTables).some((t) =>
      queryString.includes(`this.prismaService.${t}`),
    );

    if (!usesPersonalTable) return true;

    // Kiểm tra xem query đã filter theo một trong các khoá ID hợp lệ
    const hasAnyScope = [
      'patientProfileId',
      'patientId',
      'authId',
      'doctorId',
      'patient: { authId',
      'patient: { id',
      'patientProfile: { id',
    ].some((k) => queryString.includes(k));

    if (!hasAnyScope) {
      this.logger.warn('Personal data query missing user scope filter');
      return false;
    }

    return true;
  }

  private async executeSafeQuery(queryString: string): Promise<unknown> {
    // Thực thi query được tạo bởi AI một cách an toàn
    // Sử dụng eval với context hạn chế
    try {
      const scopedPrisma = this.createScopedPrisma(this.prismaService);
      // Bind this to provide this.prismaService in the generated query
      const fn = eval(`(async function() { return ${queryString}; })`);
      const result = await (
        fn as (this: { prismaService: PrismaService }) => Promise<unknown>
      ).call({ prismaService: scopedPrisma });

      return result;
    } catch (error) {
      this.logger.error('Error executing AI-generated query:', error);
      this.logger.error(`Generated query was: ${queryString}`);
      throw new BadRequestException('Lỗi khi thực thi query được tạo bởi AI');
    }
  }

  private createScopedPrisma(prisma: PrismaService): PrismaService {
    const jwtUser = (this.request as any)?.user as
      | {
          id?: string;
          role?: string;
          doctor?: { id?: string };
          patient?: { id?: string };
          patientProfileId?: string;
        }
      | undefined;
    const ctx = {
      role: (jwtUser?.role || '').toUpperCase(),
      authId: jwtUser?.id ? Number(jwtUser.id) : undefined,
      doctorId: jwtUser?.doctor?.id ? Number(jwtUser.doctor.id) : undefined,
      patientId: jwtUser?.patient?.id ? Number(jwtUser.patient.id) : undefined,
      patientProfileId: jwtUser?.patientProfileId
        ? Number(jwtUser.patientProfileId)
        : undefined,
    };
    const personalTables = new Set([
      'appointment',
      'patientProfile',
      'medicalRecord',
      'prescription',
      'invoice',
    ]);

    const safeMethods = new Set([
      'findMany',
      'findFirst',
      'findUnique',
      'count',
      'aggregate',
      'groupBy',
    ]);

    const applyScopeToArgs = (table: string, method: string, args: any) => {
      const role = ctx.role;
      if (!personalTables.has(table)) return args;
      if (method === 'findUnique') return args;

      const scopeWhere: any = {};

      const scopeForPatientProfile = () => {
        if (ctx.patientProfileId) {
          return { id: ctx.patientProfileId };
        }
        if (ctx.patientId) {
          return { OR: [{ patientId: ctx.patientId }] };
        }
        if (ctx.authId) {
          return { patient: { authId: ctx.authId } };
        }
        return {};
      };

      const addAnd = (existing: any, add: any) => {
        if (!existing) return add;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (!add || Object.keys(add).length === 0) return existing;
        return { AND: [existing, add] };
      };

      if (role === 'PATIENT') {
        switch (table) {
          case 'appointment':
            // PATIENT chỉ được xem lịch hẹn của chính mình, không được xem lịch của bác sĩ khác
            // Cấm tuyệt đối trả về dữ liệu định danh của người khác
            if (ctx.patientProfileId) {
              Object.assign(scopeWhere, {
                patientProfileId: ctx.patientProfileId,
              });
            } else if (ctx.patientId) {
              // Nếu có patientId, lấy tất cả lịch hẹn của tất cả hồ sơ thuộc bệnh nhân này
              Object.assign(scopeWhere, {
                patientProfile: { patientId: ctx.patientId },
              });
            } else if (ctx.authId) {
              // Nếu chỉ có authId, lấy tất cả lịch hẹn của tất cả hồ sơ thuộc auth này
              Object.assign(scopeWhere, {
                patientProfile: { patient: { authId: ctx.authId } },
              });
            }
            break;
          case 'medicalRecord':
          case 'prescription':
          case 'invoice': {
            // Ưu tiên patientProfileId nếu có (cho trường hợp query cụ thể một hồ sơ)
            if (ctx.patientProfileId) {
              Object.assign(scopeWhere, {
                patientProfileId: ctx.patientProfileId,
              });
            } else if (ctx.patientId) {
              // Nếu có patientId, lấy tất cả dữ liệu của tất cả hồ sơ thuộc bệnh nhân này
              Object.assign(scopeWhere, {
                patientProfile: { patientId: ctx.patientId },
              });
            } else if (ctx.authId) {
              // Nếu chỉ có authId, lấy tất cả dữ liệu của tất cả hồ sơ thuộc auth này
              Object.assign(scopeWhere, {
                patientProfile: { patient: { authId: ctx.authId } },
              });
            }
            break;
          }
          case 'patientProfile': {
            Object.assign(scopeWhere, scopeForPatientProfile());
            break;
          }
        }
      } else if (role === 'DOCTOR') {
        switch (table) {
          case 'appointment':
          case 'medicalRecord':
          case 'prescription': {
            if (ctx.doctorId) {
              Object.assign(scopeWhere, { doctorId: ctx.doctorId });
            }
            break;
          }
        }
      }

      if (!args) args = {};

      // Sanitize fields for PATIENT role
      if (role === 'PATIENT' && this.personalTables.has(table)) {
        args = this.sanitizeFieldsForPatient(args, table);
      }

      // Apply pagination limits
      if (method === 'findMany' && !args.take) {
        args.take = 50;
      }
      if (args.take && args.take > 100) {
        args.take = 100;
      }
      if (method === 'findMany' && !args.orderBy) {
        args.orderBy = { createdAt: 'desc' };
      }

      if (method === 'groupBy') {
        args.where = addAnd(args.where, scopeWhere);
      } else if (
        method === 'aggregate' ||
        method === 'count' ||
        method === 'findMany' ||
        method === 'findFirst'
      ) {
        args.where = addAnd(args.where, scopeWhere);
      }
      return args;
    };

    return new Proxy(prisma as unknown as Record<string, any>, {
      get: (target: Record<string, any>, prop: string) => {
        const tableClient = target[prop];
        if (!tableClient || typeof tableClient !== 'object') return tableClient;

        // Proxy tất cả bảng để kiểm soát method access
        return new Proxy(tableClient as Record<string, any>, {
          get: (t2: Record<string, any>, method: string) => {
            const orig = t2[method];
            if (!safeMethods.has(method) || typeof orig !== 'function') {
              return orig;
            }
            return (args?: unknown) => {
              return (orig as Function).apply(t2, [
                applyScopeToArgs(prop, method, args as Record<string, unknown>),
              ]);
            };
          },
        });
      },
    }) as unknown as PrismaService;
  }

  private sanitizeFieldsForPatient(args: any, table: string): any {
    const whitelistedFields = this.patientWhitelistedFields[table];
    if (!whitelistedFields) return args;

    // Nếu có select, chỉ cho phép fields whitelisted
    if (args.select) {
      const sanitizedSelect: any = {};
      for (const field of whitelistedFields) {
        if (args.select[field] !== undefined) {
          sanitizedSelect[field] = args.select[field];
        }
      }
      args.select = sanitizedSelect;
    }

    // Nếu có include, kiểm tra và sanitize nested fields
    if (args.include) {
      const sanitizedInclude: any = {};
      for (const [key, value] of Object.entries(
        args.include as Record<string, unknown>,
      )) {
        if (typeof value === 'object' && value !== null) {
          // Nested include - chỉ cho phép select fields an toàn
          if (
            'select' in value &&
            typeof value.select === 'object' &&
            value.select !== null
          ) {
            const nestedWhitelist = this.patientWhitelistedFields[key] || [];
            const sanitizedNestedSelect: any = {};
            for (const field of nestedWhitelist) {
              if (value.select && value.select[field] !== undefined) {
                sanitizedNestedSelect[field] = value.select[field];
              }
            }
            sanitizedInclude[key] = { select: sanitizedNestedSelect };
          } else {
            sanitizedInclude[key] = value;
          }
        } else {
          sanitizedInclude[key] = value;
        }
      }
      args.include = sanitizedInclude;
    }

    return args;
  }

  private async generateExplanation(
    question: string,
    data: unknown,
    concise = false,
  ): Promise<string> {
    const prompt = `
Dựa trên câu hỏi: "${question}"
Và kết quả dữ liệu: ${JSON.stringify(data, null, 2)}

Hãy tạo ra một câu trả lời tự nhiên và dễ hiểu bằng tiếng Việt. Giải thích ý nghĩa của dữ liệu và đưa ra insights hữu ích.
Độ dài: ${concise ? 'Ngắn gọn trong 2-3 câu.' : 'Khoảng 1 đoạn (3-5 câu).'}

Trả lời:`;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      this.logger.error('Error generating explanation:', error);
      return 'Đây là kết quả truy vấn dữ liệu từ hệ thống.';
    }
  }

  private async generateGeneralAnswer(question: string): Promise<string> {
    const prompt = `
Bạn là trợ lý ảo phòng khám. Hãy trả lời câu hỏi sau bằng tiếng Việt, ngắn gọn khoảng 1 đoạn (3-5 câu), thân thiện và dễ hiểu.

Câu hỏi: "${question}"

Trả lời:`;
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      this.logger.error('Error generating general answer:', error);
      return 'Xin lỗi, tôi chưa thể trả lời câu hỏi này lúc này.';
    }
  }

  private getSystemInfo(): SystemInfo {
    return {
      tables: [
        'Auth',
        'Doctor',
        'Patient',
        'PatientProfile',
        'Receptionist',
        'Admin',
        'Cashier',
        'Technician',
        'Specialty',
        'ClinicRoom',
        'Service',
        'Appointment',
        'Invoice',
        'InvoiceDetail',
        'MedicalRecord',
        'Prescription',
        'PrescriptionService',
        'Template',
        'WorkSession',
        'Counter',
        'CounterQueueItem',
        'CounterAssignment',
        'Booth',
      ],
      relationships: [
        'Auth -> Doctor (1:1)',
        'Auth -> Patient (1:1)',
        'Auth -> Receptionist (1:1)',
        'Doctor -> Appointment (1:N)',
        'Patient -> PatientProfile (1:N)',
        'Appointment -> PatientProfile (N:1)',
        'Appointment -> Doctor (N:1)',
        'Appointment -> Specialty (N:1)',
        'Invoice -> PatientProfile (N:1)',
        'MedicalRecord -> PatientProfile (N:1)',
        'MedicalRecord -> Doctor (N:1)',
        'Prescription -> PatientProfile (N:1)',
        'WorkSession -> Doctor (N:1)',
        'WorkSession -> Technician (N:1)',
      ],
      sampleQueries: [
        'Đếm số bác sĩ: doctor.count()',
        'Danh sách lịch hẹn hôm nay: appointment.findMany({where: {date: {gte: today}}})',
        'Tổng doanh thu: invoice.aggregate({_sum: {totalAmount: true}})',
        'Bệnh nhân theo bác sĩ: appointment.findMany({include: {doctor: true, patientProfile: true}})',
        'Dịch vụ phổ biến: service.findMany({orderBy: {price: "desc"}})',
      ],
    };
  }

  // Các method tiện ích để query thường dùng
  async getSystemStats(): Promise<{
    totalDoctors: number;
    totalPatients: number;
    totalAppointments: number;
    totalRevenue: number;
    todayAppointments: number;
    pendingPrescriptions: number;
  }> {
    try {
      const [
        totalDoctors,
        totalPatients,
        totalAppointments,
        totalRevenue,
        todayAppointments,
        pendingPrescriptions,
      ] = await Promise.all([
        this.prismaService.doctor.count(),
        this.prismaService.patientProfile.count(),
        this.prismaService.appointment.count(),
        this.prismaService.invoice.aggregate({
          _sum: { totalAmount: true },
          where: { isPaid: true },
        }),
        this.prismaService.appointment.count({
          where: {
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        this.prismaService.prescription.count({
          where: { status: 'NOT_STARTED' },
        }),
      ]);

      return {
        totalDoctors,
        totalPatients,
        totalAppointments,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        todayAppointments,
        pendingPrescriptions,
      };
    } catch (error) {
      this.logger.error('Error getting system stats:', error);
      throw error;
    }
  }

  async searchDoctors(searchTerm: string): Promise<unknown[]> {
    try {
      return await this.prismaService.doctor.findMany({
        where: {
          OR: [
            { auth: { name: { contains: searchTerm, mode: 'insensitive' } } },
            { doctorCode: { contains: searchTerm, mode: 'insensitive' } },
            { workHistory: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          doctorCode: true,
          yearsExperience: true,
          rating: true,
          workHistory: true,
          description: true,
          auth: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });
    } catch (error) {
      this.logger.error('Error searching doctors:', error);
      throw error;
    }
  }

  async getAppointmentsByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    try {
      return await this.prismaService.appointment.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          patientProfile: true,
          doctor: {
            include: {
              auth: true,
            },
          },
          specialty: true,
        },
        orderBy: { date: 'asc' },
      });
    } catch (error) {
      this.logger.error('Error getting appointments by date range:', error);
      throw error;
    }
  }
}
