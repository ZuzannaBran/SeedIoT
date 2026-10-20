import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { BleManager, type Device, State, type Subscription } from 'react-native-ble-plx';
import WifiManager from 'react-native-wifi-reborn';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { strings } from '@/constants/strings';
import { createStation, getApiBaseUrl } from '@/lib/auth-api';
import { loadSession } from '@/lib/session';

type PairQrPayload = {
  stationId: number;
  creationDate: string;
};

type PairPhase = 'scanning' | 'connecting' | 'wifi' | 'wifi-password' | 'naming';

type WifiNetwork = {
  BSSID?: string;
  SSID: string;
  capabilities?: string;
  frequency?: number;
  level?: number;
  timestamp?: number;
};

function getWifiStrengthIcon(level?: number) {
  if (typeof level !== 'number') {
    return 'wifi-strength-outline';
  }

  if (level >= -55) {
    return 'wifi-strength-4';
  }

  if (level >= -67) {
    return 'wifi-strength-3';
  }

  if (level >= -75) {
    return 'wifi-strength-2';
  }

  return 'wifi-strength-1';
}

function is24GhzNetwork(network: WifiNetwork) {
  if (typeof network.frequency !== 'number') {
    return false;
  }

  return network.frequency >= 2400 && network.frequency <= 2500;
}

function isLoopbackUrl(value: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(value);
}

const DEVICE_CONFIG_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const DEVICE_CONFIG_CHARACTERISTIC_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
const DEVICE_CONFIG_ACK_CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
const DEVICE_CONFIG_CHUNK_SIZE = 16;
const DEVICE_CONFIG_ACK_TIMEOUT_MS = 8000;
const DEVICE_CONFIG_COMMAND_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function encodeBytesToBase64(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis.btoa(binary);
}

function decodeBase64ToText(value: string) {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function getCommandName(command: string) {
  return command.includes(':') ? command.split(':', 1)[0] : command;
}

function createAckWaiter() {
  let pending:
    | {
        expectedAck: string;
        reject: (error: Error) => void;
        resolve: () => void;
        timeoutId: ReturnType<typeof setTimeout>;
      }
    | null = null;

  return {
    handleMessage(message: string) {
      console.log('[BLE RX]', message);

      if (!pending) {
        return;
      }

      if (message === pending.expectedAck) {
        clearTimeout(pending.timeoutId);
        const resolve = pending.resolve;
        pending = null;
        resolve();
        return;
      }

      if (message.startsWith('ERR:')) {
        clearTimeout(pending.timeoutId);
        const reject = pending.reject;
        pending = null;
        reject(new Error(`Urządzenie odrzuciło komendę ${message.slice(4)}.`));
      }
    },
    waitFor(expectedAck: string) {
      if (pending) {
        throw new Error('Wewnętrzny błąd protokołu BLE: ACK już oczekuje.');
      }

      return new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          pending = null;
          reject(new Error(`Brak potwierdzenia ${expectedAck} z urządzenia BLE.`));
        }, DEVICE_CONFIG_ACK_TIMEOUT_MS);

        pending = {
          expectedAck,
          reject,
          resolve,
          timeoutId,
        };
      });
    },
  };
}

async function writeDeviceConfigCommand(
  device: Device,
  command: string,
  waitForAck: (expectedAck: string) => Promise<void>,
) {
  const encoder = new TextEncoder();
  let commandWithPadding = command;

  while (
    encoder.encode(commandWithPadding).length % DEVICE_CONFIG_CHUNK_SIZE !== 0
  ) {
    commandWithPadding += ' ';
  }

  const payloadBuffer = encoder.encode(commandWithPadding);
  const expectedAck = `ACK:${getCommandName(command)}`;

  console.log('[BLE TX] Command length:', payloadBuffer.length);

  for (let attempt = 1; attempt <= DEVICE_CONFIG_COMMAND_RETRIES; attempt += 1) {
    const ackPromise = waitForAck(expectedAck);

    if (attempt > 1) {
      console.log(`[BLE TX] Retrying ${getCommandName(command)} attempt=${attempt}`);
    }

    for (let offset = 0; offset < payloadBuffer.length; offset += DEVICE_CONFIG_CHUNK_SIZE) {
      const chunk = payloadBuffer.subarray(offset, offset + DEVICE_CONFIG_CHUNK_SIZE);
      const encodedChunk = encodeBytesToBase64(chunk);

      await device.writeCharacteristicWithResponseForService(
        DEVICE_CONFIG_SERVICE_UUID,
        DEVICE_CONFIG_CHARACTERISTIC_UUID,
        encodedChunk,
      );

      await sleep(250);
    }

    if (command !== 'ACCEPT') {
      const newlineChunk = encodeBytesToBase64(encoder.encode('\n'));

      console.log('[BLE TX] Sending command terminator');

      await device.writeCharacteristicWithResponseForService(
        DEVICE_CONFIG_SERVICE_UUID,
        DEVICE_CONFIG_CHARACTERISTIC_UUID,
        newlineChunk,
      );

      await sleep(350);
    }

    try {
      await ackPromise;
      return;
    } catch (error) {
      if (attempt >= DEVICE_CONFIG_COMMAND_RETRIES) {
        throw error;
      }

      await sleep(600);
    }
  }
}

async function writeDeviceConfigCommands(
  device: Device,
  config: { ssid: string; passwd: string; apiKey: string; stationId: string; serverUrl: string },
) {
  const ackWaiter = createAckWaiter();
  let isClosingAckMonitor = false;
  const ackSubscription: Subscription = device.monitorCharacteristicForService(
    DEVICE_CONFIG_SERVICE_UUID,
    DEVICE_CONFIG_ACK_CHARACTERISTIC_UUID,
    (error, characteristic) => {
      if (error) {
        if (isClosingAckMonitor) {
          return;
        }

        console.log('[BLE RX] ACK monitor error:', error);
        return;
      }

      if (!characteristic?.value) {
        return;
      }

      ackWaiter.handleMessage(decodeBase64ToText(characteristic.value));
    },
  );

  const commands = [
    `SSID:${config.ssid}`,
    `PASSWD:${config.passwd}`,
    `APIKEY:${config.apiKey}`,
    `STATIONID:${config.stationId}`,
    `SERVERURL:${config.serverUrl}`,
    'ACCEPT',
  ];

  try {
    await sleep(300);

    for (const command of commands) {
      await writeDeviceConfigCommand(device, command, ackWaiter.waitFor);
    }

    console.log('[BLE TX] Finished sending config commands');
  } finally {
    isClosingAckMonitor = true;
    ackSubscription.remove();
  }
}
export default function PairScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<PairPhase>('scanning');
  const [targetStation, setTargetStation] = useState<PairQrPayload | null>(null);
  const [bluetoothStatus, setBluetoothStatus] = useState<string>(strings.pair.bluetoothSearching);
  const [matchedDevice, setMatchedDevice] = useState<Device | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [wifiName, setWifiName] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([]);
  const [isLoadingWifiNetworks, setIsLoadingWifiNetworks] = useState(false);
  const [isConnectingWifi, setIsConnectingWifi] = useState(false);
  const [isConnectingDevice, setIsConnectingDevice] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isSavingDevice, setIsSavingDevice] = useState(false);
  const [saveDeviceError, setSaveDeviceError] = useState<string | null>(null);
  const [wifiError, setWifiError] = useState<string | null>(null);
  const [qrErrorVisible, setQrErrorVisible] = useState(false);
  const { width, height } = useWindowDimensions();
  const connectAnimation = useRef(new Animated.Value(0)).current;
  const bleManagerRef = useRef<BleManager | null>(null);
  const hasHandledScanRef = useRef(false);
  const qrErrorTranslateY = useRef(new Animated.Value(-96)).current;
  const qrErrorOpacity = useRef(new Animated.Value(0)).current;
  const qrErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPermission = permission?.granted ?? false;
  const frameSize = Math.min(width - 96, 280);

  useEffect(() => {
    bleManagerRef.current = new BleManager();

    return () => {
      bleManagerRef.current?.stopDeviceScan().catch(() => undefined);
      bleManagerRef.current?.destroy().catch(() => undefined);
      bleManagerRef.current = null;
      if (qrErrorTimeoutRef.current) {
        clearTimeout(qrErrorTimeoutRef.current);
      }
    };
  }, []);

  const showQrErrorToast = useCallback(() => {
    if (qrErrorTimeoutRef.current) {
      clearTimeout(qrErrorTimeoutRef.current);
    }

    setQrErrorVisible(true);
    qrErrorTranslateY.stopAnimation();
    qrErrorOpacity.stopAnimation();

    Animated.parallel([
      Animated.spring(qrErrorTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
        mass: 0.9,
      }),
      Animated.timing(qrErrorOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    qrErrorTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(qrErrorTranslateY, {
          toValue: -96,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(qrErrorOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setQrErrorVisible(false);
        }
      });
    }, 5000);
  }, [qrErrorOpacity, qrErrorTranslateY]);

  useEffect(() => {
    if (phase !== 'connecting') {
      connectAnimation.stopAnimation();
      connectAnimation.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(connectAnimation, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => {
      animation.stop();
      connectAnimation.stopAnimation();
      connectAnimation.setValue(0);
    };
  }, [connectAnimation, phase]);

  useEffect(() => {
    if (phase !== 'connecting') {
      setMatchedDevice(null);
      setBluetoothStatus(strings.pair.bluetoothSearching);
      hasHandledScanRef.current = false;
      return;
    }

    let isActive = true;
    let stateSubscription: { remove(): void } | null = null;
    const manager = bleManagerRef.current;

    if (!manager) {
      return;
    }

    const startBluetoothScan = async () => {
      const granted = await requestBluetoothPermissions();

      if (!granted) {
        if (isActive) {
          setBluetoothStatus(strings.pair.bluetoothDenied);
        }
        return;
      }

      stateSubscription = manager.onStateChange(async (state) => {
        if (!isActive) {
          return;
        }

        if (state !== State.PoweredOn) {
          setBluetoothStatus(strings.pair.bluetoothOff);
          return;
        }

        const expectedName = targetStation
          ? `SeedIot_${targetStation.stationId}`
          : null;

        setBluetoothStatus(
          expectedName
            ? `Szukanie stacji ${expectedName}`
            : strings.pair.bluetoothSearching,
        );
        await manager.stopDeviceScan().catch(() => undefined);
        await manager.startDeviceScan(null, null, (error, device) => {
          if (!isActive) {
            return;
          }

          if (error) {
            setBluetoothStatus(error.message);
            return;
          }

          if (!device) {
            return;
          }

          if (!expectedName) {
            return;
          }

          const deviceName = device.name || device.localName;

          if (deviceName !== expectedName) {
            return;
          }

          setMatchedDevice(device);
          setBluetoothStatus(`Znaleziono stację ${expectedName}`);
          manager.stopDeviceScan().catch(() => undefined);
        }).catch((error: Error) => {
          if (isActive) {
            setBluetoothStatus(error.message);
          }
        });
      }, true);
    };

    void startBluetoothScan();

    return () => {
      isActive = false;
      stateSubscription?.remove();
      manager.stopDeviceScan().catch(() => undefined);
    };
  }, [phase, targetStation]);

  const parseQrPayload = useCallback((rawValue: string): PairQrPayload | null => {
    try {
      const parsed = JSON.parse(rawValue) as Record<string, unknown>;

      if (
        typeof parsed.stationId === 'number' &&
        Number.isFinite(parsed.stationId) &&
        typeof parsed.creationDate === 'string'
      ) {
        return {
          stationId: parsed.stationId,
          creationDate: parsed.creationDate,
        };
      }
    } catch {
      return null;
    }

    return null;
  }, []);

  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (phase !== 'scanning' || hasHandledScanRef.current) {
      return;
    }

    const payload = parseQrPayload(result.data);
    hasHandledScanRef.current = true;

    if (!payload) {
      showQrErrorToast();
      setTimeout(() => {
        hasHandledScanRef.current = false;
      }, 1200);
      return;
    }

    setTargetStation(payload);
    setPhase('connecting');
  }, [parseQrPayload, phase, showQrErrorToast]);

  const connectToMatchedDevice = useCallback(async () => {
    if (!matchedDevice) {
      return;
    }

    setIsConnectingDevice(true);
    setConnectError(null);

    try {
      const connectedDevice = await matchedDevice.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connectedDevice);
      setDeviceName(
        targetStation ? `SeedIot_${targetStation.stationId}` : connectedDevice.name || connectedDevice.localName || '',
      );
      setPhase('wifi');
    } catch (error) {
      setConnectError(
        error instanceof Error
          ? error.message
          : 'Nie udało się połączyć z urządzeniem.',
      );
    } finally {
      setIsConnectingDevice(false);
    }
  }, [matchedDevice, targetStation]);

  const saveDevice = useCallback(async () => {
    const trimmedName = deviceName.trim();

    if (trimmedName.length < 3) {
      setSaveDeviceError('Nazwa urządzenia musi mieć co najmniej 3 znaki.');
      return;
    }

    if (!connectedDevice) {
      setSaveDeviceError('Brak połączenia z urządzeniem BLE.');
      return;
    }

    setIsSavingDevice(true);
    setSaveDeviceError(null);

    try {
      const session = await loadSession();

      if (!session) {
        throw new Error('Sesja użytkownika wygasła. Zaloguj się ponownie.');
      }

      const serverUrl = getApiBaseUrl();

      if (isLoopbackUrl(serverUrl)) {
        throw new Error(
          'EXPO_PUBLIC_API_URL musi wskazywać na adres dostępny z RPi, nie localhost.',
        );
      }

      const station = await createStation(session.tokens.accessToken, trimmedName);

      const configPayload = {
        ssid: wifiName,
        passwd: wifiPassword,
        apiKey: station.apiKey,
        stationId: station.id,
        serverUrl,
      };

      await writeDeviceConfigCommands(connectedDevice, configPayload);
      router.replace('/dashboard');
    } catch (error) {
      setSaveDeviceError(
        error instanceof Error
          ? error.message
          : 'Nie udało się zapisać urządzenia.',
      );
    } finally {
      setIsSavingDevice(false);
    }
  }, [connectedDevice, deviceName, wifiName, wifiPassword]);

  const continueFromWifi = useCallback(() => {
    if (!wifiName.trim()) {
      setWifiError('Wybierz lub wpisz nazwę sieci Wi-Fi.');
      return;
    }

    setWifiError(null);
    setPhase('wifi-password');
  }, [wifiName]);

  const continueFromWifiPassword = useCallback(async () => {
    if (!wifiPassword.trim()) {
      setWifiError('Wpisz hasło do sieci Wi-Fi.');
      return;
    }

    setIsConnectingWifi(true);
    setWifiError(null);

    try {
      const selectedNetwork = wifiNetworks.find((network) => network.SSID === wifiName);
      const isWep = selectedNetwork?.capabilities?.toUpperCase().includes('WEP') ?? false;

      await WifiManager.connectToProtectedWifiSSID({
        ssid: wifiName,
        password: wifiPassword,
        isWEP: isWep,
        isHidden: false,
        timeout: 12,
      });

      setPhase('naming');
    } catch (error) {
      setWifiError(
        error instanceof Error
          ? 'Nie udało się połączyć z tą siecią Wi-Fi. Sprawdź hasło i spróbuj ponownie.'
          : 'Nie udało się połączyć z tą siecią Wi-Fi. Sprawdź hasło i spróbuj ponownie.',
      );
    } finally {
      setIsConnectingWifi(false);
    }
  }, [wifiName, wifiNetworks, wifiPassword]);

  const loadWifiNetworks = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setWifiError('Lista sieci Wi-Fi jest dostępna tylko na Androidzie.');
      return;
    }

    setIsLoadingWifiNetworks(true);

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Brak zgody na lokalizację wymaganej do skanowania Wi-Fi.');
      }

      const results = await WifiManager.reScanAndLoadWifiList();
      const normalized = results
        .filter((network) => typeof network.SSID === 'string' && network.SSID.trim().length > 0)
        .filter(is24GhzNetwork)
        .sort((a, b) => (b.level ?? -999) - (a.level ?? -999));

      const deduplicated = normalized.filter((network, index, array) => {
        return array.findIndex((item) => item.SSID === network.SSID) === index;
      });

      setWifiNetworks(deduplicated);
    } catch (error) {
      setWifiError(
        error instanceof Error
          ? error.message
          : 'Nie udało się pobrać listy sieci Wi-Fi.',
      );
    } finally {
      setIsLoadingWifiNetworks(false);
    }
  }, []);

  useEffect(() => {
    if (phase !== 'wifi') {
      return;
    }

    void loadWifiNetworks();
  }, [loadWifiNetworks, phase]);

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />

      {hasPermission && phase === 'scanning' ? (
        <>
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
            style={StyleSheet.absoluteFillObject}
          />

          <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
            <QrOverlay frameSize={frameSize} />
          </View>

          {qrErrorVisible ? (
            <SafeAreaView
              className="absolute inset-x-0 top-0 z-20 px-4"
              pointerEvents="none"
            >
              <Animated.View
                style={{
                  opacity: qrErrorOpacity,
                  transform: [{ translateY: qrErrorTranslateY }],
                }}
                className="rounded-[22px] border border-red-300/60 bg-red-500 px-5 py-4 shadow-2xl"
              >
                <Text className="font-sora-bold text-sm tracking-[0.5px] text-white">
                  Błędny kod QR
                </Text>
              </Animated.View>
            </SafeAreaView>
          ) : null}

          <View className="absolute inset-x-0 items-center" pointerEvents="none" style={{ top: '68%' }}>
            <Text className="px-10 text-center font-sora text-sm leading-6 text-white/80">
              {strings.pair.helperText}
            </Text>
          </View>

          <SafeAreaView className="absolute inset-x-0 top-0 z-10" pointerEvents="box-none">
            <View className="px-6 pt-2">
              <Pressable
                className="h-12 w-12 items-center justify-center rounded-full bg-black/45"
                onPress={() => router.back()}
              >
                <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </SafeAreaView>
        </>
      ) : hasPermission && phase === 'connecting' ? (
        <ConnectingState
          connectError={connectError}
          isConnectingDevice={isConnectingDevice}
          matchedDevice={matchedDevice}
          onConnect={() => {
            void connectToMatchedDevice();
          }}
          progress={connectAnimation}
          targetStation={targetStation}
        />
      ) : phase === 'naming' ? (
        <NamingState
          deviceName={deviceName}
          error={saveDeviceError}
          isSaving={isSavingDevice}
          onChangeDeviceName={setDeviceName}
          onSave={() => {
            void saveDevice();
          }}
        />
      ) : phase === 'wifi' ? (
        <WifiState
          error={wifiError}
          isLoading={isLoadingWifiNetworks}
          onChangeWifiName={(value) => {
            setWifiError(null);
            setWifiName(value);
          }}
          onContinue={continueFromWifi}
          onRefresh={() => {
            setWifiError(null);
            void loadWifiNetworks();
          }}
          wifiName={wifiName}
          wifiNetworks={wifiNetworks}
        />
      ) : phase === 'wifi-password' ? (
        <WifiPasswordState
          error={wifiError}
          isConnecting={isConnectingWifi}
          onChangeWifiPassword={(value) => {
            setWifiError(null);
            setWifiPassword(value);
          }}
          onContinue={continueFromWifiPassword}
          wifiName={wifiName}
          wifiPassword={wifiPassword}
        />
      ) : (
        <View className="flex-1 items-center justify-center bg-black px-8">
          <Text className="text-center font-sora text-base leading-7 text-white/80">
            {strings.pair.permissionHint}
          </Text>
          <Pressable
            className="mt-6 rounded-full bg-white px-6 py-3"
            onPress={() => {
              void requestPermission();
            }}
          >
            <Text className="font-sora-bold text-sm text-black">
              {strings.pair.grantPermission}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function QrOverlay({
  frameSize,
}: {
  frameSize: number;
}) {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' }} />

      <View style={{ height: frameSize, width: '100%' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: '50%',
            marginRight: frameSize / 2,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            left: '50%',
            marginLeft: frameSize / 2,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            marginLeft: -(frameSize / 2),
            width: frameSize,
            height: frameSize,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.92)',
            backgroundColor: 'transparent',
          }}
        />
      </View>

      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' }} />
    </View>
  );
}

function ConnectingState({
  connectError,
  isConnectingDevice,
  matchedDevice,
  onConnect,
  progress,
  targetStation,
}: {
  connectError: string | null;
  isConnectingDevice: boolean;
  matchedDevice: Device | null;
  onConnect: () => void;
  progress: Animated.Value;
  targetStation: PairQrPayload | null;
}) {
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View className="flex-1 items-center justify-center bg-black px-8">
      <View className="w-full items-center">
        {matchedDevice ? (
          <View
            className="items-center justify-center rounded-full bg-[#1F7A45]"
            style={{
              width: 84,
              height: 84,
            }}
          >
            <MaterialCommunityIcons name="check" size={42} color="#FFFFFF" />
          </View>
        ) : (
          <Animated.View
            style={{
              width: 84,
              height: 84,
              borderRadius: 999,
              borderWidth: 4,
              borderColor: 'rgba(255,255,255,0.16)',
              borderTopColor: '#FFFFFF',
              transform: [{ rotate }],
            }}
          />
        )}

        <Text className="mt-10 text-center font-sora-bold text-[28px] leading-9 text-white">
          {matchedDevice ? 'Znaleziono urządzenie' : 'Trwa skanowanie'}
        </Text>

        {!matchedDevice ? (
          <Text className="mt-4 text-center font-sora text-base leading-7 text-white/75">
            Trwa wyszukiwanie urządzenia SeedIot
          </Text>
        ) : null}
      </View>

      {matchedDevice ? (
        <View className="mt-10 w-full rounded-[22px] border border-white/10 bg-white/6 px-5 py-4">
          <Text className="text-center font-sora text-sm leading-6 text-white/70">
            {targetStation
              ? `Urządzenie ${`SeedIot_${targetStation.stationId}`} jest gotowe do połączenia.`
              : 'Urządzenie jest gotowe do połączenia.'}
          </Text>
          {connectError ? (
            <Text className="mt-4 text-center font-sora text-sm leading-6 text-red-300">
              {connectError}
            </Text>
          ) : null}
          <Pressable
            className={`mt-5 items-center rounded-[20px] px-5 py-4 ${isConnectingDevice ? 'bg-white/60' : 'bg-white'}`}
            disabled={isConnectingDevice}
            onPress={onConnect}
          >
            <Text className="font-sora-bold text-sm text-black">
              {isConnectingDevice ? 'Łączenie...' : 'Połącz z urządzeniem'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function NamingState({
  deviceName,
  error,
  isSaving,
  onChangeDeviceName,
  onSave,
}: {
  deviceName: string;
  error: string | null;
  isSaving: boolean;
  onChangeDeviceName: (value: string) => void;
  onSave: () => void;
}) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-black px-6">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        className="flex-1"
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-start',
            paddingTop: 24,
            paddingBottom: keyboardVisible ? 24 : 24,
          }}
        >
          <FlowProgress currentStep={3} totalSteps={3} />

          <View className={`${keyboardVisible ? 'mt-4' : 'mt-24'} rounded-[28px] border border-white/10 bg-white/6 px-5 py-6`}>
            <Text className="text-center font-sora-bold text-[28px] leading-9 text-white">
              Nazwij urządzenie
            </Text>

            <Text className="mt-4 text-center font-sora text-base leading-7 text-white/75">
              Wpisz nazwę, pod którą chcesz zapisać to urządzenie.
            </Text>

            <View className="mt-8">
              <Text className="mb-3 font-sora text-sm text-white/60">
                Nazwa urządzenia
              </Text>
              <View className="rounded-[20px] border border-white/10 bg-white px-4 py-1">
                <TextInput
                  value={deviceName}
                  onChangeText={onChangeDeviceName}
                  placeholder="Np. Szklarnia Północ"
                  placeholderTextColor="rgba(36, 36, 36, 0.42)"
                  className="font-sora text-base text-black"
                />
              </View>
            </View>

            {error ? (
              <Text className="mt-4 text-center font-sora text-sm leading-6 text-red-300">
                {error}
              </Text>
            ) : null}

            <Pressable
              className={`mt-6 items-center rounded-[20px] px-5 py-4 ${isSaving ? 'bg-white/60' : 'bg-white'}`}
              disabled={isSaving}
              onPress={onSave}
            >
              {isSaving ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text className="font-sora-bold text-sm text-black">
                  Zapisz urządzenie
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function WifiState({
  error,
  isLoading,
  onChangeWifiName,
  onContinue,
  onRefresh,
  wifiName,
  wifiNetworks,
}: {
  error: string | null;
  isLoading: boolean;
  onChangeWifiName: (value: string) => void;
  onContinue: () => void;
  onRefresh: () => void;
  wifiName: string;
  wifiNetworks: WifiNetwork[];
}) {
  const isContinueDisabled = !wifiName.trim();

  return (
    <SafeAreaView className="flex-1 bg-black px-6">
      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', paddingVertical: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
          />
        }
        >
          <FlowProgress currentStep={1} totalSteps={3} />

        <View className="mt-24 rounded-[28px] border border-white/10 bg-white/6 px-5 py-6">
          <Text className="text-center font-sora-bold text-[28px] leading-9 text-white">
            Wybierz sieć Wi-Fi
          </Text>
          <Text className="mt-4 text-center font-sora text-base leading-7 text-white/75">
            Wybierz sieć Wi-Fi wykrytą na telefonie.
          </Text>

          <View className="mt-8 gap-3">
            {isLoading ? (
              <View className="items-center rounded-[20px] border border-white/10 bg-white/6 px-4 py-5">
                <ActivityIndicator color="#FFFFFF" />
                <Text className="mt-3 text-center font-sora text-sm text-white/70">
                  Pobieranie listy sieci Wi-Fi...
                </Text>
              </View>
            ) : wifiNetworks.length > 0 ? (
              wifiNetworks.slice(0, 8).map((network) => {
                const isSelected = wifiName === network.SSID;
                const wifiIcon = getWifiStrengthIcon(network.level);

                return (
                  <Pressable
                    key={network.BSSID || network.SSID}
                    className={`rounded-[20px] border px-4 py-4 ${isSelected ? 'border-white bg-white' : 'border-white/10 bg-white/6'}`}
                    onPress={() => onChangeWifiName(network.SSID)}
                  >
                    <View className="flex-row items-center gap-3">
                      <MaterialCommunityIcons
                        name={wifiIcon}
                        size={22}
                        color={isSelected ? '#000000' : '#FFFFFF'}
                      />
                      <View className="flex-1">
                        <Text
                          className={`font-sora-bold text-sm ${isSelected ? 'text-black' : 'text-white'}`}
                        >
                          {network.SSID}
                        </Text>
                        <Text
                          className={`mt-1 font-sora text-xs ${isSelected ? 'text-black/65' : 'text-white/55'}`}
                        >
                          Sieć Wi-Fi w pobliżu
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View className="rounded-[20px] border border-white/10 bg-white/6 px-4 py-5">
                <Text className="text-center font-sora text-sm leading-6 text-white/70">
                  Nie udało się wykryć sieci. Odśwież listę i spróbuj ponownie.
                </Text>
              </View>
            )}
          </View>

          {error ? (
            <Text className="mt-4 text-center font-sora text-sm leading-6 text-red-300">
              {error}
            </Text>
          ) : null}

          <Pressable
            className={`mt-6 items-center rounded-[20px] px-5 py-4 ${isContinueDisabled ? 'bg-white/40' : 'bg-white'}`}
            disabled={isContinueDisabled}
            onPress={onContinue}
          >
            <Text className="font-sora-bold text-sm text-black">
              Dalej
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function WifiPasswordState({
  error,
  isConnecting,
  onChangeWifiPassword,
  onContinue,
  wifiName,
  wifiPassword,
}: {
  error: string | null;
  isConnecting: boolean;
  onChangeWifiPassword: (value: string) => void;
  onContinue: () => void;
  wifiName: string;
  wifiPassword: string;
}) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-black px-6">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        className="flex-1"
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-start',
            paddingTop: 24,
            paddingBottom: 24,
          }}
        >
          <FlowProgress currentStep={2} totalSteps={3} />

          <View className={`${keyboardVisible ? 'mt-4' : 'mt-24'} rounded-[28px] border border-white/10 bg-white/6 px-5 py-6`}>
            <Text className="text-center font-sora-bold text-[28px] leading-9 text-white">
              Wpisz hasło Wi-Fi
            </Text>
            <Text className="mt-4 text-center font-sora text-base leading-7 text-white/75">
              Wybrana sieć: {wifiName}
            </Text>

            <View className="mt-8">
              <Text className="mb-3 font-sora text-sm text-white/60">
                Hasło do sieci
              </Text>
              <View className="rounded-[20px] border border-white/10 bg-white px-4 py-1">
                <TextInput
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect={false}
                  importantForAutofill="no"
                  textContentType="none"
                  value={wifiPassword}
                  onChangeText={onChangeWifiPassword}
                  placeholder="Wpisz hasło"
                  placeholderTextColor="rgba(36, 36, 36, 0.42)"
                  secureTextEntry
                  className="font-sora text-base text-black"
                />
              </View>
            </View>

            {error ? (
              <Text className="mt-4 text-center font-sora text-sm leading-6 text-red-300">
                {error}
              </Text>
            ) : null}

            <Pressable
              className={`mt-6 items-center rounded-[20px] px-5 py-4 ${isConnecting ? 'bg-white/60' : 'bg-white'}`}
              disabled={isConnecting}
              onPress={onContinue}
            >
              {isConnecting ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text className="font-sora-bold text-sm text-black">
                  Dalej
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FlowProgress({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <View className="mb-6 flex-row gap-2">
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber <= currentStep;

        return (
          <View
            key={stepNumber}
            className={`h-1.5 flex-1 rounded-full ${isActive ? 'bg-white' : 'bg-white/15'}`}
          />
        );
      })}
    </View>
  );
}

async function requestBluetoothPermissions() {
  if (Platform.OS !== 'android') {
    return true;
  }

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const location = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );

  return location === PermissionsAndroid.RESULTS.GRANTED;
}
