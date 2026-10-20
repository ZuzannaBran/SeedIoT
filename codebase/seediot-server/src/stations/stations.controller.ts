import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserJwtPayload } from '../auth/auth.types';
import { UserAuthGuard } from '../auth/guards/user-auth.guard';
import { CreateStationDto } from './dto/create-station.dto';
import { ListStationReportsDto } from './dto/list-station-reports.dto';
import { StationsService } from './stations.service';

type RequestWithUser = Request & { user: UserJwtPayload };

@ApiTags('stations')
@ApiBearerAuth('user-bearer')
@UseGuards(UserAuthGuard)
@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @ApiOperation({
    summary:
      'Create a new station for the authenticated user and return its API key once',
  })
  @ApiCreatedResponse({
    schema: {
      example: {
        id: 'ed125237-b212-4834-a078-86cf97ffcbe6',
        name: 'Greenhouse Gateway 01',
        isActive: true,
        lastSeenAt: null,
        createdAt: '2026-04-06T10:20:00.000Z',
        apiKey: 'station-secret-returned-once',
      },
    },
  })
  @Post()
  create(
    @Req() request: RequestWithUser,
    @Body() createStationDto: CreateStationDto,
  ) {
    return this.stationsService.createStation(
      request.user.sub,
      createStationDto,
    );
  }

  @ApiOperation({
    summary: 'List stations belonging to the authenticated user',
  })
  @ApiOkResponse({
    schema: {
      example: [
        {
          id: 'ed125237-b212-4834-a078-86cf97ffcbe6',
          name: 'Greenhouse Gateway 01',
          isActive: true,
          lastSeenAt: '2026-04-06T10:30:00.000Z',
          createdAt: '2026-04-06T10:20:00.000Z',
        },
      ],
    },
  })
  @Get()
  list(@Req() request: RequestWithUser) {
    return this.stationsService.listStations(request.user.sub);
  }

  @ApiOperation({
    summary:
      'List payload reports for a station owned by the authenticated user',
  })
  @ApiOkResponse({
    schema: {
      example: {
        items: [
          {
            id: '06b01782-7bf4-4614-b7d7-0d324b8a8437',
            stationId: 'ed125237-b212-4834-a078-86cf97ffcbe6',
            payload: {
              temperature: 21.5,
              humidity: 48,
            },
            recordedAt: '2026-04-06T10:15:00.000Z',
            createdAt: '2026-04-06T10:15:01.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
        filters: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
      },
    },
  })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get(':id/reports')
  listReports(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Query() query: ListStationReportsDto,
  ) {
    return this.stationsService.listStationReports(id, request.user.sub, query);
  }

  @ApiOperation({ summary: 'Delete a station owned by the authenticated user' })
  @ApiOkResponse({
    schema: {
      example: {
        deleted: true,
        stationId: 'ed125237-b212-4834-a078-86cf97ffcbe6',
      },
    },
  })
  @Delete(':id')
  delete(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.stationsService.deleteStation(id, request.user.sub);
  }
}
