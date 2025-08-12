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
import { UpdateUserDto } from './dto/admin.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  private prisma = new PrismaClient();

  @Put('me')
  async updateMe(@Req() req: any, @Body() body: UpdateUserDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found');
    return this.prisma.auth.update({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: { id: userId },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: body as any,
    });
  }
}
