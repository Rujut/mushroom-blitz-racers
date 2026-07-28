import { Platform } from 'react-native';

export type QualityLevel = 'high' | 'medium' | 'low';

export interface QualityProfile {
  level: QualityLevel;
  maxParticles: number;
  maxEnemies: number;
  skipFrames: boolean;
  shadowsEnabled: boolean;
  syncRateHz: number;
  maxRemotePlayers: number;
  remotePlayerAnimFps: number;
  backgroundLayers: number;
  ghostEffectsEnabled: boolean;
}

class QualityManager {
  private level: QualityLevel = 'high';
  private frameDrops = 0;
  
  // High quality by default on iOS/Web, Medium on Android (historically lower RAM constraints)
  constructor() {
    if (Platform.OS === 'android') {
      this.level = 'medium';
    }
  }

  public getProfile(): QualityProfile {
    switch (this.level) {
      case 'low':
        return {
          level: 'low',
          maxParticles: 10,
          maxEnemies: 3,
          skipFrames: true,
          shadowsEnabled: false,
          syncRateHz: 5,
          maxRemotePlayers: 4,
          remotePlayerAnimFps: 8,
          backgroundLayers: 2,
          ghostEffectsEnabled: false,
        };
      case 'medium':
        return {
          level: 'medium',
          maxParticles: 30,
          maxEnemies: 5,
          skipFrames: false,
          shadowsEnabled: true,
          syncRateHz: 8,
          maxRemotePlayers: 6,
          remotePlayerAnimFps: 15,
          backgroundLayers: 3,
          ghostEffectsEnabled: true,
        };
      case 'high':
      default:
        return {
          level: 'high',
          maxParticles: 60,
          maxEnemies: 8,
          skipFrames: false,
          shadowsEnabled: true,
          syncRateHz: 12,
          maxRemotePlayers: 8,
          remotePlayerAnimFps: 60,
          backgroundLayers: 4,
          ghostEffectsEnabled: true,
        };
    }
  }

  // Called by the game engine loop when a frame takes too long (> 20ms)
  public reportSlowFrame() {
    this.frameDrops++;
    if (this.frameDrops > 60) {
      this.downgradeQuality();
      this.frameDrops = 0;
    }
  }

  public reportFastFrame() {
    if (this.frameDrops > 0) {
      this.frameDrops = Math.max(0, this.frameDrops - 0.5); // slowly recover
    }
  }

  private downgradeQuality() {
    if (this.level === 'high') {
      console.log('[QualityManager] Downgrading to MEDIUM due to frame drops');
      this.level = 'medium';
    } else if (this.level === 'medium') {
      console.log('[QualityManager] Downgrading to LOW due to frame drops');
      this.level = 'low';
    }
  }
}

export const qualityManager = new QualityManager();
