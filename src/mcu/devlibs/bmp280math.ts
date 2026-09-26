/** BMP280 datasheet compensation (integer versions, as used by the Adafruit library), shared by the chip model. */
export interface Bmp280Calib {
  T1: number; T2: number; T3: number;
  P1: number; P2: number; P3: number; P4: number; P5: number; P6: number; P7: number; P8: number; P9: number;
}

/** The datasheet's example calibration (a typical chip). */
export const BMP280_CALIB: Bmp280Calib = { T1: 27504, T2: 26435, T3: -1000, P1: 36477, P2: -10685, P3: 3024, P4: 2855, P5: 140, P6: -7, P7: 15500, P8: -14600, P9: 6000 };

export function bmpTFine(adcT: number, c: Bmp280Calib): number {
  const var1 = ((((adcT >> 3) - (c.T1 << 1))) * c.T2) >> 11;
  const var2 = (((((adcT >> 4) - c.T1) * ((adcT >> 4) - c.T1)) >> 12) * c.T3) >> 14;
  return var1 + var2;
}

/** temperature in °C */
export function bmpTemperature(adcT: number, c: Bmp280Calib): number {
  return ((bmpTFine(adcT, c) * 5 + 128) >> 8) / 100;
}

/** pressure in Pa */
export function bmpPressure(adcP: number, tFine: number, c: Bmp280Calib): number {
  let var1 = BigInt(tFine) - 128000n;
  let var2 = var1 * var1 * BigInt(c.P6);
  var2 = var2 + ((var1 * BigInt(c.P5)) << 17n);
  var2 = var2 + (BigInt(c.P4) << 35n);
  var1 = ((var1 * var1 * BigInt(c.P3)) >> 8n) + ((var1 * BigInt(c.P2)) << 12n);
  var1 = (((1n << 47n) + var1) * BigInt(c.P1)) >> 33n;
  if (var1 === 0n) return 0;
  let p = 1048576n - BigInt(adcP);
  p = (((p << 31n) - var2) * 3125n) / var1;
  var1 = (BigInt(c.P9) * (p >> 13n) * (p >> 13n)) >> 25n;
  var2 = (BigInt(c.P8) * p) >> 19n;
  p = ((p + var1 + var2) >> 8n) + (BigInt(c.P7) << 4n);
  return Number(p) / 256;
}

/** Raw ADC readings that compensate to the given temperature (°C) and pressure (Pa). */
export function bmpRaw(tempC: number, pressPa: number, c: Bmp280Calib): { adcT: number; adcP: number } {
  let lo = 0, hi = (1 << 20) - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bmpTemperature(mid, c) < tempC) lo = mid + 1;
    else hi = mid;
  }
  const adcT = lo;
  const tFine = bmpTFine(adcT, c);
  // pressure falls as adc_P rises
  let a = 0, b = (1 << 20) - 1;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (bmpPressure(mid, tFine, c) > pressPa) a = mid + 1;
    else b = mid;
  }
  return { adcT, adcP: a };
}
