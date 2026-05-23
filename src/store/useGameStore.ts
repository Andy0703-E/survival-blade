import { create } from 'zustand';

export type ResourceType = 'wood' | 'stone' | 'iron';
export type ScreenState = 'menu' | 'playing' | 'paused';
export type PanelState = 'none' | 'inventory' | 'market' | 'build' | 'settings' | 'leaderboard';

export type Inventory = Record<ResourceType, number>;

export interface Cost {
  coins?: number;
  wood?: number;
  stone?: number;
  iron?: number;
}

export interface BladeSnapshot {
  level: number;
  name: string;
  damage: number;
  rotationSpeed: number;
  radius: number;
  bladeCount: number;
  criticalChance: number;
  knockback: number;
  nextCost?: Cost;
}

export interface MapDot {
  x: number;
  y: number;
  kind: string;
}

export interface GameSnapshot {
  hp: number;
  maxHp: number;
  baseHp: number;
  baseMaxHp: number;
  coins: number;
  inventory: Inventory;
  xp: number;
  nextXp: number;
  playerLevel: number;
  wave: number;
  waveTarget: number;
  waveDefeated: number;
  waveActive: boolean;
  enemiesAlive: number;
  blade: BladeSnapshot;
  message: string;
  canSell: boolean;
  canUpgradeBlade: boolean;
  player: { x: number; y: number };
  base: { x: number; y: number };
  market: { x: number; y: number };
  world: { width: number; height: number };
  dots: MapDot[];
  defenses: number;
  gameOver: boolean;
}

export const initialInventory: Inventory = {
  wood: 0,
  stone: 0,
  iron: 0
};

export const initialSnapshot: GameSnapshot = {
  hp: 100,
  maxHp: 100,
  baseHp: 280,
  baseMaxHp: 280,
  coins: 0,
  inventory: initialInventory,
  xp: 0,
  nextXp: 120,
  playerLevel: 1,
  wave: 1,
  waveTarget: 0,
  waveDefeated: 0,
  waveActive: false,
  enemiesAlive: 0,
  blade: {
    level: 1,
    name: 'Wooden Blade',
    damage: 9,
    rotationSpeed: 2.5,
    radius: 82,
    bladeCount: 1,
    criticalChance: 0.05,
    knockback: 28,
    nextCost: { coins: 80, wood: 18 }
  },
  message: 'Tekan Play untuk mulai bertahan.',
  canSell: false,
  canUpgradeBlade: false,
  player: { x: 1100, y: 800 },
  base: { x: 1100, y: 800 },
  market: { x: 1230, y: 700 },
  world: { width: 2200, height: 1600 },
  dots: [],
  defenses: 0,
  gameOver: false
};

interface GameStore {
  screen: ScreenState;
  panel: PanelState;
  snapshot: GameSnapshot;
  muted: boolean;
  setScreen: (screen: ScreenState) => void;
  setPanel: (panel: PanelState) => void;
  setSnapshot: (snapshot: GameSnapshot) => void;
  setMuted: (muted: boolean) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  screen: 'menu',
  panel: 'none',
  snapshot: initialSnapshot,
  muted: false,
  setScreen: (screen) => set({ screen }),
  setPanel: (panel) => set({ panel }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setMuted: (muted) => set({ muted })
}));
