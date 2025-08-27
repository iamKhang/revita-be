import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { LoginService } from './login.service';
import { LoginController } from './login.controller';
import { GoogleStrategy } from './google.strategy';
import { PrismaClient } from '@prisma/client';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default_secret',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [LoginController],
  providers: [
    LoginService,
    GoogleStrategy,
    { provide: 'PRISMA', useValue: new PrismaClient() },
  ],
  exports: [LoginService],
})
export class LoginModule {}
