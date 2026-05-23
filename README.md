# Survival Blade ⚔️

Game survival arena bertahan hidup berbasis browser bergaya premium. Player bertahan dari gelombang musuh dengan pedang berputar yang berevolusi otomatis, membangun pertahanan strategis, dan menjelajahi lingkungan yang kaya akan alam.

## 🎮 Fitur Utama

- **Pertarungan Gelombang**: Hadapi Slime, Goblin, Skeleton (Ranged Attack), dan Boss yang semakin brutal.
- **Auto-Evolve Blade**: Pedang berputar mengelilingi player dan akan *upgrade* secara otomatis berdasarkan level (Meningkatkan damage, api berantai, hingga sambaran petir).
- **Auto-Defense Base**: Bangun pertahanan melingkar secara instan di sekitar Base (Wall, Turret, Spike, Healing Ward, dan Tar Trap).
- **Premium UI (Glassmorphism)**: Antarmuka memukau bergaya kaca (*glassmorphism*) dengan *micro-animations* yang responsif dan efek *blur*.
- **Procedural Environment**: Menggunakan aset alam (Pohon, Semak, Bebatuan) Kenney Assets yang di-generate (*scattered*) secara acak di setiap permainan.
- **Dramatic Game Over**: Efek *shake*, partikel, *fade-in*, dan efek *sound* dramatis saat base hancur.
- **Resource Farming**: Kumpulkan Kayu, Batu, dan Besi, lalu jual semuanya sekaligus melalui fitur Market.

## 🛠️ Teknologi

- **Phaser 3** — Game engine
- **React 18** — UI overlay
- **Zustand** — State management
- **Vite** — Build tool
- **TypeScript**

## 🚀 Cara Main

1. Install dependencies:
```bash
npm install
```

2. Jalankan development server:
```bash
npm run dev
```

3. Buka `http://localhost:5173` di browser

4. Klik **Play** untuk mulai

5. **Kontrol**:
   - **WASD / Arrow Keys** — Gerak
   - Klik kanan tombol aksi — Buka menu (Market / Build)
   - **Mobile**: Joystick virtual kiri bawah, tombol aksi kanan bawah

## 📦 Build Produksi

```bash
npm run build
```

Hasil build ada di folder `dist/`.

## 📁 Struktur Proyek

```
src/
├── main.tsx              # Entry point
├── App.tsx               # UI utama (Glassmorphism HUD, Menu, Game Over)
├── styles/global.css     # Styling premium
├── store/useGameStore.ts # State management
└── game/
    ├── EventBus.ts       # Komunikasi React-Phaser
    ├── PhaserGame.tsx    # Inisialisasi Phaser & Preload Aset Kenney
    └── scenes/
        └── SurvivalScene.ts  # Logic game utama, AI, Procedural Background
```

## 🧪 Stat Progresi

- **Player**: HP 100, Speed 220 + 4/level, fitur *Dash*
- **Blade**: Otomatis naik level seiring Player Level (Wooden → Iron → Dual → Fire → Lightning → Legendary)
- **Musuh**: Slime, Goblin, Skeleton (menembakkan tulang), Boss
- **Bangunan**: Wall (Pertahanan melingkar), Healing Ward, Tar Trap (AoE slow)
