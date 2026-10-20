import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedStation } from '../auth/auth.types';
import { CreateStationDto } from './dto/create-station.dto';
import { ListStationReportsDto } from './dto/list-station-reports.dto';
import { StationReportDto } from './dto/station-report.dto';

interface StationRecord {
  id: string;
  name: string;
  owner_user_id: string | null;
  api_key_hash: string;
  is_active: boolean;
  last_seen_at: Date | null;
  created_at: Date;
}

export interface StationSummary {
  id: string;
  name: string;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
}

interface StationReportRecord {
  id: string;
  station_id: string;
  payload: Record<string, unknown>;
  recorded_at: Date;
  created_at: Date;
}

@Injectable()
export class StationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createStation(
    ownerUserId: string,
    createStationDto: CreateStationDto,
  ): Promise<StationSummary & { apiKey: string }> {
    const stationId = randomUUID();
    const apiKey = randomBytes(32).toString('hex');
    const apiKeyHash = await bcrypt.hash(apiKey, 10);

    await this.databaseService.query(
      `
        INSERT INTO stations (id, name, owner_user_id, api_key_hash)
        VALUES ($1, $2, $3, $4)
      `,
      [stationId, createStationDto.name, ownerUserId, apiKeyHash],
    );

    const station = await this.findStationById(stationId);

    if (!station) {
      throw new Error('Station was not created');
    }

    return {
      ...this.mapStationSummary(station),
      apiKey,
    };
  }

  async listStations(ownerUserId: string): Promise<StationSummary[]> {
    const result = await this.databaseService.query<StationRecord>(
      `
        SELECT id, name, owner_user_id, api_key_hash, is_active, last_seen_at, created_at
        FROM stations
        WHERE owner_user_id = $1
        ORDER BY created_at DESC
      `,
      [ownerUserId],
    );

    return result.rows.map((station) => this.mapStationSummary(station));
  }

  async validateStationCredentials(
    stationId: string,
    stationKey: string,
  ): Promise<AuthenticatedStation | null> {
    const station = await this.findStationById(stationId);

    if (!station || !station.is_active) {
      return null;
    }

    const keyMatches = await bcrypt.compare(stationKey, station.api_key_hash);

    if (!keyMatches) {
      return null;
    }

    await this.databaseService.query(
      `
        UPDATE stations
        SET last_seen_at = NOW()
        WHERE id = $1
      `,
      [stationId],
    );

    return {
      id: station.id,
      name: station.name,
    };
  }

  async saveStationReport(
    stationId: string,
    stationReportDto: StationReportDto,
  ): Promise<{ reportId: string; stationId: string; accepted: boolean }> {
    const reportId = randomUUID();
    const recordedAt = stationReportDto.recordedAt
      ? new Date(stationReportDto.recordedAt)
      : new Date();

    await this.databaseService.query(
      `
        INSERT INTO station_reports (id, station_id, payload, recorded_at)
        VALUES ($1, $2, $3::jsonb, $4)
      `,
      [
        reportId,
        stationId,
        JSON.stringify(stationReportDto.payload),
        recordedAt,
      ],
    );

    return {
      reportId,
      stationId,
      accepted: true,
    };
  }

  async listStationReports(
    stationId: string,
    ownerUserId: string,
    query: ListStationReportsDto,
  ): Promise<{
    items: Array<{
      id: string;
      stationId: string;
      payload: Record<string, unknown>;
      recordedAt: Date;
      createdAt: Date;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters: {
      from: string | null;
      to: string | null;
    };
  }> {
    await this.assertStationOwnership(stationId, ownerUserId);

    const conditions = ['station_id = $1'];
    const params: unknown[] = [stationId];

    if (query.from) {
      params.push(new Date(query.from));
      conditions.push(`recorded_at >= $${params.length}`);
    }

    if (query.to) {
      params.push(new Date(query.to));
      conditions.push(`recorded_at <= $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (query.page - 1) * query.limit;

    const totalResult = await this.databaseService.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM station_reports
        WHERE ${whereClause}
      `,
      params,
    );

    const total = Number(totalResult.rows[0]?.total ?? '0');
    const pagedParams = [...params, query.limit, offset];

    const reportsResult = await this.databaseService.query<StationReportRecord>(
      `
        SELECT id, station_id, payload, recorded_at, created_at
        FROM station_reports
        WHERE ${whereClause}
        ORDER BY recorded_at DESC, created_at DESC
        LIMIT $${pagedParams.length - 1}
        OFFSET $${pagedParams.length}
      `,
      pagedParams,
    );

    return {
      items: reportsResult.rows.map((report) => ({
        id: report.id,
        stationId: report.station_id,
        payload: report.payload,
        recordedAt: report.recorded_at,
        createdAt: report.created_at,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
      filters: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
    };
  }

  async deleteStation(
    stationId: string,
    ownerUserId: string,
  ): Promise<{ deleted: boolean; stationId: string }> {
    const station = await this.findStationById(stationId);

    if (!station) {
      throw new NotFoundException('Station not found');
    }

    if (station.owner_user_id !== ownerUserId) {
      throw new ForbiddenException('You do not have access to this station');
    }

    const result = await this.databaseService.query<{ id: string }>(
      `
        DELETE FROM stations
        WHERE id = $1 AND owner_user_id = $2
        RETURNING id
      `,
      [stationId, ownerUserId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Station not found');
    }

    return {
      deleted: true,
      stationId,
    };
  }

  private async findStationById(id: string): Promise<StationRecord | null> {
    const result = await this.databaseService.query<StationRecord>(
      `
        SELECT id, name, owner_user_id, api_key_hash, is_active, last_seen_at, created_at
        FROM stations
        WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] ?? null;
  }

  private async assertStationOwnership(
    stationId: string,
    ownerUserId: string,
  ): Promise<StationRecord> {
    const station = await this.findStationById(stationId);

    if (!station) {
      throw new NotFoundException('Station not found');
    }

    if (station.owner_user_id !== ownerUserId) {
      throw new ForbiddenException('You do not have access to this station');
    }

    return station;
  }

  private mapStationSummary(station: StationRecord): StationSummary {
    return {
      id: station.id,
      name: station.name,
      isActive: station.is_active,
      lastSeenAt: station.last_seen_at,
      createdAt: station.created_at,
    };
  }
}
