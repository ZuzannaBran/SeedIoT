import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, listStationReports, type StationReportItem } from '@/lib/auth-api';
import { clearSession, loadSession } from '@/lib/session';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pl-PL');
}

export default function StationRawLogsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const stationId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [reports, setReports] = useState<StationReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        if (!stationId) {
          if (isActive) {
            setError('Brak identyfikatora stacji.');
            setIsLoading(false);
          }
          return;
        }

        const session = await loadSession();
        if (!session) {
          router.replace('/');
          return;
        }

        const response = await listStationReports(session.tokens.accessToken, stationId, {
          page: 1,
          limit: 100,
        });

        if (isActive) {
          setReports(response.items);
          setError(null);
        }
      } catch (fetchError) {
        if (fetchError instanceof ApiError && fetchError.status === 401) {
          await clearSession();
          router.replace('/');
          return;
        }

        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : 'Nie udało się pobrać logów.');
          setReports([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [stationId]);

  return (
    <SafeAreaView className="flex-1 bg-seediot-cream">
      <StatusBar style="dark" />
      <View className="flex-1 px-4 pb-6 pt-4">
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border border-seediot-forest/10 bg-white/85"
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#2F4A24" />
          </Pressable>
          <Text className="font-sora-bold text-base text-seediot-forest-dark">Raw Logs</Text>
          <View className="h-10 w-10" />
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#2F4A24" />
            <Text className="mt-3 font-sora text-sm text-seediot-moss-soft">Pobieranie logów...</Text>
          </View>
        ) : error ? (
          <View className="rounded-[16px] border border-red-200 bg-white px-4 py-4">
            <Text className="font-sora text-sm text-red-600">{error}</Text>
          </View>
        ) : reports.length === 0 ? (
          <View className="rounded-[16px] border border-seediot-forest/10 bg-white px-4 py-4">
            <Text className="font-sora text-sm text-seediot-moss-soft">Brak raportów.</Text>
          </View>
        ) : (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="gap-3 pb-8">
              {reports.map((report) => (
                <View
                  key={report.id}
                  className="rounded-[14px] border border-seediot-forest/10 bg-white px-3 py-3"
                >
                  <Text className="font-sora text-xs text-seediot-moss-soft">
                    {formatDateTime(report.recordedAt || report.createdAt)}
                  </Text>
                  <Text className="mt-2 font-mono text-[11px] leading-5 text-seediot-forest-dark">
                    {JSON.stringify(report.payload, null, 2)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
