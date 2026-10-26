export const colors = {
  background: '#F8F7F4',
  paper: '#FFFFFF',
  ink: '#203C35',
  text: '#283A34',
  muted: '#65736B',
  border: '#E3E7E1',
  borderSubtle: '#EDF1EC',
  accent: '#AF4C2D',
  accentPressed: '#933D20',
  accentLight: '#FCF0E9',
  greenLight: '#EAF0E8',
  error: '#AD3333',
  errorLight: '#FFF0ED',
  errorBorder: '#FFCDD2',
  success: '#2E7D32',
  successLight: '#EAF5EA',
  successBorder: '#C8E6C9',
  warning: '#8C5700',
  warningLight: '#FFF8E1',
  warningBorder: '#FFE082',
  info: '#1565C0',
  infoLight: '#E3F2FD',
  infoBorder: '#BBDEFB',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  section: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 21 },
  caption: { fontSize: 12, lineHeight: 18 },
} as const;

export const shadows = {
  card: {
    shadowColor: '#203C35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  modal: {
    shadowColor: '#203C35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  bottomBar: {
    shadowColor: '#203C35',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;
