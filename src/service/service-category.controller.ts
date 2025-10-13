import {
  Body,
  Controller,
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
  @ApiOperation({ summary: 'Tạo nhóm dịch vụ mới' })
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
  @ApiOperation({ summary: 'Chi tiết nhóm dịch vụ' })
  @ApiParam({ name: 'id', description: 'Mã định danh nhóm dịch vụ' })
  async getCategoryById(@Param('id') id: string) {
    const category = await this.categoryService.getCategoryDetail(id);
    return {
      success: true,
      message: 'Lấy chi tiết nhóm dịch vụ thành công',
      data: category,
    };
  }
}
