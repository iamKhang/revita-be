import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CodeGeneratorService } from '../user-management/patient-profile/code-generator.service';

interface JwtPayload {
  sub: string;
  phone: string | null;
  email?: string | null;
  role?: string;
  patient?: { id: string; patientCode: string };
  doctor?: { id: string; doctorCode: string };
  receptionist?: { id: string };
  admin?: { id: string };
}

interface GoogleUser {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  accessToken: string;
  refreshToken: string;
  googleId: string;
}

@Injectable()
export class LoginService {
  private codeGenerator = new CodeGeneratorService();

  constructor(
    private readonly jwtService: JwtService,
    @Inject('PRISMA') private readonly prisma: PrismaClient,
  ) {}

  async validateUser(identifier: string, password: string) {
    const auth = await this.prisma.auth.findFirst({
      where: {
        OR: [{ phone: identifier }, { email: identifier }],
      },
    });
    if (!auth || !auth.password) return null;
    const isMatch = await bcrypt.compare(password, auth.password);
    if (!isMatch) return null;
    return auth;
  }

  async login(
    phoneOrEmail: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const auth = await this.validateUser(phoneOrEmail, password);
    if (!auth) throw new UnauthorizedException('Invalid credentials');

    // Lấy thông tin user và role
    const user = await this.prisma.auth.findUnique({
      where: { id: auth.id },
      select: {
        id: true,
        name: true,
        dateOfBirth: true,
        gender: true,
        avatar: true,
        address: true,
        citizenId: true,
        role: true,
      },
    });

    if (!user) throw new UnauthorizedException('User not found');

    // Tạo payload cơ bản
    const payload: JwtPayload = {
      sub: auth.id,
      phone: auth.phone,
      email: auth.email,
      role: auth.role as string,
    };

    // Thêm thông tin tương ứng với role
    if (user.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({
        where: { authId: auth.id },
        select: { id: true, patientCode: true },
      });
      if (patient) {
        payload.patient = patient;
      }
    } else if (user.role === 'DOCTOR') {
      const doctor = await this.prisma.doctor.findUnique({
        where: { authId: auth.id },
        select: { id: true, doctorCode: true },
      });
      if (doctor) {
        payload.doctor = doctor;
      }
    } else if (user.role === 'RECEPTIONIST') {
      const receptionist = await this.prisma.receptionist.findUnique({
        where: { authId: auth.id },
        select: { id: true },
      });
      if (receptionist) {
        payload.receptionist = receptionist;
      }
    } else if (user.role === 'ADMIN') {
      const admin = await this.prisma.admin.findUnique({
        where: { authId: auth.id },
        select: { id: true },
      });
      if (admin) {
        payload.admin = { id: admin.id };
      }
    }

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15d' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '30d' });

    return { accessToken, refreshToken, user };
  }

  async googleLogin(googleUser: GoogleUser) {
    console.log('🔍 Processing Google login for:', googleUser.email);
    // Kiểm tra xem user đã tồn tại chưa (tìm theo email hoặc googleId)
    let auth = await this.prisma.auth.findFirst({
      where: {
        OR: [{ email: googleUser.email }, { googleId: googleUser.googleId }],
      },
    });

    if (!auth) {
      console.log('✅ Creating new user for:', googleUser.email);
      // Tạo auth mới nếu chưa tồn tại
      auth = await this.prisma.auth.create({
        data: {
          name: `${googleUser.firstName} ${googleUser.lastName}`,
          dateOfBirth: new Date(), // Có thể cập nhật sau
          gender: 'other', // Có thể cập nhật sau
          address: '', // Có thể cập nhật sau
          role: 'PATIENT', // Mặc định là PATIENT
          avatar: googleUser.picture,
          email: googleUser.email,
          googleId: googleUser.googleId,
          accessToken: googleUser.accessToken,
          refreshToken: googleUser.refreshToken,
          tokenExpiry: new Date(Date.now() + 3600 * 1000), // 1 giờ
        },
      });
      // Tạo patient mới liên kết với auth vừa tạo
      await this.prisma.patient.create({
        data: {
          id: auth.id,
          patientCode: this.codeGenerator.generatePatientCode(
            googleUser.firstName + ' ' + googleUser.lastName,
            new Date('1990-01-01'), // Default date for Google users
            'Nam', // Default gender
          ),
          authId: auth.id,
          loyaltyPoints: 0,
        },
      });
      console.log('✅ New user created with ID:', auth.id);
    } else {
      console.log(
        '✅ User already exists, updating auth info for:',
        googleUser.email,
      );
      // Cập nhật thông tin Google nếu user đã tồn tại
      await this.prisma.auth.update({
        where: { id: auth.id },
        data: {
          googleId: googleUser.googleId,
          accessToken: googleUser.accessToken,
          refreshToken: googleUser.refreshToken,
          tokenExpiry: new Date(Date.now() + 3600 * 1000), // 1 giờ
        },
      });
      // Cập nhật avatar nếu có thay đổi
      if (auth.avatar !== googleUser.picture) {
        await this.prisma.auth.update({
          where: { id: auth.id },
          data: {
            avatar: googleUser.picture,
          },
        });
      }
    }

    if (!auth) {
      throw new UnauthorizedException('Failed to create or update user');
    }

    // Tạo JWT tokens với thông tin role tương ứng
    const payload: JwtPayload = {
      sub: auth.id,
      phone: auth.phone,
      email: auth.email,
      role: auth.role as string,
    };

    // Thêm thông tin tương ứng với role
    if (auth.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({
        where: { authId: auth.id },
        select: { id: true, patientCode: true },
      });
      if (patient) {
        payload.patient = patient;
      }
    } else if (auth.role === 'DOCTOR') {
      const doctor = await this.prisma.doctor.findUnique({
        where: { authId: auth.id },
        select: { id: true, doctorCode: true },
      });
      if (doctor) {
        payload.doctor = doctor;
      }
    } else if (auth.role === 'RECEPTIONIST') {
      const receptionist = await this.prisma.receptionist.findUnique({
        where: { authId: auth.id },
        select: { id: true },
      });
      if (receptionist) {
        payload.receptionist = receptionist;
      }
    } else if (auth.role === 'ADMIN') {
      const admin = await this.prisma.admin.findUnique({
        where: { authId: auth.id },
        select: { id: true },
      });
      if (admin) {
        payload.admin = { id: admin.id };
      }
    }

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    const user = {
      id: auth.id,
      name: auth.name,
      dateOfBirth: auth.dateOfBirth,
      gender: auth.gender,
      avatar: auth.avatar,
      address: auth.address,
      citizenId: auth.citizenId,
      role: auth.role,
    };

    return { accessToken, refreshToken, user };
  }

  async refresh(refreshToken: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payloadRaw = this.jwtService.verify(refreshToken);
      if (typeof payloadRaw !== 'object' || payloadRaw === null) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const { sub, phone } = payloadRaw as Record<string, unknown>;
      if (typeof sub !== 'string' || typeof phone !== 'string') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const payload: JwtPayload = { sub, phone };

      const auth = await this.prisma.auth.findUnique({
        where: { id: payload.sub },
      });
      if (!auth) throw new UnauthorizedException('Invalid refresh token');

      const newAccessToken = this.jwtService.sign(
        { sub: auth.id, phone: auth.phone },
        { expiresIn: '15m' },
      );

      const newRefreshToken = this.jwtService.sign(
        { sub: auth.id, phone: auth.phone },
        { expiresIn: '7d' },
      );
      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getUserByToken(accessToken: string): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payloadRaw = this.jwtService.verify(accessToken);
      if (typeof payloadRaw !== 'object' || payloadRaw === null) {
        throw new UnauthorizedException('Invalid token');
      }
      const { sub } = payloadRaw as Record<string, unknown>;
      if (typeof sub !== 'string') {
        throw new UnauthorizedException('Invalid token');
      }

      const auth = await this.prisma.auth.findUnique({
        where: { id: sub },
        select: {
          id: true,
          name: true,
          dateOfBirth: true,
          email: true,
          phone: true,
          gender: true,
          avatar: true,
          address: true,
          citizenId: true,
          role: true,
          // Role-specific data
          patient: {
            select: {
              id: true,
              patientCode: true,
              loyaltyPoints: true,
            },
          },
          doctor: {
            select: {
              id: true,
              doctorCode: true,
              degrees: true,
              yearsExperience: true,
              rating: true,
              workHistory: true,
              description: true,
            },
          },
          receptionist: {
            select: {
              id: true,
            },
          },
          admin: {
            select: {
              id: true,
              adminCode: true,
            },
          },
        },
      });
      if (!auth) throw new UnauthorizedException('User not found');
      return auth;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async logout(
    accessToken: string,
  ): Promise<{ success: boolean; message: string }> {
    // Verify token to get user id
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const payloadRaw = this.jwtService.verify(accessToken);
    if (typeof payloadRaw !== 'object' || payloadRaw === null) {
      throw new UnauthorizedException('Invalid token');
    }
    const { sub } = payloadRaw as Record<string, unknown>;
    if (typeof sub !== 'string') {
      throw new UnauthorizedException('Invalid token');
    }

    // Best-effort: clear stored provider tokens so mobile/web sessions relying on them are invalidated
    await this.prisma.auth.update({
      where: { id: sub },
      data: {
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
      },
    });

    return { success: true, message: 'Logged out successfully' };
  }
}
