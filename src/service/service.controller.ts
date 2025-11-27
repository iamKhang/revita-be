/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
  ApiParam,
} from '@nestjs/swagger';
import { ServiceService } from './service.service';
import { PrescriptionServiceManagementService } from './prescription-service-management.service';
import {
  SearchServiceDto,
  AdvancedSearchDto,
  GetAllServicesDto,
  GetServicesDto,
  GetRoomWaitingListDto,
  GetRoomWaitingListResponseDto,
  ServiceManagementQueryDto,
  CreateServiceDto,
  UpdateServiceDto,
  CreatePackageDto,
  UpdatePackageDto,
  DoctorServiceQueryDto,
  ServiceLocationQueryDto,
  UpsertServicePromotionDto,
  ServicePromotionQueryDto,
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

  @Get('advanced-search')
  @ApiOperation({
    summary: 'Tìm kiếm nâng cao dịch vụ và gói dịch vụ',
    description: `
Tìm kiếm với thứ tự ưu tiên:
1. Dịch vụ có tên chứa từ khóa
2. Gói dịch vụ có tên chứa từ khóa
3. Gói dịch vụ có dịch vụ chứa từ khóa
4. Dịch vụ/Gói có mô tả chứa từ khóa

Hỗ trợ filter:
- requiresDoctor: Lọc dịch vụ/gói có yêu cầu bác sĩ
- isActive: Lọc dịch vụ/gói đang hoạt động (mặc định: true)
    `,
  })
  @ApiQuery({
    name: 'keyword',
    description: 'Từ khóa tìm kiếm',
    required: true,
    example: 'xét nghiệm',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Số lượng kết quả trả về',
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Vị trí bắt đầu',
    required: false,
    example: 0,
  })
  @ApiQuery({
    name: 'requiresDoctor',
    description: 'Lọc theo yêu cầu bác sĩ (true/false)',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'isActive',
    description: 'Lọc theo trạng thái hoạt động (true/false, mặc định: true)',
    required: false,
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'Tìm kiếm thành công',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['service', 'package'] },
                  priority: { type: 'number' },
                  id: { type: 'string' },
                  name: { type: 'string' },
                  price: { type: 'number' },
                  description: { type: 'string' },
                  requiresDoctor: { type: 'boolean' },
                  isActive: { type: 'boolean' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                limit: { type: 'number' },
                offset: { type: 'number' },
                hasMore: { type: 'boolean' },
              },
            },
            keyword: { type: 'string' },
          },
        },
      },
    },
  })
  async advancedSearch(@Query() searchDto: AdvancedSearchDto) {
    try {
      const result = await this.serviceService.advancedSearch(
        searchDto.keyword,
        searchDto.limit,
        searchDto.offset,
        searchDto.requiresDoctor,
        searchDto.isActive,
      );
      return {
        success: true,
        message: 'Tìm kiếm nâng cao thành công',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Advanced search error: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi tìm kiếm',
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
  async getManagementServices(@Query() query: ServiceManagementQueryDto) {
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
      this.logger.error(`Create service error: ${error.message}`, error.stack);
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
      this.logger.error(`Update service error: ${error.message}`, error.stack);
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

  @Post('management/services/:id/promotion')
  async upsertServicePromotion(
    @Param('id') id: string,
    @Body() dto: UpsertServicePromotionDto,
  ) {
    try {
      const service = await this.serviceService.upsertServicePromotion(id, dto);
      return {
        success: true,
        message: 'Thiết lập khuyến mãi thành công',
        data: service,
      };
    } catch (error) {
      this.logger.error(
        `Upsert service promotion error: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi thiết lập khuyến mãi',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('management/services/:id/promotion')
  async deleteServicePromotion(@Param('id') id: string) {
    try {
      await this.serviceService.deleteServicePromotion(id);
      return {
        success: true,
        message: 'Xoá khuyến mãi dịch vụ thành công',
      };
    } catch (error) {
      this.logger.error(
        `Delete service promotion error: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi xoá khuyến mãi dịch vụ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('management/services/:id/promotion')
  async getServicePromotion(@Param('id') id: string) {
    try {
      const service = await this.serviceService.getServicePromotionDetail(id);
      return {
        success: true,
        message: 'Lấy thông tin khuyến mãi dịch vụ thành công',
        data: service,
      };
    } catch (error) {
      const isError = error instanceof Error;
      const message = isError ? error.message : String(error);
      const stack = isError ? error.stack : undefined;
      this.logger.error(
        `Get service promotion detail error: ${message}`,
        stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi lấy thông tin khuyến mãi dịch vụ',
          error: message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('management/promotions')
  async listServicePromotions(@Query() query: ServicePromotionQueryDto) {
    try {
      const data = await this.serviceService.listServicePromotions(query);
      return {
        success: true,
        message: 'Lấy danh sách khuyến mãi dịch vụ thành công',
        data,
      };
    } catch (error) {
      const isError = error instanceof Error;
      const message = isError ? error.message : String(error);
      const stack = isError ? error.stack : undefined;
      this.logger.error(`List service promotions error: ${message}`, stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi lấy danh sách khuyến mãi dịch vụ',
          error: message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('management/packages')
  async getManagementPackages(@Query() query: ServiceManagementQueryDto) {
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
      this.logger.error(`Create package error: ${error.message}`, error.stack);
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
      this.logger.error(`Update package error: ${error.message}`, error.stack);
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

  @Get('doctors/:doctorCode/services')
  @ApiOperation({
    summary: 'Lấy danh sách dịch vụ theo chuyên khoa của bác sĩ',
  })
  @ApiParam({
    name: 'doctorCode',
    description: 'Mã bác sĩ',
    example: 'DOC001',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    description: 'Từ khóa tìm kiếm theo tên, code hoặc mô tả dịch vụ',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số lượng dịch vụ',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Vị trí bắt đầu',
    example: 0,
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Bao gồm dịch vụ không hoạt động',
    type: Boolean,
  })
  @ApiQuery({
    name: 'requiresDoctor',
    required: false,
    description: 'Lọc theo dịch vụ cần bác sĩ',
    type: Boolean,
  })
  async getServicesByDoctorCode(
    @Param('doctorCode') doctorCode: string,
    @Query() query: DoctorServiceQueryDto,
  ) {
    try {
      const startedAt = Date.now();
      this.logger.debug(
        `[getServicesByDoctorCode] doctorCode=${doctorCode} query=${JSON.stringify(
          query,
        )}`,
      );
      const result = await this.serviceService.getServicesByDoctorCode(
        doctorCode,
        query,
      );
      const durationMs = Date.now() - startedAt;
      this.logger.debug(
        `[getServicesByDoctorCode] doctorCode=${doctorCode} services=${
          Array.isArray((result as any)?.services)
            ? (result as any).services.length
            : 0
        } total=${(result as any)?.pagination?.total ?? 'n/a'} durationMs=${durationMs}`,
      );
      return {
        success: true,
        message: 'Lấy danh sách dịch vụ theo bác sĩ thành công',
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error instanceof Error) {
        this.logger.error(
          `Get services by doctor error: ${error.message}`,
          error.stack,
        );
        throw new HttpException(
          {
            success: false,
            message: 'Có lỗi xảy ra khi lấy dịch vụ theo bác sĩ',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      this.logger.error('Get services by doctor error: Unknown error');
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi lấy dịch vụ theo bác sĩ',
          error: 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('by-location')
  @ApiOperation({
    summary:
      'Lấy danh sách dịch vụ cùng booth hoặc phòng khám với các dịch vụ đã chọn',
    description: `
Tìm các dịch vụ có cùng booth/phòng với các dịch vụ tham chiếu.
- serviceIds: Mảng các ID dịch vụ đã chọn (có thể truyền nhiều serviceId)
- API sẽ tìm giao (intersection) của các booth/phòng từ tất cả các service đã chọn
- Nếu không có booth/phòng chung, sẽ dùng hợp (union) để tìm các service có ít nhất một booth/phòng chung
- excludeServiceIds: Loại trừ các service đã chọn khỏi kết quả
    `,
  })
  @ApiQuery({
    name: 'serviceIds',
    required: false,
    description:
      'Mảng các ID dịch vụ tham chiếu (có thể truyền nhiều, cách nhau bởi dấu phẩy hoặc array)',
    type: [String],
    example: 'service-id-1,service-id-2',
  })
  @ApiQuery({
    name: 'serviceId',
    required: false,
    description: 'ID dịch vụ tham chiếu (deprecated: dùng serviceIds thay thế)',
  })
  @ApiQuery({
    name: 'boothId',
    required: false,
    description: 'Lọc dịch vụ theo booth cụ thể',
  })
  @ApiQuery({
    name: 'clinicRoomId',
    required: false,
    description: 'Lọc dịch vụ theo phòng khám cụ thể',
  })
  @ApiQuery({
    name: 'excludeServiceIds',
    required: false,
    description:
      'Mảng các ID dịch vụ cần loại trừ (có thể truyền nhiều, cách nhau bởi dấu phẩy)',
    type: [String],
  })
  @ApiQuery({
    name: 'excludeServiceId',
    required: false,
    description: 'Loại trừ một ID dịch vụ (deprecated: dùng excludeServiceIds)',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    description: 'Từ khóa tìm kiếm theo tên, code hoặc mô tả dịch vụ',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số lượng dịch vụ',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Vị trí bắt đầu',
    example: 0,
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Bao gồm dịch vụ không hoạt động',
    type: Boolean,
  })
  @ApiQuery({
    name: 'requiresDoctor',
    required: false,
    description: 'Lọc theo dịch vụ cần bác sĩ',
    type: Boolean,
  })
  async getServicesByLocation(@Query() query: ServiceLocationQueryDto) {
    try {
      const startedAt = Date.now();
      this.logger.debug(
        `[getServicesByLocation] query=${JSON.stringify(query)}`,
      );
      const result = await this.serviceService.getServicesByLocation(query);
      const durationMs = Date.now() - startedAt;
      this.logger.debug(
        `[getServicesByLocation] referenceServiceIds=${JSON.stringify(
          (result as any)?.referenceServiceIds ?? [],
        )} boothIds=${JSON.stringify(
          (result as any)?.boothIds ?? [],
        )} clinicRoomIds=${JSON.stringify(
          (result as any)?.clinicRoomIds ?? [],
        )} services=${
          Array.isArray((result as any)?.services)
            ? (result as any).services.length
            : 0
        } total=${(result as any)?.pagination?.total ?? 'n/a'} durationMs=${durationMs}`,
      );
      return {
        success: true,
        message: 'Lấy danh sách dịch vụ theo vị trí thành công',
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error instanceof Error) {
        this.logger.error(
          `Get services by location error: ${error.message}`,
          error.stack,
        );
        throw new HttpException(
          {
            success: false,
            message: 'Có lỗi xảy ra khi lấy dịch vụ theo vị trí',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      this.logger.error('Get services by location error: Unknown error');
      throw new HttpException(
        {
          success: false,
          message: 'Có lỗi xảy ra khi lấy dịch vụ theo vị trí',
          error: 'Unknown error',
        },
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
