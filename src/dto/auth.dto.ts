import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// DTO cho endpoint POST /auth/login
export class LoginDto {
  @ApiProperty({
    description: 'Email hoặc số điện thoại',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    description: 'Mật khẩu',
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

// DTO cho endpoint POST /auth/refresh
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

// DTO cho endpoint POST /auth/google/token
export class GoogleTokenDto {
  @ApiProperty({
    description: 'Authorization code từ Google OAuth2',
    example: '4/0AfJohXn...',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}

// Response DTO cho các endpoint authentication
export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Thông tin người dùng' })
  user: UserDto | null;
}

export class UserDto {
  @ApiProperty({ description: 'ID người dùng' })
  id: string;

  @ApiProperty({ description: 'Tên người dùng' })
  name: string;

  @ApiProperty({ description: 'Ngày sinh' })
  dateOfBirth: Date;

  @ApiProperty({ description: 'Giới tính' })
  gender: string;

  @ApiProperty({ description: 'Avatar URL', required: false })
  avatar?: string | null;

  @ApiProperty({ description: 'Địa chỉ' })
  address: string;

  @ApiProperty({ description: 'Số CMND/CCCD', required: false })
  citizenId?: string | null;

  @ApiProperty({ description: 'Vai trò người dùng' })
  role: string;
}

export class TokenResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;
}

export class AuthCallbackDto {
  @ApiProperty({ description: 'Trạng thái thành công' })
  success: boolean;

  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Thông tin người dùng' })
  user: UserDto;

  @ApiProperty({ description: 'Thông báo thành công' })
  message: string;
}

export class ErrorResponseDto {
  @ApiProperty({ description: 'Thông báo lỗi' })
  error: string;
}
