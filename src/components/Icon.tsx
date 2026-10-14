import type { CSSProperties } from 'react';

const S = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E";
const E = '%3C/svg%3E';

/** Line icons (24px grid, 1.7 stroke) used as CSS masks so they inherit currentColor. Same set as the Luma theme. */
export const ICONS = {
  menu: `${S}%3Cpath d='M3.5 7h17M3.5 12h17M3.5 17h11'/%3E${E}`,
  search: `${S}%3Ccircle cx='10.8' cy='10.8' r='6.3'/%3E%3Cpath d='M15.6 15.6l4.6 4.6'/%3E${E}`,
  bag: `${S}%3Cpath d='M5.2 8.2h13.6l-1 11.6a1.4 1.4 0 0 1-1.4 1.2H7.6a1.4 1.4 0 0 1-1.4-1.2z'/%3E%3Cpath d='M8.8 8.2V7a3.2 3.2 0 0 1 6.4 0v1.2'/%3E${E}`,
  user: `${S}%3Ccircle cx='12' cy='8.3' r='3.9'/%3E%3Cpath d='M4.6 20.2c1.2-3.7 4-5.6 7.4-5.6s6.2 1.9 7.4 5.6'/%3E${E}`,
  close: `${S}%3Cpath d='M6 6l12 12M18 6L6 18'/%3E${E}`,
  chevR: `${S}%3Cpath d='M9.5 5.5L16 12l-6.5 6.5'/%3E${E}`,
  chevL: `${S}%3Cpath d='M14.5 5.5L8 12l6.5 6.5'/%3E${E}`,
  chevD: `${S}%3Cpath d='M6 9.5l6 6 6-6'/%3E${E}`,
  filter: `${S}%3Cpath d='M4 7h10M18 7h2M4 17h2M10 17h10'/%3E%3Ccircle cx='16' cy='7' r='2'/%3E%3Ccircle cx='8' cy='17' r='2'/%3E${E}`,
  trash: `${S}%3Cpath d='M4.5 7h15M9.5 7V5h5v2M6.5 7l.8 12.2a1 1 0 0 0 1 .8h7.4a1 1 0 0 0 1-.8L17.5 7'/%3E${E}`,
  heart: `${S}%3Cpath d='M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z'/%3E${E}`,
  heartFill: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black' stroke='black' stroke-width='1.7' stroke-linejoin='round'%3E%3Cpath d='M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z'/%3E%3C/svg%3E",
  check: `${S}%3Cpath d='M5 12.5l4.2 4.2L19 7'/%3E${E}`,
  plus: `${S}%3Cpath d='M12 5v14M5 12h14'/%3E${E}`,
  minus: `${S}%3Cpath d='M5 12h14'/%3E${E}`,
  arrowUp: `${S}%3Cpath d='M12 19V5M6 11l6-6 6 6'/%3E${E}`,
  arrowDown: `${S}%3Cpath d='M12 5v14M6 13l6 6 6-6'/%3E${E}`,
  eye: `${S}%3Cpath d='M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E${E}`,
  clock: `${S}%3Ccircle cx='12' cy='12' r='8.5'/%3E%3Cpath d='M12 7.5V12l3 2'/%3E${E}`,
  truck: `${S}%3Cpath d='M3 7h11v9H3zM14 10h4l3 3v3h-7z'/%3E%3Ccircle cx='7' cy='17.5' r='1.8'/%3E%3Ccircle cx='17.5' cy='17.5' r='1.8'/%3E${E}`,
  lock: `${S}%3Crect x='5' y='10.5' width='14' height='9.5' rx='2'/%3E%3Cpath d='M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5'/%3E${E}`,
  edit: `${S}%3Cpath d='M4.5 19.5l1-4L15.8 5.2a2 2 0 0 1 2.9 0l.1.1a2 2 0 0 1 0 2.9L8.5 18.5z'/%3E${E}`,
  tag: `${S}%3Cpath d='M3.5 12.2V4.5h7.7l9.3 9.3-7.7 7.7z'/%3E%3Ccircle cx='8' cy='9' r='1.4'/%3E${E}`,
  bagPlus: `${S}%3Cpath d='M5.5 8h13l-1 12h-11z'/%3E%3Cpath d='M9 10V6.5a3 3 0 0 1 6 0V10'/%3E%3Cpath d='M12 12.2v5M9.5 14.7h5'/%3E${E}`,
  arrowR: `${S}%3Cpath d='M5 12h14M13 6l6 6-6 6'/%3E${E}`,
  grid: `${S}%3Crect x='4' y='4' width='6.5' height='6.5' rx='1.2'/%3E%3Crect x='13.5' y='4' width='6.5' height='6.5' rx='1.2'/%3E%3Crect x='4' y='13.5' width='6.5' height='6.5' rx='1.2'/%3E%3Crect x='13.5' y='13.5' width='6.5' height='6.5' rx='1.2'/%3E${E}`,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  const s: CSSProperties & { '--i': string } = { '--i': `url("${ICONS[name]}")`, ...style };
  if (size) {
    s.width = size;
    s.height = size;
  }
  return <span aria-hidden="true" className={className ? `ts-i ${className}` : 'ts-i'} style={s} />;
}
