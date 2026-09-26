import type { CustomPartSpec } from '../ai/spec';

export type Rotation = 0 | 1 | 2 | 3;

export interface Point {
  x: number;
  y: number;
}

export type PropValue = string | number | boolean;
export type Props = Record<string, PropValue>;

/** A component placed on the canvas. Position is the world coordinate of the local origin. */
export interface ComponentInstance {
  id: string;
  type: string;
  x: number;
  y: number;
  rot: Rotation;
  flip: boolean;
  props: Props;
}

export interface PinRef {
  comp: string;
  pin: string;
}

export interface Wire {
  id: string;
  a: PinRef;
  b: PinRef;
  /** Intermediate bend points in world coordinates. */
  points: Point[];
  color: string;
}

export interface CircuitDoc {
  version: 1;
  name: string;
  components: ComponentInstance[];
  wires: Wire[];
  /** AI-generated part definitions used by this circuit (travel with exports & share links) */
  customParts?: CustomPartSpec[];
}

export function pinKey(ref: PinRef): string {
  return `${ref.comp}:${ref.pin}`;
}

export function emptyDoc(name = 'Untitled circuit'): CircuitDoc {
  return { version: 1, name, components: [], wires: [] };
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter = (idCounter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
