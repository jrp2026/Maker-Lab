/**
 * A USB cable plugged into a board's socket — drawn while the board's "USB cable" setting is
 * plugged in, so it's clear where an unwired board gets its power from.
 * (x, y) is the socket's outer edge centre; the cable leaves towards `side`.
 */
export function UsbCable({ x, y, side, size = 14 }: { x: number; y: number; side: 'left' | 'right'; size?: number }) {
  const s = side === 'left' ? -1 : 1;
  const plugW = size * 1.3, plugH = size * 0.95;
  const px = side === 'left' ? x - plugW : x;
  const tail = x + s * (plugW + 4);
  return (
    <g style={{ pointerEvents: 'none' }}>
      <path d={`M${tail} ${y} C${tail + s * 18} ${y} ${tail + s * 14} ${y + 26} ${tail + s * 34} ${y + 30}`} fill="none" stroke="#2a2c30" strokeWidth={5} strokeLinecap="round" />
      <path d={`M${tail} ${y} C${tail + s * 18} ${y} ${tail + s * 14} ${y + 26} ${tail + s * 34} ${y + 30}`} fill="none" stroke="#4a4e55" strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
      <rect x={side === 'left' ? tail : tail - 5} y={y - 3.5} width={5} height={7} rx={1.5} fill="#2a2c30" />
      <rect x={px} y={y - plugH / 2} width={plugW} height={plugH} rx={2.5} fill="#3b3e44" stroke="#1d1f22" strokeWidth={0.6} />
      <rect x={px + 1.5} y={y - plugH / 2 + 1.5} width={plugW - 3} height={plugH / 3} rx={1.5} fill="#ffffff" opacity={0.1} />
      <text x={px + plugW / 2} y={y + 1.6} fontSize={4.2} fontWeight={700} textAnchor="middle" fill="#c9ccd1" fontFamily="Inter, sans-serif" style={{ userSelect: 'none' }}>USB</text>
    </g>
  );
}
