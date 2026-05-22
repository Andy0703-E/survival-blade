import { CSSProperties, PointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Coins,
  Hammer,
  HeartPulse,
  Home,
  Menu,
  Package,
  Pause,
  Play,
  Settings,
  Shield,
  ShoppingCart,
  Swords,
  Trophy,
  Trees,
  Zap
} from 'lucide-react';
import PhaserGame from './game/PhaserGame';
import { gameEvents } from './game/EventBus';
import {
  Cost,
  GameSnapshot,
  PanelState,
  ResourceType,
  useGameStore
} from './store/useGameStore';

const RESOURCE_LABELS: Record<ResourceType, string> = {
  wood: 'Kayu',
  stone: 'Batu',
  iron: 'Besi'
};

const BUILD_COSTS: Array<{ type: 'wall' | 'turret' | 'spike'; label: string; icon: typeof Shield; cost: Cost }> = [
  { type: 'wall', label: 'Wall', icon: Shield, cost: { coins: 35, wood: 14 } },
  { type: 'turret', label: 'Turret', icon: Zap, cost: { coins: 95, wood: 24, stone: 12 } },
  { type: 'spike', label: 'Spike', icon: Swords, cost: { coins: 55, wood: 10, stone: 10 } }
];

export default function App() {
  const { screen, panel, snapshot, muted, setScreen, setPanel, setSnapshot, setMuted } = useGameStore();
  const [bestWave, setBestWave] = useState(() => Number(localStorage.getItem('survivalBladeBestWave') ?? 1));
  const [bestCoins, setBestCoins] = useState(() => Number(localStorage.getItem('survivalBladeBestCoins') ?? 0));

  useEffect(() => {
    const onSnapshot = (nextSnapshot: GameSnapshot) => setSnapshot(nextSnapshot);
    gameEvents.on('game:snapshot', onSnapshot);
    return () => {
      gameEvents.off('game:snapshot', onSnapshot);
    };
  }, [setSnapshot]);

  useEffect(() => {
    const completedWave = Math.max(1, snapshot.wave - (snapshot.waveActive ? 0 : 1));
    if (completedWave > bestWave) {
      setBestWave(completedWave);
      localStorage.setItem('survivalBladeBestWave', String(completedWave));
    }
    if (snapshot.coins > bestCoins) {
      setBestCoins(snapshot.coins);
      localStorage.setItem('survivalBladeBestCoins', String(snapshot.coins));
    }
  }, [bestCoins, bestWave, snapshot.coins, snapshot.wave, snapshot.waveActive]);

  const startGame = () => {
    setScreen('playing');
    setPanel('none');
    gameEvents.emit('ui:start');
  };

  const pauseGame = () => {
    setScreen('paused');
    gameEvents.emit('ui:pause');
  };

  const resumeGame = () => {
    setScreen('playing');
    gameEvents.emit('ui:resume');
  };

  const returnToMenu = () => {
    setScreen('menu');
    setPanel('none');
    gameEvents.emit('ui:menu');
  };

  const togglePanel = (nextPanel: PanelState) => {
    setPanel(panel === nextPanel ? 'none' : nextPanel);
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    gameEvents.emit('ui:setMute', nextMuted);
  };

  return (
    <main className="game-root">
      <PhaserGame />
      <div className="hud-layer">
        {screen !== 'menu' && (
          <>
            <TopHud snapshot={snapshot} onPause={pauseGame} />
            <ActionRail
              snapshot={snapshot}
              panel={panel}
              onPanel={togglePanel}
              onSell={() => gameEvents.emit('ui:sell')}
              onHeal={() => gameEvents.emit('ui:heal')}
              onNextWave={() => gameEvents.emit('ui:nextWave')}
            />
            <MiniMap snapshot={snapshot} />
            <MessageToast message={snapshot.message} />
            <VirtualJoystick />
          </>
        )}

        {screen === 'menu' && (
          <MainMenu
            bestWave={bestWave}
            bestCoins={bestCoins}
            panel={panel}
            onPlay={startGame}
            onPanel={togglePanel}
            muted={muted}
            onMute={toggleMute}
          />
        )}

        {screen === 'paused' && (
          <PauseOverlay onResume={resumeGame} onMenu={returnToMenu} muted={muted} onMute={toggleMute} />
        )}

        {screen !== 'menu' && panel !== 'none' && (
          <SidePanel
            panel={panel}
            snapshot={snapshot}
            muted={muted}
            onClose={() => setPanel('none')}
            onSell={() => gameEvents.emit('ui:sell')}
            onUpgrade={() => gameEvents.emit('ui:upgradeBlade')}
            onBuild={(type) => gameEvents.emit('ui:build', type)}
            onMute={toggleMute}
            onMenu={returnToMenu}
          />
        )}
      </div>
    </main>
  );
}

interface TopHudProps {
  snapshot: GameSnapshot;
  onPause: () => void;
}

function TopHud({ snapshot, onPause }: TopHudProps) {
  return (
    <header className="top-hud">
      <div className="hud-cluster hud-primary">
        <Meter label="HP" value={snapshot.hp} max={snapshot.maxHp} tone="health" icon={<HeartPulse size={18} />} />
        <Meter label="Base" value={snapshot.baseHp} max={snapshot.baseMaxHp} tone="base" icon={<Home size={18} />} />
      </div>
      <div className="hud-cluster hud-center">
        <Pill icon={<Swords size={17} />} label={`Wave ${snapshot.wave}`} value={`${snapshot.waveDefeated}/${snapshot.waveTarget || 0}`} />
        <Pill icon={<Zap size={17} />} label={`Blade ${snapshot.blade.level}`} value={snapshot.blade.name} />
        <Pill icon={<Trophy size={17} />} label={`Lv ${snapshot.playerLevel}`} value={`${snapshot.xp}/${snapshot.nextXp} XP`} />
      </div>
      <div className="hud-cluster hud-right">
        <Pill icon={<Coins size={17} />} label="Coin" value={String(snapshot.coins)} />
        <button className="icon-button" onClick={onPause} aria-label="Pause">
          <Pause size={19} />
        </button>
      </div>
    </header>
  );
}

interface ActionRailProps {
  snapshot: GameSnapshot;
  panel: PanelState;
  onPanel: (panel: PanelState) => void;
  onSell: () => void;
  onHeal: () => void;
  onNextWave: () => void;
}

function ActionRail({ snapshot, panel, onPanel, onSell, onHeal, onNextWave }: ActionRailProps) {
  return (
    <nav className="action-rail" aria-label="Game actions">
      <button className={panel === 'inventory' ? 'rail-button active' : 'rail-button'} onClick={() => onPanel('inventory')} title="Inventory">
        <Package size={19} />
        <span>Bag</span>
      </button>
      <button className={panel === 'upgrade' ? 'rail-button active' : 'rail-button'} onClick={() => onPanel('upgrade')} title="Upgrade">
        <Zap size={19} />
        <span>Blade</span>
      </button>
      <button className={panel === 'build' ? 'rail-button active' : 'rail-button'} onClick={() => onPanel('build')} title="Build">
        <Hammer size={19} />
        <span>Build</span>
      </button>
      <button className="rail-button" onClick={onSell} title="Sell resource" disabled={!snapshot.canSell}>
        <ShoppingCart size={19} />
        <span>Sell</span>
      </button>
      <button className="rail-button" onClick={onHeal} title="Heal">
        <HeartPulse size={19} />
        <span>Heal</span>
      </button>
      {!snapshot.waveActive && (
        <button className="rail-button accent" onClick={onNextWave} title="Start wave">
          <Swords size={19} />
          <span>Wave</span>
        </button>
      )}
    </nav>
  );
}

interface SidePanelProps {
  panel: PanelState;
  snapshot: GameSnapshot;
  muted: boolean;
  onClose: () => void;
  onSell: () => void;
  onUpgrade: () => void;
  onBuild: (type: 'wall' | 'turret' | 'spike') => void;
  onMute: () => void;
  onMenu: () => void;
}

function SidePanel({ panel, snapshot, muted, onClose, onSell, onUpgrade, onBuild, onMute, onMenu }: SidePanelProps) {
  const title = panel === 'inventory' ? 'Inventory' : panel === 'upgrade' ? 'Upgrade' : panel === 'build' ? 'Defense' : 'Settings';

  return (
    <aside className="side-panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <button className="icon-button small" onClick={onClose} aria-label="Close">
          <Menu size={18} />
        </button>
      </div>

      {panel === 'inventory' && <InventoryPanel snapshot={snapshot} onSell={onSell} />}
      {panel === 'upgrade' && <UpgradePanel snapshot={snapshot} onUpgrade={onUpgrade} />}
      {panel === 'build' && <BuildPanel snapshot={snapshot} onBuild={onBuild} />}
      {panel === 'settings' && <SettingsPanel muted={muted} onMute={onMute} onMenu={onMenu} />}
    </aside>
  );
}

function InventoryPanel({ snapshot, onSell }: { snapshot: GameSnapshot; onSell: () => void }) {
  const totalValue = Object.entries(snapshot.inventory).reduce(
    (total, [key, amount]) => total + amount * ({ wood: 2, stone: 4, iron: 8 }[key as ResourceType] ?? 0),
    0
  );

  return (
    <div className="panel-body">
      <div className="inventory-grid">
        {(Object.keys(RESOURCE_LABELS) as ResourceType[]).map((type) => (
          <div className={`inventory-slot ${type}`} key={type}>
            <span className="resource-mark" />
            <strong>{RESOURCE_LABELS[type]}</strong>
            <span>{snapshot.inventory[type]}</span>
          </div>
        ))}
      </div>
      <div className="summary-line">
        <span>Total jual</span>
        <strong>{totalValue} coin</strong>
      </div>
      <button className="wide-button" onClick={onSell} disabled={!snapshot.canSell || totalValue === 0}>
        <ShoppingCart size={18} />
        Sell Resource
      </button>
    </div>
  );
}

function UpgradePanel({ snapshot, onUpgrade }: { snapshot: GameSnapshot; onUpgrade: () => void }) {
  const nextCost = snapshot.blade.nextCost;

  return (
    <div className="panel-body">
      <div className="stat-list">
        <StatRow label="Blade" value={snapshot.blade.name} />
        <StatRow label="Damage" value={String(snapshot.blade.damage)} />
        <StatRow label="Radius" value={String(snapshot.blade.radius)} />
        <StatRow label="Jumlah" value={String(snapshot.blade.bladeCount)} />
        <StatRow label="Critical" value={`${Math.round(snapshot.blade.criticalChance * 100)}%`} />
      </div>

      <div className="cost-box">
        <span>Cost berikutnya</span>
        {nextCost ? <CostView cost={nextCost} /> : <strong>Max level</strong>}
      </div>

      <button className="wide-button" onClick={onUpgrade} disabled={!snapshot.canUpgradeBlade}>
        <Zap size={18} />
        Upgrade Blade
      </button>
    </div>
  );
}

function BuildPanel({ snapshot, onBuild }: { snapshot: GameSnapshot; onBuild: (type: 'wall' | 'turret' | 'spike') => void }) {
  return (
    <div className="panel-body">
      <div className="summary-line">
        <span>Bangunan aktif</span>
        <strong>{snapshot.defenses}</strong>
      </div>
      <div className="build-list">
        {BUILD_COSTS.map((item) => {
          const Icon = item.icon;
          return (
            <div className="build-row" key={item.type}>
              <div className="build-name">
                <Icon size={18} />
                <strong>{item.label}</strong>
              </div>
              <CostView cost={item.cost} compact />
              <button className="mini-button" onClick={() => onBuild(item.type)}>
                Build
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsPanel({ muted, onMute, onMenu }: { muted: boolean; onMute: () => void; onMenu: () => void }) {
  return (
    <div className="panel-body">
      <button className={muted ? 'setting-toggle active' : 'setting-toggle'} onClick={onMute}>
        <Settings size={18} />
        <span>FX Visual</span>
        <strong>{muted ? 'Low' : 'Full'}</strong>
      </button>
      <button className="wide-button neutral" onClick={onMenu}>
        <Home size={18} />
        Main Menu
      </button>
    </div>
  );
}

interface MainMenuProps {
  bestWave: number;
  bestCoins: number;
  panel: PanelState;
  muted: boolean;
  onPlay: () => void;
  onPanel: (panel: PanelState) => void;
  onMute: () => void;
}

function MainMenu({ bestWave, bestCoins, panel, muted, onPlay, onPanel, onMute }: MainMenuProps) {
  return (
    <section className="menu-overlay">
      <div className="brand-block">
        <span className="brand-kicker">Browser Survival MVP</span>
        <h1>Survival Blade</h1>
        <div className="menu-actions">
          <button className="primary-menu-button" onClick={onPlay}>
            <Play size={22} />
            Play
          </button>
          <button className="menu-button" onClick={() => onPanel('upgrade')}>
            <Zap size={20} />
            Upgrade
          </button>
          <button className="menu-button" onClick={() => onPanel('settings')}>
            <Settings size={20} />
            Settings
          </button>
          <button className="menu-button" onClick={() => onPanel('leaderboard')}>
            <Trophy size={20} />
            Leaderboard
          </button>
          <button className="menu-button" onClick={() => window.close()}>
            <Home size={20} />
            Exit
          </button>
        </div>
      </div>

      {panel !== 'none' && (
        <div className="menu-panel">
          {panel === 'leaderboard' && (
            <>
              <h2>Leaderboard</h2>
              <StatRow label="Best Wave" value={String(bestWave)} />
              <StatRow label="Best Coin" value={String(bestCoins)} />
            </>
          )}
          {panel === 'settings' && (
            <>
              <h2>Settings</h2>
              <button className={muted ? 'setting-toggle active' : 'setting-toggle'} onClick={onMute}>
                <Settings size={18} />
                <span>FX Visual</span>
                <strong>{muted ? 'Low' : 'Full'}</strong>
              </button>
            </>
          )}
          {panel === 'upgrade' && (
            <>
              <h2>Upgrade</h2>
              <p className="muted-copy">Upgrade aktif saat run dimulai.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function PauseOverlay({
  onResume,
  onMenu,
  muted,
  onMute
}: {
  onResume: () => void;
  onMenu: () => void;
  muted: boolean;
  onMute: () => void;
}) {
  return (
    <section className="pause-overlay">
      <div className="pause-panel">
        <h2>Paused</h2>
        <button className="wide-button" onClick={onResume}>
          <Play size={18} />
          Resume
        </button>
        <button className={muted ? 'setting-toggle active' : 'setting-toggle'} onClick={onMute}>
          <Settings size={18} />
          <span>FX Visual</span>
          <strong>{muted ? 'Low' : 'Full'}</strong>
        </button>
        <button className="wide-button neutral" onClick={onMenu}>
          <Home size={18} />
          Main Menu
        </button>
      </div>
    </section>
  );
}

function MiniMap({ snapshot }: { snapshot: GameSnapshot }) {
  const dots = useMemo(() => snapshot.dots.slice(0, 34), [snapshot.dots]);

  return (
    <aside className="mini-map" aria-label="Mini map">
      <span
        className="map-dot player"
        style={{ left: `${(snapshot.player.x / snapshot.world.width) * 100}%`, top: `${(snapshot.player.y / snapshot.world.height) * 100}%` }}
      />
      <span
        className="map-dot base"
        style={{ left: `${(snapshot.base.x / snapshot.world.width) * 100}%`, top: `${(snapshot.base.y / snapshot.world.height) * 100}%` }}
      />
      <span
        className="map-dot market"
        style={{ left: `${(snapshot.market.x / snapshot.world.width) * 100}%`, top: `${(snapshot.market.y / snapshot.world.height) * 100}%` }}
      />
      {dots.map((dot, index) => (
        <span
          key={`${dot.kind}-${index}`}
          className={`map-dot ${dot.kind}`}
          style={{ left: `${(dot.x / snapshot.world.width) * 100}%`, top: `${(dot.y / snapshot.world.height) * 100}%` }}
        />
      ))}
    </aside>
  );
}

function VirtualJoystick() {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0, active: false });

  const updateStick = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = padRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const max = bounds.width * 0.32;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const length = Math.hypot(rawX, rawY);
    const scale = length > max ? max / length : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    setStick({ x, y, active: true });
    gameEvents.emit('ui:joystick', { x: x / max, y: y / max });
  };

  const releaseStick = () => {
    setStick({ x: 0, y: 0, active: false });
    gameEvents.emit('ui:joystick', { x: 0, y: 0 });
  };

  return (
    <div
      ref={padRef}
      className={stick.active ? 'virtual-joystick active' : 'virtual-joystick'}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updateStick(event);
      }}
      onPointerMove={(event) => {
        if (stick.active) {
          updateStick(event);
        }
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        releaseStick();
      }}
      onPointerCancel={releaseStick}
    >
      <span className="joystick-knob" style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} />
    </div>
  );
}

function MessageToast({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  return <div className="message-toast">{message}</div>;
}

function Meter({
  label,
  value,
  max,
  tone,
  icon
}: {
  label: string;
  value: number;
  max: number;
  tone: 'health' | 'base';
  icon: ReactNode;
}) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`meter ${tone}`} style={{ '--meter': `${percentage}%` } as CSSProperties}>
      <div className="meter-label">
        {icon}
        <span>{label}</span>
        <strong>
          {value}/{max}
        </strong>
      </div>
      <span className="meter-track">
        <span className="meter-fill" />
      </span>
    </div>
  );
}

function Pill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="hud-pill">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CostView({ cost, compact = false }: { cost: Cost; compact?: boolean }) {
  const entries = [
    ['coin', cost.coins],
    ['wood', cost.wood],
    ['stone', cost.stone],
    ['iron', cost.iron]
  ].filter(([, amount]) => Boolean(amount)) as Array<[string, number]>;

  return (
    <div className={compact ? 'cost-view compact' : 'cost-view'}>
      {entries.map(([key, amount]) => (
        <span className={`cost-token ${key}`} key={key}>
          {amount} {key === 'coin' ? 'coin' : RESOURCE_LABELS[key as ResourceType]}
        </span>
      ))}
    </div>
  );
}
