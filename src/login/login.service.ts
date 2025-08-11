import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

interface JwtPayload {
  sub: string;
  phone: string | null;
  email?: string | null;
  role?: string;
  patient?: { id: string; patientCode: string };
  doctor?: { id: string; doctorCode: string };
  receptionist?: { id: string };
  clinicAdmin?: { id: string };
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
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
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
      sub: auth.userId,
      phone: auth.phone,
      email: auth.email,
      role: user.role,
    };

    // Thêm thông tin tương ứng với role
    if (user.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({
        where: { userId: auth.userId },
        select: { id: true, patientCode: true },
      });
      if (patient) {
        payload.patient = patient;
      }
    } else if (user.role === 'DOCTOR') {
      const doctor = await this.prisma.doctor.findUnique({
        where: { userId: auth.userId },
        select: { id: true, doctorCode: true },
      });
      if (doctor) {
        payload.doctor = doctor;
      }
    } else if (user.role === 'RECEPTIONIST') {
      const receptionist = await this.prisma.receptionist.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (receptionist) {
        payload.receptionist = receptionist;
      }
    } else if (user.role === 'CLINIC_ADMIN') {
      const clinicAdmin = await this.prisma.clinicAdmin.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (clinicAdmin) {
        payload.clinicAdmin = clinicAdmin;
      }
    }

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return { accessToken, refreshToken, user };
  }

  async googleLogin(googleUser: GoogleUser) {
    console.log('🔍 Processing Google login for:', googleUser.email);
    // Kiểm tra xem user đã tồn tại chưa (tìm theo email hoặc googleId)
    let auth = await this.prisma.auth.findFirst({
      where: {
        OR: [{ email: googleUser.email }, { googleId: googleUser.googleId }],
      },
      include: {
        user: true,
      },
    });

    if (!auth) {
      console.log('✅ Creating new user for:', googleUser.email);
      // Tạo user mới nếu chưa tồn tại
      const newUser = await this.prisma.user.create({
        data: {
          name: `${googleUser.firstName} ${googleUser.lastName}`,
          dateOfBirth: new Date(), // Có thể cập nhật sau
          gender: 'other', // Có thể cập nhật sau
          address: '', // Có thể cập nhật sau
          // citizenId: null, // Không cần set vì giờ có thể null
          role: 'PATIENT', // Mặc định là PATIENT
          avatar: googleUser.picture,
          auth: {
            create: {
              email: googleUser.email,
              googleId: googleUser.googleId,
              accessToken: googleUser.accessToken,
              refreshToken: googleUser.refreshToken,
              tokenExpiry: new Date(Date.now() + 3600 * 1000), // 1 giờ
            },
          },
        },
        include: {
          auth: true,
        },
      });
      // Tạo patient mới liên kết với user vừa tạo
      await this.prisma.patient.create({
        data: {
          userId: newUser.id,
          patientCode: `PAT${Date.now()}`,
          address: newUser.address,
          occupation: '',
          emergencyContact: {},
          healthInsurance: '',
          loyaltyPoints: 0,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      auth = newUser.auth as any;
      console.log('✅ New user created with ID:', newUser.id);
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
      if (auth.user.avatar !== googleUser.picture) {
        await this.prisma.user.update({
          where: { id: auth.userId },
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
      sub: auth.userId,
      phone: auth.phone,
      email: auth.email,
      role: auth.user.role,
    };

    // Thêm thông tin tương ứng với role
    if (auth.user.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({
        where: { userId: auth.userId },
        select: { id: true, patientCode: true },
      });
      if (patient) {
        payload.patient = patient;
      }
    } else if (auth.user.role === 'DOCTOR') {
      const doctor = await this.prisma.doctor.findUnique({
        where: { userId: auth.userId },
        select: { id: true, doctorCode: true },
      });
      if (doctor) {
        payload.doctor = doctor;
      }
    } else if (auth.user.role === 'RECEPTIONIST') {
      const receptionist = await this.prisma.receptionist.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (receptionist) {
        payload.receptionist = receptionist;
      }
    } else if (auth.user.role === 'CLINIC_ADMIN') {
      const clinicAdmin = await this.prisma.clinicAdmin.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (clinicAdmin) {
        payload.clinicAdmin = clinicAdmin;
      }
    }

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
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
        where: { userId: payload.sub },
      });
      if (!auth) throw new UnauthorizedException('Invalid refresh token');

      const newAccessToken = this.jwtService.sign(
        { sub: auth.userId, phone: auth.phone },
        { expiresIn: '15m' },
      );

      const newRefreshToken = this.jwtService.sign(
        { sub: auth.userId, phone: auth.phone },
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

      const user = await this.prisma.user.findUnique({
        where: { id: sub },
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
      return user;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
