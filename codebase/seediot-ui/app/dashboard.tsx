import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, listStations, type StationSummary } from '@/lib/auth-api';
import { clearSession, loadSession } from '@/lib/session';
import { strings } from '@/constants/strings';

export default function DashboardScreen() {
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const session = await loadSession();

        if (!session) {
          router.replace('/');
          return;
        }

        const stationList = await listStations(session.tokens.accessToken);

        if (isActive) {
          setStations(stationList);
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
              : 'Nie udało się pobrać urządzeń SeedIot.',
          );
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
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-seediot-cream">
      <StatusBar style="dark" />

      <LinearGradient
        colors={['#FCFCF8', '#F4F6EE', '#E7EDD9']}
        locations={[0, 0.45, 1]}
        className="flex-1 px-6 pb-8 pt-6"
      >
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 12 }}
        >
          <View className="gap-8">
            <View className="pt-4">
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  <Text className="font-sora text-xs uppercase tracking-[3px] text-seediot-moss">
                    {strings.dashboard.eyebrow}
                  </Text>
                  <Text className="mt-4 font-sora-bold text-[34px] leading-[40px] text-seediot-forest-dark">
                    {strings.dashboard.headline}
                  </Text>
                  <Text className="mt-4 max-w-[320px] font-sora text-base leading-6 text-seediot-moss-soft">
                    {strings.dashboard.subheadline}
                  </Text>
                </View>

                <Pressable
                  className="h-12 w-12 items-center justify-center rounded-full border border-seediot-forest/10 bg-white/85"
                  onPress={() => router.push('/pair')}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={24}
                    color="#2F4A24"
                  />
                </Pressable>
              </View>
            </View>

            {isLoading ? (
              <View className="items-center rounded-[28px] border border-seediot-forest/10 bg-white/85 px-6 py-10">
                <ActivityIndicator color="#2F4A24" />
                <Text className="mt-4 text-center font-sora text-base text-seediot-moss-soft">
                  {strings.dashboard.loading}
                </Text>
              </View>
            ) : null}

            {!isLoading && error ? (
              <View className="rounded-[28px] border border-red-200 bg-white/85 px-5 py-6">
                <Text className="font-sora text-base leading-6 text-red-500">{error}</Text>
              </View>
            ) : null}

            {!isLoading && !error && stations.length === 0 ? (
              <View className="items-center rounded-[28px] border border-seediot-forest/10 bg-white/85 px-6 py-10">
                <View className="h-20 w-20 items-center justify-center rounded-full bg-seediot-cream-deep">
                  <MaterialCommunityIcons
                    name="wifi-off"
                    size={34}
                    color="#5B6E45"
                  />
                </View>
                <Text className="mt-6 text-center font-sora-bold text-[22px] leading-8 text-seediot-forest-dark">
                  {strings.dashboard.empty}
                </Text>
                <Text className="mt-3 max-w-[280px] text-center font-sora text-base leading-6 text-seediot-moss-soft">
                  {strings.dashboard.emptyHint}
                </Text>
                <Pressable
                  className="mt-8 items-center rounded-[26px] bg-seediot-forest px-6 py-4"
                  onPress={() => router.push('/pair')}
                >
                  <Text className="font-sora-bold text-base text-white">
                    {strings.dashboard.addDevice}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {!isLoading && !error && stations.length > 0 ? (
              <View className="gap-4">
                <Text className="font-sora text-sm uppercase tracking-[2px] text-seediot-moss">
                  {strings.dashboard.connectedLabel}
                </Text>
                {stations.map((station) => (
                  <StationCard key={station.id} station={station} />
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

function StationCard({ station }: { station: StationSummary }) {
  return (
    <Pressable
      className="rounded-[24px] border border-seediot-forest/10 bg-white/80 px-5 py-4"
      onPress={() => router.push({ pathname: '/station/[id]', params: { id: station.id } })}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-sora-bold text-[20px] text-seediot-forest-dark">
          {station.name}
        </Text>
        <View
          className={`rounded-full px-3 py-1 ${station.isActive ? 'bg-seediot-lime' : 'bg-seediot-cream-deep'}`}
        >
          <Text className="font-sora text-xs text-seediot-forest-dark">
            {station.isActive ? strings.dashboard.status : 'Nieaktywne'}
          </Text>
        </View>
      </View>

      <Text className="mt-4 font-sora text-sm text-seediot-moss-soft">
        {strings.dashboard.lastSeen}:{' '}
        {station.lastSeenAt
          ? new Date(station.lastSeenAt).toLocaleString('pl-PL')
          : strings.dashboard.never}
      </Text>
    </Pressable>
  );
}
