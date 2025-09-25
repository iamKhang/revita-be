import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiChatbotController } from './ai-chatbot.controller';
import { AiChatbotService } from './ai-chatbot.service';
import { DatabaseQueryService } from './database-query.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AiChatbotController],
  providers: [AiChatbotService, DatabaseQueryService],
  exports: [AiChatbotService, DatabaseQueryService],
})
export class AiChatbotModule {}
