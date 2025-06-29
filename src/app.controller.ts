import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { HelloResponseDto } from './dto/app.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy lời chào từ server' })
  @ApiResponse({
    status: 200,
    description: 'Lời chào thành công',
    type: HelloResponseDto,
  })
  getHello(): HelloResponseDto {
    return { message: this.appService.getHello() };
  }
}
