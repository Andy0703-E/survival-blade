import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import SurvivalScene from './scenes/SurvivalScene';

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) {
      return;
    }

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: '#122018',
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: '100%',
        height: '100%'
      },
      physics: {
        default: 'arcade',
        arcade: {
          debug: false
        }
      },
      input: {
        activePointers: 4
      },
      render: {
        antialias: true,
        pixelArt: false
      },
      scene: [SurvivalScene]
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="phaser-stage" />;
}
