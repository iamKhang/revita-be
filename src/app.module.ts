import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoginModule } from './login/login.module';
import { RegisterModule } from './register/register.module';
import { RolesGuard } from './rbac/roles.guard';
import { UserManagementModule } from './user-management/user-management.module';
import { JwtStrategy } from './login/jwt.strategy';

@Module({
  imports: [LoginModule, RegisterModule, UserManagementModule],
  controllers: [AppController],
  providers: [AppService, RolesGuard, JwtStrategy],
})
export class AppModule {}
