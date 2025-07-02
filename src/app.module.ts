import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoginModule } from './login/login.module';
import { RegisterModule } from './register/register.module';

@Module({
  imports: [LoginModule, RegisterModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
