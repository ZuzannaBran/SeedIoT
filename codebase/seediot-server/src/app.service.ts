import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Injectable()
export class AppService {
  constructor(private readonly databaseService: DatabaseService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealthStatus(): Promise<{ status: string; database: string }> {
    const databaseAvailable = await this.databaseService.checkHealth();

    return {
      status: 'ok',
      database: databaseAvailable ? 'up' : 'down',
    };
  }
}
