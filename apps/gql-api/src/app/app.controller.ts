import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.ts';

@Controller('status')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }
}
