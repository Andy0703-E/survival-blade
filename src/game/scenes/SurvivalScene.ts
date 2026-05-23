import Phaser from 'phaser';
import { gameEvents } from '../EventBus';
import type { BladeSnapshot, Cost, GameSnapshot, Inventory, ResourceType } from '../../store/useGameStore';
import { AudioController } from '../AudioController';

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
  spike: { coins: 55, wood: 10, stone: 10 },
  healingWard: { coins: 150, wood: 30, stone: 20 },
  tarTrap: { coins: 65, wood: 5, stone: 15 }
};

const BLADE_LEVELS: Array<BladeSnapshot & { color: number; costToNext?: Cost; element: 'none' | 'fire' | 'lightning' }> = [
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
    element: 'none',
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
    element: 'none',
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
    element: 'none',
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
    element: 'fire',
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
    element: 'lightning',
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
    color: 0xe879f9,
    element: 'none'
  }
];

type EnemyKind = 'slime' | 'goblin' | 'skeleton' | 'boss';
type ResourceNodeType = ResourceType;
type DefenseType = 'wall' | 'turret' | 'spike' | 'healingWard' | 'tarTrap';

interface MovementKeys {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
  UP: Phaser.Input.Keyboard.Key;
  DOWN: Phaser.Input.Keyboard.Key;
  LEFT: Phaser.Input.Keyboard.Key;
  RIGHT: Phaser.Input.Keyboard.Key;
  SPACE: Phaser.Input.Keyboard.Key;
  SHIFT: Phaser.Input.Keyboard.Key;
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
  burnUntil?: number;
  lastBurnTick?: number;
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
    scale: 3
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
    scale: 3.5
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
    scale: 3.5
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
    scale: 6
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

  private audio = new AudioController();
  
  private dashUntil = 0;
  private dashCooldown = 0;
  private dashRing?: Phaser.GameObjects.Arc;

  private dayNightOverlay?: Phaser.GameObjects.Rectangle;
  private isNight = false;

  private hitParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
  
  private baseIndicator?: Phaser.GameObjects.Image;
  private marketIndicator?: Phaser.GameObjects.Image;
  
  private enemyProjectiles: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('SurvivalScene');
  }

  preload() {
    this.load.image('bg-tree', 'assets/kenney/tiny-town/Tiles/tile_0016.png');
    this.load.image('bg-bush', 'assets/kenney/tiny-town/Tiles/tile_0017.png');
    this.load.image('bg-rock', 'assets/kenney/tiny-town/Tiles/tile_0028.png');

    this.load.image('player-walk-0', 'assets/kenney/dungeon/Tiles/tile_0084.png');
    this.load.image('player-walk-1', 'assets/kenney/dungeon/Tiles/tile_0084.png'); // use same tile to prevent shape-shifting
    
    this.load.image('enemy-slime-0', 'assets/kenney/dungeon/Tiles/tile_0099.png');
    this.load.image('enemy-slime-1', 'assets/kenney/dungeon/Tiles/tile_0099.png');
    
    this.load.image('enemy-goblin-0', 'assets/kenney/dungeon/Tiles/tile_0100.png');
    this.load.image('enemy-goblin-1', 'assets/kenney/dungeon/Tiles/tile_0100.png');
    
    this.load.image('enemy-skeleton-0', 'assets/kenney/dungeon/Tiles/tile_0109.png');
    this.load.image('enemy-skeleton-1', 'assets/kenney/dungeon/Tiles/tile_0109.png');
    
    this.load.image('enemy-boss-0', 'assets/kenney/dungeon/Tiles/tile_0097.png');
    this.load.image('enemy-boss-1', 'assets/kenney/dungeon/Tiles/tile_0097.png');

    this.load.image('projectile-bone', 'assets/kenney/dungeon/Tiles/tile_0130.png');
    
    this.load.image('defense-healingWard', 'assets/kenney/tiny-town/Tiles/tile_0114.png');
    this.load.image('defense-tarTrap', 'assets/kenney/dungeon/Tiles/tile_0061.png');

    this.load.image('resource-wood', 'assets/kenney/tiny-town/Tiles/tile_0004.png');
    this.load.image('resource-stone', 'assets/kenney/dungeon/Tiles/tile_0057.png');
    this.load.image('resource-iron', 'assets/kenney/dungeon/Tiles/tile_0058.png');

    this.load.image('base', 'assets/kenney/tiny-town/Tiles/tile_0104.png');
    this.load.image('market', 'assets/kenney/tiny-town/Tiles/tile_0056.png');

    this.load.image('defense-wall', 'assets/kenney/dungeon/Tiles/tile_0012.png');
    this.load.image('defense-turret', 'assets/kenney/dungeon/Tiles/tile_0038.png');
    this.load.image('defense-spike', 'assets/kenney/dungeon/Tiles/tile_0068.png');

    this.load.image('blade-wood', 'assets/kenney/dungeon/Tiles/tile_0080.png');
    this.load.image('blade-iron', 'assets/kenney/dungeon/Tiles/tile_0081.png');
    this.load.image('blade-dual', 'assets/kenney/dungeon/Tiles/tile_0081.png');
    this.load.image('blade-fire', 'assets/kenney/dungeon/Tiles/tile_0082.png');
    this.load.image('blade-lightning', 'assets/kenney/dungeon/Tiles/tile_0083.png');
    this.load.image('blade-legendary', 'assets/kenney/dungeon/Tiles/tile_0083.png');
  }

  create() {
    this.anims.create({
      key: 'player-walk',
      frames: [{ key: 'player-walk-0' }, { key: 'player-walk-1' }],
      frameRate: 6,
      repeat: -1
    });
    this.anims.create({ key: 'enemy-slime-walk', frames: [{ key: 'enemy-slime-0' }, { key: 'enemy-slime-1' }], frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'enemy-goblin-walk', frames: [{ key: 'enemy-goblin-0' }, { key: 'enemy-goblin-1' }], frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'enemy-skeleton-walk', frames: [{ key: 'enemy-skeleton-0' }, { key: 'enemy-skeleton-1' }], frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'enemy-boss-walk', frames: [{ key: 'enemy-boss-0' }, { key: 'enemy-boss-1' }], frameRate: 6, repeat: -1 });

    this.createWorld();

    this.input.on('pointerdown', () => {
      this.audio.init();
      if (this.pausedByUi || !this.running || this.deadUntil > this.time.now) return;
      const ptr = this.input.activePointer;
      const targetX = ptr.worldX;
      const targetY = ptr.worldY;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY);
      if (dist > 10) {
        this.joystick = { x: (targetX - this.player.x) / dist, y: (targetY - this.player.y) / dist };
      }
    });

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT') as MovementKeys;
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
    this.updateEnemyProjectiles(time, dt);
    this.updateWave(time);
    this.updateDayNight(time);
    this.updateIndicators();
    this.emitSnapshot();
  }



  private createWorld() {
    this.createBackground();

    this.baseRing = this.add.circle(PLAYER_START.x, PLAYER_START.y, 176, 0x2f6f53, 0.13);
    this.baseRing.setStrokeStyle(3, 0x6ee7b7, 0.45).setDepth(0.6);
    this.base = this.add.image(PLAYER_START.x, PLAYER_START.y, 'base').setDepth(2).setScale(6);
    this.market = this.add.image(MARKET_POS.x, MARKET_POS.y, 'market').setDepth(2).setScale(5);

    this.dashRing = this.add.circle(PLAYER_START.x, PLAYER_START.y + 24, 16, 0x3b82f6, 0).setDepth(4.1);
    this.dashRing.setStrokeStyle(3, 0x3b82f6, 1);

    this.player = this.add.sprite(PLAYER_START.x, PLAYER_START.y + 80, 'player-walk-0').setDepth(5).setScale(3.5);
    this.player.play('player-walk');
    this.add.ellipse(this.player.x, this.player.y + 24, 36, 12, 0x000000, 0.4).setDepth(4).setName('player-shadow');

    this.dayNightOverlay = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x050814, 0)
      .setDepth(999)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.hitParticles = this.add.particles(0, 0, 'projectile-bone', {
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      speed: { min: 50, max: 200 },
      lifespan: 400,
      blendMode: 'ADD',
      emitting: false
    }).setDepth(100);

    this.baseIndicator = this.add.image(0, 0, 'base').setScale(2).setDepth(1000).setAlpha(0.6).setVisible(false);
    this.marketIndicator = this.add.image(0, 0, 'market').setScale(2).setDepth(1000).setAlpha(0.6).setVisible(false);

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

    // Scatter props (trees, bushes, rocks)
    for (let i = 0; i < 400; i++) {
      const x = rng.between(20, WORLD.width - 20);
      const y = rng.between(20, WORLD.height - 20);
      
      // Keep clear area around base and market
      const distBase = Phaser.Math.Distance.Between(x, y, PLAYER_START.x, PLAYER_START.y);
      const distMarket = Phaser.Math.Distance.Between(x, y, MARKET_POS.x, MARKET_POS.y);
      if (distBase < 280 || distMarket < 220) continue;

      const propType = rng.between(0, 100);
      let key = 'bg-bush';
      let scale = rng.realInRange(2, 3);
      
      if (propType < 40) {
        key = 'bg-tree';
        scale = rng.realInRange(2.5, 4);
      } else if (propType < 55) {
        key = 'bg-rock';
        scale = rng.realInRange(1.5, 2.5);
      }

      const img = this.add.image(x, y, key).setScale(scale).setDepth(0.5);
      
      // Randomly tint trees/bushes for variety
      if (key === 'bg-tree' || key === 'bg-bush') {
        const shade = rng.between(150, 255);
        img.setTint(Phaser.Display.Color.GetColor(shade, 255, shade));
      } else {
        const shade = rng.between(200, 255);
        img.setTint(Phaser.Display.Color.GetColor(shade, shade, shade));
      }
    }
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
      .setDepth(2)
      .setScale(4);
    if (type === 'iron') {
      sprite.setTint(0xbbbbbb);
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
    const cost = 25;
    if (this.hp >= this.maxHp) {
      this.showMessage('HP sudah penuh.');
      return;
    }
    if (this.coins < cost) {
      this.showMessage(`Butuh ${cost} koin untuk heal.`);
      return;
    }
    this.coins -= cost;
    this.hp = Math.min(this.maxHp, this.hp + 40);
    this.spawnRing(this.player.x, this.player.y, 0x6ee7b7);
    this.showMessage('Player disembuhkan.');
    this.emitSnapshot(true);
  }

  private damagePlayer(amount: number) {
    if (this.deadUntil > 0) return;
    this.hp -= amount;
    this.audio.playHit();
    this.cameras.main.shake(100, 0.01);
    this.player.setTint(0xffadad);
    this.time.delayedCall(150, () => this.player.clearTint());
    if (this.hp <= 0) {
      this.killPlayer();
    }
  }

  private damageBase(amount: number) {
    this.baseHp -= amount;
    this.cameras.main.shake(150, 0.02);
    this.base.setTint(0xffadad);
    this.time.delayedCall(150, () => this.base.clearTint());
    if (this.baseHp <= 0) {
      this.running = false;
      this.message = 'Base Hancur! Anda kalah.';
      this.audio.playGameOver();
      this.emitSnapshot(true);
    }
  }

  private killPlayer() {
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
    const sprite = this.add.image(placement.x, placement.y, texture).setDepth(3).setScale(4);
    if (type === 'spike') {
      sprite.setScale(3.5);
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
    if (this.keys.W.isDown || this.keys.UP.isDown) move.y -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) move.y += 1;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) move.x -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) move.x += 1;

    if (Math.abs(this.joystick.x) > 0.08 || Math.abs(this.joystick.y) > 0.08) {
      move.x += this.joystick.x;
      move.y += this.joystick.y;
    }

    const isDashing = this.time.now < this.dashUntil;
    if (!isDashing && (this.keys.SPACE.isDown || this.keys.SHIFT.isDown) && this.time.now > this.dashCooldown && move.lengthSq() > 0) {
      this.dashUntil = this.time.now + 200;
      this.dashCooldown = this.time.now + 2000;
      this.audio.playDash();
    }
    
    if (this.dashRing) {
      this.dashRing.setPosition(this.player.x, this.player.y + 24);
      this.dashRing.setStrokeStyle(3, 0x3b82f6, this.time.now < this.dashCooldown ? 0.2 : 1);
    }

    const speedMult = isDashing ? 3 : 1;

    if (move.lengthSq() > 0) {
      move.normalize();
      this.player.x = Phaser.Math.Clamp(this.player.x + move.x * this.playerSpeed * speedMult * dt, 50, WORLD.width - 50);
      this.player.y = Phaser.Math.Clamp(this.player.y + move.y * this.playerSpeed * speedMult * dt, 50, WORLD.height - 50);
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

  private updateDayNight(time: number) {
    if (!this.dayNightOverlay) return;
    const cyclePeriod = 80000; 
    const phase = (time % cyclePeriod) / cyclePeriod;
    const darkness = Math.max(0, Math.sin(phase * Math.PI * 2));
    this.dayNightOverlay.setAlpha(darkness * 0.85);
    this.isNight = darkness > 0.4;
  }

  private updateIndicators() {
    if (!this.baseIndicator || !this.marketIndicator) return;
    const cam = this.cameras.main;
    const padding = 30;
    
    const updateInd = (ind: Phaser.GameObjects.Image, target: {x:number,y:number}) => {
      const bounds = cam.worldView;
      if (bounds.contains(target.x, target.y)) {
        ind.setVisible(false);
      } else {
        ind.setVisible(true);
        ind.x = Phaser.Math.Clamp(target.x, bounds.left + padding, bounds.right - padding);
        ind.y = Phaser.Math.Clamp(target.y, bounds.top + padding, bounds.bottom - padding);
      }
    };
    updateInd(this.baseIndicator, PLAYER_START);
    updateInd(this.marketIndicator, MARKET_POS);
  }

  private updateEnemyProjectiles(time: number, dt: number) {
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];
      proj.x += proj.getData('vx') * dt;
      proj.y += proj.getData('vy') * dt;
      proj.setRotation(proj.rotation + 10 * dt);
      
      const life = proj.getData('life');
      if (time > life) {
        proj.destroy();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
      
      const dist = Phaser.Math.Distance.Between(proj.x, proj.y, this.player.x, this.player.y);
      if (dist < 30) {
        this.damagePlayer(proj.getData('damage'));
        proj.destroy();
        this.enemyProjectiles.splice(i, 1);
      } else if (Phaser.Math.Distance.Between(proj.x, proj.y, PLAYER_START.x, PLAYER_START.y) < 170) {
        this.damageBase(proj.getData('damage'));
        proj.destroy();
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  private updatePlayerShadow() {
    const shadow = this.children.getByName('player-shadow') as Phaser.GameObjects.Ellipse | null;
    shadow?.setPosition(this.player.x, this.player.y + 24);
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

        if (this.hitParticles) {
          this.hitParticles.emitParticleAt(enemy.sprite.x, enemy.sprite.y, 3);
        }

        if (blade.element === 'fire') {
          enemy.burnUntil = time + 3000;
          enemy.lastBurnTick = time;
        } else if (blade.element === 'lightning') {
          const targets = [...this.enemies]
            .filter((e) => e.id !== enemy.id && Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, enemy.sprite.x, enemy.sprite.y) <= 160)
            .sort((a, b) => Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, enemy.sprite.x, enemy.sprite.y) - Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, enemy.sprite.x, enemy.sprite.y))
            .slice(0, 2);
          
          for (const t of targets) {
            t.lastBladeHit = time;
            this.damageEnemy(t, damage * 0.5, false, 0, enemy.sprite.x, enemy.sprite.y);
            this.drawShot(enemy.sprite.x, enemy.sprite.y, t.sprite.x, t.sprite.y, 0xf6e05e);
          }
        }
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
        if (this.hitParticles) {
          this.hitParticles.emitParticleAt(resource.sprite.x, resource.sprite.y, 2);
        }
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

      if (defense.type === 'healingWard') {
        if (time - defense.lastAttack >= 1500) {
          defense.lastAttack = time;
          if (Phaser.Math.Distance.Between(defense.sprite.x, defense.sprite.y, this.player.x, this.player.y) <= 140) {
            if (this.hp < this.maxHp) {
              this.hp = Math.min(this.maxHp, this.hp + 2);
              this.spawnRing(this.player.x, this.player.y, 0x6ee7b7);
              this.emitSnapshot();
            }
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

      if (enemy.burnUntil && time < enemy.burnUntil) {
        if (time - (enemy.lastBurnTick || 0) >= 500) {
          enemy.lastBurnTick = time;
          this.damageEnemy(enemy, 5, false, 0);
        }
      }

      const target = this.findEnemyTarget(enemy);
      const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);
      const isRanged = enemy.kind === 'skeleton';
      const effectiveRange = isRanged ? 280 : enemy.attackRange;

      if (distance <= effectiveRange) {
        if (time - enemy.lastAttack >= enemy.attackMs) {
          enemy.lastAttack = time;
          if (isRanged) {
            this.fireEnemyProjectile(enemy, target);
          } else {
            this.applyEnemyAttack(enemy, target);
          }
        }
      } else {
        const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);
        let speed = enemy.speed;

        for (const defense of this.defenses) {
          if (defense.type === 'tarTrap' && Phaser.Math.Distance.Between(defense.sprite.x, defense.sprite.y, enemy.sprite.x, enemy.sprite.y) <= 60) {
            speed *= 0.4;
            break;
          }
        }

        if (this.isNight) speed *= 1.2;

        enemy.sprite.x += Math.cos(angle) * speed * dt;
        enemy.sprite.y += Math.sin(angle) * speed * dt;
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
    
    if (enemy.burnUntil && this.time.now < enemy.burnUntil) {
      enemy.sprite.setTint(0xf97316);
    } else {
      enemy.sprite.setTint(critical ? 0xfef08a : 0xffffff);
    }
    
    this.time.delayedCall(75, () => {
      if (enemy.burnUntil && this.time.now < enemy.burnUntil) {
        enemy.sprite.setTint(0xf97316);
      } else {
        enemy.sprite.clearTint()
      }
    });
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

  private fireEnemyProjectile(enemy: Enemy, target: {x:number, y:number, type: string}) {
    const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);
    const speed = 200;
    const proj = this.add.image(enemy.sprite.x, enemy.sprite.y, 'projectile-bone').setDepth(5).setScale(3);
    proj.setData('vx', Math.cos(angle) * speed);
    proj.setData('vy', Math.sin(angle) * speed);
    proj.setData('life', this.time.now + 2500);
    proj.setData('damage', enemy.damage * (this.isNight ? 1.5 : 1));
    this.enemyProjectiles.push(proj);
  }

  private applyEnemyAttack(enemy: Enemy, target: { type: string; defense?: Defense; x: number; y: number }) {
    if (this.deadUntil > 0) return;
    const time = this.time.now;
    this.spawnRing(target.x, target.y, 0xff6b6b);

    enemy.lastAttack = time;
    const dmg = enemy.damage * (this.isNight ? 1.5 : 1);
    if (target.type === 'player') {
      this.damagePlayer(dmg);
    } else if (target.type === 'base') {
      this.damageBase(dmg);
    } else if (target.type === 'defense' && target.defense) {
      target.defense.hp -= dmg;
      target.defense.sprite.setTint(0xffadad);
      this.time.delayedCall(150, () => {
        if (target.defense) target.defense.sprite.clearTint();
      });
      if (target.defense.hp <= 0) {
        target.defense.sprite.destroy();
        this.defenses = this.defenses.filter((d) => d.id !== target.defense!.id);
      }
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
      const sprite = this.add.image(this.player.x, this.player.y, texture).setDepth(7).setScale(3);
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
      defenses: this.defenses.length,
      gameOver: this.baseHp <= 0
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
