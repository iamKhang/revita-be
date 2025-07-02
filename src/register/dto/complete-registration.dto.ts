import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteRegistrationDto {
  @ApiProperty({
    description: 'Tên đầy đủ của người dùng',
    example: 'Nguyễn Văn A',
  })
  @IsString({ message: 'Tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name: string;

  @ApiProperty({
    description: 'Ngày sinh',
    example: '1990-01-01',
  })
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  @IsNotEmpty({ message: 'Ngày sinh không được để trống' })
  dateOfBirth: string;

  @ApiProperty({
    description: 'Giới tính',
    example: 'Nam',
    enum: ['male', 'female', 'other'],
  })
  @IsString({ message: 'Giới tính phải là chuỗi' })
  @IsIn(['male', 'female', 'other'], {
    message: 'Giới tính phải là male, female hoặc other',
  })
  @IsNotEmpty({ message: 'Giới tính không được để trống' })
  gender: string;

  @ApiProperty({
    description: 'Địa chỉ',
    example: '123 Đường ABC, Quận 1, TP.HCM',
  })
  @IsString({ message: 'Địa chỉ phải là chuỗi' })
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  address: string;

  @ApiProperty({
    description: 'Số chứng minh nhân dân/căn cước công dân',
    example: '123456789012',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Số CMND/CCCD phải là chuỗi' })
  citizenId?: string;

  @ApiProperty({
    description: 'URL avatar',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Avatar phải là chuỗi' })
  avatar?: string;

  @ApiProperty({
    description: 'Mật khẩu',
    example: 'password123',
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;

  @ApiProperty({
    description: 'Session ID từ bước xác thực OTP',
    example: 'session_123456789',
  })
  @IsString({ message: 'Session ID phải là chuỗi' })
  @IsNotEmpty({ message: 'Session ID không được để trống' })
  sessionId: string;
}
