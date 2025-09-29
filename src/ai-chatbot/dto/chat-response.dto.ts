export class SystemDataDto {
  query?: string;
  data?: any;
}

export class ChatResponseDto {
  response: string;
  conversationId: string;
  timestamp: Date;
  isMedicalAdvice: boolean;
  disclaimer?: string;
  systemData?: SystemDataDto;
}

export class ChatErrorDto {
  error: string;
  message: string;
  timestamp: Date;
}
