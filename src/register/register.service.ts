import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/client';
import { RedisService } from '../cache/redis.service';
import { RegisterStep1Dto } from './dto/register-step1.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RegisterService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redisService: RedisService,
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

    // In OTP ra console (thay thế cho việc gửi SMS/Email)
    console.log(`🔐 OTP cho ${phone || email}: ${otp}`);
    console.log(`📱 Session ID: ${sessionId}`);

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const sessionData = await this.redisService.getSession(sessionId);
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    sessionData.verified = true;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const sessionData = await this.redisService.getSession(sessionId);
    if (!sessionData) {
      throw new NotFoundException('Session không tồn tại hoặc đã hết hạn');
    }

    // Kiểm tra xem đã xác thực OTP chưa
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!sessionData.verified || sessionData.step !== 2) {
      throw new BadRequestException(
        'Chưa xác thực OTP hoặc session không hợp lệ',
      );
    }

    // Kiểm tra citizenId nếu có
    if (citizenId) {
      const existingUser = await this.prisma.user.findUnique({
        where: { citizenId },
      });
      if (existingUser) {
        throw new ConflictException('Số CMND/CCCD đã được đăng ký');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      // Tạo user và auth trong transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Tạo User
        const user = await prisma.user.create({
          data: {
            name,
            dateOfBirth: new Date(dateOfBirth),
            gender,
            address,
            citizenId,
            avatar,
            role: Role.PATIENT, // Mặc định là PATIENT
          },
        });

        // Tạo Auth
        await prisma.auth.create({
          data: {
            userId: user.id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            phone: sessionData.phone,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            email: sessionData.email,
            password: hashedPassword,
          },
        });

        // Tạo Patient record
        await prisma.patient.create({
          data: {
            patientCode: `PAT${Date.now()}`, // Tạo mã bệnh nhân
            userId: user.id,
            address,
            emergencyContact: {}, // Có thể để trống ban đầu
          },
        });

        return user;
      });

      // Xóa session sau khi đăng ký thành công
      await this.redisService.deleteSession(sessionId);

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const sessionData = await this.redisService.getSession(sessionId);
    if (!sessionData) {
      throw new NotFoundException('Session không tồn tại hoặc đã hết hạn');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (sessionData.verified) {
      throw new BadRequestException('OTP đã được xác thực');
    }

    // Tạo OTP mới
    const otp = this.generateOtp();

    // Lưu OTP mới
    await this.redisService.setOtp(`otp:${sessionId}`, otp, 300); // 5 phút

    // In OTP ra console
    console.log(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      `🔐 OTP mới cho ${sessionData.phone || sessionData.email}: ${otp}`,
    );

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      message: sessionData.phone
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Mã OTP mới đã được gửi đến số điện thoại ${sessionData.phone}`
        : // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Mã OTP mới đã được gửi đến email ${sessionData.email}`,
    };
  }
}
