export type CharacterId = 'mario' | 'luigi' | 'peach' | 'toad';

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  description: string;
  powerName: string;
  powerDescription: string;
  color: string;
  unlockedByDefault: boolean;
}

export const CHARACTERS: CharacterDefinition[] = [
  {
    id: 'mario',
    name: 'Blitz Bro',
    description: 'Balanced runner with fiery attacks.',
    powerName: 'Fireball',
    powerDescription: 'Shoots a fireball that kills animals.',
    color: '#e52521',
    unlockedByDefault: true,
  },
  {
    id: 'luigi',
    name: 'Leap Luigi',
    description: 'Higher jumps and ghost dash.',
    powerName: 'Ghost Dash',
    powerDescription: 'Phase through obstacles & enemies.',
    color: '#00a800',
    unlockedByDefault: true,
  },
  {
    id: 'peach',
    name: 'Float Peach',
    description: 'Slow fall and heart shield.',
    powerName: 'Heart Shield',
    powerDescription: 'Blocks one hit without losing a heart.',
    color: '#ff69b4',
    unlockedByDefault: true,
  },
  {
    id: 'toad',
    name: 'Turbo Toad',
    description: 'Speed boost specialist.',
    powerName: 'Mushroom Rush',
    powerDescription: 'Temporary speed burst.',
    color: '#4169e1',
    unlockedByDefault: true,
  },
];

/**
 * Per-character colors for the RuntimeShader.
 * Mario uses null (no shader needed).
 */
export const CHARACTER_TINT_COLORS: Record<string, number[] | null> = {
  mario: null,
  luigi: [0.0, 0.8, 0.0, 1.0], // Green
  peach: [1.0, 0.4, 0.7, 1.0], // Pink
  toad:  [0.2, 0.4, 1.0, 1.0], // Blue
};

/**
 * SkSL shader source to perfectly isolate Mario's red clothing
 * and replace it with a target color, while ignoring skin and brown shoes.
 */
export const CHARACTER_TINT_SHADER = `
uniform shader image;
uniform vec4 targetColor;

vec4 main(vec2 pos) {
  vec4 color = image.eval(pos);
  
  // Isolate pure red clothing.
  // Skin is roughly (R=1.0, G=0.8, B=0.6) - fails the G * 2.5 check.
  // Brown shoes are roughly (R=0.6, G=0.3, B=0.0) - fails the G * 2.5 check.
  // Red cloth is roughly (R=0.9, G=0.1, B=0.1) - passes easily.
  if (color.r > color.g * 2.5 && color.r > color.b * 2.5 && color.a > 0.0) {
      // Map the original red intensity to the new target color to preserve shading
      vec3 newRgb = targetColor.rgb * (color.r + 0.15);
      return vec4(newRgb, color.a);
  }
  
  return color;
}
`;
