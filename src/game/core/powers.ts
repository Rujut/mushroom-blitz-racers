import type { CharacterId } from '@/src/constants/characters';

export interface PowerDefinition {
  characterId: CharacterId;
  name: string;
  icon: string;
  cooldownMs: number;
  durationMs: number;
}

export const POWER_CATALOGUE: Record<CharacterId, PowerDefinition> = {
  mario: {
    characterId: 'mario',
    name: 'Fireball',
    icon: 'fire',
    cooldownMs: 3500,
    durationMs: 0,
  },
  luigi: {
    characterId: 'luigi',
    name: 'Ghost Dash',
    icon: 'ghost',
    cooldownMs: 6000,
    durationMs: 4000,
  },
  peach: {
    characterId: 'peach',
    name: 'Shield',
    icon: 'shield',
    cooldownMs: 6000,
    durationMs: 4000,
  },
  toad: {
    characterId: 'toad',
    name: 'Rush',
    icon: 'lightning-bolt',
    cooldownMs: 6000,
    durationMs: 4000,
  },
};

export const POWER_PROJECTILE_COLOR = '#ff5500'; // Mario fireball colour
export const SPEED_BOOST_FACTOR = 1.6;           // Toad rush multiplier
