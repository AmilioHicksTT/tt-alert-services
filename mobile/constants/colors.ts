export const Colors = {
  // T&T national colours
  primary: '#C8102E',
  primaryDark: '#9B0D23',
  primaryLight: '#E8384F',
  accent: '#1A1A2E',
  gold: '#F5A623',

  // Gradients (for LinearGradient)
  gradientPrimary: ['#C8102E', '#9B0D23'] as const,
  gradientDark: ['#1A1A2E', '#16213E'] as const,
  gradientSunrise: ['#C8102E', '#F5A623'] as const,

  // Severity
  critical: '#DC2626',
  warning: '#F59E0B',
  info: '#3B82F6',
  success: '#16A34A',

  // Alert types
  flood: '#1D4ED8',
  road: '#6B7280',
  weather: '#0EA5E9',
  power: '#FBBF24',
  water: '#06B6D4',
  emergency: '#DC2626',

  // UI
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E8E8ED',
  textPrimary: '#1C1C1E',
  textSecondary: '#636366',
  textMuted: '#AEAEB2',

  // Dark mode
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    border: '#38383A',
    textPrimary: '#F5F5F7',
    textSecondary: '#AEAEB2',
  },
};

export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
} as const;

export const AlertTypeColors: Record<string, string> = {
  flood: Colors.flood,
  road_closure: Colors.road,
  weather: Colors.weather,
  power_outage: Colors.power,
  water_outage: Colors.water,
  landslide: '#92400E',
  emergency: Colors.emergency,
  other: Colors.textSecondary,
};

export const AlertTypeIcons: Record<string, string> = {
  flood: 'water',
  road_closure: 'car-off',
  weather: 'weather-lightning-rainy',
  power_outage: 'flash-off',
  water_outage: 'water-off',
  landslide: 'terrain',
  emergency: 'alert-circle',
  other: 'information',
};

export const ReportTypeIcons: Record<string, string> = {
  water_outage: 'water-off',
  burst_main: 'pipe-leak',
  power_outage: 'flash-off',
  blocked_drain: 'pipe',
  fallen_tree: 'tree',
  flooding: 'water',
  road_damage: 'road',
  other: 'flag',
};
