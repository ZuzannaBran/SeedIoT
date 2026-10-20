import Constants from 'expo-constants';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthProfile {
  id: string;
  email: string;
  role: string;
}

export interface StationSummary {
  id: string;
  name: string;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface StationReportItem {
  id: string;
  stationId: string;
  payload: Record<string, unknown>;
  recordedAt: string;
  createdAt: string;
}

export interface StationReportsResponse {
  items: StationReportItem[];
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
}

export interface CreatedStation extends StationSummary {
  apiKey: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface AuthPayload {
  email: string;
  password: string;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function extractHost(value?: string | null) {
  return value?.split(':')[0]?.trim() || null;
}

export function getApiBaseUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (explicitUrl) {
    return trimTrailingSlash(explicitUrl);
  }

  const host =
    extractHost(Constants.expoConfig?.hostUri) ??
    extractHost(Constants.expoGoConfig?.debuggerHost) ??
    extractHost(Constants.platform?.hostUri);

  if (host) {
    return `http://${host}:3000`;
  }

  return 'http://localhost:3000';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      `Nie udało się połączyć z serwerem Seediot pod adresem ${baseUrl}. Ustaw EXPO_PUBLIC_API_URL, jeśli backend działa pod innym adresem w sieci lokalnej.`,
    );
  }

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : 'Nie udało się połączyć z serwerem Seediot.';
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export function login(payload: AuthPayload) {
  return request<AuthTokens>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function register(payload: AuthPayload) {
  return request<AuthTokens>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMe(accessToken: string) {
  return request<AuthProfile>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function listStations(accessToken: string) {
  return request<StationSummary[]>('/stations', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function createStation(accessToken: string, name: string) {
  return request<CreatedStation>('/stations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ name }),
  });
}

export function deleteStation(accessToken: string, stationId: string) {
  return request<{ deleted: boolean; stationId: string }>(`/stations/${stationId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function listStationReports(
  accessToken: string,
  stationId: string,
  query?: {
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  },
) {
  const searchParams = new URLSearchParams();

  if (query?.from) {
    searchParams.set('from', query.from);
  }

  if (query?.to) {
    searchParams.set('to', query.to);
  }

  if (typeof query?.page === 'number') {
    searchParams.set('page', String(query.page));
  }

  if (typeof query?.limit === 'number') {
    searchParams.set('limit', String(query.limit));
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';

  return request<StationReportsResponse>(`/stations/${stationId}/reports${suffix}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
