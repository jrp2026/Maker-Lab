/** Tools: the ISP programmer. */
import { chip, crystalCan, moduleBoard, rect, silk, smdRow, usbPort } from '../kit';
import { poweredFn, TextLines, type DevicePart } from './common';

const programmer: DevicePart = (() => {
  const b = moduleBoard(['VCC', 'MOSI', 'MISO', 'SCK', 'RST', 'GND'], { h: 50, w: 100, color: '#2b5fae', title: 'USBasp', titleY: -48 + 4, titleX: 44, titleSize: 3.2, labels: { VCC: '+5 V out (target power)', MOSI: 'MOSI → target MOSI', MISO: 'MISO ← target MISO', SCK: 'SCK → target SCK', RST: 'RESET → target RESET', GND: 'GND' } });
  return [
    {
      type: 'isp-programmer', name: 'Microcontroller programmer (USBasp ISP)', category: 'mcu',
      description: 'In-system programmer for AVR chips (ATtiny85, ATmega328P …): wire MOSI, MISO, SCK, RESET and GND to the target\'s pins (and VCC to power it). The display checks the wiring and reports the target it found — the sketch in the Code panel is what gets "flashed".',
      keywords: ['programmer', 'usbasp', 'isp', 'avrisp', 'debugger', 'st-link', 'flash', 'upload'],
      pins: b.pins,
      props: [{ key: 'power', label: 'Target power', type: 'select', default: 1, options: [{ value: 1, label: '5 V to target' }, { value: 0, label: 'Off (target self-powered)' }] }],
      shapes: [...b.shapes, ...usbPort(-26, -34, 'a'), ...chip(0, -44, 18, 18, { legs: 'qfp', n: 6, label: 'MEGA8' }), ...crystalCan(24, -44, 16, 6, '12.000'), ...smdRow(24, -30, 5, 5, false, 'rcrcr'), rect(56, -44, 5, 3, '#efe9d2', { rx: 0.4 }), rect(64, -44, 5, 3, '#efe9d2', { rx: 0.4 }), silk(46, -18, 'ISP', 3)],
      model: {
        elements: [
          { id: 'P', kind: 'vsource', p: 'VCC', n: 'GND', value: 'power == 1 ? 5 : 0', r: 0.5 },
          ...['MOSI', 'MISO', 'SCK', 'RST'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e6 })),
        ],
      },
    },
    {
      setup(bld) {
        const mosi = bld.boardAt('MOSI'), miso = bld.boardAt('MISO'), sck = bld.boardAt('SCK');
        let status: string[];
        if (!mosi && !miso && !sck) status = ['no target', 'wire MOSI/MISO/SCK', 'RESET, GND'];
        else if (!mosi || !miso || !sck || mosi.board !== miso.board || mosi.board !== sck.board) status = ['incomplete wiring:', 'MOSI, MISO and SCK must', 'go to one chip'];
        else if (mosi.pin !== mosi.spi.mosi || miso.pin !== mosi.spi.miso || sck.pin !== mosi.spi.sck) status = [`${mosi.name}:`, 'MOSI/MISO/SCK swapped', 'check the pinout'];
        else if (!bld.connected('RST')) status = [`${mosi.name} found`, 'connect RESET to', 'program it'];
        else status = [`✓ ${mosi.name}`, 'flash OK — running', 'the Code panel sketch'];
        const powered = poweredFn(bld, 4, 'VCC', 'GND');
        return { frame: () => ({ status: powered() || bld.connected('VCC') ? status : ['USB connected'] }) };
      },
      overlay: ({ sim }) => (sim ? <TextLines x={14} y={-50} w={62} h={24} lines={(sim.status as string[]) ?? []} size={3.8} /> : null),
    },
  ];
})();

export const TOOL_DEVICES: DevicePart[] = [programmer];
