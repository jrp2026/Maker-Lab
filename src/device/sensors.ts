/**
 * The real sensors of the device MakerLab runs on (microphone, accelerometer/gyroscope, compass,
 * camera as a light/motion sensor, location). Each source starts when the first part subscribes
 * and stops when the last one leaves, so the mic/camera light only stays on while it's in use.
 */
import { create } from 'zustand';

export type SourceId = 'mic' | 'motion' | 'compass' | 'camera' | 'geo';

export interface Readings {
  /** loudness in dB full scale (−100 … 0) and the strongest pitch in Hz (0 when quiet) */
  mic: { dbfs: number; pitch: number };
  /** acceleration incl. gravity in g (device axes: x right, y up the screen, z out of the screen), rotation in °/s, shake in m/s² */
  motion: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number; shake: number };
  /** degrees clockwise from north */
  compass: { heading: number };
  /** estimated light level and how much the picture changed since the last frame (0 … 1) */
  camera: { lux: number; motion: number };
  geo: { lat: number; lon: number; alt: number; speed: number; course: number; accuracy: number };
}

export type Status = 'idle' | 'starting' | 'on' | 'denied' | 'error';

interface DeviceState {
  /** which sources this device can offer (filled in by detectCapabilities) */
  caps: Record<SourceId, boolean>;
  status: Record<SourceId, Status>;
  error: Partial<Record<SourceId, string>>;
}

export const useDevice = create<DeviceState>(() => ({
  caps: { mic: false, motion: false, compass: false, camera: false, geo: false },
  status: { mic: 'idle', motion: 'idle', compass: 'idle', camera: 'idle', geo: 'idle' },
  error: {},
}));

const setStatus = (id: SourceId, s: Status, error?: string) =>
  useDevice.setState((st) => ({ status: { ...st.status, [id]: s }, error: { ...st.error, [id]: error } }));

// ---------------------------------------------------------------- capability detection

type MotionCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
type OrientCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

let detected = false;
/** Find out which sensors exist. Motion sensors only count once they actually report a value. */
export function detectCapabilities() {
  if (detected || typeof window === 'undefined') return;
  detected = true;
  const caps = { ...useDevice.getState().caps };
  const md = navigator.mediaDevices;
  caps.geo = 'geolocation' in navigator;
  const publish = () => useDevice.setState({ caps: { ...caps } });
  if (md?.enumerateDevices) {
    md.enumerateDevices().then((list) => {
      caps.mic = list.some((d) => d.kind === 'audioinput');
      caps.camera = list.some((d) => d.kind === 'videoinput');
      publish();
    }).catch(() => undefined);
  }
  // iPhone/iPad: sensors exist but report nothing until the user grants access from a tap
  const M = (window as unknown as { DeviceMotionEvent?: MotionCtor }).DeviceMotionEvent;
  if (M && typeof M.requestPermission === 'function') {
    caps.motion = true;
    caps.compass = true;
  } else if (M) {
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (g && g.x !== null && g.y !== null) {
        caps.motion = true;
        publish();
        window.removeEventListener('devicemotion', onMotion);
      }
    };
    window.addEventListener('devicemotion', onMotion);
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && (e.absolute || 'webkitCompassHeading' in e)) {
        caps.compass = true;
        publish();
        window.removeEventListener('deviceorientationabsolute', onOrient as EventListener);
      }
    };
    window.addEventListener('deviceorientationabsolute', onOrient as EventListener);
    setTimeout(() => {
      window.removeEventListener('devicemotion', onMotion);
      window.removeEventListener('deviceorientationabsolute', onOrient as EventListener);
    }, 4000);
  }
  publish();
}

// ---------------------------------------------------------------- subscriptions

type Listener<K extends SourceId> = (r: Readings[K]) => void;
const listeners: { [K in SourceId]: Set<Listener<K>> } = { mic: new Set(), motion: new Set(), compass: new Set(), camera: new Set(), geo: new Set() };
const stops: Partial<Record<SourceId, () => void>> = {};
const last: Partial<Readings> = {};

function emit<K extends SourceId>(id: K, r: Readings[K]) {
  (last as Record<K, Readings[K]>)[id] = r;
  for (const l of listeners[id]) l(r);
}

export const lastReading = <K extends SourceId>(id: K): Readings[K] | undefined => last[id] as Readings[K] | undefined;

/**
 * Listen to a source. Call this from a click handler the first time (browsers only allow the
 * mic, camera and motion prompts in response to a tap). Returns the unsubscribe function.
 */
export function subscribe<K extends SourceId>(id: K, fn: Listener<K>): () => void {
  const set = listeners[id] as Set<Listener<K>>;
  set.add(fn);
  if (set.size === 1 && !stops[id]) void start(id);
  else if (last[id]) fn(last[id] as Readings[K]);
  return () => {
    set.delete(fn);
    if (!set.size) {
      stops[id]?.();
      delete stops[id];
      delete last[id];
      setStatus(id, 'idle');
    }
  };
}

async function start(id: SourceId) {
  setStatus(id, 'starting');
  try {
    const stop = await STARTERS[id]();
    if (!listeners[id].size) {
      stop();
      setStatus(id, 'idle');
      return;
    }
    stops[id] = stop;
    setStatus(id, 'on');
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || /denied|permission/i.test(err?.message ?? '');
    setStatus(id, denied ? 'denied' : 'error', denied ? 'Access was blocked. Allow it in the browser’s site settings and try again.' : err?.message ?? String(e));
  }
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const STARTERS: Record<SourceId, () => Promise<() => void>> = {
  async mic() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 4096;
    src.connect(an);
    const time = new Float32Array(an.fftSize);
    const freq = new Float32Array(an.frequencyBinCount);
    const timer = window.setInterval(() => {
      an.getFloatTimeDomainData(time);
      let sum = 0;
      for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
      const dbfs = clamp(20 * Math.log10(Math.sqrt(sum / time.length) + 1e-6), -100, 0);
      an.getFloatFrequencyData(freq);
      // strongest bin between 60 Hz and 4 kHz
      const hz = ctx.sampleRate / an.fftSize;
      let best = -Infinity, bi = 0;
      for (let i = Math.ceil(60 / hz); i < Math.min(freq.length, 4000 / hz); i++) if (freq[i] > best) { best = freq[i]; bi = i; }
      emit('mic', { dbfs, pitch: dbfs > -55 ? Math.round(bi * hz) : 0 });
    }, 60);
    return () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    };
  },

  async motion() {
    const M = (window as unknown as { DeviceMotionEvent?: MotionCtor }).DeviceMotionEvent;
    if (!M) throw new Error('This device has no motion sensors.');
    if (typeof M.requestPermission === 'function' && (await M.requestPermission()) !== 'granted') throw Object.assign(new Error('Motion access denied'), { name: 'NotAllowedError' });
    // iOS used to report gravity with the opposite sign; flat on a table must read +1 g on Z
    let sign = 0;
    let pending: Readings['motion'] | null = null;
    const on = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x === null || g.y === null || g.z === null) return;
      if (!sign) sign = Math.abs(g.z) > 7 ? Math.sign(g.z) : Math.abs(g.y) > 7 ? Math.sign(g.y) : 0;
      const k = (sign || 1) / 9.80665;
      const r = e.rotationRate;
      const a = e.acceleration;
      const shake = a && a.x !== null ? Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0) : Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
      pending = { ax: g.x * k, ay: g.y * k, az: g.z * k, gx: r?.beta ?? 0, gy: r?.gamma ?? 0, gz: r?.alpha ?? 0, shake: Math.max(pending?.shake ?? 0, shake) };
    };
    window.addEventListener('devicemotion', on);
    const timer = window.setInterval(() => {
      if (pending) emit('motion', pending);
      pending = null;
    }, 80);
    return () => {
      window.removeEventListener('devicemotion', on);
      clearInterval(timer);
    };
  },

  async compass() {
    const O = (window as unknown as { DeviceOrientationEvent?: OrientCtor }).DeviceOrientationEvent;
    if (!O) throw new Error('This device has no compass.');
    if (typeof O.requestPermission === 'function' && (await O.requestPermission()) !== 'granted') throw Object.assign(new Error('Compass access denied'), { name: 'NotAllowedError' });
    let heading: number | null = null;
    const on = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading;
      else if (e.alpha !== null && (e.absolute || e.type === 'deviceorientationabsolute')) heading = (360 - e.alpha) % 360;
    };
    const ev = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(ev, on as EventListener);
    const timer = window.setInterval(() => heading !== null && emit('compass', { heading: Math.round(heading) % 360 }), 100);
    return () => {
      window.removeEventListener(ev, on as EventListener);
      clearInterval(timer);
    };
  },

  async camera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 160 }, height: { ideal: 120 } } });
    const track = stream.getVideoTracks()[0];
    // auto-exposure makes every room look equally bright; switch it off where the camera allows
    try {
      const caps = (track.getCapabilities?.() ?? {}) as { exposureMode?: string[] };
      if (caps.exposureMode?.includes('manual')) await track.applyConstraints({ advanced: [{ exposureMode: 'manual' } as MediaTrackConstraintSet] });
    } catch { /* not supported: covering the lens still reads as dark */ }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    const W = 32, H = 24;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d', { willReadFrequently: true })!;
    let prev: Uint8ClampedArray | null = null;
    const timer = window.setInterval(() => {
      if (video.readyState < 2) return;
      g.drawImage(video, 0, 0, W, H);
      const px = g.getImageData(0, 0, W, H).data;
      let luma = 0, diff = 0;
      for (let i = 0; i < px.length; i += 4) {
        const y = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        luma += y;
        if (prev) diff += Math.abs(y - (0.2126 * prev[i] + 0.7152 * prev[i + 1] + 0.0722 * prev[i + 2]));
      }
      const n = W * H;
      prev = px;
      // gamma-decoded brightness → a lux-like scale (covered ≈ 0, room ≈ 150–400, a lamp ≈ 1000+)
      emit('camera', { lux: Math.round(2000 * Math.pow(luma / n / 255, 2.2)), motion: clamp(diff / n / 40, 0, 1) });
    }, 125);
    return () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  },

  async geo() {
    if (!('geolocation' in navigator)) throw new Error('Location isn’t available on this device.');
    let fail: ((e: Error) => void) | null = null;
    const first = new Promise<void>((resolve, reject) => {
      fail = reject;
      setTimeout(resolve, 0);
    });
    const id = navigator.geolocation.watchPosition(
      (p) => emit('geo', {
        lat: p.coords.latitude, lon: p.coords.longitude, alt: p.coords.altitude ?? 0,
        speed: (p.coords.speed ?? 0) * 3.6, course: p.coords.heading ?? 0, accuracy: p.coords.accuracy,
      }),
      (e) => {
        const err = Object.assign(new Error(e.message || 'Location unavailable'), { name: e.code === e.PERMISSION_DENIED ? 'NotAllowedError' : 'Error' });
        if (fail) fail(err);
        setStatus('geo', e.code === e.PERMISSION_DENIED ? 'denied' : 'error', e.code === e.PERMISSION_DENIED ? 'Access was blocked. Allow it in the browser’s site settings and try again.' : err.message);
      },
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
    await first;
    return () => navigator.geolocation.clearWatch(id);
  },
};
