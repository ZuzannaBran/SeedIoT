import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { StationReportDto } from './dto/station-report.dto';
import { StationAuthGuard } from './guards/station-auth.guard';
import { StationsService } from './stations.service';

type RequestWithStation = Request & {
  station: {
    id: string;
    name: string;
  };
};

@ApiTags('station-report')
@Controller('station-report')
export class StationReportController {
  constructor(private readonly stationsService: StationsService) {}

  @ApiHeader({ name: 'x-station-id', required: true })
  @ApiHeader({ name: 'x-station-key', required: true })
  @ApiOperation({
    summary: 'Accept a device report authenticated by station credentials',
  })
  @ApiOkResponse({
    schema: {
      example: {
        accepted: true,
        stationId: 'ed125237-b212-4834-a078-86cf97ffcbe6',
        reportId: '06b01782-7bf4-4614-b7d7-0d324b8a8437',
      },
    },
  })
  @UseGuards(StationAuthGuard)
  @Post()
  createReport(
    @Req() request: RequestWithStation,
    @Body() stationReportDto: StationReportDto,
  ) {
    return this.stationsService.saveStationReport(
      request.station.id,
      stationReportDto,
    );
  }
}
