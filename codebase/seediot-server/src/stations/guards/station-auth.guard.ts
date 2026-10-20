import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StationsService } from '../stations.service';

type RequestWithStation = Request & {
  station?: {
    id: string;
    name: string;
  };
};

@Injectable()
export class StationAuthGuard implements CanActivate {
  constructor(private readonly stationsService: StationsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithStation>();
    const stationId = request.headers['x-station-id'];
    const stationKey = request.headers['x-station-key'];

    if (typeof stationId !== 'string' || typeof stationKey !== 'string') {
      throw new UnauthorizedException('Missing station authentication headers');
    }

    const station = await this.stationsService.validateStationCredentials(
      stationId,
      stationKey,
    );

    if (!station) {
      throw new UnauthorizedException('Invalid station credentials');
    }

    request.station = station;
    return true;
  }
}
