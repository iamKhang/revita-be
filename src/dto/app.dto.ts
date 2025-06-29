import { ApiProperty } from '@nestjs/swagger';

// Response DTO cho endpoint GET /
export class HelloResponseDto {
  @ApiProperty({
    description: 'Lời chào từ server',
    example: 'Hello World!',
  })
  message: string;
}
