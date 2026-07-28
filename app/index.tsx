import { Redirect } from 'expo-router';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { onAuthChanged } from '@/src/firebase/auth';
import { getUserProfile } from '@/src/firebase/userProfile';
import { usePlayerStore } from '@/src/store/playerStore';

type Destination = '/(auth)/login' | '/(menu)/home' | '/(auth)/username' | null;

export default function SplashScreen() {
  const [dest, setDest] = useState<Destination>(null);
  const setFirebaseUser = usePlayerStore((s) => s.setFirebaseUser);

  // Always portrait on splash/menu screens
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  useEffect(() => {
    // Wait for Firebase to restore persisted auth state
    const unsub = onAuthChanged(async (user) => {
      if (!user) {
        // No session → go to login
        setDest('/(auth)/login');
        return;
      }

      // Firebase has a session — check for profile
      // null  = document definitely doesn't exist (new user → needs username)
      // undefined = fetch failed (offline / permissions) → assume profile exists
      let profileResult: Awaited<ReturnType<typeof getUserProfile>> | undefined;
      let displayName = user.displayName ?? 'Racer';
      let coins       = 0;
      let selectedCharacterId: string | undefined;
      let unlockedCharacterIds: string[] | undefined;
      try {
        profileResult = await getUserProfile(user.uid);
        if (profileResult) {
          displayName = profileResult.displayName;
          coins = profileResult.coins ?? 0;
          selectedCharacterId = profileResult.selectedCharacterId;
          unlockedCharacterIds = profileResult.unlockedCharacterIds;
        }
      } catch {
        // Network / permissions error — we cannot confirm either way.
        // Treat as "has profile" so returning users are NOT sent to username screen.
        profileResult = undefined;
      }

      // profileResult === null  → document confirmed missing → new user
      // profileResult === undefined → fetch failed (offline) → assume returning user
      const hasUsername = profileResult === null ? false : (profileResult?.username ? true : false) || profileResult === undefined;

      setFirebaseUser({
        uid: user.uid, displayName, isAnonymous: user.isAnonymous, hasUsername,
        coins, selectedCharacterId, unlockedCharacterIds,
      });

      if (!hasUsername) {
        setDest('/(auth)/username');
      } else {
        setDest('/(menu)/home');  // ← already signed in: skip login/username screens
      }

      unsub(); // only need first auth event
    });

    // Timeout fallback — if Firebase takes too long, go to login
    const timeout = setTimeout(() => setDest('/(auth)/login'), 8000);

    return () => { unsub(); clearTimeout(timeout); };
  }, [setFirebaseUser]);

  if (!dest) {
    return (
      <View style={styles.container}>
        <Image 
          source={require('../assets/images/splash-icon.png')}
          style={styles.splashImage}
          contentFit="contain"
        />
        <ActivityIndicator color="#fff" size="large" style={styles.loader} />
      </View>
    );
  }

  return <Redirect href={dest} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1D3F75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashImage: {
    width: '80%',
    height: '60%',
  },
  loader: {
    position: 'absolute',
    bottom: 50,
  }
});
