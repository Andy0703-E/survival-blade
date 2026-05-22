# Survival Blade ⚔️

Game survival arena bertahan hidup berbasis browser. Player bertahan dari gelombang musuh dengan pedang berputar yang bisa di-upgrade, membangun pertahanan, dan mengumpulkan resource.

## 🎮 Fitur

- **Pertarungan Gelombang**: Hadapi slime, goblin, skeleton, dan boss yang semakin kuat
- **Pedang Berputar**: Pedang otomatis berputar mengelilingi player, bisa di-upgrade (damage, kecepatan, jumlah, radius)
- **Bangunan Pertahanan**: Bangun Wall, Turret, dan Spike untuk melindungi base
- **Resource Farming**: Kumpulkan Kayu, Batu, dan Besi dari map, jual untuk koin
- **Progresi**: Level up player, upgrade blade, buka wave lebih tinggi
- **Pixel Art Karakter**: Sprite karakter dan musuh dengan animasi berjalan
- **Mobile Support**: Kontrol joystick virtual untuk perangkat sentuh

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
   - Klik kanan tombol aksi — Buka panel
   - **Mobile**: Joystick kiri bawah, tombol aksi kanan bawah

## 📦 Build Produksi

```bash
npm run build
```

Hasil build ada di folder `dist/`.

## 🌐 Deploy

```bash
npm run build
# Upload folder dist/ ke hosting statis (Netlify, Vercel, GitHub Pages, dll)
```

## 📁 Struktur Proyek

```
src/
├── main.tsx              # Entry point
├── App.tsx               # UI utama (HUD, panel, menu)
├── styles/global.css     # Semua styling
├── store/useGameStore.ts # State management
└── game/
    ├── EventBus.ts       # Komunikasi React-Phaser
    ├── PhaserGame.tsx    # Inisialisasi Phaser
    └── scenes/
        └── SurvivalScene.ts  # Logic game utama
```

## 🧪 Stat Progresi

- **Player**: HP 100, Speed 220 + 4/level
- **Blade**: 6 level — Wooden → Iron → Dual → Fire → Lightning → Legendary
- **Musuh**: Slime, Goblin, Skeleton (ranged), Boss (tiap 5 wave)
- **Bangunan**: Wall (block), Turret (auto-aim), Spike (melee damage)
