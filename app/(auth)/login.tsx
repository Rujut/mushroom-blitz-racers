/**
 * app/(auth)/login.tsx
 *
 * Sign-in screen — Guest / Google.
 * Apple sign in removed.
 */
import { useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { withRepeat, withTiming, withSequence, useSharedValue } from 'react-native-reanimated';
import { GameButton } from '@/src/components/ui/GameButton';
import { GameColors } from '@/src/constants/theme';
import { isFirebaseConfigured } from '@/src/firebase/config';
import { signInAsGuest, signInWithGoogle } from '@/src/firebase/auth';
import { getUserProfile } from '@/src/firebase/userProfile';
import { usePlayerStore } from '@/src/store/playerStore';

export default function LoginScreen() {
  const [loading, setLoading] = useState<'guest' | 'google' | null>(null);
  const [error,   setError]   = useState('');
  const setFirebaseUser = usePlayerStore((s) => s.setFirebaseUser);

  /** Guest sign-in → always ask for a username first */
  const handleGuest = async () => {
    setError('');
    setLoading('guest');
    try {
      if (isFirebaseConfigured) {
        const user = await signInAsGuest();
        if (user) {
          try {
            const profile = await getUserProfile(user.uid);
            if (profile) {
              setFirebaseUser({
                uid: user.uid,
                displayName: profile.displayName,
                isAnonymous: true,
                hasUsername: true,
                coins: profile.coins ?? 0,
                selectedCharacterId: profile.selectedCharacterId,
                unlockedCharacterIds: profile.unlockedCharacterIds,
              });
              router.replace('/(menu)/home');
              return;
            }
          } catch { /* offline or no profile */ }

          setFirebaseUser({ uid: user.uid, displayName: 'Racer', isAnonymous: true, hasUsername: false });
        }
      }
      // Need a racing name
      router.replace('/(auth)/username');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to sign in. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  /** Google sign-in → navigate immediately */
  const handleGoogle = async () => {
    setError('');
    setLoading('google');
    try {
      const user = await signInWithGoogle();
      if (!user) return;

      // Check if profile already exists
      let hasUsername = false;
      let displayName = user.displayName ?? 'Racer';
      let coins       = 0;
      let selectedCharacterId: string | undefined;
      let unlockedCharacterIds: string[] | undefined;
      try {
        const profile = await getUserProfile(user.uid);
        if (profile) {
          hasUsername = true;
          displayName = profile.displayName;
          coins = profile.coins ?? 0;
          selectedCharacterId = profile.selectedCharacterId;
          unlockedCharacterIds = profile.unlockedCharacterIds;
        }
      } catch { /* offline — treat as new user */ }

      setFirebaseUser({
        uid: user.uid, displayName, isAnonymous: false, hasUsername,
        coins, selectedCharacterId, unlockedCharacterIds,
      });

      if (hasUsername) {
        router.replace('/(menu)/home');
      } else {
        router.replace('/(auth)/username');
      }
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED' && e?.message !== 'The user canceled the sign-in flow.') {
        setError(e?.message ?? 'Google Sign-In failed.');
      }
    } finally {
      setLoading(null);
    }
  };

  const busy = loading !== null;
  const insets = useSafeAreaInsets();
  
  const heartScale = useSharedValue(1);
  useEffect(() => {
    heartScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 400 }),
        withTiming(1, { duration: 400 })
      ),
      -1,
      true
    );
  }, []);

  return (
    <View style={styles.background}>
      <Image
        source={require('../../assets/vecteezy_deep-forest-scene-with-trees-cartoon-background-vector_9577135.webp')}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={0}
      />
      <View style={styles.overlay}>
        <View style={styles.contentContainer}>
          {/* Title Area */}
          <View style={styles.header}>
            <Text style={styles.title}>Mighty Dash</Text>
            <Text style={styles.titleShadow}>Mighty Dash</Text>
            <Text style={styles.subtitle}>Sign in to save progress</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            {/* Guest button */}
            <GameButton
              label={loading === 'guest' ? 'Signing in...' : 'Play as Guest'}
              icon={loading === 'guest' ? null : <MaterialCommunityIcons name="account-outline" size={20} color="#fff" />}
              onPress={handleGuest}
              disabled={busy}
              style={styles.btn}
            />

            <View style={styles.divider}>
              <View style={styles.line} /><Text style={styles.divText}>or</Text><View style={styles.line} />
            </View>

            {/* Google */}
            <GameButton
              label={loading === 'google' ? 'Signing in...' : 'Google Sign-In'}
              icon={loading === 'google' ? null : <MaterialCommunityIcons name="google" size={20} color="#fff" />}
              variant="secondary"
              onPress={handleGoogle}
              disabled={busy || !isFirebaseConfigured}
              style={styles.btn}
            />

            {/* Error */}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Loading spinner */}
            {busy && <ActivityIndicator color={GameColors.gold} style={{ marginTop: 12 }} size="large" />}
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <Text style={styles.footerText}>Made with </Text>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <MaterialCommunityIcons name="heart" size={16} color="#ff4444" />
          </Animated.View>
          <Text style={styles.footerText}> for MD</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dark overlay to make text pop
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    zIndex: 2,
  },
  titleShadow: {
    fontSize: 42,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#f0f0f0',
    marginTop: 8,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  btn: { marginBottom: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  divText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 'bold' },
  error: { color: '#ff4444', fontSize: 14, textAlign: 'center', marginTop: 12, fontWeight: 'bold', textShadowColor: '#000', textShadowRadius: 2 },
  footer: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  footerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
});
