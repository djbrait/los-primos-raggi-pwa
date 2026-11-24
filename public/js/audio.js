// Motor de audio de Los Primos Raggi:
// - Música de fondo real en bucle: Audio 1 (bgm_main.mp3) y Audio 2 Jefe Final Abruk (bgm_boss.mp3)
// - Efectos de sonido (SFX) instantáneos por Web Audio API

const BGM_SOURCES = {
  main: './assets/audio/bgm_main.mp3?v=6',
  boss: './assets/audio/bgm_boss.mp3?v=6',
};

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.currentChannel = null; // 'main' | 'boss'
    this.bgmElements = {};

    if (typeof Audio !== 'undefined') {
      for (const [key, src] of Object.entries(BGM_SOURCES)) {
        const el = new Audio(src);
        el.loop = true;
        el.preload = 'auto';
        el.volume = key === 'boss' ? 0.72 : 0.65;
        this.bgmElements[key] = el;
      }
    }
  }

  unlock() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    // Reanudar la pista actual si estaba bloqueada por autoplay del navegador
    if (!this.muted && this.currentChannel && this.bgmElements[this.currentChannel]) {
      const el = this.bgmElements[this.currentChannel];
      if (el.paused) {
        el.play().catch(() => {});
      }
    }
  }

  _resolveChannel(trackName) {
    return trackName === 'boss' ? 'boss' : 'main';
  }

  setMuted(muted) {
    this.muted = muted;
    for (const el of Object.values(this.bgmElements)) {
      el.muted = this.muted;
      if (this.muted) {
        el.pause();
      }
    }
    if (!this.muted && this.currentChannel && this.bgmElements[this.currentChannel]) {
      this.bgmElements[this.currentChannel].play().catch(() => {});
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return !this.muted;
  }

  playMusic(trackName) {
    const channel = this._resolveChannel(trackName);
    const prevChannel = this.currentChannel;
    this.currentChannel = channel;

    const targetEl = this.bgmElements[channel];
    if (!targetEl) return;

    if (prevChannel && prevChannel !== channel && this.bgmElements[prevChannel]) {
      this.bgmElements[prevChannel].pause();
      try {
        this.bgmElements[prevChannel].currentTime = 0;
      } catch {}
    }

    targetEl.loop = true;
    targetEl.muted = this.muted;
    if (!this.muted && targetEl.paused) {
      targetEl.play().catch(() => {});
    }
  }

  stopMusic() {
    for (const el of Object.values(this.bgmElements)) {
      el.pause();
    }
  }

  playTone(freq, duration, type = 'triangle', volume = 0.14, slideTo = null) {
    if (this.muted || !this.ctx || !freq) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // Efectos de sonido (SFX)
  sfxJump(isUnderwater = false) {
    this.unlock();
    this.playTone(isUnderwater ? 240 : 320, 0.15, 'triangle', 0.14, isUnderwater ? 480 : 660);
  }

  sfxStomp() {
    this.unlock();
    this.playTone(220, 0.09, 'square', 0.12, 540);
    setTimeout(() => this.playTone(620, 0.11, 'triangle', 0.14, 880), 45);
  }

  sfxSwordSlash() {
    this.unlock();
    this.playTone(760, 0.1, 'sawtooth', 0.1, 210);
  }

  sfxSwordBreak() {
    this.unlock();
    this.playTone(460, 0.12, 'sawtooth', 0.11, 160);
    setTimeout(() => this.playTone(260, 0.18, 'square', 0.09, 95), 75);
  }

  sfxLuckyBlock() {
    this.unlock();
    this.playTone(523, 0.07, 'square', 0.11);
    setTimeout(() => this.playTone(784, 0.14, 'triangle', 0.15, 1046), 65);
  }

  sfxPowerUp(isGold = false) {
    this.unlock();
    const notes = isGold ? [523, 659, 784, 1046, 1318] : [392, 523, 659, 784];
    notes.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.13, 'triangle', 0.14), idx * 65);
    });
  }

  sfxHurt() {
    this.unlock();
    this.playTone(260, 0.13, 'sawtooth', 0.11, 135);
  }

  sfxLoseHeart() {
    this.unlock();
    [420, 350, 280, 190].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.15, 'square', 0.11), idx * 80);
    });
  }

  sfxMeteor() {
    this.unlock();
    this.playTone(520, 0.16, 'sawtooth', 0.06, 190);
  }

  sfxPipeEnter() {
    this.unlock();
    [520, 440, 360, 290, 220, 170].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.09, 'triangle', 0.13), idx * 58);
    });
  }

  sfxBossSlam() {
    this.unlock();
    this.playTone(140, 0.25, 'sawtooth', 0.17, 48);
  }

  sfxBossHit() {
    this.unlock();
    this.playTone(300, 0.12, 'square', 0.14, 680);
  }

  sfxBossDefeat() {
    this.unlock();
    [523, 587, 659, 784, 880, 1046].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.2, 'triangle', 0.16), idx * 90);
    });
  }

  sfxVictory() {
    this.unlock();
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.22, 'triangle', 0.16), idx * 110);
    });
  }
}
