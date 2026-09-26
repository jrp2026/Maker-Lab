import type { SimSnapshot } from '../sim/simulator';

/** Plays a square-ish tone for every sounding piezo. */
class AudioOut {
  private ctx: AudioContext | null = null;
  private voices = new Map<string, { osc: OscillatorNode; gain: GainNode }>();

  update(snap: SimSnapshot, muted: boolean) {
    const active = new Map<string, number>();
    if (!muted) {
      for (const [id, st] of Object.entries(snap.comps)) if (st && typeof st.freq === 'number' && st.freq > 0) active.set(id, st.freq);
    }
    for (const [id, v] of this.voices) {
      if (!active.has(id)) {
        v.gain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.01);
        v.osc.stop(this.ctx!.currentTime + 0.1);
        this.voices.delete(id);
      }
    }
    if (!active.size) return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
    }
    for (const [id, f] of active) {
      let v = this.voices.get(id);
      if (!v) {
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        gain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.01);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start();
        v = { osc, gain };
        this.voices.set(id, v);
      }
      v.osc.frequency.setTargetAtTime(Math.min(8000, f), this.ctx.currentTime, 0.005);
    }
  }

  stopAll() {
    for (const v of this.voices.values()) {
      try {
        v.osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.voices.clear();
  }
}

export const audio = new AudioOut();
