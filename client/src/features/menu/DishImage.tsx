const PLACEHOLDER: Record<string, string> = {
  starters: '🥗',
  mains: '🍽️',
  desserts: '🍰',
  drinks: '🥤',
};

interface Props {
  name: string;
  imageUrl: string | null;
  category?: string;
  size: 'sm' | 'md' | 'lg';
  soldOut?: boolean;
}

const sizes = {
  // `dish-thumb` lets a tenant reshape list thumbnails (styles/themes.css).
  sm: 'dish-thumb size-14 text-3xl',
  md: 'size-32 text-6xl',
  lg: 'size-44 text-7xl',
} as const;

/**
 * A dish on a round plate (fork-flame-ui §5). Without a photo it shows a
 * neutral plate with a category glyph; sold-out dishes are desaturated.
 */
export function DishImage({ name, imageUrl, category, size, soldOut = false }: Props) {
  const tone = soldOut ? 'grayscale opacity-60' : '';
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        className={`${sizes[size]} shrink-0 rounded-full border-4 border-card-top object-cover shadow-dish ${tone}`}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={name}
      className={`${sizes[size]} grid shrink-0 place-items-center rounded-full border-4 border-card-top bg-slate shadow-dish ${tone}`}
    >
      <span aria-hidden="true">{PLACEHOLDER[category?.toLowerCase() ?? ''] ?? '🍽️'}</span>
    </div>
  );
}
