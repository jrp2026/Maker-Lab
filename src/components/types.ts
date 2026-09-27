import type { ReactNode } from 'react';
import type { ComponentInstance, Props, PropValue } from '../model/types';
import type { SimBuilder, SimComponent } from '../sim/builder';
import type { BoardSpec } from '../mcu/boards';

/**
 * lead     — a component leg; plugs into a socket it sits on top of.
 * socket   — breadboard hole / female header; accepts leads.
 * terminal — screw/clip terminal; only wires attach.
 */
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PinKind = 'lead' | 'socket' | 'terminal';

export interface PinDef {
  id: string;
  x: number;
  y: number;
  label?: string;
  kind: PinKind;
}

export type PropField =
  | { key: string; label: string; kind: 'number'; unit?: string; min?: number; max?: number; step?: number; si?: boolean; live?: boolean }
  | { key: string; label: string; kind: 'select'; options: { value: PropValue; label: string }[]; live?: boolean }
  | { key: string; label: string; kind: 'slider'; min: number; max: number; step: number; unit?: string; live?: boolean }
  | { key: string; label: string; kind: 'text' }
  | { key: string; label: string; kind: 'bool'; live?: boolean }
  /** text box + button that sends a message to the running part (terminals, phones); `key` is the input queue name */
  | { key: string; label: string; kind: 'send'; placeholder?: string; newline?: boolean };

export interface RenderArgs {
  comp: ComponentInstance;
  props: Props;
  /** Live simulation state for this component, or undefined when stopped. */
  sim?: Record<string, any>;
}

export type CategoryId =
  | 'boards'
  | 'passive'
  | 'diodes'
  | 'transistors'
  | 'switches'
  | 'power'
  | 'mcu'
  | 'instruments'
  | 'output'
  | 'drivers'
  | 'ics'
  | 'logic'
  | 'gates'
  | 'memory'
  | 'sensors'
  | 'displays'
  | 'comms';

export interface ComponentDef {
  type: string;
  name: string;
  category: CategoryId;
  description: string;
  keywords?: string[];
  /** Local bounding box (used for selection & hit testing). */
  bounds: Bounds;
  /** Optional prop-dependent bounds (e.g. 16x2 vs 20x4 LCD). */
  boundsFor?: (props: Props) => Bounds;
  pins: (props: Props) => PinDef[];
  /** Groups of pins that are permanently connected inside the part. */
  internalConnections?: (props: Props) => string[][];
  defaultProps: Props;
  fields?: PropField[];
  /** z-order: boards draw below parts. */
  layer?: number;
  render: (a: RenderArgs) => ReactNode;
  schematic: (a: RenderArgs) => ReactNode;
  /** Short summary shown under the name in the inspector. */
  summary?: (props: Props) => string;
  build?: (b: SimBuilder, comp: ComponentInstance) => SimComponent;
  /** Is the part interactive during simulation (click / press)? */
  interactive?: 'press' | 'toggle' | 'drag';
  /** prop flipped 0/1 by a click while simulating (default "position") */
  toggleKey?: string;
  /** slider prop adjusted by dragging while simulating (default "position") */
  dragKey?: string;
  /** Microcontroller boards have code. */
  mcu?: { defaultCode: string; board: BoardSpec };
  /** Thumbnail scale override for the library panel. */
  thumbScale?: number;
}

export function boundsOf(def: ComponentDef, props: Props): Bounds {
  return def.boundsFor ? def.boundsFor(props) : def.bounds;
}
