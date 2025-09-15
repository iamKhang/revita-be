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
  UpdateServiceResultsDto,
  ScanPrescriptionResponseDto,
  UpdateServiceStatusResponseDto,
  UpdateResultsResponseDto,
  GetServicesDto,
  GetRoomWaitingListDto,
  GetRoomWaitingListResponseDto,
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

  // Prescription Service Management endpoints
  @Post('scan-prescription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Quét mã phiếu chỉ định để nhận thông tin dịch vụ' })
  @ApiResponse({
    status: 200,
    description: 'Quét thành công',
    type: ScanPrescriptionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy phiếu chỉ định',
  })
  async scanPrescription(
    @Body() scanDto: ScanPrescriptionDto,
    @Request() req: any,
  ): Promise<ScanPrescriptionResponseDto> {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      const result = await this.prescriptionServiceManagement.scanPrescription(
        scanDto.prescriptionCode,
        userId,
        userRole,
      );
      return result;
    } catch (error) {
      this.logger.error(`Scan prescription error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi quét phiếu chỉ định',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('prescription-service/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cập nhật trạng thái prescription service' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái thành công',
    type: UpdateServiceStatusResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy service',
  })
  async updateServiceStatus(
    @Body() updateDto: UpdateServiceStatusDto,
    @Request() req: any,
  ): Promise<UpdateServiceStatusResponseDto> {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      const result =
        await this.prescriptionServiceManagement.updateServiceStatus(
          updateDto.prescriptionId,
          updateDto.serviceId,
          updateDto.status,
          userId,
          userRole,
          updateDto.note,
        );
      return result;
    } catch (error) {
      this.logger.error(`Update service status error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi cập nhật trạng thái service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('prescription-service/results')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cập nhật kết quả prescription service' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật kết quả thành công',
    type: UpdateResultsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy service',
  })
  @ApiResponse({
    status: 400,
    description: 'Service không ở trạng thái WAITING_RESULT',
  })
  async updateServiceResults(
    @Body() updateDto: UpdateServiceResultsDto,
    @Request() req: any,
  ): Promise<UpdateResultsResponseDto> {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      const result =
        await this.prescriptionServiceManagement.updateServiceResults(
          updateDto.prescriptionId,
          updateDto.serviceId,
          updateDto.results,
          userId,
          userRole,
          updateDto.note,
        );
      return result;
    } catch (error) {
      this.logger.error(`Update service results error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi cập nhật kết quả service',
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

  @Post('prescription-service/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Bắt đầu thực hiện prescription service (SERVING)' })
  @ApiResponse({
    status: 200,
    description: 'Bắt đầu service thành công',
  })
  async startService(
    @Body() startDto: UpdateServiceStatusDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      const result =
        await this.prescriptionServiceManagement.updateServiceStatus(
          startDto.prescriptionId,
          startDto.serviceId,
          PrescriptionStatus.SERVING,
          userId,
          userRole,
          'Bắt đầu thực hiện dịch vụ',
        );
      return result;
    } catch (error) {
      this.logger.error(`Start service error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi bắt đầu service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('prescription-service/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Hoàn thành prescription service và chuyển sang waiting result',
  })
  @ApiResponse({
    status: 200,
    description: 'Hoàn thành service thành công',
  })
  async completeService(
    @Body() completeDto: UpdateServiceStatusDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      const result =
        await this.prescriptionServiceManagement.updateServiceStatus(
          completeDto.prescriptionId,
          completeDto.serviceId,
          PrescriptionStatus.WAITING_RESULT,
          userId,
          userRole,
          'Hoàn thành thực hiện dịch vụ, chờ kết quả',
        );
      return result;
    } catch (error) {
      this.logger.error(`Complete service error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi hoàn thành service',
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

  @Post('prescription-service/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Phân công prescription service cho staff' })
  @ApiResponse({
    status: 200,
    description: 'Phân công thành công',
  })
  async assignServiceToStaff(
    @Body()
    body: {
      prescriptionId: string;
      serviceId: string;
      staffId: string;
      staffRole: 'DOCTOR' | 'TECHNICIAN';
    },
  ) {
    try {
      const result =
        await this.prescriptionServiceManagement.assignServiceToStaff(
          body.prescriptionId,
          body.serviceId,
          body.staffId,
          body.staffRole,
        );
      return result;
    } catch (error) {
      this.logger.error(`Assign service error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi phân công dịch vụ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('prescription-service/assign-from-work-session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Phân công tất cả services từ work session' })
  @ApiResponse({
    status: 200,
    description: 'Phân công thành công',
  })
  async assignServicesFromWorkSession(
    @Body() body: { workSessionId: string },
  ) {
    try {
      const result =
        await this.prescriptionServiceManagement.assignServicesFromWorkSession(
          body.workSessionId,
        );
      return result;
    } catch (error) {
      this.logger.error(`Assign from work session error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi phân công từ work session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
