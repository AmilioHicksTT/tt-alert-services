import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface User {
  id: string;
  phone: string;
  display_name?: string;
  district_code?: string;
  verified: boolean;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  source?: string;
  district_code?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
  active: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  type: string;
  description?: string;
  photo_url?: string;
  status: string;
  upvotes: number;
  district_code?: string;
  lat: number;
  lng: number;
  created_at: string;
}

export interface TransportRoute {
  id: string;
  code: string;
  name: string;
  type: string;
  origin?: string;
  destination?: string;
  status: string;
  delay_mins: number;
  status_note?: string;
  last_updated: string;
}

export interface AreaSummary {
  district: { code: string; name: string; region: string };
  alerts: Alert[];
  reports: Report[];
  transport_disruptions: TransportRoute[];
  generated_at: string;
}

interface Coords {
  lat: number;
  lng: number;
}

interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;

  // Location
  location: Coords | null;
  setLocation: (loc: Coords) => void;

  // Area summary
  summary: AreaSummary | null;
  setSummary: (s: AreaSummary) => void;

  // Alerts
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;

  // Transport
  routes: TransportRoute[];
  setRoutes: (routes: TransportRoute[]) => void;

  // Reports
  reports: Report[];
  setReports: (reports: Report[]) => void;
  addReport: (report: Report) => void;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  token: null,
  location: null,
  summary: null,
  alerts: [],
  routes: [],
  reports: [],

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    set({ user, token });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    set({ user: null, token: null });
  },

  loadStoredAuth: async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    const userStr = await SecureStore.getItemAsync('auth_user');
    if (token && userStr) {
      set({ token, user: JSON.parse(userStr) });
    }
  },

  setLocation: (location) => set({ location }),
  setSummary: (summary) => set({ summary }),
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) =>
    set((state) => ({ alerts: [alert, ...state.alerts.filter((a) => a.id !== alert.id)] })),
  setRoutes: (routes) => set({ routes }),
  setReports: (reports) => set({ reports }),
  addReport: (report) =>
    set((state) => ({ reports: [report, ...state.reports.filter((r) => r.id !== report.id)] })),
}));
