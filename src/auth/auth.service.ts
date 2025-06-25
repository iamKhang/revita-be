import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

interface JwtPayload {
  sub: string;
  phone: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject('PRISMA') private readonly prisma: PrismaClient,
  ) {}

  async validateUser(phone: string, password: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const auth = await this.prisma.auth.findFirst({ where: { phone } });
    if (!auth) return null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    const isMatch = await bcrypt.compare(password, auth.password);
    if (!isMatch) return null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return auth;
  }

  async login(
    phone: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const auth = await this.validateUser(phone, password);
    if (!auth) throw new UnauthorizedException('Invalid credentials');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const payload = { sub: auth.userId, phone: auth.phone };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const user = await this.prisma.user.findUnique({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      where: { id: auth.userId },
      select: {
        id: true,
        name: true,
        dateOfBirth: true,
        gender: true,
        avatarUrl: true,
        address: true,
        idCard: true,
        role: true,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const auth = await this.prisma.auth.findUnique({
        where: { userId: payload.sub },
      });
      if (!auth) throw new UnauthorizedException('Invalid refresh token');

      const newAccessToken = this.jwtService.sign(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        { sub: auth.userId, phone: auth.phone },
        { expiresIn: '15m' },
      );

      const newRefreshToken = this.jwtService.sign(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const user = await this.prisma.user.findUnique({
        where: { id: sub },
        select: {
          id: true,
          name: true,
          dateOfBirth: true,
          gender: true,
          avatarUrl: true,
          address: true,
          idCard: true,
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
