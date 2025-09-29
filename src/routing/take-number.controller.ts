import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Public } from '../rbac/public.decorator';
import { TakeNumberService, TakeNumberResult } from './take-number.service';
import { TakeNumberDto } from './dto/take-number.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('take-number')
export class TakeNumberController {
  constructor(
    private readonly takeNumberService: TakeNumberService,
  ) {}

  @Public()
  @Post('take')
  async takeNumber(@Body() body: TakeNumberDto): Promise<TakeNumberResult> {
    return this.takeNumberService.takeNumber(body);
  }
}

