import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
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
import { FileStorageModule } from './file-storage/file-storage.module';
import { WorkSessionModule } from './work-session/work-session.module';
import { AppointmentBookingModule } from './appointment-booking/appointment-booking.module';
import { AiChatbotModule } from './ai-chatbot/ai-chatbot.module';
import { WebSocketModule } from './websocket/websocket.module';
import { MedicationPrescriptionModule } from './medication-prescription/medication-prescription.module';
import { DrugCatalogModule } from './drug-catalog/drug-catalog.module';
import { ClinicModule } from './clinic/clinic.module';
import { StatisticsModule } from './statistics/statistics.module';
import { DoctorRatingModule } from './doctor-rating/doctor-rating.module';
import { PostsModule } from './posts/posts.module';
import { PublicModule } from './public/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        // Default to Docker service name when env var is not provided
        uri: process.env.MONGODB_URI || 'mongodb://mongo:27017/revita-drug',
      }),
    }),
    LoginModule,
    RegisterModule,
    UserManagementModule,
    MedicalRecordModule,
    RoutingModule,
    PrescriptionModule,
    InvoiceModule,
    ServiceModule,
    FileStorageModule,
    WorkSessionModule,
    AppointmentBookingModule,
    AiChatbotModule,
    WebSocketModule,
    MedicationPrescriptionModule,
    DrugCatalogModule,
    ClinicModule,
    StatisticsModule,
    DoctorRatingModule,
    PostsModule,
    PublicModule,
  ],
  controllers: [AppController],
  providers: [AppService, RolesGuard, JwtStrategy],
})
export class AppModule {}
