import type { ComponentDef } from '../components/types';
import { linkFor, SOURCE_ICON } from '../device/links';
import { toggleLink, useDeviceLinks } from '../device/runner';
import { useDevice } from '../device/sensors';

/** "Use this device's microphone / motion sensors / camera …" switch for a part, when the device has that sensor. */
export function DeviceToggle({ compId, def }: { compId: string; def: ComponentDef }) {
  const link = linkFor(def);
  const has = useDevice((s) => (link ? s.caps[link.source] : false));
  const status = useDevice((s) => (link ? s.status[link.source] : 'idle'));
  const error = useDevice((s) => (link ? s.error[link.source] : undefined));
  const on = useDeviceLinks((s) => !!s.on[compId]);
  const reading = useDeviceLinks((s) => s.reading[compId]);
  if (!link || !has) return null;
  const id = `dev-${compId}`;
  const meter = on && reading && link.meter ? link.meter(reading as never) : null;
  let note: string;
  if (!on) note = 'Off: the settings below are used.';
  else if (status === 'denied' || status === 'error') note = error ?? 'The sensor could not be started.';
  else if (!reading) note = status === 'starting' ? 'Waiting for permission…' : 'Waiting for the first reading…';
  else note = link.show(reading as never);
  return (
    <div className={`device-link${on ? ' on' : ''}${status === 'denied' || status === 'error' ? ' bad' : ''}`}>
      <label className="device-row" htmlFor={id}>
        <span className="device-ico" aria-hidden>{SOURCE_ICON[link.source]}</span>
        <span className="device-label">{link.label}</span>
        <input id={id} type="checkbox" role="switch" className="switch" checked={on} onChange={() => toggleLink(compId)} />
      </label>
      <div className="device-note" aria-live="polite">
        {meter !== null && <span className="device-meter" aria-hidden><span style={{ width: `${Math.round(meter * 100)}%` }} /></span>}
        <span>{note}</span>
      </div>
    </div>
  );
}
