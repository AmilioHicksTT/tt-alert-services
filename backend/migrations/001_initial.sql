-- Enable PostGIS for geo-spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone         VARCHAR(20) UNIQUE NOT NULL,
  display_name  VARCHAR(100),
  district_code VARCHAR(10),
  location      GEOGRAPHY(POINT, 4326),  -- stored lat/lng for area queries
  fcm_token     TEXT,                    -- Firebase push token
  verified      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_district ON users(district_code);

-- ─────────────────────────────────────────────
-- ALERTS  (flood / road / weather / utility)
-- ─────────────────────────────────────────────
CREATE TYPE alert_type AS ENUM (
  'flood', 'road_closure', 'weather', 'power_outage',
  'water_outage', 'landslide', 'emergency', 'other'
);

CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');

CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          alert_type NOT NULL,
  severity      alert_severity NOT NULL DEFAULT 'info',
  title         VARCHAR(200) NOT NULL,
  body          TEXT NOT NULL,
  source        VARCHAR(100),            -- ODPM, Met Office, T&TEC, citizen
  district_code VARCHAR(10),
  location      GEOGRAPHY(POINT, 4326),
  radius_km     NUMERIC(6,2),            -- affected radius from epicentre
  area_polygon  GEOGRAPHY(POLYGON, 4326), -- optional precise area
  active        BOOLEAN DEFAULT TRUE,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_active  ON alerts(active);
CREATE INDEX idx_alerts_district ON alerts(district_code);
CREATE INDEX idx_alerts_type    ON alerts(type);
CREATE INDEX idx_alerts_geo     ON alerts USING GIST(location);

-- ─────────────────────────────────────────────
-- CITIZEN REPORTS
-- ─────────────────────────────────────────────
CREATE TYPE report_type AS ENUM (
  'water_outage', 'burst_main', 'power_outage', 'blocked_drain',
  'fallen_tree', 'flooding', 'road_damage', 'other'
);

CREATE TYPE report_status AS ENUM ('open', 'acknowledged', 'in_progress', 'resolved');

CREATE TABLE reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          report_type NOT NULL,
  description   TEXT,
  photo_url     TEXT,
  location      GEOGRAPHY(POINT, 4326) NOT NULL,
  district_code VARCHAR(10),
  status        report_status DEFAULT 'open',
  upvotes       INT DEFAULT 0,
  reporter_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_status   ON reports(status);
CREATE INDEX idx_reports_district ON reports(district_code);
CREATE INDEX idx_reports_type     ON reports(type);
CREATE INDEX idx_reports_geo      ON reports USING GIST(location);

-- Track which users upvoted which reports (prevent double-upvote)
CREATE TABLE report_upvotes (
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id)   ON DELETE CASCADE,
  PRIMARY KEY (report_id, user_id)
);

-- ─────────────────────────────────────────────
-- TRANSPORT
-- ─────────────────────────────────────────────
CREATE TYPE transport_type AS ENUM ('ptsc', 'maxi_taxi', 'water_taxi');
CREATE TYPE route_status   AS ENUM ('normal', 'delayed', 'cancelled', 'unknown');

CREATE TABLE transport_routes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         VARCHAR(20) UNIQUE NOT NULL,   -- e.g. PTSC-PBR, MAXI-EW
  name         VARCHAR(200) NOT NULL,
  type         transport_type NOT NULL,
  origin       VARCHAR(100),
  destination  VARCHAR(100),
  waypoints    JSONB,                          -- array of {lat, lng, name}
  status       route_status DEFAULT 'unknown',
  delay_mins   INT DEFAULT 0,
  status_note  TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transport_type   ON transport_routes(type);
CREATE INDEX idx_transport_status ON transport_routes(status);

-- ─────────────────────────────────────────────
-- OTP (phone verification)
-- ─────────────────────────────────────────────
CREATE TABLE otp_codes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone      VARCHAR(20) NOT NULL,
  code       VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_codes(phone);

-- ─────────────────────────────────────────────
-- DISTRICTS lookup
-- ─────────────────────────────────────────────
CREATE TABLE districts (
  code     VARCHAR(10) PRIMARY KEY,
  name     VARCHAR(100) NOT NULL,
  region   VARCHAR(50),
  centroid GEOGRAPHY(POINT, 4326)
);

INSERT INTO districts (code, name, region) VALUES
  ('POS',  'Port of Spain',         'North'),
  ('SFO',  'San Fernando',          'South'),
  ('ARI',  'Arima',                 'East'),
  ('CHG',  'Chaguanas',             'Central'),
  ('PTF',  'Point Fortin',          'South-West'),
  ('DGO',  'Diego Martin',          'North-West'),
  ('TUP',  'Tunapuna-Piarco',       'East'),
  ('SJU',  'San Juan-Laventille',   'East'),
  ('PED',  'Penal-Debe',            'South'),
  ('SIP',  'Siparia',               'South'),
  ('RCL',  'Rio Claro-Mayaro',      'South-East'),
  ('SNG',  'Sangre Grande',         'North-East'),
  ('COU',  'Couva-Tabaquite-Talparo','Central'),
  ('PTF2', 'Princes Town',          'South-Central'),
  ('TOB',  'Tobago',                'Tobago');
