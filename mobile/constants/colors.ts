export const Colors = {
  // T&T national colours
  primary: '#C8102E',     // Trinidad red
  primaryDark: '#8B0000',
  accent: '#000000',      // black
  gold: '#FFD700',        // from national coat of arms

  // Severity
  critical: '#C8102E',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Alert types
  flood: '#1D4ED8',
  road: '#6B7280',
  weather: '#0EA5E9',
  power: '#FBBF24',
  water: '#06B6D4',
  emergency: '#DC2626',

  // UI
  background: '#F8F9FA',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Dark mode
  dark: {
    background: '#0F0F0F',
    surface: '#1A1A1A',
    border: '#2D2D2D',
    textPrimary: '#F9FAFB',
    textSecondary: '#9CA3AF',
  },
};

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
