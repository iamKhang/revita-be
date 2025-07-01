import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RegisterController } from './register.controller';
import { RegisterService } from './register.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
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
