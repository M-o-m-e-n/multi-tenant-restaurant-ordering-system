import tailwindConfig from '../../tailwind.config';

/**
 * Design tokens for code that cannot use class names (chart libraries). Read
 * straight from the Tailwind theme so colours have one source (fork-flame-ui §2).
 */
const colors = tailwindConfig.theme.extend.colors;

export const chartTheme = {
  /** The single series colour: flame, used as a fill (≥ 3:1 against the panel). */
  series: colors.flame.light,
  seriesHover: colors.flame.DEFAULT,
  grid: colors.line.DEFAULT,
  axis: colors.ink.muted,
  text: colors.ink.DEFAULT,
  surface: colors.surface.DEFAULT,
  surfaceRaised: colors.surface.raised,
} as const;
