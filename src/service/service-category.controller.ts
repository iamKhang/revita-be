import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ServiceCategoryService } from './service-category.service';
import {
  ServiceCategoryListQueryDto,
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
} from './dto';

@ApiTags('Service Categories')
@Controller('service-categories')
export class ServiceCategoryController {
  constructor(private readonly categoryService: ServiceCategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nhóm dịch vụ' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Tìm kiếm theo tên hoặc code',
  })
  async getCategories(@Query() query: ServiceCategoryListQueryDto) {
    const result = await this.categoryService.listCategories(query);
    return {
      success: true,
      message: 'Lấy danh sách nhóm dịch vụ thành công',
      data: result,
    };
  }

  @Post()
  @ApiOperation({ 
    summary: 'Tạo nhóm dịch vụ mới',
    description: 'Tạo nhóm dịch vụ mới. Có thể truyền vào mã danh mục (code) hoặc để hệ thống tự động generate từ tên.'
  })
  async createCategory(@Body() dto: CreateServiceCategoryDto) {
    const category = await this.categoryService.createCategory(dto);
    return {
      success: true,
      message: 'Tạo nhóm dịch vụ thành công',
      data: category,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật nhóm dịch vụ' })
  @ApiParam({ name: 'id', description: 'Mã định danh nhóm dịch vụ' })
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateServiceCategoryDto,
  ) {
    const category = await this.categoryService.updateCategory(id, dto);
    return {
      success: true,
      message: 'Cập nhật nhóm dịch vụ thành công',
      data: category,
    };
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Chi tiết nhóm dịch vụ',
    description: 'Lấy thông tin chi tiết nhóm dịch vụ kèm theo danh sách đầy đủ các dịch vụ và gói dịch vụ thuộc nhóm này'
  })
  @ApiParam({ name: 'id', description: 'Mã định danh nhóm dịch vụ' })
  async getCategoryById(@Param('id') id: string) {
    const category = await this.categoryService.getCategoryDetail(id);
    return {
      success: true,
      message: 'Lấy chi tiết nhóm dịch vụ thành công',
      data: category,
    };
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Xóa nhóm dịch vụ',
    description: 'Xóa nhóm dịch vụ. Không thể xóa nếu nhóm dịch vụ đang được sử dụng bởi các dịch vụ hoặc gói dịch vụ.'
  })
  @ApiParam({ name: 'id', description: 'Mã định danh nhóm dịch vụ' })
  async deleteCategory(@Param('id') id: string) {
    await this.categoryService.deleteCategory(id);
    return {
      success: true,
      message: 'Xóa nhóm dịch vụ thành công',
    };
  }

  @Post(':categoryId/services/:serviceId')
  @ApiOperation({ 
    summary: 'Thêm dịch vụ vào nhóm dịch vụ',
    description: 'Thêm một dịch vụ vào nhóm dịch vụ. Nếu dịch vụ đã thuộc nhóm khác, sẽ được chuyển sang nhóm mới.'
  })
  @ApiParam({ name: 'categoryId', description: 'Mã định danh nhóm dịch vụ' })
  @ApiParam({ name: 'serviceId', description: 'Mã định danh dịch vụ' })
  async addServiceToCategory(
    @Param('categoryId') categoryId: string,
    @Param('serviceId') serviceId: string,
  ) {
    const service = await this.categoryService.addServiceToCategory(
      categoryId,
      serviceId,
    );
    return {
      success: true,
      message: 'Thêm dịch vụ vào nhóm dịch vụ thành công',
      data: service,
    };
  }

  @Delete(':categoryId/services/:serviceId')
  @ApiOperation({ 
    summary: 'Xóa dịch vụ khỏi nhóm dịch vụ',
    description: 'Xóa một dịch vụ khỏi nhóm dịch vụ. Dịch vụ sẽ không còn thuộc nhóm nào.'
  })
  @ApiParam({ name: 'categoryId', description: 'Mã định danh nhóm dịch vụ' })
  @ApiParam({ name: 'serviceId', description: 'Mã định danh dịch vụ' })
  async removeServiceFromCategory(
    @Param('categoryId') categoryId: string,
    @Param('serviceId') serviceId: string,
  ) {
    const service = await this.categoryService.removeServiceFromCategory(
      categoryId,
      serviceId,
    );
    return {
      success: true,
      message: 'Xóa dịch vụ khỏi nhóm dịch vụ thành công',
      data: service,
    };
  }
}
