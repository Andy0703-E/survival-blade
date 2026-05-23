export class AudioController {
  private ctx: AudioContext | null = null;
  private muted = false;

  constructor() {
    // AudioContext will be created on first interaction
  }

  public init() {
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public playCoin() {
    if (this.muted || !this.ctx) return;
    this.playTone(800, 'sine', 0.1, 0.1, 0);
    this.playTone(1200, 'sine', 0.15, 0.1, 0.1);
  }

  public playHit() {
    if (this.muted || !this.ctx) return;
    this.playTone(150, 'sawtooth', 0.1, 0.2, 0, -100);
  }

  public playDash() {
    if (this.muted || !this.ctx) return;
    this.playTone(300, 'triangle', 0.2, 0.1, 0, 400);
  }

  public playShoot() {
    if (this.muted || !this.ctx) return;
    this.playTone(600, 'square', 0.15, 0.05, 0, -400);
  }

  public playBuild() {
    if (this.muted || !this.ctx) return;
    this.playTone(200, 'square', 0.1, 0.1, 0);
    this.playTone(300, 'square', 0.1, 0.1, 0.1);
  }

  public playGameOver() {
    if (this.muted || !this.ctx) return;
    this.playTone(400, 'sawtooth', 0.4, 0.3, 0, -300);
    this.playTone(300, 'square', 0.6, 0.3, 0.2, -250);
    this.playTone(150, 'sawtooth', 1.0, 0.4, 0.5, -100);
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol: number, delay = 0, freqDrop = 0) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);
      
      if (freqDrop !== 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq + freqDrop), this.ctx.currentTime + delay + duration);
      }

      gain.gain.setValueAtTime(vol, this.ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + delay + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + duration);
    } catch (e) {
      // Ignore errors if audio context is suspended or failing
    }
  }
}
