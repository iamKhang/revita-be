import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RegisterController } from './register.controller';
import { RegisterService } from './register.service';
import { CacheModule } from '../cache/cache.module';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [CacheModule, EmailModule, SmsModule],
  controllers: [RegisterController],
  providers: [
    RegisterService,
    {
      provide: PrismaClient,
      useValue: new PrismaClient(),
    },
  ],
  exports: [RegisterService],
})
export class RegisterModule {}
