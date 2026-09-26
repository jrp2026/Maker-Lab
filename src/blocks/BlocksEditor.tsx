import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly/core';
import { DEFAULT_BLOCKS, defineArduinoBlocks, generateSketch, setBlocksBoard, toolbox } from './arduino';
import type { BoardSpec } from '../mcu/boards';

interface Props {
  /** serialized workspace (JSON string), or '' for the default program */
  value: string;
  board: BoardSpec;
  /** called with the new serialized workspace and the generated sketch */
  onChange: (json: string, code: string) => void;
}

const theme = Blockly.Theme.defineTheme('circuitlab', {
  name: 'circuitlab',
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#f7f9fb',
    toolboxBackgroundColour: '#ffffff',
    toolboxForegroundColour: '#25303b',
    flyoutBackgroundColour: '#eef2f6',
    flyoutOpacity: 0.96,
    scrollbarColour: '#c9d2db',
    insertionMarkerColour: '#00a39a',
  },
  fontStyle: { family: 'Inter, system-ui, sans-serif', weight: '600', size: 11 },
});

export default function BlocksEditor({ value, board, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    defineArduinoBlocks();
    setBlocksBoard(board);
    const ws = Blockly.inject(host.current!, {
      toolbox: toolbox(board) as any,
      renderer: 'zelos',
      theme,
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.4 },
      move: { scrollbars: true, drag: true, wheel: false },
      grid: { spacing: 24, length: 2, colour: '#dde3ea', snap: true },
      sounds: false,
      media: `${import.meta.env.BASE_URL}blockly-media/`,
    });
    let json: unknown = DEFAULT_BLOCKS;
    try {
      if (value) json = JSON.parse(value);
    } catch {
      /* fall back to the default program */
    }
    Blockly.Events.disable();
    try {
      Blockly.serialization.workspaces.load(json as any, ws);
    } finally {
      Blockly.Events.enable();
    }
    const emit = () => {
      const saved = JSON.stringify(Blockly.serialization.workspaces.save(ws));
      cb.current(saved, generateSketch(ws, board));
    };
    emit();
    const listener = (e: Blockly.Events.Abstract) => {
      if (e.isUiEvent || ws.isDragging()) return;
      emit();
    };
    ws.addChangeListener(listener);
    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(host.current!);
    return () => {
      ro.disconnect();
      ws.dispose();
    };
    // the workspace is created once per board; later value changes come from the workspace itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  return <div ref={host} className="blocks-host" />;
}
