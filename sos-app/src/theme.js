export const C = {
  // Theme Backgrounds & Surfaces: Crisp, Modern, Forest-Slate Palette
  bg: '#F6F9F6',
  card: '#FFFFFF',
  cardSubtle: '#F0F6F1',
  surface: '#FFFFFF',
  text: '#0E2012',
  textSecondary: '#243A29',
  sub: '#506855',
  muted: '#809B86',
  border: '#DFE8E0',
  borderLight: '#EDF4EE',
  borderDark: '#C7D7C9',

  // Core Theme: Forest Green (#24652B)
  forest: '#24652B',
  forestDark: '#1B4F22',
  forestLight: '#2F7E37',
  forestBg: '#EDF6EE',
  forestBorder: '#C6DEC9',
  forestGlow: 'rgba(36, 101, 43, 0.22)',

  // Core Accent: Golden Yellow (#FABC11)
  gold: '#FABC11',
  goldDark: '#B88000',
  goldLight: '#FCD34D',
  goldBg: '#FEF9E7',
  goldBorder: '#FDE68A',
  goldGlow: 'rgba(250, 188, 17, 0.28)',

  // Brand Aliases
  primary: '#24652B',
  primaryDark: '#1B4F22',
  primaryLight: '#2F7E37',
  primaryBg: '#EDF6EE',
  primaryBorder: '#C6DEC9',
  primaryGlow: 'rgba(36, 101, 43, 0.22)',

  accent: '#FABC11',
  accentDark: '#B88000',
  accentLight: '#FCD34D',
  accentBg: '#FEF9E7',
  accentBorder: '#FDE68A',
  accentGlow: 'rgba(250, 188, 17, 0.28)',

  // Map blue & indigo to Forest Green so all existing screens seamlessly adopt the theme
  blue: '#24652B',
  blueDark: '#1B4F22',
  blueLight: '#2F7E37',
  blueBg: '#EDF6EE',
  blueBorder: '#C6DEC9',
  blueGlow: 'rgba(36, 101, 43, 0.22)',

  indigo: '#24652B',
  indigoDark: '#1B4F22',
  indigoLight: '#2F7E37',
  indigoBg: '#EDF6EE',
  indigoBorder: '#C6DEC9',

  // Map green to Forest Green
  green: '#24652B',
  greenDark: '#1B4F22',
  greenLight: '#2F7E37',
  greenBg: '#EDF6EE',
  greenBorder: '#C6DEC9',

  // Map amber & yellow to Golden Yellow
  amber: '#FABC11',
  amberDark: '#B88000',
  amberLight: '#FCD34D',
  amberBg: '#FEF9E7',
  amberBorder: '#FDE68A',

  yellow: '#FABC11',
  yellowDark: '#B88000',
  yellowLight: '#FCD34D',
  yellowBg: '#FEF9E7',
  yellowBorder: '#FDE68A',

  // Emergency SOS & High Threat (Maintained for safety protocols)
  red: '#DC2626',
  redDark: '#991B1B',
  redLight: '#EF4444',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  redGlow: 'rgba(220, 38, 38, 0.22)',

  teal: '#24652B',
  tealDark: '#1B4F22',
  tealBg: '#EDF6EE',
  tealBorder: '#C6DEC9',

  cyan: '#2E8037',
  cyanDark: '#1B4F22',
  cyanBg: '#EDF6EE',
  cyanBorder: '#C6DEC9',

  rose: '#DC2626',
  roseBg: '#FEF2F2',
  roseBorder: '#FECACA',

  navy: '#0E2012',
  navyLight: '#1B3821',
  gray: '#809B86',
  white: '#FFFFFF',
};

export const SHADOWS = {
  sm: {
    shadowColor: '#0E2012',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0E2012',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0E2012',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 6,
  },
  glow: (color = C.forest) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 8,
  }),
};

export const TYPES = [
  { key: 'medical', label: 'Medical Emergency', emoji: '🚑', icon: 'medical', color: '#EF4444', bg: '#FEE2E2', border: '#FCA5A5', desc: 'Injury, unconsciousness, severe illness' },
  { key: 'fire', label: 'Fire & Smoke', emoji: '🔥', icon: 'flame', color: '#F97316', bg: '#FFEDD5', border: '#FDBA74', desc: 'Active fire, smoke smell, hazard' },
  { key: 'fight', label: 'Physical Threat', emoji: '⚠️', icon: 'shield-alert', color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5', desc: 'Assault, weapon, active altercation' },
  { key: 'accident', label: 'Accident / Hazard', emoji: '💥', icon: 'alert-triangle', color: '#D97706', bg: '#FEF3C7', border: '#FCD34D', desc: 'Structural hazard, chemical leak, collision' },
  { key: 'harassment', label: 'Harassment / Safety', emoji: '🛑', icon: 'hand-left', color: '#8B5CF6', bg: '#EDE9FE', border: '#C4B5FD', desc: 'Stalking, aggressive confrontation' },
  { key: 'other', label: 'General Emergency', emoji: '❗', icon: 'alert-circle', color: '#0284C7', bg: '#E0F2FE', border: '#BAE6FD', desc: 'Immediate security assistance needed' },
];

export const typeInfo = (key) => TYPES.find((t) => t.key === key) || TYPES[TYPES.length - 1];

export const ACTIVE = ['open', 'acknowledged', 'on_the_way'];

export const STATUS = {
  open: {
    label: 'Waiting for Responder',
    short: 'WAITING',
    color: '#EF4444',
    bg: '#FEF2F2',
    border: '#FECACA',
    icon: 'time-outline',
  },
  acknowledged: {
    label: 'Dispatched & Received',
    short: 'RECEIVED',
    color: '#F59E0B',
    bg: '#FFFBEB',
    border: '#FDE68A',
    icon: 'eye-outline',
  },
  on_the_way: {
    label: 'Responder En Route',
    short: 'EN ROUTE',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    icon: 'navigate-outline',
  },
  resolved: {
    label: 'Resolved',
    short: 'RESOLVED',
    color: '#10B981',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    icon: 'checkmark-circle-outline',
  },
  cancelled: {
    label: 'Cancelled',
    short: 'CANCELLED',
    color: '#64748B',
    bg: '#F8FAFC',
    border: '#E2E8F0',
    icon: 'close-circle-outline',
  },
};

export const parseTime = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z') : null);

export function fmtTime(s) {
  const d = parseTime(s);
  if (!d || isNaN(d)) return '';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(s) {
  const d = parseTime(s);
  if (!d || isNaN(d)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return 'Just now';
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
