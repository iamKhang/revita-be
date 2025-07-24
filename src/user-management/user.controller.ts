import {
  Controller,
  Put,
  Body,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { PrismaClient } from '@prisma/client';
import { UpdateUserDto } from './dto/user.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  private prisma = new PrismaClient();

  @Put('me')
  async updateMe(@Req() req: any, @Body() body: UpdateUserDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { role, ...basicInfo } = body;
    return this.prisma.user.update({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: { id: userId },
      data: basicInfo,
    });
  }
}
