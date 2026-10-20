import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/constants/strings';
import { getMe, login, register, type AuthProfile, type AuthTokens } from '@/lib/auth-api';
import {
  evaluatePasswordStrength,
  isAcceptedRegisterPassword,
} from '@/lib/password-strength';
import { loadSession, saveSession } from '@/lib/session';

type ScreenMode = 'landing' | 'auth';
type AuthMode = 'login' | 'register' | null;

export default function OnboardScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [screenMode, setScreenMode] = useState<ScreenMode>('landing');
  const [sliderWidth, setSliderWidth] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authTokens, setAuthTokens] = useState<AuthTokens | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const translateX = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(420)).current;
  const dragOffset = useRef(0);

  const isCompact = width < 390;
  const sliderHeight = isCompact ? 68 : 76;
  const sliderPadding = isCompact ? 8 : 10;
  const thumbSize = sliderHeight - sliderPadding * 2;
  const maxTranslate = Math.max(0, sliderWidth - thumbSize - sliderPadding * 2);
  const isRegister = authMode === 'register';
  const [keyboardInset, setKeyboardInset] = useState(0);
  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);

  const textOpacity = translateX.interpolate({
    inputRange: [0, Math.max(maxTranslate * 0.35, 1), Math.max(maxTranslate * 0.75, 1)],
    outputRange: [1, 0.45, 0],
    extrapolate: 'clamp',
  });

  const sheetOverlayOpacity = useMemo(
    () =>
      sheetTranslateY.interpolate({
        inputRange: [0, 420],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [sheetTranslateY],
  );

  const animateTo = useCallback(
    (value: number, onComplete?: () => void) => {
      dragOffset.current = value;
      Animated.spring(translateX, {
        toValue: value,
        useNativeDriver: true,
        bounciness: 6,
        speed: 16,
      }).start(({ finished }) => {
        if (finished) {
          onComplete?.();
        }
      });
    },
    [translateX],
  );

  const openAuthScreen = useCallback(() => {
    setIsCompleting(true);
    animateTo(maxTranslate, () => {
      Animated.timing(screenFade, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          return;
        }

        setScreenMode('auth');
        dragOffset.current = 0;
        translateX.setValue(0);
        setIsCompleting(false);

        Animated.timing(screenFade, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }).start();
      });
    });
  }, [animateTo, maxTranslate, screenFade, translateX]);

  const navigateToDashboard = useCallback(() => {
    Animated.timing(screenFade, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        router.replace('/dashboard');
      }
    });
  }, [screenFade]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          screenMode === 'landing' && !isCompleting && Math.abs(gestureState.dx) > 4,
        onPanResponderMove: (_, gestureState) => {
          if (isCompleting || screenMode !== 'landing') {
            return;
          }

          const nextValue = Math.min(
            maxTranslate,
            Math.max(0, dragOffset.current + gestureState.dx),
          );
          translateX.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (isCompleting || screenMode !== 'landing') {
            return;
          }

          const nextValue = Math.min(
            maxTranslate,
            Math.max(0, dragOffset.current + gestureState.dx),
          );
          const shouldComplete = nextValue > maxTranslate * 0.6;

          if (shouldComplete) {
            openAuthScreen();
            return;
          }

          animateTo(0);
        },
        onPanResponderTerminate: () => {
          if (!isCompleting && screenMode === 'landing') {
            animateTo(0);
          }
        },
      }),
    [animateTo, isCompleting, maxTranslate, openAuthScreen, screenMode, translateX],
  );

  const openSheet = useCallback(
    (nextMode: Exclude<AuthMode, null>) => {
      setAuthError(null);
      setAuthMode(nextMode);
      sheetTranslateY.stopAnimation();
      sheetTranslateY.setValue(420);
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 180,
        mass: 0.9,
      }).start();
    },
    [sheetTranslateY],
  );

  const closeSheet = useCallback(() => {
    Animated.timing(sheetTranslateY, {
      toValue: 420,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setAuthMode(null);
      }
    });
  }, [sheetTranslateY]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates.height);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const session = await loadSession();

        if (session && isActive) {
          router.replace('/dashboard');
          return;
        }
      } finally {
        if (isActive) {
          setIsBootstrapping(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const submitAuth = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.includes('@') || password.trim().length < 8 || !authMode) {
      setAuthError(strings.auth.validation);
      return;
    }

    if (authMode === 'register' && !isAcceptedRegisterPassword(password)) {
      setAuthError(strings.auth.passwordValidation);
      return;
    }

    setIsSubmitting(true);
    setAuthError(null);

    try {
      const tokens =
        authMode === 'register'
          ? await register({ email: normalizedEmail, password })
          : await login({ email: normalizedEmail, password });

      const me = await getMe(tokens.accessToken);

      setAuthTokens(tokens);
      setProfile(me);
      await saveSession({
        profile: me,
        tokens,
      });
      closeSheet();
      navigateToDashboard();
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Nie udało się połączyć z serwerem Seediot.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [authMode, closeSheet, email, navigateToDashboard, password]);

  if (isBootstrapping) {
    return (
      <SafeAreaView className="flex-1 bg-seediot-cream">
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <StatusBar style="dark" />

      {screenMode === 'landing' ? (
        <LandingView
          insetsBottom={Math.max(insets.bottom, 20)}
          isCompact={isCompact}
          isCompleting={isCompleting}
          maxTranslate={maxTranslate}
          panHandlers={panResponder.panHandlers}
          screenFade={screenFade}
          setSliderWidth={setSliderWidth}
          sliderHeight={sliderHeight}
          sliderPadding={sliderPadding}
          textOpacity={textOpacity}
          thumbSize={thumbSize}
          translateX={translateX}
          width={width}
        />
      ) : (
        <AuthView
          authMode={authMode}
          authError={authError}
          authTokens={authTokens}
          closeSheet={closeSheet}
          email={email}
          insetsBottom={Math.max(insets.bottom, 20)}
          isSubmitting={isSubmitting}
          isRegister={isRegister}
          keyboardInset={keyboardInset}
          openSheet={openSheet}
          overlayOpacity={sheetOverlayOpacity}
          password={password}
          passwordStrength={passwordStrength}
          profile={profile}
          setEmail={setEmail}
          setPassword={setPassword}
          sheetTranslateY={sheetTranslateY}
          submitAuth={submitAuth}
        />
      )}

      <Animated.View
        pointerEvents="none"
        className="absolute inset-0 bg-white"
        style={{
          opacity: screenFade,
        }}
      />
    </SafeAreaView>
  );
}

function LandingView({
  insetsBottom,
  isCompact,
  isCompleting,
  panHandlers,
  screenFade,
  setSliderWidth,
  sliderHeight,
  sliderPadding,
  textOpacity,
  thumbSize,
  translateX,
  width,
}: {
  insetsBottom: number;
  isCompact: boolean;
  isCompleting: boolean;
  maxTranslate: number;
  panHandlers: ReturnType<PanResponder['create']>['panHandlers'];
  screenFade: Animated.Value;
  setSliderWidth: (value: number) => void;
  sliderHeight: number;
  sliderPadding: number;
  textOpacity: Animated.AnimatedInterpolation<number>;
  thumbSize: number;
  translateX: Animated.Value;
  width: number;
}) {
  return (
    <ImageBackground
      source={require('@/assets/images/bg/farm.jpg')}
      resizeMode="cover"
      className="flex-1"
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.92)', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,1)']}
        locations={[0, 0.42, 1]}
        className="flex-1"
      >
        <View className="flex-1 px-5 py-5">
          <Text className="mb-2 mt-5 text-center font-sora-bold text-3xl tracking-[1px] text-green-900">
            Seed<Text className="text-black">Iot</Text>
          </Text>

          <Text className="text-center font-sora text-sm tracking-[1px] text-black/80">
            {strings.home.brandSubtitle}
          </Text>

          <View className="flex-1" />

          <View className="items-center pb-5" style={{ paddingBottom: insetsBottom }}>
            <Text
              className={`mb-[5px] w-full max-w-[520px] text-center font-sora tracking-tighter text-white ${isCompact ? 'text-[34px] leading-[38px]' : 'text-[42px] leading-[48px]'}`}
              style={styles.headline}
            >
              {strings.home.headline}
            </Text>

            <Text
              className={`mb-10 w-full max-w-[520px] text-center font-sora text-white/90 ${isCompact ? 'text-sm leading-[18px]' : 'text-base leading-[22px]'}`}
            >
              {strings.home.subheadline}
            </Text>

            <View
              className="w-full max-w-[520px] flex-row items-center overflow-hidden border border-white/20 bg-white/15"
              style={{
                height: sliderHeight,
                borderRadius: sliderHeight / 2,
                paddingHorizontal: sliderPadding,
              }}
              onLayout={(event) => {
                setSliderWidth(event.nativeEvent.layout.width);
              }}
            >
              <Animated.View
                className="z-10 items-center justify-center rounded-full bg-seediot-lime"
                style={{
                  width: thumbSize,
                  height: thumbSize,
                  marginRight: 12,
                  transform: [{ translateX }],
                }}
                {...(!isCompleting ? panHandlers : {})}
              >
                <MaterialCommunityIcons
                  name="sprout"
                  size={thumbSize * 0.42}
                  color="#24411F"
                />
              </Animated.View>

              <Animated.Text
                className={`flex-1 font-sora-bold text-white ${isCompact ? 'text-lg' : 'text-[20px]'}`}
                style={{ opacity: textOpacity }}
              >
                {strings.home.start}
              </Animated.Text>

              <View
                className="items-center justify-center"
                style={{ width: width < 390 ? 36 : 44 }}
              >
                <MaterialCommunityIcons
                  name="chevron-triple-right"
                  size={width < 390 ? 20 : 22}
                  color="rgba(255,255,255,0.72)"
                />
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

function AuthView({
  authMode,
  authError,
  authTokens,
  closeSheet,
  email,
  insetsBottom,
  isSubmitting,
  isRegister,
  keyboardInset,
  openSheet,
  overlayOpacity,
  password,
  passwordStrength,
  profile,
  setEmail,
  setPassword,
  sheetTranslateY,
  submitAuth,
}: {
  authMode: AuthMode;
  authError: string | null;
  authTokens: AuthTokens | null;
  closeSheet: () => void;
  email: string;
  insetsBottom: number;
  isSubmitting: boolean;
  isRegister: boolean;
  keyboardInset: number;
  openSheet: (mode: Exclude<AuthMode, null>) => void;
  overlayOpacity: Animated.AnimatedInterpolation<number>;
  password: string;
  passwordStrength: ReturnType<typeof evaluatePasswordStrength>;
  profile: AuthProfile | null;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  sheetTranslateY: Animated.Value;
  submitAuth: () => Promise<void>;
}) {
  return (
    <>
      <LinearGradient
        colors={['#FCFCF8', '#EEF2E3', '#E2EAD0']}
        locations={[0, 0.45, 1]}
        className="flex-1 px-6 pb-8 pt-6"
      >
        <View className="flex-1 justify-between">
          <View className="items-center pt-10">
            <Text className="font-sora text-xs uppercase tracking-[3px] text-seediot-moss">
              SeedIot
            </Text>

            <Text className="mt-4 text-center font-sora-bold text-[34px] leading-[40px] text-seediot-forest-dark">
              {strings.auth.headline}
            </Text>

            <Text className="mt-4 max-w-[320px] text-center font-sora text-base leading-6 text-seediot-moss-soft">
              {strings.auth.subheadline}
            </Text>

            {profile ? (
              <View className="mt-6 w-full max-w-[320px] rounded-[24px] border border-seediot-forest/10 bg-white/80 px-5 py-4">
                <Text className="font-sora text-xs uppercase tracking-[2px] text-seediot-moss">
                  {strings.auth.connected}
                </Text>
                <Text className="mt-2 font-sora-bold text-base text-seediot-forest-dark">
                  {profile.email}
                </Text>
                <Text className="mt-2 font-sora text-sm leading-5 text-seediot-moss-soft">
                  {strings.auth.ready}
                </Text>
                <Text className="mt-3 font-sora text-xs text-seediot-moss-soft">
                  token: {authTokens?.accessToken.slice(0, 18)}...
                </Text>
              </View>
            ) : null}
          </View>

          <View className="flex-1 items-center justify-center">
            <Image
              source={require('@/assets/images/farmer/farmer-login.png')}
              contentFit="contain"
              style={{
                width: 220,
                height: 220,
              }}
            />
          </View>

          <View className="gap-4">
            <Pressable
              className="items-center rounded-[28px] bg-seediot-forest px-6 py-5"
              onPress={() => openSheet('register')}
            >
              <Text className="font-sora-bold text-base text-white">
                {strings.auth.register}
              </Text>
            </Pressable>

            <Pressable
              className="items-center rounded-[28px] border border-seediot-forest/15 bg-white/80 px-6 py-5"
              onPress={() => openSheet('login')}
            >
              <Text className="font-sora-bold text-base text-seediot-forest">
                {strings.auth.login}
              </Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {authMode ? (
        <View
          className="absolute inset-0 justify-end"
        >
          <Animated.View
            pointerEvents="none"
            className="absolute inset-0 bg-[#213019]"
            style={{ opacity: overlayOpacity }}
          />

          <Pressable className="absolute inset-0" onPress={closeSheet} />

          <Animated.View
            className="rounded-t-[32px] bg-white px-6 pt-4"
            style={{
              paddingBottom: insetsBottom + 12,
              marginBottom: keyboardInset,
              transform: [{ translateY: sheetTranslateY }],
            }}
          >
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <View className="items-center">
                <View className="h-1.5 w-14 rounded-full bg-seediot-cream-deep" />
              </View>

              <View className="mt-6">
                <Text className="font-sora-bold text-[28px] leading-[32px] text-seediot-forest-dark">
                  {isRegister ? strings.auth.registerTitle : strings.auth.loginTitle}
                </Text>

                <Text className="mt-3 font-sora text-[15px] leading-6 text-seediot-moss-soft">
                  {isRegister
                    ? strings.auth.registerDescription
                    : strings.auth.loginDescription}
                </Text>
              </View>

              <View className="mt-8 gap-4">
                <Field
                  label={strings.auth.email}
                  placeholder="twoj@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Field
                  label={strings.auth.password}
                  placeholder="••••••••"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />

                {isRegister ? <PasswordStrengthBar strength={passwordStrength} /> : null}
              </View>

              {authError ? (
                <Text className="mt-5 font-sora text-sm leading-5 text-red-500">
                  {authError}
                </Text>
              ) : null}

              <View className="mt-8 gap-3">
                <Pressable
                  className="items-center rounded-[26px] bg-seediot-forest px-6 py-4"
                  onPress={() => {
                    void submitAuth();
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="font-sora-bold text-base text-white">
                      {strings.auth.continue}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  className="items-center rounded-[26px] border border-seediot-forest/10 px-6 py-4"
                  onPress={closeSheet}
                >
                  <Text className="font-sora text-base text-seediot-moss-soft">
                    {strings.auth.close}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      ) : null}
    </>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  autoCapitalize,
  autoCorrect,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: 'default' | 'email-address';
}) {
  return (
    <View className="gap-2">
      <Text className="font-sora text-sm text-seediot-moss">{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(93, 108, 78, 0.58)"
        secureTextEntry={secureTextEntry}
        value={value}
        className="rounded-[22px] border border-seediot-forest/10 bg-seediot-cream-light px-5 py-4 font-sora text-base text-seediot-forest-dark"
      />
    </View>
  );
}

function PasswordStrengthBar({
  strength,
}: {
  strength: ReturnType<typeof evaluatePasswordStrength>;
}) {
  const label =
    strength.strength === 'strong'
      ? strings.auth.strong
      : strength.strength === 'medium'
        ? strings.auth.medium
        : strings.auth.weak;

  const activeColor =
    strength.strength === 'strong'
      ? '#2F4A24'
      : strength.strength === 'medium'
        ? '#A2B86C'
        : '#D77A61';

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {[0, 1, 2].map((segment) => (
          <View
            key={segment}
            className="h-2 flex-1 rounded-full bg-seediot-cream-deep"
            style={{
              backgroundColor: segment < strength.score ? activeColor : '#E2EAD0',
            }}
          />
        ))}
      </View>
      <Text className="font-sora text-sm text-seediot-moss-soft">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 14,
  },
});
