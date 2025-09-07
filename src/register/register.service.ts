import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/client';
import { RedisService } from '../cache/redis.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { RegisterStep1Dto } from './dto/register-step1.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { CodeGeneratorService } from '../user-management/patient-profile/code-generator.service';

@Injectable()
export class RegisterService {
  private codeGenerator = new CodeGeneratorService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Bước 1: Đăng ký với số điện thoại hoặc email
   */
  async registerStep1(
    registerDto: RegisterStep1Dto,
  ): Promise<{ sessionId: string; message: string }> {
    const { phone, email } = registerDto;

    // Kiểm tra xem phone hoặc email đã tồn tại chưa
    if (phone) {
      const existingAuth = await this.prisma.auth.findUnique({
        where: { phone },
      });
      if (existingAuth) {
        throw new ConflictException('Số điện thoại đã được đăng ký');
      }
    }

    if (email) {
      const existingAuth = await this.prisma.auth.findUnique({
        where: { email },
      });
      if (existingAuth) {
        throw new ConflictException('Email đã được đăng ký');
      }
    }

    // Tạo OTP 6 chữ số
    const otp = this.generateOtp();

    // Tạo session ID
    const sessionId = uuidv4();

    // Lưu thông tin vào Redis
    const sessionData = {
      phone,
      email,
      step: 1,
      verified: false,
      createdAt: new Date().toISOString(),
    };

    await this.redisService.setSession(sessionId, sessionData);

    // Lưu OTP với key là sessionId
    await this.redisService.setOtp(`otp:${sessionId}`, otp, 300); // 5 phút

    // Gửi OTP qua SMS hoặc Email
    let sendSuccess = false;
    if (phone) {
      sendSuccess = await this.smsService.sendOtp(phone, otp);
    } else if (email) {
      sendSuccess = await this.emailService.sendOtp(email, otp);
    }

    if (!sendSuccess) {
      // Nếu gửi thất bại, vẫn log ra console để development
      console.log(
        `🔐 OTP cho ${phone || email}: ${otp} (Gửi thất bại, hiển thị để test)`,
      );
      console.log(`📱 Session ID: ${sessionId}`);
    }

    return {
      sessionId,
      message: phone
        ? `Mã OTP đã được gửi đến số điện thoại ${phone}`
        : `Mã OTP đã được gửi đến email ${email}`,
    };
  }

  /**
   * Bước 2: Xác thực OTP
   */
  async verifyOtp(
    verifyDto: VerifyOtpDto,
  ): Promise<{ sessionId: string; message: string }> {
    const { otp, sessionId } = verifyDto;

    // Lấy thông tin session
    const sessionData = (await this.redisService.getSession(sessionId)) as {
      phone?: string;
      email?: string;
      step?: number;
      verified?: boolean;
    } | null;
    if (!sessionData) {
      throw new NotFoundException('Session không tồn tại hoặc đã hết hạn');
    }

    // Lấy OTP từ Redis
    const storedOtp = await this.redisService.getOtp(`otp:${sessionId}`);
    if (!storedOtp) {
      throw new BadRequestException('OTP đã hết hạn');
    }

    // Kiểm tra OTP
    if (storedOtp !== otp) {
      throw new BadRequestException('OTP không chính xác');
    }

    // Cập nhật session - đánh dấu đã xác thực
    sessionData.verified = true;
    sessionData.step = 2;
    await this.redisService.setSession(sessionId, sessionData, 1800); // 30 phút

    // Xóa OTP đã sử dụng
    await this.redisService.deleteOtp(`otp:${sessionId}`);

    return {
      sessionId,
      message: 'Xác thực OTP thành công. Vui lòng hoàn tất thông tin đăng ký.',
    };
  }

  /**
   * Bước 3: Hoàn tất đăng ký
   */
  async completeRegistration(
    completeDto: CompleteRegistrationDto,
  ): Promise<{ message: string; userId: string }> {
    const {
      sessionId,
      name,
      dateOfBirth,
      gender,
      address,
      citizenId,
      avatar,
      password,
    } = completeDto;

    // Lấy thông tin session

    const sessionData = (await this.redisService.getSession(sessionId)) as {
      phone?: string;
      email?: string;
      step?: number;
      verified?: boolean;
    } | null;
    if (!sessionData) {
      throw new NotFoundException('Session không tồn tại hoặc đã hết hạn');
    }

    // Kiểm tra xem đã xác thực OTP chưa

    if (!sessionData.verified || sessionData.step !== 2) {
      throw new BadRequestException(
        'Chưa xác thực OTP hoặc session không hợp lệ',
      );
    }

    // Kiểm tra citizenId nếu có
    if (citizenId) {
      const existingAuth = await this.prisma.auth.findUnique({
        where: { citizenId },
      });
      if (existingAuth) {
        throw new ConflictException('Số CMND/CCCD đã được đăng ký');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      // Tạo auth và patient trong transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Tạo Auth (main user table)
        const auth = await prisma.auth.create({
          data: {
            name,
            dateOfBirth: new Date(dateOfBirth),
            gender,
            address,
            citizenId,
            avatar,
            role: Role.PATIENT, // Mặc định là PATIENT
            phone: sessionData.phone,
            email: sessionData.email,
            password: hashedPassword,
          },
        });

        // Tạo Patient record
        const patientCode = this.codeGenerator.generatePatientCode(
          name,
          new Date(dateOfBirth),
          gender,
        );
        await prisma.patient.create({
          data: {
            id: auth.id,
            patientCode, // Tạo mã bệnh nhân
            authId: auth.id,
            loyaltyPoints: 0,
          },
        });

        return auth;
      });

      // Xóa session sau khi đăng ký thành công
      await this.redisService.deleteSession(sessionId);

      // Gửi email/SMS chào mừng
      if (sessionData.email) {
        await this.emailService.sendWelcomeEmail(sessionData.email, name);
      }
      if (sessionData.phone) {
        await this.smsService.sendWelcomeSms(sessionData.phone, name);
      }

      return {
        message: 'Đăng ký thành công',
        userId: result.id,
      };
    } catch (error) {
      console.error('Error during registration:', error);
      throw new BadRequestException('Có lỗi xảy ra trong quá trình đăng ký');
    }
  }

  /**
   * Tạo OTP 6 chữ số
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Gửi lại OTP
   */
  async resendOtp(sessionId: string): Promise<{ message: string }> {
    // Lấy thông tin session
    const sessionData = (await this.redisService.getSession(sessionId)) as {
      phone?: string;
      email?: string;
      verified?: boolean;
    } | null;
    if (!sessionData) {
      throw new NotFoundException('Session không tồn tại hoặc đã hết hạn');
    }

    if (sessionData.verified) {
      throw new BadRequestException('OTP đã được xác thực');
    }

    // Tạo OTP mới
    const otp = this.generateOtp();

    // Lưu OTP mới
    await this.redisService.setOtp(`otp:${sessionId}`, otp, 300); // 5 phút

    // Gửi OTP mới qua SMS hoặc Email
    let sendSuccess = false;
    if (sessionData.phone) {
      sendSuccess = await this.smsService.sendOtp(sessionData.phone, otp);
    } else if (sessionData.email) {
      sendSuccess = await this.emailService.sendOtp(sessionData.email, otp);
    }

    if (!sendSuccess) {
      // Nếu gửi thất bại, vẫn log ra console để development
      console.log(
        `🔐 OTP mới cho ${sessionData.phone || sessionData.email}: ${otp} (Gửi thất bại, hiển thị để test)`,
      );
    }

    return {
      message: sessionData.phone
        ? `Mã OTP mới đã được gửi đến số điện thoại ${sessionData.phone}`
        : `Mã OTP mới đã được gửi đến email ${sessionData.email}`,
    };
  }
}
