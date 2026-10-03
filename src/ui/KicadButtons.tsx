import type { ComponentDef } from '../components/types';
import type { Props } from '../model/types';
import { showToast } from '../model/store';

/** "KiCad symbol" / "KiCad footprint" downloads for one part (built-in or AI-generated). */
export function KicadButtons({ def, props }: { def: ComponentDef; props: Props }) {
  const onBoard = def.layer !== 0 && def.category !== 'instruments';
  const run = async (what: 'symbol' | 'footprint') => {
    try {
      const k = await import('../kicad');
      if (what === 'symbol') k.downloadSymbol(def, props);
      else k.downloadFootprint(def, props);
    } catch (e) {
      showToast(`KiCad export failed: ${(e as Error).message}`, 'error');
    }
  };
  return (
    <div className="kicad-row">
      <span className="muted small">KiCad</span>
      <button className="btn small" title="Download a KiCad symbol library (.kicad_sym) with this part" onClick={() => run('symbol')}>⬇ Symbol</button>
      <button className="btn small" disabled={!onBoard} title={onBoard ? 'Download a KiCad footprint (.kicad_mod) for this part' : 'Instruments and breadboards have no PCB footprint'} onClick={() => run('footprint')}>⬇ Footprint</button>
    </div>
  );
}
