/**
 * app/(auth)/username.tsx
 *
 * Username setup screen — shown once after first Google/Guest sign-in.
 * Validates username (3-16 chars, a-z0-9_), checks uniqueness in Firestore,
 * then saves profile and redirects to home.
 */
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, ScrollView,
  Platform, StyleSheet, Text, TextInput, View, Pressable, Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { GameButton } from '@/src/components/ui/GameButton';
import { GameColors } from '@/src/constants/theme';
import { usePlayerStore } from '@/src/store/playerStore';
import { saveUserProfile, isUsernameTaken } from '@/src/firebase/userProfile';
import { signOutUser } from '@/src/firebase/auth';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,16}$/;

export default function UsernameScreen() {
  const uid            = usePlayerStore((s) => s.uid);
  const isAnonymous    = usePlayerStore((s) => s.isAnonymous);
  const setDisplayName = usePlayerStore((s) => s.setDisplayName);
  const setFirebaseUser= usePlayerStore((s) => s.setFirebaseUser);

  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);

  const validate = (val: string): string => {
    if (val.length < 3)  return 'At least 3 characters required';
    if (val.length > 16) return 'Maximum 16 characters';
    if (!USERNAME_REGEX.test(val)) return 'Only letters, numbers and underscores allowed';
    return '';
  };

  const handleSubmit = async () => {
    const valError = validate(username.trim());
    if (valError) { setError(valError); return; }

    setChecking(true); setError('');
    try {
      const taken = await isUsernameTaken(username.trim());
      if (taken) { setError('This username is already taken. Try another!'); setChecking(false); return; }

      await saveUserProfile(uid, username.trim(), username.trim(), isAnonymous);

      setDisplayName(username.trim());
      // Mark profile complete in store — preserve existing coins/character state
      const currentState = usePlayerStore.getState();
      setFirebaseUser({
        uid,
        displayName: username.trim(),
        isAnonymous,
        hasUsername: true,
        coins: currentState.coins,
        selectedCharacterId: currentState.selectedCharacterId,
        unlockedCharacterIds: currentState.unlockedCharacterIds,
      });
      setSuccess(true);

      setTimeout(() => router.replace('/(menu)/home'), 600);
    } catch (e: any) {
      setError(e?.message ?? 'Could not save username. Please try again.');
      setChecking(false);
    }
  };

  const handleBack = async () => {
    // If they back out of choosing a name, sign them out so they don't get stuck in a half-logged-in state
    try {
      await signOutUser();
      setFirebaseUser(null);
    } catch { /* ignore */ }
    router.replace('/(auth)/login');
  };

  const live = validate(username.trim());
  const isValid = username.trim().length >= 3 && !live;

  return (
    <View style={styles.background}>
      <Image
        source={require('../../assets/vecteezy_deep-forest-scene-with-trees-cartoon-background-vector_9577135.webp')}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={0}
      />
      <View style={styles.overlay}>
        {/* Back Button */}
        <Pressable style={styles.backBtn} onPress={handleBack}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
        </Pressable>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={styles.kav}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.contentContainer}>
            {/* Title Area */}
            <View style={styles.header}>
              <Text style={styles.title}>Choose Name</Text>
              <Text style={styles.titleShadow}>Choose Name</Text>
              <Text style={styles.subtitle}>Pick a unique racing tag</Text>
            </View>

            <View style={styles.card}>
              {/* Preview */}
              <View style={styles.preview}>
                <Text style={styles.previewLabel}>Your tag will appear as:</Text>
                <Text style={styles.previewName}>
                  {username.trim() || 'Racer'}
                </Text>
              </View>

              {/* Input */}
              <TextInput
                style={[styles.input, error ? styles.inputError : isValid ? styles.inputOk : null]}
                placeholder="e.g. BlitzRacer_99"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={username}
                onChangeText={(t) => { setUsername(t); setError(''); }}
                maxLength={16}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              {/* Char counter */}
              <Text style={styles.counter}>{username.length}/16</Text>

              {/* Rules */}
              <Text style={styles.rules}>
                3–16 characters · Letters, numbers, underscores
              </Text>

              {/* Error */}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* Submit */}
              <GameButton
                label={checking ? 'Checking...' : success ? 'Saved!' : 'Set Username'}
                icon={
                  checking ? null :
                  success ? <MaterialCommunityIcons name="check-circle" size={20} color="#fff" /> :
                  <MaterialCommunityIcons name="rocket-launch" size={20} color="#fff" />
                }
                onPress={handleSubmit}
                disabled={checking || success || !isValid}
                style={styles.btn}
              />

              {checking && <ActivityIndicator color={GameColors.gold} style={{ marginTop: 16 }} size="large" />}
            </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 50, // safe area padding
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 10,
  },
  kav: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
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
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    zIndex: 2,
  },
  titleShadow: {
    fontSize: 36,
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
  preview: {
    alignItems: 'center', marginBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  previewLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 6 },
  previewName:  { color: GameColors.gold, fontSize: 26, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 4 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
    textAlign: 'center',
  },
  inputError: { borderColor: '#ff4444' },
  inputOk:    { borderColor: '#44aa66' },
  counter: { color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'right', marginBottom: 8 },
  rules:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginBottom: 16, fontWeight: 'bold' },
  error:   { color: '#ff4444', fontSize: 14, textAlign: 'center', marginBottom: 12, fontWeight: 'bold', textShadowColor: '#000', textShadowRadius: 2 },
  btn:     { marginTop: 4 },
});
