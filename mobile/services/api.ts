import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import {
  MOCK_ALERTS, MOCK_REPORTS, MOCK_TRANSPORT, MOCK_SUMMARY, MOCK_USER,
} from './mockData';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

// Wrap a value as if it were an axios response
const mock = (data: any) => Promise.resolve({ data });

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
export const authApi = {
  sendOtp: (phone: string) => DEMO_MODE ? mock({ message: 'OTP sent' }) : api.post('/users/otp/send', { phone }),
  verifyOtp: (phone: string, code: string) =>
    DEMO_MODE ? mock({ token: 'demo-token', user: MOCK_USER }) : api.post('/users/otp/verify', { phone, code }),
  getMe: () => DEMO_MODE ? mock(MOCK_USER) : api.get('/users/me'),
  updateProfile: (data: object) => DEMO_MODE ? mock({ ...MOCK_USER, ...data }) : api.patch('/users/me', data),
};

// ─────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────
export const alertsApi = {
  list: (params?: { district?: string; lat?: number; lng?: number; radius?: number; type?: string }) =>
    DEMO_MODE ? mock(MOCK_ALERTS) : api.get('/alerts', { params }),
  get: (id: string) =>
    DEMO_MODE ? mock(MOCK_ALERTS.find((a) => a.id === id) || MOCK_ALERTS[0]) : api.get(`/alerts/${id}`),
};

// ─────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────
export const reportsApi = {
  list: (params?: { district?: string; lat?: number; lng?: number; radius?: number; type?: string }) =>
    DEMO_MODE ? mock(MOCK_REPORTS) : api.get('/reports', { params }),
  create: (data: {
    type: string;
    description?: string;
    photo_url?: string;
    lat: number;
    lng: number;
    district_code?: string;
  }) => DEMO_MODE ? mock({ id: 'new-report', ...data, status: 'open', upvotes: 0, created_at: new Date().toISOString() })
    : api.post('/reports', data),
  upvote: (id: string) => DEMO_MODE ? mock({ upvotes: 1 }) : api.post(`/reports/${id}/upvote`),
};

// ─────────────────────────────────────────────
// TRANSPORT
// ─────────────────────────────────────────────
export const transportApi = {
  routes: (params?: { type?: string; status?: string }) =>
    DEMO_MODE ? mock(MOCK_TRANSPORT) : api.get('/transport/routes', { params }),
  getRoute: (id: string) =>
    DEMO_MODE ? mock(MOCK_TRANSPORT.find((r) => r.id === id) || MOCK_TRANSPORT[0]) : api.get(`/transport/routes/${id}`),
  crowdReport: (id: string, delay_mins: number, note?: string) =>
    DEMO_MODE ? mock({ message: 'Report received' }) : api.post(`/transport/routes/${id}/crowd-report`, { delay_mins, note }),
};

// ─────────────────────────────────────────────
// AREA SUMMARY
// ─────────────────────────────────────────────
export const areaApi = {
  summary: (params: { district?: string; lat?: number; lng?: number }) =>
    DEMO_MODE ? mock(MOCK_SUMMARY) : api.get('/area/summary', { params }),
  districts: () => DEMO_MODE ? mock([
    { code: 'POS', name: 'Port of Spain', region: 'North' },
    { code: 'SFO', name: 'San Fernando', region: 'South' },
    { code: 'CHG', name: 'Chaguanas', region: 'Central' },
  ]) : api.get('/area/districts'),
};

export default api;
