import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Returns a basic hello message' })
  @ApiOkResponse({ schema: { example: 'Hello World!' } })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiOperation({ summary: 'Checks application and database availability' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        database: 'up',
      },
    },
  })
  @Get('health')
  getHealthStatus(): Promise<{ status: string; database: string }> {
    return this.appService.getHealthStatus();
  }
}
