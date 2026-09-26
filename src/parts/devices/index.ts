/** Built-in parts with TypeScript behaviour that Arduino libraries talk to. */
import type { DevicePart } from './common';
import { DISPLAY_DEVICES } from './displays';
import { SENSOR_DEVICES } from './sensors';
import { MEMORY_DEVICES } from './memory';
import { COMM_DEVICES } from './comm';

export const DEVICE_PARTS: DevicePart[] = [...DISPLAY_DEVICES, ...SENSOR_DEVICES, ...MEMORY_DEVICES, ...COMM_DEVICES];
