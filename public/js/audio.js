// Web Audio API Morse Code Generator
// 700 Hz sine, volume 0.3, dot = 0.12 s * speed, dash = 3 dots, 1 dot gap between symbols, space between letters adds 4 dots.

class MorsePlayer {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.stopRequested = false;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  async playPattern(pattern, speedFactor = 1.0, onProgress = null) {
    this.init();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.stopRequested = false;

    const baseUnit = 0.12 * speedFactor; // in seconds
    const freq = 700; // Hz
    const volume = 0.3;

    // Track total duration and trigger decoy flash at ~2.2s
    let elapsed = 0;
    let flashTriggered = false;

    try {
      for (const item of pattern) {
        if (this.stopRequested) break;

        const duration = item.u * baseUnit;

        if (item.tone) {
          // Play beep
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

          gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
          gain.gain.linearRampToValueAtTime(volume, this.audioCtx.currentTime + 0.005);
          gain.gain.setValueAtTime(volume, this.audioCtx.currentTime + duration - 0.005);
          gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + duration);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start();
          osc.stop(this.audioCtx.currentTime + duration);
        }

        // Check if elapsed time reaches ~2.2s
        if (!flashTriggered && elapsed >= 2.0) {
          flashTriggered = true;
          if (onProgress) onProgress('flash');
          setTimeout(() => {
            if (onProgress) onProgress('reset-flash');
          }, 300);
        }

        await new Promise(r => setTimeout(r, duration * 1000));
        elapsed += duration;
      }
    } finally {
      this.isPlaying = false;
      if (onProgress) onProgress('done');
    }
  }

  stop() {
    this.stopRequested = true;
    this.isPlaying = false;
  }
}

window.morsePlayer = new MorsePlayer();
