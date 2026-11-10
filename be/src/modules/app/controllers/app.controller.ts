import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../authorization/decorators/public.decorator';
import { AppService } from '../services/app.service';

@ApiTags('Application')
@Controller({ path: '', version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get application greeting' })
  @ApiOkResponse({ description: 'Application is responding.', type: String })
  getHello(): string {
    return this.appService.getHello();
  }
}
