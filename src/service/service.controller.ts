import { Controller, Get, Query, Param, ParseUUIDPipe, HttpStatus, HttpException } from '@nestjs/common';
import { ServiceService } from './service.service';
import { SearchServiceDto, GetAllServicesDto } from './dto/search-service.dto';

@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get('search')
  async searchServices(@Query() searchDto: SearchServiceDto) {
    try {
      const result = await this.serviceService.searchServices(searchDto.query, searchDto.limit, searchDto.offset);
      return { success: true, message: 'Tìm kiếm dịch vụ thành công', data: result };
    } catch (error) {
      throw new HttpException({ success: false, message: 'Có lỗi xảy ra khi tìm kiếm dịch vụ', error: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async getAllServices(@Query() getAllDto: GetAllServicesDto) {
    try {
      const result = await this.serviceService.getAllServices(getAllDto.limit, getAllDto.offset);
      return { success: true, message: 'Lấy danh sách dịch vụ thành công', data: result };
    } catch (error) {
      throw new HttpException({ success: false, message: 'Có lỗi xảy ra khi lấy danh sách dịch vụ', error: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async getServiceById(@Param('id', ParseUUIDPipe) id: string) {
    try {
      const service = await this.serviceService.getServiceById(id);
      if (!service) {
        throw new HttpException({ success: false, message: 'Không tìm thấy dịch vụ' }, HttpStatus.NOT_FOUND);
      }
      return { success: true, message: 'Lấy thông tin dịch vụ thành công', data: service };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException({ success: false, message: 'Có lỗi xảy ra khi lấy thông tin dịch vụ', error: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
