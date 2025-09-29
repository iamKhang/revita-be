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
import { Request } from 'express';
import { AiChatbotService } from './ai-chatbot.service';
import { DatabaseQueryService } from './database-query.service';
import { ChatRequestDto, ChatResponseDto } from './dto';
import { JwtAuthGuard } from '../login/jwt-auth.guard';

// JWT user is read in services via request-scoped providers

@Controller('ai-chatbot')
@UseGuards(JwtAuthGuard)
export class AiChatbotController {
  private readonly logger = new Logger(AiChatbotController.name);

  constructor(
    private readonly aiChatbotService: AiChatbotService,
    private readonly databaseQueryService: DatabaseQueryService,
  ) {}

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

  @Get('system-stats')
  @HttpCode(HttpStatus.OK)
  async getSystemStats(): Promise<any> {
    try {
      this.logger.log('Getting system statistics');
      return await this.databaseQueryService.getSystemStats();
    } catch (error) {
      this.logger.error('Error getting system stats:', error);
      throw error;
    }
  }

  @Get('search-doctors')
  @HttpCode(HttpStatus.OK)
  async searchDoctors(@Query('q') searchTerm: string): Promise<any[]> {
    try {
      this.logger.log(`Searching doctors with term: ${searchTerm}`);
      return await this.databaseQueryService.searchDoctors(searchTerm);
    } catch (error) {
      this.logger.error('Error searching doctors:', error);
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
