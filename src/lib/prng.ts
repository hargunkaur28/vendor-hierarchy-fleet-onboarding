/**
 * Mulberry32 seeded PRNG — deterministic pseudo-random number generator.
 * Produces the same sequence for the same seed, making demos reproducible.
 * @see https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 *
 * @param seed - 32-bit integer seed
 * @returns A function that returns a float in [0, 1) on each call
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded random utilities built on mulberry32.
 * All methods are deterministic for a given seed.
 */
export class SeededRandom {
  private next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  /** Float in [0, 1) */
  random(): number {
    return this.next();
  }

  /** Integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Pick one element from array */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  /** Pick n unique elements from array (Fisher-Yates partial shuffle) */
  sample<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr];
    const count = Math.min(n, copy.length);
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(this.next() * (copy.length - i));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy.slice(0, count);
  }

  /** True with probability p (0–1) */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Generate a UUID-like string (not cryptographic, but unique enough for mock data) */
  uuid(): string {
    const hex = () =>
      Math.floor(this.next() * 0x10000)
        .toString(16)
        .padStart(4, '0');
    return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex()}`;
  }
}
