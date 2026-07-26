/**
 * Deterministic, local avatar generator (no deps, no CDN). Produces an on-theme
 * SVG data URL seeded by the user's email and tinted by gender. Used as the
 * fallback whenever a user hasn't uploaded a profile image.
 */

export type Gender = 'male' | 'female' | 'other';

export function isGender(v: string | undefined | null): v is Gender {
  return v === 'male' || v === 'female' || v === 'other';
}

// Gender-tinted gradient pairs, drawn from the app's cyan/violet identity so
// generated avatars still read as part of the cyber-SOC system.
const PALETTES: Record<Gender, [string, string]> = {
  male: ['#22d3ee', '#0891b2'], // cyan
  female: ['#a78bfa', '#7c3aed'], // violet
  other: ['#34d399', '#0891b2'], // teal→cyan
};

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initials(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[.\-_+]/).filter(Boolean);
  const chars =
    parts.length >= 2
      ? parts[0][0] + parts[1][0]
      : local.slice(0, 2);
  return chars.toUpperCase();
}

/**
 * Generate a data-URL SVG avatar for `email`, tinted by `gender`
 * (defaults to 'other' when unknown). Deterministic: same inputs → same image.
 */
export function generatedAvatar(email: string, gender?: string): string {
  const g: Gender = isGender(gender) ? gender : 'other';
  const [from, to] = PALETTES[g];
  const h = hash(email + g);
  const rotation = h % 360;
  const label = initials(email || '??');
  const gradId = `g${h.toString(36)}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Generated avatar">
  <defs>
    <linearGradient id="${gradId}" gradientTransform="rotate(${rotation} 0.5 0.5)">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="20" fill="url(#${gradId})"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="JetBrains Mono, ui-monospace, monospace" font-size="38"
        font-weight="700" fill="#06202a">${label}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
