export class ChatResponseDto {
  response: string;
  conversationId: string;
  timestamp: Date;
  isMedicalAdvice: boolean;
  disclaimer?: string;
}

export class ChatErrorDto {
  error: string;
  message: string;
  timestamp: Date;
}
