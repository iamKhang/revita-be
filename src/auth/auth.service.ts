import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

interface JwtPayload {
  sub: string;
  phone: string;
  email?: string;
}

@Injectable()
export class AuthService {
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

    const payload = { sub: auth.userId, phone: auth.phone, email: auth.email };
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
