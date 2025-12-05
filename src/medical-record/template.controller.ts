import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TemplateService } from './template.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { JwtUserPayload } from './dto/jwt-user-payload.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Tạo template mới (chỉ ADMIN)' })
  @ApiResponse({
    status: 201,
    description: 'Template đã được tạo thành công',
  })
  @ApiResponse({ status: 400, description: 'Template code đã tồn tại' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async create(
    @Body() createTemplateDto: CreateTemplateDto,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.templateService.create(createTemplateDto, req.user);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cập nhật template (chỉ ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Template đã được cập nhật thành công',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy template' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async update(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.templateService.update(id, updateTemplateDto, req.user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Xóa template (chỉ ADMIN)',
    description:
      'Chỉ xóa được template chưa được sử dụng trong bệnh án. Nếu template đang được sử dụng, vui lòng vô hiệu hóa (isActive = false) thay vì xóa.',
  })
  @ApiResponse({
    status: 200,
    description: 'Template đã được xóa thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Template đang được sử dụng, không thể xóa',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy template' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async remove(
    @Param('id') id: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.templateService.remove(id, req.user);
  }
}
