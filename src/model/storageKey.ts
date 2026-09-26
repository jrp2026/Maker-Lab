/** localStorage key for MakerLab data; carries over data saved under the app's old "circuitlab:" prefix. */
export function storageKey(name: string): string {
  const key = `makerlab:${name}`;
  try {
    const old = `circuitlab:${name}`;
    if (typeof localStorage !== 'undefined' && localStorage.getItem(key) === null) {
      const v = localStorage.getItem(old);
      if (v !== null) {
        localStorage.setItem(key, v);
        localStorage.removeItem(old);
      }
    }
  } catch {
    // storage unavailable (private mode / tests)
  }
  return key;
}
