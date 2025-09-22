import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AiChatbotService } from './ai-chatbot.service';
import { ChatRequestDto, ChatResponseDto } from './dto';
import { JwtAuthGuard } from '../login/jwt-auth.guard';

@Controller('ai-chatbot')
@UseGuards(JwtAuthGuard)
export class AiChatbotController {
  private readonly logger = new Logger(AiChatbotController.name);

  constructor(private readonly aiChatbotService: AiChatbotService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() chatRequest: ChatRequestDto): Promise<ChatResponseDto> {
    try {
      this.logger.log(
        `Received chat request: ${chatRequest.message.substring(0, 50)}...`,
      );
      return await this.aiChatbotService.generateResponse(chatRequest);
    } catch (error) {
      this.logger.error('Error in chat endpoint:', error);
      throw error;
    }
  }

  @Get('health-tips')
  @HttpCode(HttpStatus.OK)
  async getHealthTips(
    @Query('category') category?: string,
  ): Promise<ChatResponseDto> {
    try {
      this.logger.log(
        `Getting health tips for category: ${category || 'general'}`,
      );
      return await this.aiChatbotService.getHealthTips(category);
    } catch (error) {
      this.logger.error('Error getting health tips:', error);
      throw error;
    }
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  getStatus(): { status: string; timestamp: Date } {
    return {
      status: 'AI Chatbot service is running',
      timestamp: new Date(),
    };
  }
}
