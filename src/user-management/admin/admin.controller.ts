import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../rbac/roles.decorator';
import { Role } from '../../rbac/roles.enum';
import { RolesGuard } from '../../rbac/roles.guard';
import { UserService } from '../user.service';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { JwtAuthGuard } from '../../login/jwt-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly userService: UserService) {}

  @Get('users')
  @Roles(Role.SYSTEM_ADMIN)
  async findAllUsers(@Query('role') role?: string) {
    return this.userService.findAll(role);
  }

  @Get('users/:userId')
  @Roles(Role.SYSTEM_ADMIN)
  async findUserById(@Param('userId') userId: string) {
    return this.userService.findById(userId);
  }

  @Post('users')
  @Roles(Role.SYSTEM_ADMIN)
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Put('users/:userId')
  @Roles(Role.SYSTEM_ADMIN)
  async updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(userId, updateUserDto);
  }

  @Delete('users/:userId')
  @Roles(Role.SYSTEM_ADMIN)
  async deleteUser(@Param('userId') userId: string) {
    return this.userService.delete(userId);
  }
}
