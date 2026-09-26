import type { ReactNode } from 'react';
import type { ComponentInstance, Props, PropValue } from '../model/types';
import type { SimBuilder, SimComponent } from '../sim/builder';

/**
 * lead     — a component leg; plugs into a socket it sits on top of.
 * socket   — breadboard hole / female header; accepts leads.
 * terminal — screw/clip terminal; only wires attach.
 */
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
  | { key: string; label: string; kind: 'bool'; live?: boolean };

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
  | 'output';

export interface ComponentDef {
  type: string;
  name: string;
  category: CategoryId;
  description: string;
  keywords?: string[];
  /** Local bounding box (used for selection & hit testing). */
  bounds: { x: number; y: number; w: number; h: number };
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
  /** Microcontroller boards have code. */
  mcu?: { defaultCode: string };
  /** Thumbnail scale override for the library panel. */
  thumbScale?: number;
}
