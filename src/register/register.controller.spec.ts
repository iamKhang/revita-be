import { Test, TestingModule } from '@nestjs/testing';
import { RegisterController } from './register.controller';
import { RegisterService } from './register.service';
import { RedisService } from './redis.service';
import { PrismaClient } from '@prisma/client';

describe('RegisterController', () => {
  let controller: RegisterController;
  let service: RegisterService;

  const mockRegisterService = {
    registerStep1: jest.fn(),
    verifyOtp: jest.fn(),
    completeRegistration: jest.fn(),
    resendOtp: jest.fn(),
  };

  const mockRedisService = {
    setOtp: jest.fn(),
    getOtp: jest.fn(),
    deleteOtp: jest.fn(),
    setSession: jest.fn(),
    getSession: jest.fn(),
    deleteSession: jest.fn(),
  };

  const mockPrismaClient = {
    auth: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    patient: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegisterController],
      providers: [
        {
          provide: RegisterService,
          useValue: mockRegisterService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: PrismaClient,
          useValue: mockPrismaClient,
        },
      ],
    }).compile();

    controller = module.get<RegisterController>(RegisterController);
    service = module.get<RegisterService>(RegisterService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('registerStep1', () => {
    it('should call registerService.registerStep1', async () => {
      const dto = { phone: '0987654321' };
      const expectedResult = {
        sessionId: 'test-session-id',
        message: 'Mã OTP đã được gửi đến số điện thoại 0987654321',
      };

      mockRegisterService.registerStep1.mockResolvedValue(expectedResult);

      const result = await controller.registerStep1(dto);

      expect(service.registerStep1).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('verifyOtp', () => {
    it('should call registerService.verifyOtp', async () => {
      const dto = { otp: '123456', sessionId: 'test-session-id' };
      const expectedResult = {
        sessionId: 'test-session-id',
        message: 'Xác thực OTP thành công. Vui lòng hoàn tất thông tin đăng ký.',
      };

      mockRegisterService.verifyOtp.mockResolvedValue(expectedResult);

      const result = await controller.verifyOtp(dto);

      expect(service.verifyOtp).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('completeRegistration', () => {
    it('should call registerService.completeRegistration', async () => {
      const dto = {
        name: 'Test User',
        dateOfBirth: '1990-01-01',
        gender: 'Nam',
        address: 'Test Address',
        password: 'password123',
        sessionId: 'test-session-id',
      };
      const expectedResult = {
        message: 'Đăng ký thành công',
        userId: 'test-user-id',
      };

      mockRegisterService.completeRegistration.mockResolvedValue(expectedResult);

      const result = await controller.completeRegistration(dto);

      expect(service.completeRegistration).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('resendOtp', () => {
    it('should call registerService.resendOtp', async () => {
      const sessionId = 'test-session-id';
      const expectedResult = {
        message: 'Mã OTP mới đã được gửi đến số điện thoại 0987654321',
      };

      mockRegisterService.resendOtp.mockResolvedValue(expectedResult);

      const result = await controller.resendOtp(sessionId);

      expect(service.resendOtp).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual(expectedResult);
    });
  });
});
