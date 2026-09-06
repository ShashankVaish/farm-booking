export const breakpoints = {
  320: 320,
  375: 375,
  390: 390,
  414: 414,
  768: 768,
  1024: 1024,
  1280: 1280,
  1440: 1440,
  1920: 1920,
} as const;

export type Breakpoint = keyof typeof breakpoints;
