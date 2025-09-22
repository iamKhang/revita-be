import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiChatbotController } from './ai-chatbot.controller';
import { AiChatbotService } from './ai-chatbot.service';

@Module({
  imports: [ConfigModule],
  controllers: [AiChatbotController],
  providers: [AiChatbotService],
  exports: [AiChatbotService],
})
export class AiChatbotModule {}
