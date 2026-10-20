import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StationReportController } from './station-report.controller';
import { StationAuthGuard } from './guards/station-auth.guard';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  imports: [AuthModule],
  controllers: [StationsController, StationReportController],
  providers: [StationsService, StationAuthGuard],
  exports: [StationsService, StationAuthGuard],
})
export class StationsModule {}
