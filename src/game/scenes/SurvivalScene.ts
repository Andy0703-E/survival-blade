import Phaser from 'phaser';
import { gameEvents } from '../EventBus';
import type { BladeSnapshot, Cost, GameSnapshot, Inventory, ResourceType } from '../../store/useGameStore';

const WORLD = { width: 2200, height: 1600 };
const PLAYER_START = { x: WORLD.width / 2, y: WORLD.height / 2 };
const MARKET_POS = { x: PLAYER_START.x + 150, y: PLAYER_START.y - 110 };
const BASE_MAX_HP = 280;

const RESOURCE_PRICES: Record<ResourceType, number> = {
  wood: 2,
  stone: 4,
  iron: 8
};

const RESOURCE_COLORS: Record<ResourceType, number> = {
  wood: 0x62b15a,
  stone: 0x9ca3af,
  iron: 0xb5835a
};

const BUILDING_COSTS: Record<DefenseType, Cost> = {
  wall: { coins: 35, wood: 14 },
  turret: { coins: 95, wood: 24, stone: 12 },
  spike: { coins: 55, wood: 10, stone: 10 }
};

const BLADE_LEVELS: Array<BladeSnapshot & { color: number; costToNext?: Cost }> = [
  {
    level: 1,
    name: 'Wooden Blade',
    damage: 9,
    rotationSpeed: 3.5,
    radius: 82,
    bladeCount: 1,
    criticalChance: 0.05,
    knockback: 28,
    color: 0xd9a45c,
    costToNext: { coins: 80, wood: 18 }
  },
  {
    level: 2,
    name: 'Iron Blade',
    damage: 15,
    rotationSpeed: 4.2,
    radius: 92,
    bladeCount: 1,
    criticalChance: 0.08,
    knockback: 35,
    color: 0xd1d5db,
    costToNext: { coins: 160, wood: 24, stone: 14 }
  },
  {
    level: 3,
    name: 'Dual Blade',
    damage: 19,
    rotationSpeed: 4.7,
    radius: 102,
    bladeCount: 2,
    criticalChance: 0.1,
    knockback: 42,
    color: 0x8bd3dd,
    costToNext: { coins: 290, stone: 28, iron: 8 }
  },
  {
    level: 4,
    name: 'Fire Blade',
    damage: 27,
    rotationSpeed: 5.25,
    radius: 112,
    bladeCount: 2,
    criticalChance: 0.14,
    knockback: 48,
    color: 0xff7a45,
    costToNext: { coins: 480, wood: 40, stone: 34, iron: 18 }
  },
  {
    level: 5,
    name: 'Lightning Blade',
    damage: 34,
    rotationSpeed: 6.1,
    radius: 124,
    bladeCount: 3,
    criticalChance: 0.18,
    knockback: 56,
    color: 0xf6e05e,
    costToNext: { coins: 760, stone: 50, iron: 34 }
  },
  {
    level: 6,
    name: 'Legendary Blade',
    damage: 46,
    rotationSpeed: 6.8,
    radius: 140,
    bladeCount: 4,
    criticalChance: 0.24,
    knockback: 70,
    color: 0xe879f9
  }
];

type EnemyKind = 'slime' | 'goblin' | 'skeleton' | 'boss';
type ResourceNodeType = ResourceType;
type DefenseType = 'wall' | 'turret' | 'spike';

interface MovementKeys {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
  UP: Phaser.Input.Keyboard.Key;
  DOWN: Phaser.Input.Keyboard.Key;
  LEFT: Phaser.Input.Keyboard.Key;
  RIGHT: Phaser.Input.Keyboard.Key;
}

interface EnemyConfig {
  hp: number;
  speed: number;
  damage: number;
  reward: number;
  xp: number;
  attackRange: number;
  attackMs: number;
  animKey: string;
  scale: number;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  sprite: Phaser.GameObjects.Sprite;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  reward: number;
  xp: number;
  attackRange: number;
  attackMs: number;
  lastAttack: number;
  lastBladeHit: number;
  knockX: number;
  knockY: number;
}

interface ResourceNode {
  id: number;
  type: ResourceNodeType;
  sprite: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  amount: number;
  alive: boolean;
  respawnAt: number;
  lastBladeHit: number;
}

interface Defense {
  id: number;
  type: DefenseType;
  sprite: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  attackMs: number;
  lastAttack: number;
}

interface FloatingText {
  text: Phaser.GameObjects.Text;
  bornAt: number;
}

interface JoystickVector {
  x: number;
  y: number;
}

const ENEMY_CONFIGS: Record<EnemyKind, EnemyConfig> = {
  slime: {
    hp: 38,
    speed: 90,
    damage: 9,
    reward: 7,
    xp: 16,
    attackRange: 36,
    attackMs: 850,
    animKey: 'enemy-slime-walk',
    scale: 1
  },
  goblin: {
    hp: 60,
    speed: 116,
    damage: 14,
    reward: 13,
    xp: 24,
    attackRange: 38,
    attackMs: 760,
    animKey: 'enemy-goblin-walk',
    scale: 1.05
  },
  skeleton: {
    hp: 50,
    speed: 82,
    damage: 16,
    reward: 16,
    xp: 28,
    attackRange: 150,
    attackMs: 1000,
    animKey: 'enemy-skeleton-walk',
    scale: 1
  },
  boss: {
    hp: 300,
    speed: 68,
    damage: 28,
    reward: 85,
    xp: 100,
    attackRange: 54,
    attackMs: 980,
    animKey: 'enemy-boss-walk',
    scale: 1.45
  }
};

export default class SurvivalScene extends Phaser.Scene {
  private keys!: MovementKeys;
  private player!: Phaser.GameObjects.Sprite;
  private base!: Phaser.GameObjects.Image;
  private baseRing!: Phaser.GameObjects.Arc;
  private market!: Phaser.GameObjects.Image;
  private blades: Phaser.GameObjects.Image[] = [];
  private enemies: Enemy[] = [];
  private resources: ResourceNode[] = [];
  private defenses: Defense[] = [];
  private floatingTexts: FloatingText[] = [];
  private joystick: JoystickVector = { x: 0, y: 0 };
  private inventory: Inventory = { wood: 0, stone: 0, iron: 0 };
  private coins = 0;
  private hp = 100;
  private maxHp = 100;
  private baseHp = BASE_MAX_HP;
  private playerSpeed = 220;
  private playerLevel = 1;
  private xp = 0;
  private nextXp = 120;
  private bladeLevel = 1;
  private wave = 1;
  private waveActive = false;
  private waveTarget = 0;
  private waveSpawned = 0;
  private waveDefeated = 0;
  private nextSpawnAt = 0;
  private nextWaveAt = 0;
  private message = 'Tekan Play untuk mulai bertahan.';
  private messageUntil = 0;
  private running = false;
  private pausedByUi = false;
  private deadUntil = 0;
  private lastSnapshotAt = 0;
  private enemyId = 1;
  private resourceId = 1;
  private defenseId = 1;
  private bladeAngle = 0;
  private muted = false;

  constructor() {
    super('SurvivalScene');
  }

  create() {
    this.prepareTextures();
    this.createWorld();

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as MovementKeys;
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setZoom(1);

    gameEvents.on('ui:start', this.startNewRun, this);
    gameEvents.on('ui:pause', this.pauseRun, this);
    gameEvents.on('ui:resume', this.resumeRun, this);
    gameEvents.on('ui:menu', this.returnToMenu, this);
    gameEvents.on('ui:sell', this.sellResources, this);
    gameEvents.on('ui:upgradeBlade', this.upgradeBlade, this);
    gameEvents.on('ui:heal', this.healPlayer, this);
    gameEvents.on('ui:build', this.buildDefense, this);
    gameEvents.on('ui:nextWave', this.requestNextWave, this);
    gameEvents.on('ui:joystick', this.setJoystick, this);
    gameEvents.on('ui:setMute', this.setMute, this);

    const cleanupEvents = () => {
      gameEvents.off('ui:start', this.startNewRun, this);
      gameEvents.off('ui:pause', this.pauseRun, this);
      gameEvents.off('ui:resume', this.resumeRun, this);
      gameEvents.off('ui:menu', this.returnToMenu, this);
      gameEvents.off('ui:sell', this.sellResources, this);
      gameEvents.off('ui:upgradeBlade', this.upgradeBlade, this);
      gameEvents.off('ui:heal', this.healPlayer, this);
      gameEvents.off('ui:build', this.buildDefense, this);
      gameEvents.off('ui:nextWave', this.requestNextWave, this);
      gameEvents.off('ui:joystick', this.setJoystick, this);
      gameEvents.off('ui:setMute', this.setMute, this);
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupEvents);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanupEvents);

    this.emitSnapshot(true);
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;
    this.updateAmbientAnimations(time);
    this.updateFloatingTexts(time);
    this.updateResourceRespawns(time);

    if (!this.running || this.pausedByUi) {
      this.emitSnapshot();
      return;
    }

    if (this.deadUntil > 0) {
      if (time >= this.deadUntil) {
        this.respawnPlayer();
      }
      this.emitSnapshot();
      return;
    }

    this.updatePlayer(dt);
    this.updateBlades(time, dt);
    this.updateDefenses(time);
    this.updateEnemies(time, dt);
    this.updateWave(time);
    this.emitSnapshot();
  }

  private prepareTextures() {
    this.makePlayerTextures();
    this.makeCircleTexture('player-shadow', 32, 0x0b120f, 0x0b120f, 0, 0.25);
    this.makeBladeTexture('blade-wood', 0xd9a45c);
    this.makeBladeTexture('blade-iron', 0xd1d5db);
    this.makeBladeTexture('blade-dual', 0x8bd3dd);
    this.makeBladeTexture('blade-fire', 0xff7a45);
    this.makeBladeTexture('blade-lightning', 0xf6e05e);
    this.makeBladeTexture('blade-legendary', 0xe879f9);
    this.makeTreeTexture();
    this.makeRockTexture('resource-stone', 0x9ca3af, 0x606a78);
    this.makeRockTexture('resource-iron', 0xb5835a, 0x6f4d37);
    this.makeBaseTexture();
    this.makeMarketTexture();
    this.makeDefenseTextures();
    this.makeEnemyTextures();
  }

  private makeCircleTexture(
    key: string,
    radius: number,
    fill: number,
    stroke: number,
    strokeWidth = 0,
    alpha = 1
  ) {
    if (this.textures.exists(key)) {
      return;
    }

    const size = radius * 2 + strokeWidth * 2 + 4;
    const graphics = this.add.graphics();
    graphics.fillStyle(fill, alpha);
    graphics.fillCircle(size / 2, size / 2, radius);
    if (strokeWidth > 0) {
      graphics.lineStyle(strokeWidth, stroke, 1);
      graphics.strokeCircle(size / 2, size / 2, radius);
    }
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  private makePlayerTextures() {
    if (this.textures.exists('player-walk-0')) {
      return;
    }

    const w = 56;
    const h = 64;
    const cx = w / 2;
    const cy = h / 2 - 2;

    const drawBase = (g: Phaser.GameObjects.Graphics) => {
      g.fillStyle(0x2563eb, 1);
      g.fillRoundedRect(cx - 9, cy + 2, 18, 18, 3);

      g.fillStyle(0xfbbf24, 1);
      g.fillCircle(cx, cy - 6, 12);

      g.fillStyle(0x2d1a0e, 1);
      g.fillRect(cx - 12, cy - 12, 24, 8);

      g.fillStyle(0xfbbf24, 1);
      g.fillRect(cx - 16, cy + 4, 7, 5);
      g.fillRect(cx + 9, cy + 4, 7, 5);

      g.fillStyle(0x1f2937, 1);
      g.fillCircle(cx - 4, cy - 7, 2);
      g.fillCircle(cx + 4, cy - 7, 2);

      g.fillStyle(0xfca5a5, 1);
      g.fillRect(cx - 2, cy - 3, 4, 2);
    };

    const drawLegs = (g: Phaser.GameObjects.Graphics, leftOff: number, rightOff: number) => {
      g.fillStyle(0x1e40af, 1);
      g.fillRect(cx - 7, cy + 20 + leftOff, 6, 10);
      g.fillRect(cx + 1, cy + 20 + rightOff, 6, 10);
      g.fillStyle(0x3f2921, 1);
      g.fillRect(cx - 8, cy + 28 + leftOff, 7, 3);
      g.fillRect(cx + 1, cy + 28 + rightOff, 7, 3);
    };

    let g = this.add.graphics();
    g.fillStyle(0x0b120f, 0.15);
    g.fillEllipse(cx, cy + 36, 38, 10);
    drawBase(g);
    drawLegs(g, -3, 3);
    g.generateTexture('player-walk-0', w, h);
    g.destroy();

    g = this.add.graphics();
    g.fillStyle(0x0b120f, 0.15);
    g.fillEllipse(cx, cy + 36, 38, 10);
    drawBase(g);
    drawLegs(g, 3, -3);
    g.generateTexture('player-walk-1', w, h);
    g.destroy();

    this.anims.create({
      key: 'player-walk',
      frames: [{ key: 'player-walk-0' }, { key: 'player-walk-1' }],
      frameRate: 8,
      repeat: -1
    });
  }

  private makeBladeTexture(key: string, fill: number) {
    if (this.textures.exists(key)) {
      return;
    }

    const g = this.add.graphics();
    const w = 92;
    const h = 30;

    g.fillStyle(0xffffff, 0.08);
    g.fillRoundedRect(14, 4, 74, 22, 6);

    g.fillStyle(fill, 1);
    g.lineStyle(2, 0xffffff, 0.3);
    g.beginPath();
    g.moveTo(22, 6);
    g.lineTo(82, 11);
    g.lineTo(88, 15);
    g.lineTo(82, 19);
    g.lineTo(22, 24);
    g.closePath();
    g.fillPath();
    g.strokePath();

    g.lineStyle(1, 0xffffff, 0.12);
    g.lineBetween(22, 15, 86, 15);

    g.fillStyle(0x8a6d3b, 1);
    g.fillRect(18, 0, 8, 30);
    g.lineStyle(1, 0xd4a84b, 0.6);
    g.strokeRect(18, 0, 8, 30);

    g.fillStyle(0x3f2921, 1);
    g.fillRoundedRect(0, 9, 20, 12, 3);

    g.lineStyle(1, 0x5c3a21, 1);
    g.lineBetween(5, 9, 5, 21);
    g.lineBetween(10, 9, 10, 21);
    g.lineBetween(15, 9, 15, 21);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeTreeTexture() {
    if (this.textures.exists('resource-wood')) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0x7a4f2a, 1);
    graphics.fillRoundedRect(28, 38, 10, 22, 3);
    graphics.fillStyle(0x2c7a44, 1);
    graphics.fillCircle(33, 28, 27);
    graphics.fillStyle(0x4caf59, 1);
    graphics.fillCircle(22, 23, 14);
    graphics.fillCircle(44, 20, 16);
    graphics.fillCircle(36, 40, 14);
    graphics.lineStyle(3, 0x154d2c, 0.9);
    graphics.strokeCircle(33, 28, 27);
    graphics.generateTexture('resource-wood', 68, 68);
    graphics.destroy();
  }

  private makeRockTexture(key: string, fill: number, shadow: number) {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(shadow, 1);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(12, 40),
        new Phaser.Geom.Point(24, 12),
        new Phaser.Geom.Point(48, 10),
        new Phaser.Geom.Point(58, 34),
        new Phaser.Geom.Point(43, 56),
        new Phaser.Geom.Point(20, 54)
      ],
      true
    );
    graphics.fillStyle(fill, 1);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(17, 35),
        new Phaser.Geom.Point(27, 17),
        new Phaser.Geom.Point(44, 16),
        new Phaser.Geom.Point(53, 33),
        new Phaser.Geom.Point(40, 48),
        new Phaser.Geom.Point(23, 47)
      ],
      true
    );
    graphics.generateTexture(key, 68, 68);
    graphics.destroy();
  }

  private makeBaseTexture() {
    if (this.textures.exists('base')) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0x3b2f2f, 1);
    graphics.fillRoundedRect(10, 25, 84, 66, 8);
    graphics.fillStyle(0xd69d58, 1);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(4, 30),
        new Phaser.Geom.Point(52, 0),
        new Phaser.Geom.Point(100, 30)
      ],
      true
    );
    graphics.fillStyle(0x84cc87, 1);
    graphics.fillRoundedRect(40, 54, 24, 37, 4);
    graphics.lineStyle(4, 0x211717, 1);
    graphics.strokeRoundedRect(10, 25, 84, 66, 8);
    graphics.generateTexture('base', 104, 98);
    graphics.destroy();
  }

  private makeMarketTexture() {
    if (this.textures.exists('market')) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0x5a4636, 1);
    graphics.fillRoundedRect(9, 28, 68, 48, 6);
    graphics.fillStyle(0xf2c15d, 1);
    graphics.fillRect(12, 20, 12, 16);
    graphics.fillStyle(0xe35d5b, 1);
    graphics.fillRect(24, 20, 13, 16);
    graphics.fillStyle(0xf2c15d, 1);
    graphics.fillRect(37, 20, 13, 16);
    graphics.fillStyle(0xe35d5b, 1);
    graphics.fillRect(50, 20, 13, 16);
    graphics.fillStyle(0xf2c15d, 1);
    graphics.fillRect(63, 20, 12, 16);
    graphics.fillStyle(0x8bd3dd, 1);
    graphics.fillRoundedRect(28, 48, 30, 28, 4);
    graphics.lineStyle(3, 0x32241d, 1);
    graphics.strokeRoundedRect(9, 28, 68, 48, 6);
    graphics.generateTexture('market', 86, 84);
    graphics.destroy();
  }

  private makeDefenseTextures() {
    if (!this.textures.exists('defense-wall')) {
      const wall = this.add.graphics();
      wall.fillStyle(0x9f7a4d, 1);
      wall.fillRoundedRect(5, 12, 62, 36, 6);
      wall.lineStyle(4, 0x513a25, 1);
      wall.strokeRoundedRect(5, 12, 62, 36, 6);
      wall.lineStyle(2, 0x6e5131, 1);
      wall.lineBetween(19, 13, 19, 47);
      wall.lineBetween(35, 13, 35, 47);
      wall.lineBetween(51, 13, 51, 47);
      wall.generateTexture('defense-wall', 72, 60);
      wall.destroy();
    }

    if (!this.textures.exists('defense-turret')) {
      const turret = this.add.graphics();
      turret.fillStyle(0x334155, 1);
      turret.fillCircle(32, 34, 22);
      turret.fillStyle(0x8bd3dd, 1);
      turret.fillRoundedRect(29, 4, 8, 34, 4);
      turret.lineStyle(3, 0x111827, 1);
      turret.strokeCircle(32, 34, 22);
      turret.generateTexture('defense-turret', 66, 66);
      turret.destroy();
    }

    if (!this.textures.exists('defense-spike')) {
      const spike = this.add.graphics();
      spike.fillStyle(0x6b7280, 1);
      for (let i = 0; i < 4; i += 1) {
        const x = 10 + i * 13;
        spike.fillTriangle(x, 52, x + 6, 14, x + 12, 52);
      }
      spike.lineStyle(2, 0xf3f4f6, 0.8);
      spike.strokeRect(6, 50, 58, 8);
      spike.generateTexture('defense-spike', 70, 64);
      spike.destroy();
    }
  }

  private makeEnemyTextures() {
    if (!this.textures.exists('enemy-slime-0')) {
      let g = this.add.graphics();
      g.fillStyle(0x58bf60, 1);
      g.fillEllipse(30, 32, 54, 40);
      g.fillStyle(0x70d878, 1);
      g.fillEllipse(30, 30, 46, 32);
      g.fillStyle(0x123d2d, 1);
      g.fillCircle(21, 26, 4);
      g.fillCircle(39, 26, 4);
      g.fillStyle(0xfef2f2, 1);
      g.fillCircle(20, 25, 1.5);
      g.fillCircle(38, 25, 1.5);
      g.fillStyle(0x123d2d, 1);
      g.fillEllipse(30, 34, 10, 5);
      g.lineStyle(2, 0x236b3c, 0.8);
      g.strokeEllipse(30, 32, 54, 40);
      g.generateTexture('enemy-slime-0', 62, 56);
      g.destroy();

      g = this.add.graphics();
      g.fillStyle(0x58bf60, 1);
      g.fillEllipse(30, 30, 46, 46);
      g.fillStyle(0x70d878, 1);
      g.fillEllipse(30, 28, 40, 38);
      g.fillStyle(0x123d2d, 1);
      g.fillCircle(22, 24, 4);
      g.fillCircle(38, 24, 4);
      g.fillStyle(0xfef2f2, 1);
      g.fillCircle(21, 23, 1.5);
      g.fillCircle(37, 23, 1.5);
      g.fillStyle(0x123d2d, 1);
      g.fillEllipse(30, 32, 8, 4);
      g.lineStyle(2, 0x236b3c, 0.8);
      g.strokeEllipse(30, 30, 46, 46);
      g.generateTexture('enemy-slime-1', 62, 56);
      g.destroy();

      this.anims.create({
        key: 'enemy-slime-walk',
        frames: [{ key: 'enemy-slime-0' }, { key: 'enemy-slime-1' }],
        frameRate: 6,
        repeat: -1
      });
    }

    if (!this.textures.exists('enemy-goblin-0')) {
      const size = 64;
      const cx = size / 2;

      const drawGoblinBody = (g: Phaser.GameObjects.Graphics) => {
        g.fillStyle(0x7cb342, 1);
        g.fillCircle(cx - 2, 22, 16);
        g.fillStyle(0x689f38, 1);
        g.fillRoundedRect(cx - 14, 37, 28, 20, 3);
        g.fillStyle(0x7cb342, 1);
        g.fillTriangle(cx - 24, 22, cx - 32, 10, cx - 14, 28);
        g.fillTriangle(cx + 20, 22, cx + 30, 10, cx + 18, 28);
        g.fillStyle(0x689f38, 1);
        g.fillTriangle(cx - 26, 18, cx - 32, 8, cx - 16, 24);
        g.fillTriangle(cx + 22, 18, cx + 30, 8, cx + 16, 24);
        g.fillStyle(0x1f2937, 1);
        g.fillCircle(cx - 10, 20, 3);
        g.fillCircle(cx + 6, 20, 3);
        g.fillStyle(0xfef2f2, 1);
        g.fillCircle(cx - 11, 19, 1);
        g.fillCircle(cx + 5, 19, 1);
        g.fillStyle(0x991b1b, 1);
        g.fillRect(cx - 8, 28, 12, 3);
      };

      let g = this.add.graphics();
      drawGoblinBody(g);
      g.fillStyle(0x3f2921, 1);
      g.fillRect(cx - 22, 40, 6, 18);
      g.fillRect(cx + 12, 40, 6, 18);
      g.fillStyle(0x57534e, 1);
      g.fillRect(cx - 24, 56, 10, 4);
      g.fillRect(cx + 10, 56, 10, 4);
      g.generateTexture('enemy-goblin-0', size, size);
      g.destroy();

      g = this.add.graphics();
      drawGoblinBody(g);
      g.fillStyle(0x3f2921, 1);
      g.fillRect(cx - 24, 38, 6, 18);
      g.fillRect(cx + 14, 38, 6, 18);
      g.fillStyle(0x57534e, 1);
      g.fillRect(cx - 26, 54, 10, 4);
      g.fillRect(cx + 12, 54, 10, 4);
      g.generateTexture('enemy-goblin-1', size, size);
      g.destroy();

      this.anims.create({
        key: 'enemy-goblin-walk',
        frames: [{ key: 'enemy-goblin-0' }, { key: 'enemy-goblin-1' }],
        frameRate: 8,
        repeat: -1
      });
    }

    if (!this.textures.exists('enemy-skeleton-0')) {
      const size = 56;
      const cx = size / 2;

      const drawSkeletonBody = (g: Phaser.GameObjects.Graphics) => {
        g.fillStyle(0xe7e5d9, 1);
        g.fillCircle(cx, 20, 14);
        g.fillStyle(0x1f2937, 1);
        g.fillCircle(cx - 5, 18, 3);
        g.fillCircle(cx + 5, 18, 3);
        g.fillRect(cx - 6, 24, 12, 3);
        g.fillStyle(0xd4d2c4, 1);
        g.fillRoundedRect(cx - 12, 34, 24, 16, 3);
        g.lineStyle(3, 0xe7e5d9, 1);
        g.lineBetween(cx - 20, 38, cx + 16, 38);
        g.lineBetween(cx + 8, 50, cx + 8, 60);
      };

      let g = this.add.graphics();
      drawSkeletonBody(g);
      g.lineStyle(3, 0xe7e5d9, 1);
      g.lineBetween(cx - 18, 44, cx - 12, 54);
      g.lineBetween(cx + 14, 44, cx + 8, 54);
      g.fillStyle(0xbab8aa, 1);
      g.fillRect(cx - 18, 52, 6, 4);
      g.fillRect(cx + 6, 52, 6, 4);
      g.fillRect(cx - 22, 36, 4, 6);
      g.fillRect(cx + 14, 36, 4, 6);
      g.generateTexture('enemy-skeleton-0', size, 64);
      g.destroy();

      g = this.add.graphics();
      drawSkeletonBody(g);
      g.lineStyle(3, 0xe7e5d9, 1);
      g.lineBetween(cx - 20, 42, cx - 18, 54);
      g.lineBetween(cx + 16, 42, cx + 12, 54);
      g.fillStyle(0xbab8aa, 1);
      g.fillRect(cx - 22, 52, 6, 4);
      g.fillRect(cx + 10, 52, 6, 4);
      g.fillRect(cx - 22, 36, 4, 6);
      g.fillRect(cx + 14, 36, 4, 6);
      g.generateTexture('enemy-skeleton-1', size, 64);
      g.destroy();

      this.anims.create({
        key: 'enemy-skeleton-walk',
        frames: [{ key: 'enemy-skeleton-0' }, { key: 'enemy-skeleton-1' }],
        frameRate: 7,
        repeat: -1
      });
    }

    if (!this.textures.exists('enemy-boss-0')) {
      const size = 76;
      const cx = size / 2;

      const drawBossBody = (g: Phaser.GameObjects.Graphics) => {
        g.fillStyle(0x7f1d1d, 1);
        g.fillCircle(cx, cx, 32);
        g.fillStyle(0x9f1239, 1);
        g.fillCircle(cx, cx - 2, 28);
        g.fillStyle(0xdc2626, 1);
        g.fillTriangle(cx - 20, cx - 22, cx - 28, cx - 36, cx - 4, cx - 20);
        g.fillTriangle(cx + 20, cx - 22, cx + 30, cx - 36, cx + 4, cx - 20);
        g.fillStyle(0x991b1b, 1);
        g.fillTriangle(cx - 22, cx - 26, cx - 30, cx - 34, cx - 8, cx - 22);
        g.fillTriangle(cx + 22, cx - 26, cx + 32, cx - 34, cx + 8, cx - 22);
        g.fillStyle(0xfef2f2, 1);
        g.fillCircle(cx - 12, cx - 6, 5);
        g.fillCircle(cx + 12, cx - 6, 5);
        g.fillStyle(0x3f0f1a, 1);
        g.fillCircle(cx - 13, cx - 7, 2.5);
        g.fillCircle(cx + 11, cx - 7, 2.5);
        g.fillStyle(0xfca5a5, 1);
        g.fillRoundedRect(cx - 14, cx + 8, 28, 6, 2);
        g.fillStyle(0xfef2f2, 1);
        g.fillRect(cx - 6, cx + 8, 12, 6);
        g.lineStyle(2, 0xdc2626, 0.6);
        g.strokeCircle(cx, cx - 2, 28);
      };

      let g = this.add.graphics();
      drawBossBody(g);
      g.fillStyle(0x3f2921, 1);
      g.fillRect(cx - 28, cx + 20, 10, 16);
      g.fillRect(cx + 14, cx + 20, 10, 16);
      g.fillStyle(0x57534e, 1);
      g.fillRect(cx - 30, cx + 34, 12, 5);
      g.fillRect(cx + 14, cx + 34, 12, 5);
      g.generateTexture('enemy-boss-0', size, size + 8);
      g.destroy();

      g = this.add.graphics();
      drawBossBody(g);
      g.fillStyle(0x3f2921, 1);
      g.fillRect(cx - 30, cx + 18, 10, 16);
      g.fillRect(cx + 16, cx + 18, 10, 16);
      g.fillStyle(0x57534e, 1);
      g.fillRect(cx - 32, cx + 32, 12, 5);
      g.fillRect(cx + 16, cx + 32, 12, 5);
      g.generateTexture('enemy-boss-1', size, size + 8);
      g.destroy();

      this.anims.create({
        key: 'enemy-boss-walk',
        frames: [{ key: 'enemy-boss-0' }, { key: 'enemy-boss-1' }],
        frameRate: 6,
        repeat: -1
      });
    }
  }

  private createWorld() {
    this.createBackground();

    this.baseRing = this.add.circle(PLAYER_START.x, PLAYER_START.y, 176, 0x2f6f53, 0.13);
    this.baseRing.setStrokeStyle(3, 0x6ee7b7, 0.45).setDepth(0.6);
    this.base = this.add.image(PLAYER_START.x, PLAYER_START.y, 'base').setDepth(2);
    this.market = this.add.image(MARKET_POS.x, MARKET_POS.y, 'market').setDepth(2);

    this.player = this.add.sprite(PLAYER_START.x, PLAYER_START.y + 80, 'player-walk-0').setDepth(5);
    this.player.play('player-walk');
    this.add.image(this.player.x, this.player.y + 8, 'player-shadow').setDepth(4).setName('player-shadow');

    this.spawnResources();
    this.ensureBladeSprites();
  }

  private createBackground() {
    const g = this.add.graphics();
    g.fillStyle(0x142b1f, 1);
    g.fillRect(0, 0, WORLD.width, WORLD.height);

    const rng = new Phaser.Math.RandomDataGenerator(['survival-blade-map']);

    const colors = [0x1a4c30, 0x1f5435, 0x254b3a, 0x2d4432, 0x35513b, 0x1d3d2a];
    for (let i = 0; i < 120; i += 1) {
      const x = rng.between(0, WORLD.width);
      const y = rng.between(0, WORLD.height);
      const size = rng.between(60, 200);
      const color = rng.pick(colors);
      g.fillStyle(color, rng.realInRange(0.15, 0.4));
      g.fillPoints(
        [
          new Phaser.Geom.Point(x, y - size * 0.5),
          new Phaser.Geom.Point(x + size * 0.55, y - size * 0.08),
          new Phaser.Geom.Point(x + size * 0.45, y + size * 0.48),
          new Phaser.Geom.Point(x - size * 0.5, y + size * 0.35),
          new Phaser.Geom.Point(x - size * 0.42, y - size * 0.25)
        ],
        true
      );
    }

    g.lineStyle(1, 0x6b5d42, 0.1);
    for (let x = 0; x <= WORLD.width; x += 80) {
      g.lineBetween(x, 0, x, WORLD.height);
    }
    for (let y = 0; y <= WORLD.height; y += 80) {
      g.lineBetween(0, y, WORLD.width, y);
    }

    g.lineStyle(2, 0x6b5d42, 0.15);
    for (let x = 0; x <= WORLD.width; x += 240) {
      g.lineBetween(x, 0, x, WORLD.height);
    }
    for (let y = 0; y <= WORLD.height; y += 240) {
      g.lineBetween(0, y, WORLD.width, y);
    }

    const grassColors = [0x2d6b3a, 0x3a7d48, 0x478a54, 0x58a868];
    for (let i = 0; i < 300; i += 1) {
      const x = rng.between(10, WORLD.width - 10);
      const y = rng.between(10, WORLD.height - 10);
      const h = rng.between(4, 10);
      g.fillStyle(rng.pick(grassColors), rng.realInRange(0.2, 0.5));
      g.fillRect(x, y - h, 2, h);
    }

    const path = this.add.graphics();
    path.lineStyle(12, 0x5c4a32, 0.25);
    path.beginPath();
    path.moveTo(PLAYER_START.x, PLAYER_START.y);
    path.lineTo(MARKET_POS.x, MARKET_POS.y);
    path.strokePath();
    path.lineStyle(6, 0x7a6548, 0.2);
    path.beginPath();
    path.moveTo(PLAYER_START.x, PLAYER_START.y);
    path.lineTo(MARKET_POS.x, MARKET_POS.y);
    path.strokePath();
    path.destroy();

    const clearColor = 0x3a6b3d;
    const clearG = this.add.graphics();
    clearG.fillStyle(clearColor, 0.3);
    clearG.fillCircle(PLAYER_START.x, PLAYER_START.y, 220);
    clearG.fillCircle(MARKET_POS.x, MARKET_POS.y, 120);
    clearG.setDepth(0);

    const pebbleG = this.add.graphics();
    for (let i = 0; i < 50; i += 1) {
      const angle = rng.realInRange(0, Math.PI * 2);
      const dist = rng.between(20, 210);
      const px = PLAYER_START.x + Math.cos(angle) * dist;
      const py = PLAYER_START.y + Math.sin(angle) * dist;
      pebbleG.fillStyle(0x6b7280, rng.realInRange(0.1, 0.25));
      pebbleG.fillCircle(px, py, rng.between(2, 5));
    }
    pebbleG.setDepth(0);

    const flowerG = this.add.graphics();
    const flowerColors = [0xfbbf24, 0xf87171, 0xa78bfa, 0x34d399, 0xfb923c];
    for (let i = 0; i < 30; i += 1) {
      const x = rng.between(50, WORLD.width - 50);
      const y = rng.between(50, WORLD.height - 50);
      if (Phaser.Math.Distance.Between(x, y, PLAYER_START.x, PLAYER_START.y) > 160) {
        flowerG.fillStyle(rng.pick(flowerColors), rng.realInRange(0.15, 0.35));
        flowerG.fillCircle(x, y, rng.between(2, 4));
        flowerG.fillStyle(0x4ade80, rng.realInRange(0.15, 0.3));
        flowerG.fillRect(x - 0.5, y, 1, rng.between(4, 8));
      }
    }
    flowerG.setDepth(0);

    const darkPatchG = this.add.graphics();
    for (let i = 0; i < 20; i += 1) {
      const x = rng.between(200, WORLD.width - 200);
      const y = rng.between(200, WORLD.height - 200);
      const size = rng.between(30, 80);
      darkPatchG.fillStyle(0x0d1f14, rng.realInRange(0.1, 0.2));
      darkPatchG.fillEllipse(x, y, size, size * rng.realInRange(0.6, 1.2));
    }
    darkPatchG.setDepth(0);

    if (!this.textures.exists('map-bg')) {
      g.generateTexture('map-bg', 1, 1);
    }
    g.setDepth(0);
  }

  private spawnResources() {
    this.clearResources();

    for (let i = 0; i < 30; i += 1) {
      this.createResource('wood', 28, Phaser.Math.Between(4, 7), 280);
    }
    for (let i = 0; i < 14; i += 1) {
      this.createResource('stone', 48, Phaser.Math.Between(2, 5), 340);
    }
    for (let i = 0; i < 8; i += 1) {
      this.createResource('iron', 68, Phaser.Math.Between(1, 3), 420);
    }
  }

  private createResource(type: ResourceNodeType, hp: number, amount: number, minBaseDistance: number) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 80; tries += 1) {
      x = Phaser.Math.Between(100, WORLD.width - 100);
      y = Phaser.Math.Between(100, WORLD.height - 100);
      if (Phaser.Math.Distance.Between(x, y, PLAYER_START.x, PLAYER_START.y) >= minBaseDistance) {
        break;
      }
    }

    const sprite = this.add
      .image(x, y, type === 'wood' ? 'resource-wood' : type === 'stone' ? 'resource-stone' : 'resource-iron')
      .setDepth(2);
    if (type === 'iron') {
      sprite.setScale(0.94);
    }

    this.resources.push({
      id: this.resourceId++,
      type,
      sprite,
      hp,
      maxHp: hp,
      amount,
      alive: true,
      respawnAt: 0,
      lastBladeHit: 0
    });
  }

  private clearResources() {
    this.resources.forEach((resource) => resource.sprite.destroy());
    this.resources = [];
  }

  private startNewRun() {
    this.running = true;
    this.pausedByUi = false;
    this.deadUntil = 0;
    this.coins = 0;
    this.inventory = { wood: 0, stone: 0, iron: 0 };
    this.hp = 100;
    this.maxHp = 100;
    this.playerSpeed = 220;
    this.playerLevel = 1;
    this.xp = 0;
    this.nextXp = 120;
    this.baseHp = BASE_MAX_HP;
    this.bladeLevel = 1;
    this.wave = 1;
    this.waveActive = false;
    this.waveTarget = 0;
    this.waveDefeated = 0;
    this.waveSpawned = 0;
    this.enemies.forEach((enemy) => enemy.sprite.destroy());
    this.enemies = [];
    this.defenses.forEach((defense) => defense.sprite.destroy());
    this.defenses = [];
    this.resources.forEach((resource) => {
      resource.alive = true;
      resource.hp = resource.maxHp;
      resource.respawnAt = 0;
      resource.sprite.setVisible(true).setAlpha(1);
    });
    this.player.setPosition(PLAYER_START.x, PLAYER_START.y + 80).setVisible(true).clearTint();
    this.updatePlayerShadow();
    this.ensureBladeSprites();
    this.message = 'Wave 1 dimulai. Lindungi base dan kumpulkan resource.';
    this.messageUntil = this.time.now + 3600;
    this.startWave(this.time.now);
    this.emitSnapshot(true);
  }

  private pauseRun() {
    this.pausedByUi = true;
    this.emitSnapshot(true);
  }

  private resumeRun() {
    this.pausedByUi = false;
    this.emitSnapshot(true);
  }

  private returnToMenu() {
    this.running = false;
    this.pausedByUi = false;
    this.message = 'Tekan Play untuk mulai bertahan.';
    this.messageUntil = 0;
    this.emitSnapshot(true);
  }

  private setJoystick(vector: JoystickVector) {
    this.joystick = vector;
  }

  private setMute(muted: boolean) {
    this.muted = muted;
  }

  private sellResources() {
    if (!this.running || this.pausedByUi) {
      return;
    }

    if (!this.isNearMarket()) {
      this.showMessage('Dekati market atau base untuk menjual resource.');
      return;
    }

    const total =
      this.inventory.wood * RESOURCE_PRICES.wood +
      this.inventory.stone * RESOURCE_PRICES.stone +
      this.inventory.iron * RESOURCE_PRICES.iron;

    if (total <= 0) {
      this.showMessage('Inventory kosong.');
      return;
    }

    this.inventory = { wood: 0, stone: 0, iron: 0 };
    this.coins += total;
    this.showMessage(`Resource terjual: +${total} coin.`);
    this.spawnCoinBurst(this.player.x, this.player.y);
    this.emitSnapshot(true);
  }

  private upgradeBlade() {
    if (!this.running || this.pausedByUi) {
      return;
    }

    const current = this.currentBlade();
    if (!current.costToNext) {
      this.showMessage('Blade sudah mencapai level maksimal.');
      return;
    }

    if (!this.canAfford(current.costToNext)) {
      this.showMessage('Resource atau coin belum cukup untuk upgrade blade.');
      return;
    }

    this.payCost(current.costToNext);
    this.bladeLevel = Math.min(this.bladeLevel + 1, BLADE_LEVELS.length);
    this.ensureBladeSprites();
    this.showMessage(`${this.currentBlade().name} siap berputar.`);
    this.cameras.main.shake(160, 0.006);
    this.emitSnapshot(true);
  }

  private healPlayer() {
    if (!this.running || this.pausedByUi) {
      return;
    }

    const cost: Cost = { coins: 55 };
    if (this.hp >= this.maxHp) {
      this.showMessage('HP masih penuh.');
      return;
    }
    if (!this.canAfford(cost)) {
      this.showMessage('Butuh 55 coin untuk heal.');
      return;
    }

    this.payCost(cost);
    this.hp = Math.min(this.maxHp, this.hp + 35);
    this.showMessage('HP pulih.');
    this.spawnRing(this.player.x, this.player.y, 0x6ee7b7);
    this.emitSnapshot(true);
  }

  private buildDefense(type: DefenseType) {
    if (!this.running || this.pausedByUi) {
      return;
    }

    const cost = BUILDING_COSTS[type];
    if (!this.canAfford(cost)) {
      this.showMessage('Material belum cukup untuk membangun.');
      return;
    }

    const placement = this.findPlacementPosition();
    if (!placement) {
      this.showMessage('Area terlalu padat untuk bangunan baru.');
      return;
    }

    this.payCost(cost);
    const stats = this.getDefenseStats(type);
    const texture = type === 'wall' ? 'defense-wall' : type === 'turret' ? 'defense-turret' : 'defense-spike';
    const sprite = this.add.image(placement.x, placement.y, texture).setDepth(3);
    if (type === 'wall') {
      sprite.setScale(0.95);
    }
    if (type === 'spike') {
      sprite.setScale(0.85);
    }

    this.defenses.push({
      id: this.defenseId++,
      type,
      sprite,
      hp: stats.hp,
      maxHp: stats.hp,
      damage: stats.damage,
      range: stats.range,
      attackMs: stats.attackMs,
      lastAttack: 0
    });

    this.showMessage(`${this.capitalize(type)} dibangun.`);
    this.emitSnapshot(true);
  }

  private requestNextWave() {
    if (!this.running || this.pausedByUi || this.waveActive) {
      return;
    }
    this.nextWaveAt = this.time.now;
  }

  private updatePlayer(dt: number) {
    const move = new Phaser.Math.Vector2(0, 0);
    if (this.keys.W.isDown || this.keys.UP.isDown) {
      move.y -= 1;
    }
    if (this.keys.S.isDown || this.keys.DOWN.isDown) {
      move.y += 1;
    }
    if (this.keys.A.isDown || this.keys.LEFT.isDown) {
      move.x -= 1;
    }
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) {
      move.x += 1;
    }

    if (Math.abs(this.joystick.x) > 0.08 || Math.abs(this.joystick.y) > 0.08) {
      move.x += this.joystick.x;
      move.y += this.joystick.y;
    }

    if (move.lengthSq() > 0) {
      move.normalize();
      this.player.x = Phaser.Math.Clamp(this.player.x + move.x * this.playerSpeed * dt, 50, WORLD.width - 50);
      this.player.y = Phaser.Math.Clamp(this.player.y + move.y * this.playerSpeed * dt, 50, WORLD.height - 50);
      this.player.setRotation(move.x * 0.08);
      if (!this.player.anims.isPlaying) {
        this.player.play('player-walk');
      }
    } else {
      this.player.setRotation(0);
      if (this.player.anims.isPlaying) {
        this.player.stop();
        this.player.setTexture('player-walk-0');
      }
    }
    this.updatePlayerShadow();
  }

  private updatePlayerShadow() {
    const shadow = this.children.getByName('player-shadow') as Phaser.GameObjects.Image | null;
    shadow?.setPosition(this.player.x, this.player.y + 9);
  }

  private updateBlades(time: number, dt: number) {
    const blade = this.currentBlade();
    this.bladeAngle += blade.rotationSpeed * 3 * dt;

    for (let i = 0; i < this.blades.length; i += 1) {
      const bladeSprite = this.blades[i];
      if (i >= blade.bladeCount) {
        bladeSprite.setVisible(false);
        continue;
      }

      const offset = (Math.PI * 2 * i) / blade.bladeCount;
      const angle = this.bladeAngle + offset;
      const x = this.player.x + Math.cos(angle) * blade.radius;
      const y = this.player.y + Math.sin(angle) * blade.radius;
      bladeSprite.setVisible(true).setPosition(x, y).setRotation(angle);

      this.hitEnemiesWithBlade(time, bladeSprite.x, bladeSprite.y);
      this.hitResourcesWithBlade(time, bladeSprite.x, bladeSprite.y);
    }
  }

  private hitEnemiesWithBlade(time: number, bladeX: number, bladeY: number) {
    const blade = this.currentBlade();
    const cooldown = Math.max(110, 335 - blade.rotationSpeed * 35);
    for (const enemy of [...this.enemies]) {
      if (time - enemy.lastBladeHit < cooldown) {
        continue;
      }
      const hitDistance = enemy.kind === 'boss' ? 72 : 52;
      const distToBlade = Phaser.Math.Distance.Between(bladeX, bladeY, enemy.sprite.x, enemy.sprite.y);
      const distToPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y);
      if (distToBlade <= hitDistance || Math.abs(distToPlayer - blade.radius) <= 30) {
        enemy.lastBladeHit = time;
        const critical = Math.random() < blade.criticalChance;
        const damage = critical ? blade.damage * 2 : blade.damage;
        this.damageEnemy(enemy, damage, critical, blade.knockback);
      }
    }
  }

  private hitResourcesWithBlade(time: number, bladeX: number, bladeY: number) {
    const blade = this.currentBlade();
    for (const resource of this.resources) {
      if (!resource.alive || time - resource.lastBladeHit < 260) {
        continue;
      }
      if (Phaser.Math.Distance.Between(bladeX, bladeY, resource.sprite.x, resource.sprite.y) <= 44) {
        resource.lastBladeHit = time;
        resource.hp -= blade.damage;
        resource.sprite.setTint(0xffffff);
        this.time.delayedCall(80, () => resource.sprite.clearTint());
        this.spawnRing(resource.sprite.x, resource.sprite.y, RESOURCE_COLORS[resource.type]);
        if (resource.hp <= 0) {
          this.collectResource(resource);
        }
      }
    }
  }

  private updateDefenses(time: number) {
    const destroyed: Defense[] = [];

    for (const defense of this.defenses) {
      if (defense.hp <= 0) {
        destroyed.push(defense);
        continue;
      }

      if (defense.type === 'turret') {
        if (time - defense.lastAttack >= defense.attackMs) {
          const target = this.findNearestEnemy(defense.sprite.x, defense.sprite.y, defense.range);
          if (target) {
            defense.lastAttack = time;
            this.damageEnemy(target, defense.damage, false, 16, defense.sprite.x, defense.sprite.y);
            this.drawShot(defense.sprite.x, defense.sprite.y, target.sprite.x, target.sprite.y, 0x8bd3dd);
            defense.sprite.setRotation(Phaser.Math.Angle.Between(defense.sprite.x, defense.sprite.y, target.sprite.x, target.sprite.y) + Math.PI / 2);
          }
        }
      }

      if (defense.type === 'spike') {
        for (const enemy of this.enemies) {
          if (time - enemy.lastBladeHit < 250) {
            continue;
          }
          if (Phaser.Math.Distance.Between(defense.sprite.x, defense.sprite.y, enemy.sprite.x, enemy.sprite.y) <= 44) {
            enemy.lastBladeHit = time;
            this.damageEnemy(enemy, defense.damage, false, 6, defense.sprite.x, defense.sprite.y);
          }
        }
      }
    }

    if (destroyed.length > 0) {
      destroyed.forEach((defense) => defense.sprite.destroy());
      this.defenses = this.defenses.filter((defense) => !destroyed.includes(defense));
    }
  }

  private updateEnemies(time: number, dt: number) {
    const defeated: Enemy[] = [];

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        defeated.push(enemy);
        continue;
      }

      const target = this.findEnemyTarget(enemy);
      const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);

      if (distance <= enemy.attackRange) {
        if (time - enemy.lastAttack >= enemy.attackMs) {
          enemy.lastAttack = time;
          this.applyEnemyAttack(enemy, target);
        }
      } else {
        const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);
        enemy.sprite.x += Math.cos(angle) * enemy.speed * dt;
        enemy.sprite.y += Math.sin(angle) * enemy.speed * dt;
      }

      enemy.sprite.x += enemy.knockX * dt;
      enemy.sprite.y += enemy.knockY * dt;
      enemy.knockX *= 0.82;
      enemy.knockY *= 0.82;
      enemy.sprite.setDepth(enemy.sprite.y < this.player.y ? 4 : 6);
    }

    if (defeated.length > 0) {
      defeated.forEach((enemy) => this.killEnemy(enemy));
      this.enemies = this.enemies.filter((enemy) => !defeated.includes(enemy));
    }
  }

  private updateWave(time: number) {
    if (!this.waveActive) {
      if (this.nextWaveAt > 0 && time >= this.nextWaveAt) {
        this.startWave(time);
      }
      return;
    }

    if (this.waveSpawned < this.waveTarget && time >= this.nextSpawnAt) {
      this.spawnEnemy();
      this.waveSpawned += 1;
      this.nextSpawnAt = time + Math.max(500, 1400 - this.wave * 30);
    }

    if (this.waveSpawned >= this.waveTarget && this.enemies.length === 0) {
      this.completeWave(time);
    }
  }

  private updateResourceRespawns(time: number) {
    for (const resource of this.resources) {
      if (!resource.alive && resource.respawnAt > 0 && time >= resource.respawnAt) {
        resource.alive = true;
        resource.hp = resource.maxHp;
        resource.respawnAt = 0;
        resource.sprite.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: resource.sprite, alpha: 1, duration: 240 });
      }
    }
  }

  private updateAmbientAnimations(time: number) {
    this.baseRing.setScale(1 + Math.sin(time / 900) * 0.018);
    this.market.setY(MARKET_POS.y + Math.sin(time / 620) * 2);
  }

  private updateFloatingTexts(time: number) {
    const expired: FloatingText[] = [];
    for (const item of this.floatingTexts) {
      const progress = (time - item.bornAt) / 850;
      item.text.y -= 0.4;
      item.text.setAlpha(Phaser.Math.Clamp(1 - progress, 0, 1));
      if (progress >= 1) {
        expired.push(item);
      }
    }

    expired.forEach((item) => item.text.destroy());
    this.floatingTexts = this.floatingTexts.filter((item) => !expired.includes(item));
  }

  private collectResource(resource: ResourceNode) {
    resource.alive = false;
    resource.respawnAt = this.time.now + Phaser.Math.Between(6000, 12000);
    resource.sprite.setVisible(false);
    this.inventory[resource.type] += resource.amount;
    this.addXp(resource.type === 'wood' ? 6 : resource.type === 'stone' ? 10 : 16);
    this.spawnFloatingText(resource.sprite.x, resource.sprite.y - 18, `+${resource.amount} ${this.resourceLabel(resource.type)}`, RESOURCE_COLORS[resource.type]);
    this.showMessage(`${this.resourceLabel(resource.type)} masuk inventory.`);
  }

  private damageEnemy(
    enemy: Enemy,
    damage: number,
    critical: boolean,
    knockback: number,
    sourceX = this.player.x,
    sourceY = this.player.y
  ) {
    enemy.hp -= damage;
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, enemy.sprite.x, enemy.sprite.y);
    enemy.knockX += Math.cos(angle) * knockback * 2.5;
    enemy.knockY += Math.sin(angle) * knockback * 2.5;
    enemy.sprite.setTint(critical ? 0xfef08a : 0xffffff);
    this.time.delayedCall(75, () => enemy.sprite.clearTint());
    this.spawnFloatingText(enemy.sprite.x, enemy.sprite.y - 25, `${Math.ceil(damage)}`, critical ? 0xfef08a : 0xf8fafc);
    this.spawnRing(enemy.sprite.x, enemy.sprite.y, critical ? 0xfef08a : 0xff6b6b);
  }

  private killEnemy(enemy: Enemy) {
    this.coins += enemy.reward;
    this.addXp(enemy.xp);
    this.waveDefeated += 1;
    if (Math.random() < 0.28) {
      const loot: ResourceType = enemy.kind === 'skeleton' ? 'stone' : enemy.kind === 'boss' ? 'iron' : 'wood';
      const amount = enemy.kind === 'boss' ? 6 : 1;
      this.inventory[loot] += amount;
      this.spawnFloatingText(enemy.sprite.x + 8, enemy.sprite.y - 8, `+${amount} ${this.resourceLabel(loot)}`, RESOURCE_COLORS[loot]);
    }
    this.spawnFloatingText(enemy.sprite.x, enemy.sprite.y - 34, `+${enemy.reward} coin`, 0xfacc15);
    this.spawnCoinBurst(enemy.sprite.x, enemy.sprite.y);
    enemy.sprite.destroy();
  }

  private addXp(amount: number) {
    this.xp += amount;
    while (this.xp >= this.nextXp) {
      this.xp -= this.nextXp;
      this.playerLevel += 1;
      this.maxHp += 12;
      this.hp = Math.min(this.maxHp, this.hp + 28);
      this.playerSpeed += 4;
      this.nextXp = Math.floor(this.nextXp * 1.24 + 35);
      this.showMessage(`Level ${this.playerLevel}: HP dan speed meningkat.`);
      this.spawnRing(this.player.x, this.player.y, 0x8bd3dd);
    }
  }

  private startWave(time: number) {
    this.waveActive = true;
    this.waveTarget = 5 + this.wave * 2 + Math.floor(this.wave / 2) + (this.wave % 5 === 0 ? 1 : 0);
    this.waveSpawned = 0;
    this.waveDefeated = 0;
    this.nextSpawnAt = time + 500;
    this.nextWaveAt = 0;
    this.showMessage(`Wave ${this.wave} datang.`);
  }

  private completeWave(time: number) {
    this.waveActive = false;
    const coinBonus = 18 + this.wave * 8;
    this.coins += coinBonus;
    this.inventory.wood += 3 + Math.floor(this.wave / 3);
    if (this.wave >= 4) {
      this.inventory.stone += 1 + Math.floor(this.wave / 8);
    }
    if (this.wave >= 8) {
      this.inventory.iron += Math.floor(this.wave / 12);
    }
    this.addXp(20 + this.wave * 6);
    this.showMessage(`Wave ${this.wave} selesai. Bonus +${coinBonus} coin.`);
    this.wave += 1;
    this.nextWaveAt = time + 8000;
    this.emitSnapshot(true);
  }

  private spawnEnemy() {
    const kind = this.pickEnemyKind();
    const config = ENEMY_CONFIGS[kind];
    const side = Phaser.Math.Between(0, 3);
    let x = 0;
    let y = 0;
    if (side === 0) {
      x = Phaser.Math.Between(40, WORLD.width - 40);
      y = 30;
    } else if (side === 1) {
      x = WORLD.width - 30;
      y = Phaser.Math.Between(40, WORLD.height - 40);
    } else if (side === 2) {
      x = Phaser.Math.Between(40, WORLD.width - 40);
      y = WORLD.height - 30;
    } else {
      x = 30;
      y = Phaser.Math.Between(40, WORLD.height - 40);
    }

    const waveScale = 1 + Math.max(0, this.wave - 1) * 0.22;
    const sprite = this.add.sprite(x, y, config.animKey.replace('-walk', '-0')).setScale(config.scale).setDepth(5);
    sprite.play(config.animKey);
    this.enemies.push({
      id: this.enemyId++,
      kind,
      sprite,
      hp: Math.ceil(config.hp * waveScale),
      maxHp: Math.ceil(config.hp * waveScale),
      speed: Math.min(180, config.speed + this.wave * 3),
      damage: Math.ceil(config.damage * (1 + this.wave * 0.11)),
      reward: Math.ceil(config.reward * (1 + this.wave * 0.08)),
      xp: Math.ceil(config.xp * (1 + this.wave * 0.05)),
      attackRange: config.attackRange + Math.min(30, this.wave * 2),
      attackMs: Math.max(400, config.attackMs - this.wave * 15),
      lastAttack: 0,
      lastBladeHit: 0,
      knockX: 0,
      knockY: 0
    });
  }

  private pickEnemyKind(): EnemyKind {
    if (this.wave % 5 === 0 && this.waveSpawned === this.waveTarget - 1) {
      return 'boss';
    }
    const roll = Math.random();
    if (this.wave >= 7 && roll > 0.72) {
      return 'skeleton';
    }
    if (this.wave >= 3 && roll > 0.46) {
      return 'goblin';
    }
    return 'slime';
  }

  private findEnemyTarget(enemy: Enemy) {
    const nearbyDefense = this.findNearestDefense(enemy.sprite.x, enemy.sprite.y, 130);
    if (nearbyDefense) {
      return {
        x: nearbyDefense.sprite.x,
        y: nearbyDefense.sprite.y,
        type: 'defense' as const,
        defense: nearbyDefense
      };
    }

    const playerDistance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);
    if (playerDistance < 450) {
      return { x: this.player.x, y: this.player.y, type: 'player' as const };
    }

    return { x: PLAYER_START.x, y: PLAYER_START.y, type: 'base' as const };
  }

  private applyEnemyAttack(enemy: Enemy, target: ReturnType<SurvivalScene['findEnemyTarget']>) {
    if (enemy.kind === 'skeleton') {
      this.drawShot(enemy.sprite.x, enemy.sprite.y, target.x, target.y, 0xf8fafc);
    } else {
      this.spawnRing(target.x, target.y, 0xff6b6b);
    }

    if (target.type === 'player') {
      this.hp -= enemy.damage;
      this.player.setTint(0xffadad);
      this.time.delayedCall(90, () => this.player.clearTint());
      if (this.hp <= 0) {
        this.handlePlayerDeath();
      }
    } else if (target.type === 'base') {
      this.baseHp -= enemy.damage;
      this.base.setTint(0xffadad);
      this.time.delayedCall(90, () => this.base.clearTint());
      if (this.baseHp <= 0) {
        this.handleBaseDestroyed();
      }
    } else {
      target.defense.hp -= enemy.damage;
      target.defense.sprite.setTint(0xffadad);
      this.time.delayedCall(90, () => target.defense.sprite.clearTint());
    }
  }

  private handlePlayerDeath() {
    this.hp = 0;
    this.deadUntil = this.time.now + 2300;
    this.player.setVisible(false);
    this.blades.forEach((blade) => blade.setVisible(false));
    this.inventory.wood = Math.floor(this.inventory.wood * 0.65);
    this.inventory.stone = Math.floor(this.inventory.stone * 0.65);
    this.inventory.iron = Math.floor(this.inventory.iron * 0.65);
    this.showMessage('Player tumbang. Resource berkurang, coin tetap aman.');
    this.cameras.main.shake(260, 0.01);
  }

  private respawnPlayer() {
    this.deadUntil = 0;
    this.hp = this.maxHp;
    this.player.setPosition(PLAYER_START.x, PLAYER_START.y + 80).setVisible(true).clearTint();
    this.updatePlayerShadow();
    this.showMessage('Respawn di base.');
  }

  private handleBaseDestroyed() {
    this.baseHp = BASE_MAX_HP;
    this.waveActive = false;
    this.waveSpawned = 0;
    this.waveDefeated = 0;
    this.nextWaveAt = this.time.now + 7000;
    this.enemies.forEach((enemy) => enemy.sprite.destroy());
    this.enemies = [];
    this.inventory.wood = Math.floor(this.inventory.wood * 0.72);
    this.inventory.stone = Math.floor(this.inventory.stone * 0.72);
    this.inventory.iron = Math.floor(this.inventory.iron * 0.72);
    this.showMessage('Base hancur. Wave gagal dan resource berkurang.');
    this.cameras.main.shake(420, 0.016);
  }

  private findNearestEnemy(x: number, y: number, range: number) {
    let best: Enemy | undefined;
    let bestDistance = range;
    for (const enemy of this.enemies) {
      const distance = Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y);
      if (distance < bestDistance) {
        best = enemy;
        bestDistance = distance;
      }
    }
    return best;
  }

  private findNearestDefense(x: number, y: number, range: number) {
    let best: Defense | undefined;
    let bestDistance = range;
    for (const defense of this.defenses) {
      const distance = Phaser.Math.Distance.Between(x, y, defense.sprite.x, defense.sprite.y);
      if (distance < bestDistance) {
        best = defense;
        bestDistance = distance;
      }
    }
    return best;
  }

  private findPlacementPosition() {
    const angle = Phaser.Math.Angle.Between(PLAYER_START.x, PLAYER_START.y, this.player.x, this.player.y);
    const distanceFromPlayer = 82;
    const x = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distanceFromPlayer, 90, WORLD.width - 90);
    const y = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distanceFromPlayer, 90, WORLD.height - 90);
    const tooClose = this.defenses.some((defense) => Phaser.Math.Distance.Between(x, y, defense.sprite.x, defense.sprite.y) < 66);
    const baseDistance = Phaser.Math.Distance.Between(x, y, PLAYER_START.x, PLAYER_START.y);

    if (tooClose || baseDistance > 520) {
      return null;
    }
    return { x, y };
  }

  private getDefenseStats(type: DefenseType) {
    if (type === 'wall') {
      return { hp: 170, damage: 0, range: 0, attackMs: 99999 };
    }
    if (type === 'turret') {
      return { hp: 92, damage: 18 + this.playerLevel * 2, range: 260, attackMs: 620 };
    }
    return { hp: 80, damage: 13 + this.playerLevel, range: 44, attackMs: 420 };
  }

  private currentBlade() {
    return BLADE_LEVELS[this.bladeLevel - 1];
  }

  private ensureBladeSprites() {
    const blade = this.currentBlade();
    const texture = this.bladeTextureKey(blade.level);
    while (this.blades.length < blade.bladeCount) {
      const sprite = this.add.image(this.player.x, this.player.y, texture).setDepth(7);
      this.blades.push(sprite);
    }

    for (const sprite of this.blades) {
      sprite.setTexture(texture).setVisible(true);
    }
  }

  private bladeTextureKey(level: number) {
    if (level === 1) {
      return 'blade-wood';
    }
    if (level === 2) {
      return 'blade-iron';
    }
    if (level === 3) {
      return 'blade-dual';
    }
    if (level === 4) {
      return 'blade-fire';
    }
    if (level === 5) {
      return 'blade-lightning';
    }
    return 'blade-legendary';
  }

  private canAfford(cost: Cost) {
    return (
      this.coins >= (cost.coins ?? 0) &&
      this.inventory.wood >= (cost.wood ?? 0) &&
      this.inventory.stone >= (cost.stone ?? 0) &&
      this.inventory.iron >= (cost.iron ?? 0)
    );
  }

  private payCost(cost: Cost) {
    this.coins -= cost.coins ?? 0;
    this.inventory.wood -= cost.wood ?? 0;
    this.inventory.stone -= cost.stone ?? 0;
    this.inventory.iron -= cost.iron ?? 0;
  }

  private isNearMarket() {
    const nearMarket = Phaser.Math.Distance.Between(this.player.x, this.player.y, MARKET_POS.x, MARKET_POS.y) <= 180;
    const nearBase = Phaser.Math.Distance.Between(this.player.x, this.player.y, PLAYER_START.x, PLAYER_START.y) <= 210;
    return nearMarket || nearBase;
  }

  private emitSnapshot(force = false) {
    const now = this.time?.now ?? 0;
    if (!force && now - this.lastSnapshotAt < 120) {
      return;
    }
    this.lastSnapshotAt = now;

    const current = this.currentBlade();
    const blade: BladeSnapshot = {
      level: current.level,
      name: current.name,
      damage: current.damage,
      rotationSpeed: current.rotationSpeed,
      radius: current.radius,
      bladeCount: current.bladeCount,
      criticalChance: current.criticalChance,
      knockback: current.knockback,
      nextCost: current.costToNext
    };

    const dots = [
      ...this.enemies.slice(0, 22).map((enemy) => ({ x: enemy.sprite.x, y: enemy.sprite.y, kind: enemy.kind })),
      ...this.defenses.slice(0, 14).map((defense) => ({ x: defense.sprite.x, y: defense.sprite.y, kind: defense.type }))
    ];

    const snapshot: GameSnapshot = {
      hp: Math.max(0, Math.ceil(this.hp)),
      maxHp: this.maxHp,
      baseHp: Math.max(0, Math.ceil(this.baseHp)),
      baseMaxHp: BASE_MAX_HP,
      coins: this.coins,
      inventory: { ...this.inventory },
      xp: this.xp,
      nextXp: this.nextXp,
      playerLevel: this.playerLevel,
      wave: this.wave,
      waveTarget: this.waveTarget,
      waveDefeated: this.waveDefeated,
      waveActive: this.waveActive,
      enemiesAlive: this.enemies.length,
      blade,
      message: now <= this.messageUntil || this.messageUntil === 0 ? this.message : '',
      canSell: this.isNearMarket(),
      canUpgradeBlade: current.costToNext ? this.canAfford(current.costToNext) : false,
      player: { x: this.player.x, y: this.player.y },
      base: { x: PLAYER_START.x, y: PLAYER_START.y },
      market: { x: MARKET_POS.x, y: MARKET_POS.y },
      world: { ...WORLD },
      dots,
      defenses: this.defenses.length
    };

    gameEvents.emit('game:snapshot', snapshot);
  }

  private spawnFloatingText(x: number, y: number, label: string, color: number) {
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '18px',
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        stroke: '#111827',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.floatingTexts.push({ text, bornAt: this.time.now });
  }

  private spawnRing(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 8).setStrokeStyle(2, color, 0.9).setDepth(9);
    this.tweens.add({
      targets: ring,
      radius: 30,
      alpha: 0,
      duration: 240,
      onComplete: () => ring.destroy()
    });
  }

  private spawnCoinBurst(x: number, y: number) {
    if (this.muted) {
      return;
    }
    for (let i = 0; i < 5; i += 1) {
      const coin = this.add.circle(x, y, 4, 0xfacc15, 1).setDepth(10);
      this.tweens.add({
        targets: coin,
        x: x + Phaser.Math.Between(-28, 28),
        y: y + Phaser.Math.Between(-36, -12),
        alpha: 0,
        duration: 430,
        ease: 'Quad.easeOut',
        onComplete: () => coin.destroy()
      });
    }
  }

  private drawShot(x1: number, y1: number, x2: number, y2: number, color: number) {
    const graphics = this.add.graphics().setDepth(12);
    graphics.lineStyle(3, color, 0.9);
    graphics.lineBetween(x1, y1, x2, y2);
    this.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 140,
      onComplete: () => graphics.destroy()
    });
  }

  private showMessage(message: string) {
    this.message = message;
    this.messageUntil = this.time.now + 3400;
  }

  private resourceLabel(type: ResourceType) {
    if (type === 'wood') {
      return 'Kayu';
    }
    if (type === 'stone') {
      return 'Batu';
    }
    return 'Besi';
  }

  private capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
