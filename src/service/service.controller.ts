import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  HttpStatus,
  HttpException,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ServiceService } from './service.service';
import { PrescriptionServiceManagementService } from './prescription-service-management.service';
import {
  SearchServiceDto,
  GetAllServicesDto,
  ScanPrescriptionDto,
  UpdateServiceStatusDto,
  ScanPrescriptionResponseDto,
  GetServicesDto,
  GetRoomWaitingListDto,
  GetRoomWaitingListResponseDto,
  ServiceManagementQueryDto,
  CreateServiceDto,
  UpdateServiceDto,
  CreatePackageDto,
  UpdatePackageDto,
} from './dto';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { PrescriptionStatus } from '@prisma/client';

@ApiTags('Services', 'Prescription Service Management')
@Controller('services')
export class ServiceController {
  private readonly logger = new Logger(ServiceController.name);

  constructor(
    private readonly serviceService: ServiceService,
    private readonly prescriptionServiceManagement: PrescriptionServiceManagementService,
  ) {}

  @Get('search')
  async searchServices(@Query() searchDto: SearchServiceDto) {
    try {
      const result = await this.serviceService.searchServices(
        searchDto.query,
        searchDto.limit,
        searchDto.offset,
      );
      return {
        success: true,
        message: 'Tìm kiếm dịch vụ thành công',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi tìm kiếm dịch vụ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async getAllServices(@Query() getAllDto: GetAllServicesDto) {
    try {
      const result = await this.serviceService.getAllServices(
        getAllDto.limit,
        getAllDto.offset,
      );
      return {
        success: true,
        message: 'Lấy danh sách dịch vụ thành công',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi lấy danh sách dịch vụ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('management/services')
  async getManagementServices(
    @Query() query: ServiceManagementQueryDto,
  ) {
    try {
      const result = await this.serviceService.getServiceManagementList(query);
      return {
        success: true,
        message: 'Lấy danh sách dịch vụ (quản lý) thành công',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Get management services error: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi lấy danh sách dịch vụ (quản lý)',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('management/services/:id')
  async getManagementServiceById(@Param('id') id: string) {
    try {
      const service = await this.serviceService.getServiceManagementById(id);
      return {
        success: true,
        message: 'Lấy thông tin dịch vụ (quản lý) thành công',
        data: service,
      };
    } catch (error) {
      this.logger.error(
        `Get management service detail error: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi lấy thông tin dịch vụ (quản lý)',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('management/services')
  async createServiceForManagement(@Body() dto: CreateServiceDto) {
    try {
      const service = await this.serviceService.createService(dto);
      return {
        success: true,
        message: 'Tạo dịch vụ thành công',
        data: service,
      };
    } catch (error) {
      this.logger.error(
        `Create service error: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi tạo dịch vụ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('management/services/:id')
  async updateServiceForManagement(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    try {
      const service = await this.serviceService.updateService(id, dto);
      return {
        success: true,
        message: 'Cập nhật dịch vụ thành công',
        data: service,
      };
    } catch (error) {
      this.logger.error(
        `Update service error: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi cập nhật dịch vụ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('management/packages')
  async getManagementPackages(
    @Query() query: ServiceManagementQueryDto,
  ) {
    try {
      const result = await this.serviceService.getPackageManagementList(query);
      return {
        success: true,
        message: 'Lấy danh sách gói dịch vụ thành công',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Get management packages error: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi lấy danh sách gói dịch vụ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('management/packages/:id')
  async getManagementPackageById(@Param('id') id: string) {
    try {
      const pkg = await this.serviceService.getPackageManagementById(id);
      return {
        success: true,
        message: 'Lấy thông tin gói dịch vụ thành công',
        data: pkg,
      };
    } catch (error) {
      this.logger.error(
        `Get management package detail error: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi lấy thông tin gói dịch vụ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('management/packages')
  async createPackageForManagement(@Body() dto: CreatePackageDto) {
    try {
      const pkg = await this.serviceService.createPackage(dto);
      return {
        success: true,
        message: 'Tạo gói dịch vụ thành công',
        data: pkg,
      };
    } catch (error) {
      this.logger.error(
        `Create package error: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi tạo gói dịch vụ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('management/packages/:id')
  async updatePackageForManagement(
    @Param('id') id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    try {
      const pkg = await this.serviceService.updatePackage(id, dto);
      return {
        success: true,
        message: 'Cập nhật gói dịch vụ thành công',
        data: pkg,
      };
    } catch (error) {
      this.logger.error(
        `Update package error: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi cập nhật gói dịch vụ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('management/endpoints')
  getManagementEndpoints() {
    return {
      success: true,
      message: 'Danh sách endpoint quản lý dịch vụ',
      data: {
        servicesList: '/services/management/services',
        serviceDetail: '/services/management/services/:id',
        createService: '/services/management/services',
        updateService: '/services/management/services/:id',
        packagesList: '/services/management/packages',
        packageDetail: '/services/management/packages/:id',
        createPackage: '/services/management/packages',
        updatePackage: '/services/management/packages/:id',
      },
    };
  }

  @Get('my-services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Lấy danh sách prescription services của user hiện tại',
  })
  @ApiQuery({
    name: 'status',
    enum: PrescriptionStatus,
    description: 'Lọc theo trạng thái (tùy chọn)',
    required: false,
  })
  @ApiQuery({
    name: 'workSessionId',
    description: 'ID work session hiện tại (tùy chọn)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách services thành công',
    schema: {
      type: 'object',
      properties: {
        services: {
          type: 'array',
          items: { type: 'object' },
        },
        total: { type: 'number' },
      },
    },
  })
  async getMyServices(@Query() query: GetServicesDto, @Request() req: any) {
    console.log('=== getMyServices called ===');
    console.log('Request headers:', req.headers);
    console.log('Request query:', query);
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      console.log('userId:', userId);
      console.log('userRole:', userRole);

      const result = await this.prescriptionServiceManagement.getUserServices(
        userId,
        userRole,
        query,
      );
      return result;
    } catch (error) {
      console.log('=== getMyServices error ===');
      console.log('Error type:', typeof error);
      console.log('Error message:', error.message);
      console.log('Error stack:', error.stack);
      this.logger.error(`Get my services error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi lấy danh sách services',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getServiceById(@Param('id') id: string) {
    try {
      const service = await this.serviceService.getServiceById(id);
      if (!service) {
        throw new HttpException(
          {
            success: false,
            message: 'Không tìm thấy dịch vụ',
          },
          HttpStatus.NOT_FOUND,
        );
      }
      return {
        success: true,
        message: 'Lấy thông tin dịch vụ thành công',
        data: service,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi lấy thông tin dịch vụ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('work-session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy thông tin work session hiện tại của user' })
  @ApiResponse({
    status: 200,
    description: 'Lấy work session thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy work session',
  })
  async getCurrentWorkSession(@Request() req: any) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      const workSession =
        await this.prescriptionServiceManagement.getUserWorkSession(
          userId,
          userRole,
        );
      if (!workSession) {
        throw new HttpException(
          'Không tìm thấy work session hiện tại',
          HttpStatus.NOT_FOUND,
        );
      }

      // Get user information based on role
      let userInfo;
      if (userRole === 'DOCTOR') {
        userInfo = {
          id: workSession.doctor?.id,
          role: 'DOCTOR',
          doctorCode: workSession.doctor?.doctorCode,
          name: workSession.doctor?.auth?.name,
        };
      } else if (userRole === 'TECHNICIAN') {
        userInfo = {
          id: workSession.technician?.id,
          role: 'TECHNICIAN',
          technicianCode: workSession.technician?.technicianCode,
          name: workSession.technician?.auth?.name,
        };
      }

      return {
        success: true,
        message: 'Lấy work session thành công',
        data: {
          workSession: {
            id: workSession.id,
            booth: {
              id: workSession.booth?.id,
              boothCode: workSession.booth?.boothCode,
              name: workSession.booth?.name,
              room: {
                id: workSession.booth?.room?.id,
                roomCode: workSession.booth?.room?.roomCode,
                roomName: workSession.booth?.room?.roomName,
                specialty: {
                  id: workSession.booth?.room?.specialty?.id,
                  name: workSession.booth?.room?.specialty?.name,
                },
              },
            },
            startTime: workSession.startTime,
            endTime: workSession.endTime,
            nextAvailableAt: workSession.nextAvailableAt,
          },
          user: userInfo,
        },
      };
    } catch (error) {
      this.logger.error(`Get work session error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi lấy work session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('room-waiting-list')
  @ApiOperation({ summary: 'Lấy danh sách bệnh nhân đang chờ trong phòng' })
  @ApiQuery({
    name: 'roomId',
    description: 'ID của phòng khám',
    example: 'uuid-room-id',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách chờ thành công',
    type: GetRoomWaitingListResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy phòng',
  })
  async getRoomWaitingList(
    @Query() query: GetRoomWaitingListDto,
  ): Promise<GetRoomWaitingListResponseDto> {
    try {
      const result =
        await this.prescriptionServiceManagement.getRoomWaitingList(
          query.roomId,
        );
      return result;
    } catch (error) {
      this.logger.error(`Get room waiting list error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi lấy danh sách chờ của phòng',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
