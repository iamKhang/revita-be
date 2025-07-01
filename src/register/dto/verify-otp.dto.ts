import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Mã OTP 6 chữ số',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString({ message: 'OTP phải là chuỗi' })
  @IsNotEmpty({ message: 'OTP không được để trống' })
  @Length(6, 6, { message: 'OTP phải có đúng 6 chữ số' })
  otp: string;

  @ApiProperty({
    description: 'Session ID từ bước đăng ký đầu tiên',
    example: 'session_123456789',
  })
  @IsString({ message: 'Session ID phải là chuỗi' })
  @IsNotEmpty({ message: 'Session ID không được để trống' })
  sessionId: string;
}
