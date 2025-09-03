import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoginModule } from './login/login.module';
import { RegisterModule } from './register/register.module';
import { RolesGuard } from './rbac/roles.guard';
import { UserManagementModule } from './user-management/user-management.module';
import { JwtStrategy } from './login/jwt.strategy';
import { MedicalRecordModule } from './medical-record/medical-record.module';
import { RoutingModule } from './routing/routing.module';
import { PrescriptionModule } from './prescription/prescription.module';
import { InvoiceModule } from './invoice/invoice.module';
import { ServiceModule } from './service/service.module';

@Module({
  imports: [
    LoginModule,
    RegisterModule,
    UserManagementModule,
    MedicalRecordModule,
    RoutingModule,
    PrescriptionModule,
    InvoiceModule,
    ServiceModule,
  ],
  controllers: [AppController],
  providers: [AppService, RolesGuard, JwtStrategy],
})
export class AppModule {}
