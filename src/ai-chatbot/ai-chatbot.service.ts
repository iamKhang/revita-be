import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import { ChatRequestDto, ChatResponseDto } from './dto';
import { DatabaseQueryService } from './database-query.service';

@Injectable()
export class AiChatbotService {
  private readonly logger = new Logger(AiChatbotService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(
    private configService: ConfigService,
    private databaseQueryService: DatabaseQueryService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
  }

  async generateResponse(
    chatRequest: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    try {
      // Kiểm tra xem câu hỏi có liên quan đến dữ liệu hệ thống không
      const databaseQuery =
        await this.databaseQueryService.processDatabaseQuery(
          chatRequest.message,
        );

      let text: string;
      let isMedicalAdvice = false;
      let systemData: any = null;

      if (databaseQuery.success) {
        // Trả lời dựa trên dữ liệu hệ thống
        text = databaseQuery.explanation || 'Đây là thông tin từ hệ thống.';
        systemData = {
          query: databaseQuery.query,
          data: databaseQuery.data,
        };
      } else {
        // Trả lời y tế thông thường
        const prompt = this.buildMedicalAssistantPrompt(chatRequest.message);
        const result = await this.model.generateContent(prompt);
        const response = result.response;
        text = response.text();
        isMedicalAdvice = this.containsMedicalAdvice(text);
      }

      // Generate conversation ID if not provided
      const conversationId =
        chatRequest.conversationId || this.generateConversationId();

      return {
        response: text,
        conversationId,
        timestamp: new Date(),
        isMedicalAdvice,
        disclaimer: isMedicalAdvice ? this.getMedicalDisclaimer() : undefined,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        systemData: systemData || undefined,
      };
    } catch (error) {
      this.logger.error('Error generating AI response:', error);
      throw new BadRequestException('Failed to generate AI response');
    }
  }

  // JWT is handled in DatabaseQueryService (request-scoped)

  private buildMedicalAssistantPrompt(userMessage: string): string {
    return `Bạn là một trợ lý y tế AI thông minh và có kinh nghiệm. Nhiệm vụ của bạn là:

1. Trả lời các câu hỏi liên quan đến sức khỏe và y tế một cách chính xác và hữu ích
2. Cung cấp thông tin giáo dục về sức khỏe, triệu chứng, và các vấn đề y tế phổ biến
3. Đưa ra lời khuyên chung về lối sống lành mạnh và phòng ngừa bệnh tật
4. Hướng dẫn người dùng khi nào cần tìm kiếm sự chăm sóc y tế chuyên nghiệp
5. Trà lời ngắn gọn khoảng một đoạn ngắn, nhưng vẫn đủ ý nghĩa
QUAN TRỌNG:
- Bạn KHÔNG được chẩn đoán bệnh cụ thể
- Bạn KHÔNG được thay thế cho bác sĩ hoặc chuyên gia y tế
- Luôn khuyến khích người dùng tham khảo ý kiến bác sĩ cho các vấn đề sức khỏe nghiêm trọng
- Sử dụng ngôn ngữ dễ hiểu và thân thiện
- Trả lời bằng tiếng Việt

Câu hỏi của người dùng: ${userMessage}

Hãy trả lời một cách hữu ích và an toàn:`;
  }

  private containsMedicalAdvice(text: string): boolean {
    const medicalKeywords = [
      'bệnh',
      'triệu chứng',
      'điều trị',
      'thuốc',
      'bác sĩ',
      'khám',
      'chẩn đoán',
      'sức khỏe',
      'y tế',
      'phòng ngừa',
      'cách chữa',
      'dấu hiệu',
      'nguyên nhân',
    ];

    return medicalKeywords.some((keyword) =>
      text.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  private getMedicalDisclaimer(): string {
    return '⚠️ Lưu ý: Thông tin này chỉ mang tính chất tham khảo và không thay thế cho việc tư vấn y tế chuyên nghiệp. Vui lòng tham khảo ý kiến bác sĩ cho các vấn đề sức khỏe cụ thể.';
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getHealthTips(category?: string): Promise<ChatResponseDto> {
    const categoryPrompts: Record<string, string> = {
      general: 'Cung cấp 5 lời khuyên sức khỏe tổng quát',
      nutrition: 'Cung cấp 5 lời khuyên về dinh dưỡng và ăn uống lành mạnh',
      exercise: 'Cung cấp 5 lời khuyên về tập thể dục và vận động',
      mental: 'Cung cấp 5 lời khuyên về sức khỏe tinh thần',
      prevention: 'Cung cấp 5 lời khuyên về phòng ngừa bệnh tật',
    };

    const prompt = category
      ? categoryPrompts[category] || categoryPrompts.general
      : categoryPrompts.general;

    return this.generateResponse({
      message: prompt,
      conversationId: `tips_${category || 'general'}_${Date.now()}`,
    });
  }
}
