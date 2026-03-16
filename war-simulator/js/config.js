const MAP_CONFIG = {
  center: [28.5, 46.5],
  zoom: {
    min: 5,
    initial: 6,
    max: 12
  },
  maxBounds: {
    minLat: 10.0,
    maxLat: 42.0,
    minLng: 28.0,
    maxLng: 65.0
  },
  maxBoundsViscosity: 0.8
};

const COLORS = {
  factions: {
    blue: {
      primary: '#2563eb',
      dark: '#1e40af',
      light: '#60a5fa',
      glow: 'rgba(37, 99, 235, 0.5)'
    },
    red: {
      primary: '#dc2626',
      dark: '#991b1b',
      light: '#f87171',
      glow: 'rgba(220, 38, 38, 0.5)'
    },
    orange: {
      primary: '#ea580c',
      dark: '#9a3412',
      light: '#fb923c',
      glow: 'rgba(234, 88, 12, 0.5)'
    }
  }
};