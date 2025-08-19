import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RegisterService } from './register.service';
import { RegisterStep1Dto } from './dto/register-step1.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';

@ApiTags('Register')
@Controller('register')
export class RegisterController {
  constructor(private readonly registerService: RegisterService) {}

  @Post('step1')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bước 1: Đăng ký với số điện thoại hoặc email',
    description:
      'Người dùng nhập số điện thoại hoặc email để bắt đầu quá trình đăng ký. Hệ thống sẽ gửi mã OTP.',
  })
  @ApiBody({ type: RegisterStep1Dto })
  @ApiResponse({
    status: 200,
    description: 'OTP đã được gửi thành công',
    schema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'ID session để sử dụng cho các bước tiếp theo',
          example: 'session_123456789',
        },
        message: {
          type: 'string',
          description: 'Thông báo kết quả',
          example: 'Mã OTP đã được gửi đến số điện thoại +84987654321',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Số điện thoại hoặc email đã được đăng ký',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Số điện thoại đã được đăng ký',
        },
      },
    },
  })
  async registerStep1(@Body() registerDto: RegisterStep1Dto) {
    return await this.registerService.registerStep1(registerDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bước 2: Xác thực mã OTP',
    description:
      'Người dùng nhập mã OTP nhận được để xác thực số điện thoại hoặc email.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'Xác thực OTP thành công',
    schema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'ID session để sử dụng cho bước tiếp theo',
          example: 'session_123456789',
        },
        message: {
          type: 'string',
          description: 'Thông báo kết quả',
          example:
            'Xác thực OTP thành công. Vui lòng hoàn tất thông tin đăng ký.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'OTP không chính xác hoặc đã hết hạn',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'OTP không chính xác',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Session không tồn tại hoặc đã hết hạn',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Session không tồn tại hoặc đã hết hạn',
        },
      },
    },
  })
  async verifyOtp(@Body() verifyDto: VerifyOtpDto) {
    return await this.registerService.verifyOtp(verifyDto);
  }

  @Post('complete')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bước 3: Hoàn tất đăng ký',
    description:
      'Người dùng nhập các thông tin cá nhân để hoàn tất quá trình đăng ký.',
  })
  @ApiBody({ type: CompleteRegistrationDto })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Thông báo kết quả',
          example: 'Đăng ký thành công',
        },
        userId: {
          type: 'string',
          description: 'ID của người dùng vừa được tạo',
          example: 'user_123456789',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Thông tin không hợp lệ hoặc chưa xác thực OTP',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Chưa xác thực OTP hoặc session không hợp lệ',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Số CMND/CCCD đã được đăng ký',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Số CMND/CCCD đã được đăng ký',
        },
      },
    },
  })
  async completeRegistration(@Body() completeDto: CompleteRegistrationDto) {
    return await this.registerService.completeRegistration(completeDto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi lại mã OTP',
    description: 'Gửi lại mã OTP cho session đang hoạt động.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'ID session cần gửi lại OTP',
          example: 'session_123456789',
        },
      },
      required: ['sessionId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'OTP mới đã được gửi thành công',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Thông báo kết quả',
          example: 'Mã OTP mới đã được gửi đến số điện thoại +84987654321',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'OTP đã được xác thực',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'OTP đã được xác thực',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Session không tồn tại hoặc đã hết hạn',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Session không tồn tại hoặc đã hết hạn',
        },
      },
    },
  })
  async resendOtp(@Body('sessionId') sessionId: string) {
    return await this.registerService.resendOtp(sessionId);
  }
}
