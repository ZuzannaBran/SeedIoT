import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ComponentProps, useEffect, useState } from 'react';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { strings } from '@/constants/strings';
import {
  ApiError,
  deleteStation,
  listStationReports,
  listStations,
  type StationReportItem,
  type StationSummary,
} from '@/lib/auth-api';
import { clearSession, loadSession } from '@/lib/session';

const REPORT_LIMIT = 100;
const SENSOR_PRIORITY = [
  'bme280',
  'ds18b20',
  'soil_moisture',
  'wind',
  'rain',
  'ltr559',
  'scd41',
  'bme680',
];
const ACTIVE_REPORT_WINDOW_MS = 60 * 60 * 1000;
const PRESSURE_AXIS_CENTER = 1013;

const CHART_BUCKET_OPTIONS = [
  { label: '10 min', value: 10 },
  { label: '30 min', value: 30 },
  { label: '1h', value: 60 },
  { label: '3h', value: 180 },
  { label: '6h', value: 360 },
  { label: '12h', value: 720 },
  { label: '24h', value: 1440 },
] as const;

type ChartBucketMinutes = (typeof CHART_BUCKET_OPTIONS)[number]['value'];

function formatFallbackLabel(key: string) {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

function formatValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  }

  if (typeof value === 'boolean') {
    return value ? 'Tak' : 'Nie';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pl-PL');
}

function getBucketStartIso(timestamp: string, bucketMinutes: ChartBucketMinutes) {
  const bucketDate = new Date(timestamp);

  if (Number.isNaN(bucketDate.getTime())) {
    return null;
  }

  const totalMinutes = bucketDate.getHours() * 60 + bucketDate.getMinutes();
  const bucketStartMinutes = Math.floor(totalMinutes / bucketMinutes) * bucketMinutes;
  const bucketStartHour = Math.floor(bucketStartMinutes / 60);
  const bucketStartMinute = bucketStartMinutes % 60;

  bucketDate.setHours(bucketStartHour, bucketStartMinute, 0, 0);

  return bucketDate.toISOString();
}

function getBucketDescription(bucketMinutes: ChartBucketMinutes) {
  if (bucketMinutes < 60) {
    return `co ${bucketMinutes} min`;
  }

  const bucketHours = bucketMinutes / 60;

  if (bucketHours === 1) {
    return 'co 1 godzinę';
  }

  if (bucketHours === 24) {
    return 'co 24 godziny';
  }

  return `co ${bucketHours} godziny`;
}

function isRecentReport(value: string) {
  const reportTimestamp = new Date(value).getTime();

  if (Number.isNaN(reportTimestamp)) {
    return false;
  }

  return Date.now() - reportTimestamp <= ACTIVE_REPORT_WINDOW_MS;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapTelemetryPayload(payload: Record<string, unknown>) {
  const root = payload.payload;

  if (isPlainObject(root) && isPlainObject(root.readings)) {
    return root.readings;
  }

  if (isPlainObject(root)) {
    return root;
  }

  return payload;
}

function mergeTelemetryWithLastKnown(
  lastKnown: Record<string, unknown>,
  current: Record<string, unknown>,
) {
  const merged: Record<string, unknown> = { ...lastKnown };

  for (const [sensorKey, sensorValue] of Object.entries(current)) {
    if (sensorValue === null && sensorKey in merged) {
      continue;
    }

    const previousValue = merged[sensorKey];

    if (isPlainObject(previousValue) && isPlainObject(sensorValue)) {
      merged[sensorKey] = { ...previousValue, ...sensorValue };
    } else {
      merged[sensorKey] = sensorValue;
    }
  }

  return merged;
}

function hydrateReportsWithLastKnownTelemetry(reports: StationReportItem[]) {
  if (reports.length === 0) {
    return reports;
  }

  const byTimestampAsc = [...reports].sort((left, right) => {
    const leftTime = new Date(left.recordedAt || left.createdAt).getTime();
    const rightTime = new Date(right.recordedAt || right.createdAt).getTime();
    return leftTime - rightTime;
  });
  let lastKnownTelemetry: Record<string, unknown> = {};

  const hydratedChronological = byTimestampAsc.map((report) => {
    const telemetry = unwrapTelemetryPayload(report.payload);

    if (!isPlainObject(telemetry)) {
      return report;
    }

    lastKnownTelemetry = mergeTelemetryWithLastKnown(lastKnownTelemetry, telemetry);

    return {
      ...report,
      payload: {
        payload: {
          readings: lastKnownTelemetry,
        },
      },
    };
  });

  return hydratedChronological.reverse();
}

function toSensorLabel(key: string) {
  switch (key) {
    case 'bme280':
      return 'BME280';
    case 'bme680':
      return 'BME680';
    case 'ds18b20':
      return 'DS18B20';
    case 'ltr559':
      return 'LTR559';
    case 'scd41':
      return 'SCD41';
    case 'soil_moisture':
      return 'Wilgotność gleby';
    case 'wind':
      return 'Wiatr';
    case 'rain':
      return 'Deszcz';
    default:
      return formatFallbackLabel(key);
  }
}

function formatMetricLabelFromPath(path: string[]) {
  const leaf = path[path.length - 1] ?? '';

  if (leaf in strings.dashboard.metrics) {
    return strings.dashboard.metrics[leaf as keyof typeof strings.dashboard.metrics];
  }

  if (leaf.endsWith('_c')) {
    return `${formatFallbackLabel(leaf.replace(/_c$/, ''))} [°C]`;
  }

  if (leaf.endsWith('_hpa')) {
    return `${formatFallbackLabel(leaf.replace(/_hpa$/, ''))} [hPa]`;
  }

  if (leaf.endsWith('_percent')) {
    return `${formatFallbackLabel(leaf.replace(/_percent$/, ''))} [%]`;
  }

  if (leaf.endsWith('_m_s')) {
    return `${formatFallbackLabel(leaf.replace(/_m_s$/, ''))} [m/s]`;
  }

  if (leaf.endsWith('_mm_per_hour')) {
    return `${formatFallbackLabel(leaf.replace(/_mm_per_hour$/, ''))} [mm/h]`;
  }

  if (leaf.endsWith('_mm')) {
    return `${formatFallbackLabel(leaf.replace(/_mm$/, ''))} [mm]`;
  }

  if (leaf.endsWith('_v')) {
    return `${formatFallbackLabel(leaf.replace(/_v$/, ''))} [V]`;
  }

  if (leaf.endsWith('_deg')) {
    return `${formatFallbackLabel(leaf.replace(/_deg$/, ''))} [deg]`;
  }

  return formatFallbackLabel(leaf);
}

function collectSensorSummary(payload: Record<string, unknown>) {
  const telemetry = unwrapTelemetryPayload(payload);

  if (!isPlainObject(telemetry)) {
    return [];
  }

  return Object.entries(telemetry)
    .map(([sensorKey, sensorValue]) => {
      if (sensorValue === null) {
        return {
          key: sensorKey,
          label: toSensorLabel(sensorKey),
          status: 'Brak danych',
          fields: [] as { label: string; value: unknown }[],
        };
      }

      if (!isPlainObject(sensorValue)) {
        return {
          key: sensorKey,
          label: toSensorLabel(sensorKey),
          status: formatValue(sensorValue),
          fields: [],
        };
      }

      const fields = Object.entries(sensorValue)
        .filter(
          ([, fieldValue]) =>
            typeof fieldValue !== 'object' ||
            fieldValue === null ||
            Array.isArray(fieldValue),
        )
        .map(([fieldKey, fieldValue]) => ({
          label: formatMetricLabelFromPath([sensorKey, fieldKey]),
          value: fieldValue,
        }));

      const statusSource =
        fields.find((field) => typeof field.value === 'string')?.value ??
        fields.find((field) => typeof field.value === 'number')?.value ??
        'OK';

      return {
        key: sensorKey,
        label: toSensorLabel(sensorKey),
        status: formatValue(statusSource),
        fields,
      };
    })
    .sort((left, right) => {
      const leftIndex = SENSOR_PRIORITY.indexOf(left.key);
      const rightIndex = SENSOR_PRIORITY.indexOf(right.key);

      if (leftIndex !== rightIndex) {
        return (
          (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
          (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
        );
      }

      return left.label.localeCompare(right.label, 'pl');
    });
}

function extractPressureValue(sensorValue: unknown) {
  if (!isPlainObject(sensorValue)) {
    return null;
  }

  const pressure = sensorValue.pressure_hpa;

  if (typeof pressure === 'number' && Number.isFinite(pressure)) {
    return pressure;
  }

  return null;
}

function findNestedSensorValue(
  value: unknown,
  sensorKey: string,
): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const directValue = value[sensorKey];

  if (isPlainObject(directValue)) {
    return directValue;
  }

  for (const child of Object.values(value)) {
    const nestedValue = findNestedSensorValue(child, sensorKey);

    if (nestedValue) {
      return nestedValue;
    }
  }

  return null;
}

type PressurePoint = {
  recordedAt: string;
  value: number;
  bme280?: number;
  bme680?: number;
};

type WindPoint = {
  recordedAt: string;
  value: number;
};

type HumidityPoint = {
  recordedAt: string;
  value: number;
};

type RainPoint = {
  recordedAt: string;
  value: number;
};

type MetricChartPoint = {
  recordedAt: string;
  value: number;
};

type MetricChartDataPoint = {
  value: number;
  label: string;
  labelTextStyle?: {
    color: string;
    fontSize: number;
  };
};

function collectPressureSeries(
  reports: StationReportItem[],
  bucketHours: ChartBucketMinutes,
): PressurePoint[] {
  const chronologicalReports = [...reports].reverse();
  const buckets = new Map<
    string,
    {
      recordedAt: string;
      pressureTotal: number;
      pressureCount: number;
      bme280Total: number;
      bme280Count: number;
      bme680Total: number;
      bme680Count: number;
    }
  >();

  for (const report of chronologicalReports) {
    const telemetry = unwrapTelemetryPayload(report.payload);

    if (!isPlainObject(telemetry)) {
      continue;
    }

    const bme280Sensor = findNestedSensorValue(telemetry, 'bme280');
    const bme680Sensor = findNestedSensorValue(telemetry, 'bme680');
    const bme280Pressure = extractPressureValue(bme280Sensor);
    const bme680Pressure = extractPressureValue(bme680Sensor);
    const pressureValues = [bme280Pressure, bme680Pressure].filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value),
    );

    if (pressureValues.length === 0) {
      continue;
    }

    const averagePressure =
      pressureValues.reduce((sum, value) => sum + value, 0) / pressureValues.length;
    const timestamp = report.recordedAt || report.createdAt;
    const bucketKey = getBucketStartIso(timestamp, bucketHours);

    if (!bucketKey) {
      continue;
    }

    const existingBucket = buckets.get(bucketKey) ?? {
      recordedAt: bucketKey,
      pressureTotal: 0,
      pressureCount: 0,
      bme280Total: 0,
      bme280Count: 0,
      bme680Total: 0,
      bme680Count: 0,
    };

    existingBucket.pressureTotal += averagePressure;
    existingBucket.pressureCount += 1;

    if (typeof bme280Pressure === 'number') {
      existingBucket.bme280Total += bme280Pressure;
      existingBucket.bme280Count += 1;
    }

    if (typeof bme680Pressure === 'number') {
      existingBucket.bme680Total += bme680Pressure;
      existingBucket.bme680Count += 1;
    }

    buckets.set(bucketKey, existingBucket);
  }

  return [...buckets.values()].map((bucket) => ({
    recordedAt: bucket.recordedAt,
    value: bucket.pressureTotal / bucket.pressureCount,
    bme280:
      bucket.bme280Count > 0 ? bucket.bme280Total / bucket.bme280Count : undefined,
    bme680:
      bucket.bme680Count > 0 ? bucket.bme680Total / bucket.bme680Count : undefined,
  }));
}

function collectWindSeries(
  reports: StationReportItem[],
  bucketHours: ChartBucketMinutes,
): WindPoint[] {
  const chronologicalReports = [...reports].reverse();
  const buckets = new Map<
    string,
    {
      recordedAt: string;
      windTotal: number;
      windCount: number;
    }
  >();

  for (const report of chronologicalReports) {
    const telemetry = unwrapTelemetryPayload(report.payload);

    if (!isPlainObject(telemetry)) {
      continue;
    }

    const windSensor = findNestedSensorValue(telemetry, 'wind');

    if (!isPlainObject(windSensor)) {
      continue;
    }

    const windSpeed = windSensor.wind_speed_m_s;

    if (typeof windSpeed !== 'number' || !Number.isFinite(windSpeed)) {
      continue;
    }

    const timestamp = report.recordedAt || report.createdAt;
    const bucketKey = getBucketStartIso(timestamp, bucketHours);

    if (!bucketKey) {
      continue;
    }

    const existingBucket = buckets.get(bucketKey) ?? {
      recordedAt: bucketKey,
      windTotal: 0,
      windCount: 0,
    };

    existingBucket.windTotal += windSpeed;
    existingBucket.windCount += 1;
    buckets.set(bucketKey, existingBucket);
  }

  return [...buckets.values()].map((bucket) => ({
    recordedAt: bucket.recordedAt,
    value: bucket.windTotal / bucket.windCount,
  }));
}

function extractFirstFiniteNumber(
  sensorValue: unknown,
  candidateFields: string[],
): number | null {
  if (!isPlainObject(sensorValue)) {
    return null;
  }

  for (const field of candidateFields) {
    const value = sensorValue[field];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function collectAveragedHourlySeries(
  reports: StationReportItem[],
  bucketHours: ChartBucketMinutes,
  getValue: (telemetry: Record<string, unknown>) => number | null,
): HumidityPoint[] {
  const chronologicalReports = [...reports].reverse();
  const buckets = new Map<
    string,
    {
      recordedAt: string;
      total: number;
      count: number;
    }
  >();

  for (const report of chronologicalReports) {
    const telemetry = unwrapTelemetryPayload(report.payload);

    if (!isPlainObject(telemetry)) {
      continue;
    }

    const value = getValue(telemetry);

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      continue;
    }

    const timestamp = report.recordedAt || report.createdAt;
    const bucketKey = getBucketStartIso(timestamp, bucketHours);

    if (!bucketKey) {
      continue;
    }

    const existingBucket = buckets.get(bucketKey) ?? {
      recordedAt: bucketKey,
      total: 0,
      count: 0,
    };

    existingBucket.total += value;
    existingBucket.count += 1;
    buckets.set(bucketKey, existingBucket);
  }

  return [...buckets.values()].map((bucket) => ({
    recordedAt: bucket.recordedAt,
    value: bucket.total / bucket.count,
  }));
}

function collectAirHumiditySeries(
  reports: StationReportItem[],
  bucketHours: ChartBucketMinutes,
): HumidityPoint[] {
  return collectAveragedHourlySeries(reports, bucketHours, (telemetry) => {
    const bme280Sensor = findNestedSensorValue(telemetry, 'bme280');
    const bme680Sensor = findNestedSensorValue(telemetry, 'bme680');
    const candidateFields = [
      'humidity_percent',
      'relative_humidity_percent',
      'air_humidity_percent',
    ];

    const values = [
      extractFirstFiniteNumber(bme280Sensor, candidateFields),
      extractFirstFiniteNumber(bme680Sensor, candidateFields),
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    if (values.length === 0) {
      return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
}

function collectSoilHumiditySeries(
  reports: StationReportItem[],
  bucketHours: ChartBucketMinutes,
): HumidityPoint[] {
  return collectAveragedHourlySeries(reports, bucketHours, (telemetry) => {
    const soilSensor = findNestedSensorValue(telemetry, 'soil_moisture');

    return extractFirstFiniteNumber(soilSensor, [
      'soil_moisture_percent',
      'moisture_percent',
      'humidity_percent',
      'value_percent',
      'percent',
    ]);
  });
}

function collectSoilTemperatureSeries(
  reports: StationReportItem[],
  bucketHours: ChartBucketMinutes,
): MetricChartPoint[] {
  return collectAveragedHourlySeries(reports, bucketHours, (telemetry) => {
    const ds18b20Sensor = findNestedSensorValue(telemetry, 'ds18b20');

    return extractFirstFiniteNumber(ds18b20Sensor, ['temperature_c']);
  });
}

function extractRainAmountMm(sensorValue: unknown) {
  if (!isPlainObject(sensorValue)) {
    return null;
  }

  const rainMm = sensorValue.rain_mm;

  if (typeof rainMm === 'number' && Number.isFinite(rainMm)) {
    return rainMm;
  }

  const rainMmPerHour = sensorValue.rain_mm_per_hour;
  const sampleElapsedMs = sensorValue.sample_elapsed_ms;

  if (
    typeof rainMmPerHour === 'number' &&
    Number.isFinite(rainMmPerHour) &&
    typeof sampleElapsedMs === 'number' &&
    Number.isFinite(sampleElapsedMs) &&
    sampleElapsedMs > 0
  ) {
    return rainMmPerHour * (sampleElapsedMs / 3_600_000);
  }

  return null;
}

function collectRainSeries(
  reports: StationReportItem[],
  bucketHours: ChartBucketMinutes,
): RainPoint[] {
  const chronologicalReports = [...reports].reverse();
  const buckets = new Map<
    string,
    {
      recordedAt: string;
      totalMm: number;
    }
  >();

  for (const report of chronologicalReports) {
    const telemetry = unwrapTelemetryPayload(report.payload);

    if (!isPlainObject(telemetry)) {
      continue;
    }

    const rainSensor = findNestedSensorValue(telemetry, 'rain');
    const rainAmountMm = extractRainAmountMm(rainSensor);

    if (typeof rainAmountMm !== 'number' || !Number.isFinite(rainAmountMm)) {
      continue;
    }

    const timestamp = report.recordedAt || report.createdAt;
    const bucketKey = getBucketStartIso(timestamp, bucketHours);

    if (!bucketKey) {
      continue;
    }

    const existingBucket = buckets.get(bucketKey) ?? {
      recordedAt: bucketKey,
      totalMm: 0,
    };

    existingBucket.totalMm += rainAmountMm;
    buckets.set(bucketKey, existingBucket);
  }

  return [...buckets.values()].map((bucket) => ({
    recordedAt: bucket.recordedAt,
    value: bucket.totalMm,
  }));
}

function formatChartBucket(value: string, bucketMinutes: ChartBucketMinutes) {
  const date = new Date(value);

  if (bucketMinutes >= 1440) {
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  return date.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatChartNumber(value: number, decimals = 1) {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return value.toFixed(decimals);
}

function buildMetricChartData(
  points: MetricChartPoint[],
  bucketHours: ChartBucketMinutes,
): MetricChartDataPoint[] {
  const middleIndex = Math.floor((points.length - 1) / 2);

  return points.map((point, index) => {
    const shouldShowLabel =
      index === 0 || index === middleIndex || index === points.length - 1;

    return {
      value: Number(point.value.toFixed(2)),
      label: shouldShowLabel ? formatChartBucket(point.recordedAt, bucketHours) : '',
      labelTextStyle: {
        color: '#7A8B6C',
        fontSize: 10,
      },
    };
  });
}

function getMetricStats(points: MetricChartPoint[]) {
  const values = points.map((point) => point.value);
  const latest = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2];

  return {
    latest,
    min: Math.min(...values),
    max: Math.max(...values),
    delta: typeof previous === 'number' ? latest - previous : null,
  };
}

function getCenteredAxisBounds(values: number[], center: number, minHalfSpan = 2) {
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  const maxDeviation = Math.max(
    Math.abs(maxValue - center),
    Math.abs(minValue - center),
    minHalfSpan,
  );

  const paddedDeviation = maxDeviation * 1.25;

  return {
    maxValue: Number((center + paddedDeviation).toFixed(2)),
    minValue: Number((center - paddedDeviation).toFixed(2)),
  };
}

function getPositiveAxisBounds(values: number[], minMaxValue = 1) {
  const maxValue = Math.max(...values, minMaxValue);

  return {
    minValue: 0,
    maxValue: Number((maxValue * 1.25).toFixed(2)),
  };
}

function getPercentAxisBounds(values: number[], minSpan = 20) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, minSpan);
  const center = (minValue + maxValue) / 2;
  const halfSpan = range / 2;

  return {
    minValue: Math.max(0, Number((center - halfSpan - 4).toFixed(2))),
    maxValue: Math.min(100, Number((center + halfSpan + 4).toFixed(2))),
  };
}

function ChartStatPill({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: string;
  accentColor: string;
}) {
  return (
    <View className="flex-1 rounded-[16px] bg-white/65 px-3 py-2.5">
      <Text className="font-sora text-[10px] uppercase tracking-[2px] text-seediot-moss-soft">
        {label}
      </Text>
      <Text className="mt-1 font-sora-bold text-sm" style={{ color: accentColor }}>
        {value}
      </Text>
    </View>
  );
}

function MetricLineChart({
  title,
  subtitle,
  iconName,
  unit,
  points,
  chartData,
  maxValue,
  minValue,
  color,
  fillColor,
  decimals = 1,
  formatYLabel,
}: {
  title: string;
  subtitle: string;
  iconName: ComponentProps<typeof MaterialCommunityIcons>['name'];
  unit: string;
  points: MetricChartPoint[];
  chartData: MetricChartDataPoint[];
  maxValue: number;
  minValue: number;
  color: string;
  fillColor: string;
  decimals?: number;
  formatYLabel: (label: string) => string;
}) {
  const { width } = useWindowDimensions();
  const [chartContainerWidth, setChartContainerWidth] = useState(0);

  if (points.length === 0) {
    return null;
  }

  const stats = getMetricStats(points);
  const fallbackWidth = Math.max(220, Math.min(width - 72, 410));
  const chartWidth = Math.max(220, chartContainerWidth || fallbackWidth);
  const renderedChartData =
    chartData.length === 1
      ? [
          chartData[0],
          {
            ...chartData[0],
            label: '',
          },
        ]
      : chartData;

  const spacing =
    renderedChartData.length > 1
      ? Math.max(18, (chartWidth - 82) / (renderedChartData.length - 1))
      : chartWidth / 2;

  const deltaLabel =
    stats.delta === null
      ? '—'
      : `${stats.delta > 0 ? '+' : ''}${formatChartNumber(stats.delta, decimals)} ${unit}`;

  const deltaIcon =
    stats.delta === null ? 'minus' : stats.delta >= 0 ? 'trending-up' : 'trending-down';

  const deltaColor =
    stats.delta === null ? '#7A8B6C' : stats.delta >= 0 ? '#3E6B4A' : '#B7791F';

  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.96)', 'rgba(246,248,240,0.96)']}
      locations={[0, 1]}
      className="overflow-hidden rounded-[24px] border border-seediot-forest/10 px-4 py-4"
    >
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-3">
            <View
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: fillColor }}
            >
              <MaterialCommunityIcons name={iconName} size={21} color={color} />
            </View>

            <View className="flex-1">
              <Text className="font-sora-bold text-[17px] text-seediot-forest-dark">
                {title}
              </Text>
              <Text className="mt-1 font-sora text-xs text-seediot-moss-soft">
                {subtitle}
              </Text>
            </View>
          </View>
        </View>

        <View className="items-end">
          <Text className="font-sora-bold text-[20px] text-seediot-forest-dark">
            {formatChartNumber(stats.latest, decimals)}
          </Text>
          <Text className="font-sora text-xs text-seediot-moss-soft">{unit}</Text>
        </View>
      </View>

      <View className="mt-3 flex-row gap-2">
        <ChartStatPill
          label="Minimum"
          value={`${formatChartNumber(stats.min, decimals)} ${unit}`}
          accentColor={color}
        />
        <ChartStatPill
          label="Maksimum"
          value={`${formatChartNumber(stats.max, decimals)} ${unit}`}
          accentColor={color}
        />
        <ChartStatPill label="Zmiana" value={deltaLabel} accentColor={deltaColor} />
      </View>

      <View
        className="mt-3 rounded-[20px] bg-seediot-cream/70 px-0.5 py-3"
        onLayout={(event) => {
          const nextWidth = Math.floor(event.nativeEvent.layout.width) - 6;

          if (nextWidth > 0 && nextWidth !== chartContainerWidth) {
            setChartContainerWidth(nextWidth);
          }
        }}
      >
        <LineChart
          data={renderedChartData}
          areaChart
          curved
          isAnimated
          animateOnDataChange
          animationDuration={650}
          width={chartWidth}
          height={160}
          spacing={spacing}
          initialSpacing={10}
          endSpacing={10}
          color={color}
          thickness={3}
          startFillColor={fillColor}
          endFillColor={fillColor}
          startOpacity={0.46}
          endOpacity={0.05}
          dataPointsColor={color}
          dataPointsRadius={3.6}
          focusedDataPointColor="#FFFFFF"
          focusedDataPointRadius={6}
          hideDataPoints={renderedChartData.length > 18}
          hideRules={false}
          rulesColor="rgba(47,74,36,0.10)"
          rulesType="dashed"
          noOfSections={4}
          maxValue={maxValue}
          minValue={minValue}
          yAxisLabelWidth={38}
          yAxisColor="transparent"
          yAxisThickness={0}
          xAxisColor="rgba(47,74,36,0.14)"
          xAxisThickness={1}
          yAxisTextStyle={{
            color: '#7A8B6C',
            fontSize: 10,
          }}
          xAxisLabelTextStyle={{
            color: '#7A8B6C',
            fontSize: 10,
            textAlign: 'center',
          }}
          showVerticalLines={false}
          disableScroll
          formatYLabel={formatYLabel}
          focusEnabled
          showTextOnFocus={false}
          pointerConfig={{
            pointerStripHeight: 145,
            pointerStripColor: 'rgba(47,74,36,0.25)',
            pointerStripWidth: 1,
            pointerColor: color,
            radius: 5,
            pointerLabelWidth: 104,
            pointerLabelHeight: 58,
            activatePointersOnLongPress: true,
            autoAdjustPointerLabelPosition: true,
            pointerLabelComponent: (items: { value?: number }[]) => {
              const value = Number(items?.[0]?.value ?? 0);

              return (
                <View className="rounded-[16px] bg-seediot-forest-dark px-3 py-2">
                  <Text className="font-sora text-[10px] uppercase tracking-[1.5px] text-white/70">
                    Wartość
                  </Text>
                  <Text className="mt-1 font-sora-bold text-sm text-white">
                    {formatChartNumber(value, decimals)} {unit}
                  </Text>
                </View>
              );
            },
          }}
        />
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <MaterialCommunityIcons name={deltaIcon} size={17} color={deltaColor} />
        <Text className="flex-1 font-sora text-xs text-seediot-moss-soft">
          Ostatnia zmiana względem poprzedniego punktu: {deltaLabel}
        </Text>
      </View>
    </LinearGradient>
  );
}

function PressureLineChart({
  points,
  bucketHours,
}: {
  points: PressurePoint[];
  bucketHours: ChartBucketMinutes;
}) {
  if (points.length === 0) {
    return null;
  }

  const values = points.map((point) => point.value);
  const chartData = buildMetricChartData(points, bucketHours);
  const { maxValue, minValue } = getCenteredAxisBounds(
    values,
    PRESSURE_AXIS_CENTER,
    2,
  );

  return (
    <MetricLineChart
      title="Ciśnienie atmosferyczne"
      subtitle="Średnia z czujników BME280 / BME680"
      iconName="gauge"
      unit="hPa"
      points={points}
      chartData={chartData}
      maxValue={maxValue}
      minValue={minValue}
      color="#2F4A24"
      fillColor="#DDE7B8"
      decimals={1}
      formatYLabel={(label) => `${Number(label).toFixed(0)}`}
    />
  );
}

function WindLineChart({
  points,
  bucketHours,
}: {
  points: WindPoint[];
  bucketHours: ChartBucketMinutes;
}) {
  if (points.length === 0) {
    return null;
  }

  const values = points.map((point) => point.value);
  const chartData = buildMetricChartData(points, bucketHours);
  const { maxValue, minValue } = getPositiveAxisBounds(values, 1);

  return (
    <MetricLineChart
      title="Prędkość wiatru"
      subtitle="Średnia prędkość wiatru w czasie"
      iconName="weather-windy"
      unit="m/s"
      points={points}
      chartData={chartData}
      maxValue={maxValue}
      minValue={minValue}
      color="#3E6B4A"
      fillColor="#CFE0C0"
      decimals={2}
      formatYLabel={(label) => `${Number(label).toFixed(1)}`}
    />
  );
}

function AirHumidityLineChart({
  points,
  bucketHours,
}: {
  points: HumidityPoint[];
  bucketHours: ChartBucketMinutes;
}) {
  if (points.length === 0) {
    return null;
  }

  const values = points.map((point) => point.value);
  const chartData = buildMetricChartData(points, bucketHours);
  const { maxValue, minValue } = getPercentAxisBounds(values, 20);

  return (
    <MetricLineChart
      title="Wilgotność powietrza"
      subtitle="Średnia wilgotność względna z czujników BME"
      iconName="water-percent"
      unit="%"
      points={points}
      chartData={chartData}
      maxValue={maxValue}
      minValue={minValue}
      color="#4B6FA8"
      fillColor="#DCE7F5"
      decimals={1}
      formatYLabel={(label) => `${Number(label).toFixed(0)}`}
    />
  );
}

function SoilHumidityLineChart({
  points,
  bucketHours,
}: {
  points: HumidityPoint[];
  bucketHours: ChartBucketMinutes;
}) {
  if (points.length === 0) {
    return null;
  }

  const values = points.map((point) => point.value);
  const chartData = buildMetricChartData(points, bucketHours);
  const { maxValue, minValue } = getPercentAxisBounds(values, 20);

  return (
    <MetricLineChart
      title="Wilgotność gleby"
      subtitle="Średnia wilgotność z czujnika gleby"
      iconName="sprout"
      unit="%"
      points={points}
      chartData={chartData}
      maxValue={maxValue}
      minValue={minValue}
      color="#6B8F3A"
      fillColor="#E3EDC8"
      decimals={1}
      formatYLabel={(label) => `${Number(label).toFixed(0)}`}
    />
  );
}

function SoilTemperatureLineChart({
  points,
  bucketHours,
}: {
  points: MetricChartPoint[];
  bucketHours: ChartBucketMinutes;
}) {
  if (points.length === 0) {
    return null;
  }

  const values = points.map((point) => point.value);
  const chartData = buildMetricChartData(points, bucketHours);
  const center = values.reduce((sum, value) => sum + value, 0) / values.length;
  const { maxValue, minValue } = getCenteredAxisBounds(values, center, 2);

  return (
    <MetricLineChart
      title="Temperatura gleby"
      subtitle="Średnia temperatura z czujnika DS18B20"
      iconName="thermometer"
      unit="°C"
      points={points}
      chartData={chartData}
      maxValue={maxValue}
      minValue={minValue}
      color="#A05E2A"
      fillColor="#F3E2D2"
      decimals={1}
      formatYLabel={(label) => `${Number(label).toFixed(1)}`}
    />
  );
}

function RainBarChart({
  points,
  bucketHours,
}: {
  points: RainPoint[];
  bucketHours: ChartBucketMinutes;
}) {
  const { width } = useWindowDimensions();
  const [chartContainerWidth, setChartContainerWidth] = useState(0);

  if (points.length === 0) {
    return null;
  }

  const values = points.map((point) => point.value);
  const latest = values[values.length - 1] ?? 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  const maxPointValue = Math.max(...values, 0.2);
  const chartMaxValue = Number((maxPointValue * 1.35).toFixed(2));
  const fallbackWidth = Math.max(220, Math.min(width - 72, 410));
  const chartWidth = Math.max(220, chartContainerWidth || fallbackWidth);
  const middleIndex = Math.floor((points.length - 1) / 2);
  const barWidth = points.length <= 6 ? 24 : points.length <= 10 ? 18 : 14;
  const spacing = points.length <= 6 ? 12 : points.length <= 10 ? 9 : 6;

  const chartData = points.map((point, index) => ({
    value: Number(point.value.toFixed(3)),
    label:
      index === 0 || index === middleIndex || index === points.length - 1
        ? formatChartBucket(point.recordedAt, bucketHours)
        : '',
    frontColor: '#4B7BA8',
    gradientColor: '#CFE4F7',
    topLabelComponent:
      point.value > 0
        ? () => (
            <Text className="font-sora text-[9px] text-seediot-moss-soft">
              {point.value.toFixed(point.value < 1 ? 2 : 1)}
            </Text>
          )
        : undefined,
  }));

  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.96)', 'rgba(246,248,240,0.96)']}
      locations={[0, 1]}
      className="overflow-hidden rounded-[24px] border border-seediot-forest/10 px-4 py-4"
    >
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-3">
            <View
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: '#DCECF8' }}
            >
              <MaterialCommunityIcons name="weather-pouring" size={21} color="#4B7BA8" />
            </View>

            <View className="flex-1">
              <Text className="font-sora-bold text-[17px] text-seediot-forest-dark">
                Opady
              </Text>
              <Text className="mt-1 font-sora text-xs text-seediot-moss-soft">
                Suma opadów w przedziałach godzinowych
              </Text>
            </View>
          </View>
        </View>

        <View className="items-end">
          <Text className="font-sora-bold text-[20px] text-seediot-forest-dark">
            {total.toFixed(total < 1 ? 2 : 1)}
          </Text>
          <Text className="font-sora text-xs text-seediot-moss-soft">mm</Text>
        </View>
      </View>

      <View className="mt-3 flex-row gap-2">
        <ChartStatPill
          label="Ostatnio"
          value={`${latest.toFixed(latest < 1 ? 2 : 1)} mm`}
          accentColor="#4B7BA8"
        />
        <ChartStatPill
          label="Suma"
          value={`${total.toFixed(total < 1 ? 2 : 1)} mm`}
          accentColor="#4B7BA8"
        />
        <ChartStatPill
          label="Najwięcej"
          value={`${maxPointValue.toFixed(maxPointValue < 1 ? 2 : 1)} mm`}
          accentColor="#4B7BA8"
        />
      </View>

      <View
        className="mt-3 rounded-[20px] bg-seediot-cream/70 px-0.5 py-3"
        onLayout={(event) => {
          const nextWidth = Math.floor(event.nativeEvent.layout.width) - 6;

          if (nextWidth > 0 && nextWidth !== chartContainerWidth) {
            setChartContainerWidth(nextWidth);
          }
        }}
      >
        <BarChart
          data={chartData}
          width={chartWidth}
          height={160}
          barWidth={barWidth}
          spacing={spacing}
          initialSpacing={10}
          endSpacing={10}
          roundedTop
          roundedBottom
          showGradient
          isAnimated
          animationDuration={650}
          noOfSections={4}
          maxValue={chartMaxValue}
          yAxisLabelWidth={38}
          yAxisColor="transparent"
          yAxisThickness={0}
          xAxisColor="rgba(47,74,36,0.14)"
          xAxisThickness={1}
          rulesColor="rgba(47,74,36,0.10)"
          rulesType="dashed"
          yAxisTextStyle={{
            color: '#7A8B6C',
            fontSize: 10,
          }}
          xAxisLabelTextStyle={{
            color: '#7A8B6C',
            fontSize: 10,
            textAlign: 'center',
          }}
          formatYLabel={(label) => `${Number(label).toFixed(1)}`}
          hideRules={false}
          disableScroll
        />
      </View>
    </LinearGradient>
  );
}

function ChartBucketSelector({
  value,
  onChange,
}: {
  value: ChartBucketMinutes;
  onChange: (value: ChartBucketMinutes) => void;
}) {
  return (
    <View className="rounded-[22px] border border-seediot-forest/10 bg-seediot-cream/70 px-3 py-3">
      <Text className="font-sora-bold text-sm text-seediot-forest-dark">
        Agregacja danych
      </Text>
      <Text className="mt-1 font-sora text-xs text-seediot-moss-soft">
        Grupowanie pomiarów {getBucketDescription(value)}
      </Text>

      <View className="mt-3 flex-row flex-wrap gap-2">
        {CHART_BUCKET_OPTIONS.map((option) => {
          const isSelected = option.value === value;

          return (
            <Pressable
              key={option.value}
              className={`rounded-full border px-3 py-2 ${
                isSelected
                  ? 'border-seediot-forest bg-seediot-forest'
                  : 'border-seediot-forest/10 bg-white/75'
              }`}
              onPress={() => onChange(option.value)}
            >
              <Text
                className={`font-sora-bold text-xs ${
                  isSelected ? 'text-white' : 'text-seediot-forest-dark'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SensorSummaryCard({
  label,
  status,
  fields,
}: {
  label: string;
  status: string;
  fields: { label: string; value: unknown }[];
}) {
  return (
    <View className="rounded-[22px] border border-seediot-forest/10 bg-white px-4 py-4">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <Text className="font-sora text-xs uppercase tracking-[3px] text-seediot-moss">
            {label}
          </Text>
          <Text className="mt-2 font-sora-bold text-lg text-seediot-forest-dark">
            {status}
          </Text>
        </View>
        <View className="rounded-full bg-seediot-cream-deep px-3 py-1">
          <Text className="font-sora text-xs text-seediot-forest-dark">
            {fields.length} pól
          </Text>
        </View>
      </View>

      {fields.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {fields.slice(0, 4).map((field) => (
            <View
              key={`${label}-${field.label}`}
              className="min-w-[44%] flex-1 rounded-[16px] bg-seediot-cream px-3 py-2.5"
            >
              <Text className="font-sora text-[10px] uppercase tracking-[2px] text-seediot-moss">
                {field.label}
              </Text>
              <Text className="mt-1.5 font-sora-bold text-sm text-seediot-forest-dark">
                {formatValue(field.value)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function StationDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const stationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [station, setStation] = useState<StationSummary | null>(null);
  const [reports, setReports] = useState<StationReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bucketHours, setBucketHours] = useState<ChartBucketMinutes>(60);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        if (!stationId) {
          throw new Error('Brak identyfikatora urządzenia.');
        }

        const session = await loadSession();

        if (!session) {
          router.replace('/');
          return;
        }

        if (isActive) {
          setAccessToken(session.tokens.accessToken);
        }

        const stationList = await listStations(session.tokens.accessToken);
        const foundStation = stationList.find((item) => item.id === stationId) ?? null;

        if (!isActive) {
          return;
        }

        if (!foundStation) {
          setError('Nie znaleziono tego urządzenia.');
          setStation(null);
          setReports([]);
          return;
        }

        setStation(foundStation);
        setError(null);
        setReports([]);
        setReportsLoading(true);
        setReportsError(null);

        try {
          const reportsResponse = await listStationReports(session.tokens.accessToken, stationId, {
            limit: REPORT_LIMIT,
          });

          if (isActive) {
            setReports(reportsResponse.items);
            setReportsError(null);
          }
        } catch (reportsFetchError) {
          if (reportsFetchError instanceof ApiError && reportsFetchError.status === 401) {
            await clearSession();
            router.replace('/');
            return;
          }

          if (isActive) {
            setReportsError(
              reportsFetchError instanceof Error
                ? reportsFetchError.message
                : 'Nie udało się pobrać raportów urządzenia.',
            );
            setReports([]);
          }
        }
      } catch (fetchError) {
        if (fetchError instanceof ApiError && fetchError.status === 401) {
          await clearSession();
          router.replace('/');
          return;
        }

        if (isActive) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Nie udało się pobrać szczegółów urządzenia.',
          );
          setReportsError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Nie udało się pobrać raportów urządzenia.',
          );
          setReports([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
          setReportsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [stationId]);

  const handleDeleteStation = async () => {
    if (!stationId || !accessToken) {
      setDeleteError('Brak danych do usunięcia urządzenia.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteStation(accessToken, stationId);
      router.replace('/dashboard');
    } catch (deleteStationError) {
      if (deleteStationError instanceof ApiError && deleteStationError.status === 401) {
        await clearSession();
        router.replace('/');
        return;
      }

      setDeleteError(
        deleteStationError instanceof Error
          ? deleteStationError.message
          : 'Nie udało się usunąć urządzenia.',
      );
    } finally {
      setIsDeleting(false);
      setDeleteModalVisible(false);
      setMenuVisible(false);
    }
  };

  const hydratedReports = hydrateReportsWithLastKnownTelemetry(reports);
  const latestReport = hydratedReports[0] ?? null;
  const sensorSummary = latestReport ? collectSensorSummary(latestReport.payload) : [];
  const pressureSeries = collectPressureSeries(hydratedReports, bucketHours);
  const windSeries = collectWindSeries(hydratedReports, bucketHours);
  const airHumiditySeries = collectAirHumiditySeries(hydratedReports, bucketHours);
  const soilHumiditySeries = collectSoilHumiditySeries(hydratedReports, bucketHours);
  const soilTemperatureSeries = collectSoilTemperatureSeries(hydratedReports, bucketHours);
  const rainSeries = collectRainSeries(hydratedReports, bucketHours);
  const latestReportTimestamp = latestReport?.recordedAt ?? latestReport?.createdAt ?? null;
  const latestReportIsActive = latestReportTimestamp ? isRecentReport(latestReportTimestamp) : false;

  return (
    <SafeAreaView className="flex-1 bg-seediot-cream">
      <StatusBar style="dark" />

      <LinearGradient
        colors={['#FCFCF8', '#F4F6EE', '#E7EDD9']}
        locations={[0, 0.45, 1]}
        className="flex-1 px-4 pb-6 pt-4"
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border border-seediot-forest/10 bg-white/85"
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#2F4A24" />
          </Pressable>
          <Text className="font-sora text-xs uppercase tracking-[3px] text-seediot-moss">
            Urządzenie
          </Text>
          <View className="relative h-10 w-10 items-end">
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full border border-seediot-forest/10 bg-white/85"
              onPress={() => setMenuVisible((value) => !value)}
            >
              <MaterialCommunityIcons name="dots-vertical" size={22} color="#2F4A24" />
            </Pressable>

            {menuVisible ? (
              <View className="absolute right-0 top-12 z-20 w-52 overflow-hidden rounded-[16px] border border-seediot-forest/10 bg-white/95 shadow-2xl">
                <Pressable
                  className="flex-row items-center gap-3 px-3 py-3"
                  onPress={() => {
                    if (!stationId) {
                      return;
                    }
                    setMenuVisible(false);
                    router.push(`/station/${stationId}/raw`);
                  }}
                >
                  <MaterialCommunityIcons name="file-document-outline" size={20} color="#2F4A24" />
                  <Text className="font-sora text-sm text-seediot-forest-dark">
                    Logi deweloperskie
                  </Text>
                </Pressable>
                <Pressable
                  className="flex-row items-center gap-3 px-3 py-3"
                  onPress={() => {
                    setMenuVisible(false);
                    setDeleteModalVisible(true);
                  }}
                >
                  <MaterialCommunityIcons name="delete-outline" size={20} color="#B42318" />
                  <Text className="font-sora-bold text-sm text-red-600">
                    Usuń urządzenie
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        <ScrollView className="mt-5 flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-3 pb-6">
            {isLoading ? (
              <View className="flex-1 items-center justify-center rounded-[28px] border border-seediot-forest/10 bg-white/85 px-6 py-10">
                <ActivityIndicator color="#2F4A24" />
                <Text className="mt-4 text-center font-sora text-base text-seediot-moss-soft">
                  Ładowanie urządzenia...
                </Text>
              </View>
            ) : error ? (
              <View className="rounded-[24px] border border-red-200 bg-white/85 px-4 py-4">
                <Text className="font-sora text-base leading-6 text-red-500">{error}</Text>
              </View>
            ) : station ? (
              <>
                <View className="rounded-[24px] border border-seediot-forest/10 bg-white/85 px-4 py-4">
                  <View className="flex-row items-start justify-between gap-4">
                    <View className="flex-1">
                      <Text className="font-sora text-xs uppercase tracking-[3px] text-seediot-moss">
                        Nazwa
                      </Text>
                      <Text className="mt-2 font-sora-bold text-[26px] leading-8 text-seediot-forest-dark">
                        {station.name}
                      </Text>
                    </View>
                    <View
                      className={`rounded-full px-3 py-1 ${
                        latestReportIsActive ? 'bg-seediot-lime' : 'bg-seediot-cream-deep'
                      }`}
                    >
                      <Text className="font-sora text-xs text-seediot-forest-dark">
                        {latestReportIsActive ? 'Aktywne' : 'Nieaktywne'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="rounded-[24px] border border-seediot-forest/10 bg-white/85 px-4 py-4">
                  <Text className="font-sora-bold text-[17px] text-seediot-forest-dark">
                    {strings.station.reportsTitle}
                  </Text>
                  <Text className="mt-2 font-sora text-sm leading-6 text-seediot-moss-soft">
                    {strings.station.reportsSubtitle}
                  </Text>

                  {reportsLoading ? (
                    <View className="mt-4 flex-row items-center gap-3">
                      <ActivityIndicator color="#2F4A24" />
                      <Text className="font-sora text-sm text-seediot-moss-soft">
                        Pobieranie raportów...
                      </Text>
                    </View>
                  ) : reportsError ? (
                    <Text className="mt-4 font-sora text-sm leading-6 text-red-500">
                      {reportsError}
                    </Text>
                  ) : reports.length === 0 ? (
                    <Text className="mt-4 font-sora text-sm leading-6 text-seediot-moss-soft">
                      {strings.station.noReports}
                    </Text>
                  ) : (
                    <View className="mt-4 gap-3">
                      <Text className="font-sora text-sm leading-6 text-seediot-moss-soft">
                        Ostatni raport:{' '}
                        {latestReportTimestamp ? formatDateTime(latestReportTimestamp) : 'Brak'}
                      </Text>

                      <ChartBucketSelector value={bucketHours} onChange={setBucketHours} />

                      {sensorSummary.length > 0 ? (
                        <View className="gap-3">
                          <Text className="font-sora-bold text-[17px] text-seediot-forest-dark">
                            Sensory
                          </Text>
                          {sensorSummary.map((sensor) => (
                            <SensorSummaryCard
                              key={sensor.key}
                              label={sensor.label}
                              status={sensor.status}
                              fields={sensor.fields}
                            />
                          ))}
                        </View>
                      ) : null}

                      {pressureSeries.length > 0 ? (
                        <PressureLineChart points={pressureSeries} bucketHours={bucketHours} />
                      ) : (
                        <Text className="font-sora text-sm leading-6 text-seediot-moss-soft">
                          Raporty nie zawierają jeszcze danych ciśnienia z czujników BME280 i BME680.
                        </Text>
                      )}

                      {windSeries.length > 0 ? (
                        <WindLineChart points={windSeries} bucketHours={bucketHours} />
                      ) : (
                        <Text className="font-sora text-sm leading-6 text-seediot-moss-soft">
                          Raporty nie zawierają jeszcze danych prędkości wiatru.
                        </Text>
                      )}

                      {airHumiditySeries.length > 0 ? (
                        <AirHumidityLineChart points={airHumiditySeries} bucketHours={bucketHours} />
                      ) : (
                        <Text className="font-sora text-sm leading-6 text-seediot-moss-soft">
                          Raporty nie zawierają jeszcze danych wilgotności powietrza.
                        </Text>
                      )}

                      {soilHumiditySeries.length > 0 ? (
                        <SoilHumidityLineChart points={soilHumiditySeries} bucketHours={bucketHours} />
                      ) : (
                        <Text className="font-sora text-sm leading-6 text-seediot-moss-soft">
                          Raporty nie zawierają jeszcze danych wilgotności gleby.
                        </Text>
                      )}

                      {soilTemperatureSeries.length > 0 ? (
                        <SoilTemperatureLineChart
                          points={soilTemperatureSeries}
                          bucketHours={bucketHours}
                        />
                      ) : (
                        <Text className="font-sora text-sm leading-6 text-seediot-moss-soft">
                          Raporty nie zawierają jeszcze danych temperatury gleby.
                        </Text>
                      )}

                      {rainSeries.length > 0 ? (
                        <RainBarChart points={rainSeries} bucketHours={bucketHours} />
                      ) : (
                        <Text className="font-sora text-sm leading-6 text-seediot-moss-soft">
                          Raporty nie zawierają jeszcze danych opadów.
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>

        {deleteError ? (
          <View className="mt-3 rounded-[18px] border border-red-200 bg-white/90 px-3 py-2.5">
            <Text className="font-sora text-sm leading-6 text-red-500">{deleteError}</Text>
          </View>
        ) : null}
      </LinearGradient>

      <Modal
        animationType="fade"
        transparent
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/55 px-6">
          <View className="w-full max-w-[320px] rounded-[24px] bg-white px-5 py-5">
            <Text className="font-sora-bold text-[22px] leading-8 text-seediot-forest-dark">
              Czy na pewno chcesz usunąć to urządzenie?
            </Text>
            <Text className="mt-2 font-sora text-sm leading-6 text-seediot-moss-soft">
              Ta operacja usunie urządzenie z Twojego konta.
            </Text>

            <View className="mt-4 gap-2">
              <Pressable
                className="items-center rounded-[16px] bg-red-600 px-4 py-3"
                disabled={isDeleting}
                onPress={() => {
                  void handleDeleteStation();
                }}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="font-sora-bold text-sm text-white">Usuń</Text>
                )}
              </Pressable>

              <Pressable
                className="items-center rounded-[16px] border border-seediot-forest/10 bg-white px-4 py-3"
                disabled={isDeleting}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text className="font-sora-bold text-sm text-seediot-forest-dark">
                  Anuluj
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
