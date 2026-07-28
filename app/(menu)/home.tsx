import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, Modal, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { GameButton } from '@/src/components/ui/GameButton';
import { GameColors } from '@/src/constants/theme';
import { usePlayerStore } from '@/src/store/playerStore';
import { signOutUser } from '@/src/firebase/auth';
import { preloadGameBackground } from '@/src/utils/preloadGameAssets';
import { saveUserProfile } from '@/src/firebase/userProfile';

export default function HomeScreen() {
  const coins        = usePlayerStore((s) => s.coins);
  const displayName  = usePlayerStore((s) => s.displayName);
  const isFirebase   = usePlayerStore((s) => s.isFirebaseUser);
  const isAnonymous  = usePlayerStore((s) => s.isAnonymous);
  const setFirebase  = usePlayerStore((s) => s.setFirebaseUser);
  const uid          = usePlayerStore((s) => s.uid);
  const setDisplayName = usePlayerStore((s) => s.setDisplayName);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);

  // Lock to portrait whenever we're on any menu/non-game screen
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  // Preload forest background while on menu so Single Player paints instantly
  useEffect(() => {
    preloadGameBackground().catch(() => {});
  }, []);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      if (!isAnonymous) {
        // Only call Firebase signOut for Google/Apple accounts.
        // For anonymous/guest users, we preserve their Firebase session
        // so next time they tap "Play as Guest" they get the same UID + profile.
        await signOutUser();
      }
      setFirebase(null);
      setShowLogoutConfirm(false);
      router.replace('/(auth)/login');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not sign out.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (trimmed.length < 3 || trimmed.length > 16) {
      Alert.alert('Invalid Name', 'Name must be 3-16 characters.');
      return;
    }
    setSavingName(true);
    try {
      await saveUserProfile(uid, trimmed, trimmed, isAnonymous ?? true);
      setDisplayName(trimmed);
      setShowEditName(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save name.');
    } finally {
      setSavingName(false);
    }
  };

  const accountLabel = isFirebase && !isAnonymous
    ? `Signed in as ${displayName}`
    : 'Playing as Guest';

  return (
    <View style={styles.background}>
      <Image
        source={require('../../assets/vecteezy_deep-forest-scene-with-trees-cartoon-background-vector_9577135.webp')}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={0}
      />
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.title}>Hey, {displayName}!</Text>
          <Text style={styles.titleShadow}>Hey, {displayName}!</Text>
          <View style={styles.coinBadge}>
            <MaterialCommunityIcons name="star-circle" size={18} color="#FFD700" />
            <Text style={styles.coinText}>{coins} Coins</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Account badge + logout */}
          <View style={styles.accountRow}>
            <View style={styles.accountBadge}>
              <MaterialCommunityIcons name={isFirebase && !isAnonymous ? 'account' : 'incognito'} size={18} color="#fff" />
              <Text style={styles.accountLabel} numberOfLines={1}>{accountLabel}</Text>
            </View>
            <Pressable
              onPress={() => { setNewName(displayName); setShowEditName(true); }}
              style={({ pressed }) => [
                styles.editBtn,
                pressed && { opacity: 0.7 }
              ]}
            >
              <MaterialCommunityIcons name="pencil" size={18} color="#fff" />
            </Pressable>
            <Pressable
              onPress={handleLogout}
              disabled={loggingOut}
              style={({ pressed }) => [
                styles.logoutBtn,
                pressed && { opacity: 0.7 }
              ]}
            >
              <MaterialCommunityIcons name="logout" size={18} color="#ff6b6b" />
            </Pressable>
          </View>

          {/* How to play */}
          <View style={styles.tipBox}>
            <View style={styles.tipHeader}>
              <MaterialCommunityIcons name="gamepad-variant" size={20} color={GameColors.primary} />
              <Text style={styles.tipTitle}>How to play</Text>
            </View>
            <Text style={styles.tipText}>
              Game auto-rotates to landscape. Use ◀ ▶ to move, tap JUMP to jump (double-tap for double jump). Fire power-ups at enemies!
            </Text>
          </View>

          <View style={styles.menuCard}>
            <GameButton
              label="Single Player Race"
              icon={<MaterialCommunityIcons name="flag-checkered" size={20} color="#fff" />}
              onPress={async () => {
                await preloadGameBackground().catch(() => {});
                router.push({ pathname: '/game', params: { mode: 'single', ts: Date.now().toString() } });
              }}
            />
            <GameButton
              label="Multiplayer"
              icon={<MaterialCommunityIcons name="earth" size={20} color="#fff" />}
              variant="secondary"
              onPress={() => router.push('/(lobby)/matchmaking')}
              style={styles.mt}
            />
            <GameButton
              label="Choose Character"
              icon={<MaterialCommunityIcons name="account-switch" size={20} color="#fff" />}
              variant="ghost"
              onPress={() => router.push('/(menu)/character-select')}
              style={styles.mt}
            />
          </View>
        </ScrollView>
      </View>

      {/* Custom Sign Out Modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <MaterialCommunityIcons name="logout" size={32} color="#ff6b6b" />
            </View>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalSubtitle}>Are you sure you want to sign out of Mighty Dash?</Text>
            
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={confirmLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Sign Out</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Username Modal */}
      <Modal
        visible={showEditName}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditName(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(100,200,255,0.1)', borderColor: 'rgba(100,200,255,0.2)' }]}>
              <MaterialCommunityIcons name="account-edit" size={32} color="#64c8ff" />
            </View>
            <Text style={styles.modalTitle}>Edit Name</Text>
            <Text style={styles.modalSubtitle}>Change your racing display name</Text>
            <TextInput
              style={styles.editInput}
              value={newName}
              onChangeText={setNewName}
              maxLength={16}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="rgba(255,255,255,0.4)"
              placeholder="New name..."
            />
            <Text style={styles.editCounter}>{newName.length}/16</Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setShowEditName(false)}
                disabled={savingName}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: '#4488ff', borderColor: '#66aaff' }]}
                onPress={handleSaveName}
                disabled={savingName || newName.trim().length < 3}
              >
                {savingName ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingTop: 60, // Add top padding to act as safe area
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
    zIndex: 2,
  },
  titleShadow: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
    position: 'absolute',
    top: 3,
    left: 3,
    zIndex: 1,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  coinText: {
    color: '#FFD700',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 14,
  },
  scrollContent: { padding: 24, paddingBottom: 100 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(30, 30, 45, 0.95)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,107,107,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.2)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalConfirmBtn: {
    backgroundColor: '#ff4444',
    borderColor: '#ff6b6b',
  },
  modalCancelText: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '700',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  scroll: { paddingBottom: 40 },
  mt: { marginTop: 12 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  accountBadge: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
  },
  accountLabel: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,100,100,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,100,100,0.3)',
  },
  tipBox: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: GameColors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tipTitle: { fontSize: 16, fontWeight: '800', color: GameColors.textDark, marginLeft: 6 },
  tipText:  { fontSize: 13, color: '#333', opacity: 0.9, lineHeight: 20, fontWeight: '500' },
  menuCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(100,200,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100,200,255,0.3)',
  },
  editInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
  },
  editCounter: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
});
