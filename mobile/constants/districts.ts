export interface District {
  code: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
}

export const DISTRICTS: District[] = [
  { code: 'POS',  name: 'Port of Spain',          region: 'North',         lat: 10.6549,  lng: -61.5019 },
  { code: 'SFO',  name: 'San Fernando',            region: 'South',         lat: 10.2796,  lng: -61.4683 },
  { code: 'ARI',  name: 'Arima',                   region: 'East',          lat: 10.6362,  lng: -61.2831 },
  { code: 'CHG',  name: 'Chaguanas',               region: 'Central',       lat: 10.5168,  lng: -61.4111 },
  { code: 'PTF',  name: 'Point Fortin',            region: 'South-West',    lat: 10.1703,  lng: -61.6824 },
  { code: 'DGO',  name: 'Diego Martin',            region: 'North-West',    lat: 10.7300,  lng: -61.5650 },
  { code: 'TUP',  name: 'Tunapuna-Piarco',         region: 'East',          lat: 10.6433,  lng: -61.3856 },
  { code: 'SJU',  name: 'San Juan-Laventille',     region: 'East',          lat: 10.6540,  lng: -61.4440 },
  { code: 'PED',  name: 'Penal-Debe',              region: 'South',         lat: 10.1480,  lng: -61.4540 },
  { code: 'SIP',  name: 'Siparia',                 region: 'South',         lat: 10.1364,  lng: -61.5027 },
  { code: 'RCL',  name: 'Rio Claro-Mayaro',        region: 'South-East',    lat: 10.2980,  lng: -61.1790 },
  { code: 'SNG',  name: 'Sangre Grande',           region: 'North-East',    lat: 10.5870,  lng: -61.1290 },
  { code: 'COU',  name: 'Couva-Tabaquite-Talparo', region: 'Central',       lat: 10.4213,  lng: -61.4483 },
  { code: 'PTF2', name: 'Princes Town',            region: 'South-Central', lat: 10.2702,  lng: -61.3682 },
  { code: 'TOB',  name: 'Tobago',                  region: 'Tobago',        lat: 11.2511,  lng: -60.6778 },
];

export function getDistrictByCode(code: string): District | undefined {
  return DISTRICTS.find((d) => d.code === code);
}
