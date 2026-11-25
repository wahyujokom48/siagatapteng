import { District } from '../data/districts';

export type AlertLevel = 'AMAN' | 'WASPADA' | 'SIAGA' | 'AWAS';

export interface HourlyPoint {
  time: string;
  hourLabel: string;
  rainMm: number;
  probability: number;
  tempC: number;
  cloudCover: number;
}

export interface DailyPoint {
  date: string;
  dayLabel: string;
  rainSumMm: number;
  maxProb: number;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  weatherLabel: string;
  bmkgCategory: string;
}

export interface ModelComparisonItem {
  modelId: string;
  modelName: string;
  agency: string;
  next6hRainMm: number;
  next24hRainMm: number;
  past3DaysRainMm: number;
  maxHourlyRainMm: number;
  alertLevel: AlertLevel;
}

export interface DistrictWeather {
  district: District;
  currentTempC: number;
  apparentTempC: number;
  currentRainMm: number;
  currentHumidity: number;
  currentWindKmh: number;
  windGustsKmh: number;
  cloudCover: number;
  pressureMsl: number;
  weatherCode: number;
  weatherLabel: string;
  next6hRainMm: number;
  next24hRainMm: number;
  past3DaysRainMm: number;
  maxHourlyRainMm: number;
  maxRainProb: number;
  bmkg24hCategory: string;
  alertLevel: AlertLevel;
  alertReason: string;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  updatedAt: string;
}

export function describeWeatherCode(code: number): string {
  if (code === 0) return 'Cerah';
  if (code <= 3) return 'Cerah Berawan';
  if (code <= 48) return 'Berkabut';
  if (code <= 55) return 'Gerimis';
  if (code <= 63) return 'Hujan Ringan - Sedang';
  if (code <= 65) return 'Hujan Lebat';
  if (code <= 82) return 'Hujan Deras Lokal';
  if (code >= 95) return 'Badai Petir & Hujan Lebat';
  return 'Berawan';
}

/**
 * Kategori intensitas hujan 24 jam menurut standar BMKG
 */
export function classifyBmkgDailyRain(mm24h: number): string {
  if (mm24h < 0.5) return 'Berawan / Tidak Hujan';
  if (mm24h <= 20) return 'Hujan Ringan (0.5–20 mm)';
  if (mm24h <= 50) return 'Hujan Sedang (20–50 mm)';
  if (mm24h <= 100) return 'Hujan Lebat (50–100 mm)';
  if (mm24h <= 150) return 'Hujan Sangat Lebat (100–150 mm)';
  return 'Hujan Ekstrem (> 150 mm)';
}

/**
 * Logika klasifikasi potensi banjir bandang berdasarkan intensitas & akumulasi hujan
 * Mengacu pada ambang batas curah hujan BMKG & kerentanan topografi Tapteng - Sibolga.
 */
export function evaluateFloodRisk(
  currentRainMm: number,
  next6hRainMm: number,
  next24hRainMm: number,
  maxHourlyRainMm: number,
  riskProfile: 'Tinggi' | 'Sedang'
): { level: AlertLevel; reason: string } {
  const highRiskMultiplier = riskProfile === 'Tinggi' ? 0.85 : 1.0;

  if (
    currentRainMm >= 20 * highRiskMultiplier ||
    maxHourlyRainMm >= 30 * highRiskMultiplier ||
    next6hRainMm >= 60 * highRiskMultiplier ||
    next24hRainMm >= 120 * highRiskMultiplier
  ) {
    return {
      level: 'AWAS',
      reason: `Hujan ekstrem terdeteksi (puncak ${maxHourlyRainMm.toFixed(1)} mm/jam, akumulasi 6 jam ${next6hRainMm.toFixed(1)} mm). Potensi tinggi banjir bandang & longsor!`,
    };
  }

  if (
    currentRainMm >= 10 * highRiskMultiplier ||
    maxHourlyRainMm >= 15 * highRiskMultiplier ||
    next6hRainMm >= 35 * highRiskMultiplier ||
    next24hRainMm >= 70 * highRiskMultiplier
  ) {
    return {
      level: 'SIAGA',
      reason: `Hujan lebat berkepanjangan (akumulasi 6 jam ${next6hRainMm.toFixed(1)} mm). Pantau debit sungai dan siapkan jalur evakuasi.`,
    };
  }

  if (
    currentRainMm >= 2.5 ||
    maxHourlyRainMm >= 7 ||
    next6hRainMm >= 15 ||
    next24hRainMm >= 35
  ) {
    return {
      level: 'WASPADA',
      reason: `Potensi hujan sedang dalam 6–24 jam ke depan (${next24hRainMm.toFixed(1)} mm). Tetap pantau perkembangan cuaca hulu.`,
    };
  }

  return {
    level: 'AMAN',
    reason: 'Curah hujan terpantau rendah/normal. Tidak ada indikasi banjir bandang saat ini.',
  };
}

export async function fetchDistrictWeather(district: District): Promise<DistrictWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${district.lat}&longitude=${district.lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_gusts_10m` +
    `&hourly=temperature_2m,rain,precipitation_probability,cloud_cover` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,rain_sum,precipitation_probability_max` +
    `&timezone=Asia%2FJakarta&past_days=3&forecast_days=3`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gagal memuat data cuaca untuk ${district.name} (HTTP ${res.status})`);
  }

  const data = await res.json();
  const now = new Date();

  const hourlyTimes: string[] = data.hourly.time;
  const hourlyRain: number[] = data.hourly.rain;
  const hourlyProb: number[] = data.hourly.precipitation_probability;
  const hourlyTemp: number[] = data.hourly.temperature_2m;
  const hourlyCloud: number[] = data.hourly.cloud_cover;

  let startIndex = hourlyTimes.findIndex((t) => new Date(t).getTime() >= now.getTime() - 3600000);
  if (startIndex < 0) startIndex = 0;

  const next24Slice: HourlyPoint[] = [];
  for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
    const dt = new Date(hourlyTimes[i]);
    next24Slice.push({
      time: hourlyTimes[i],
      hourLabel: `${String(dt.getHours()).padStart(2, '0')}:00`,
      rainMm: Number(hourlyRain[i] ?? 0),
      probability: Number(hourlyProb[i] ?? 0),
      tempC: Number(hourlyTemp[i] ?? 0),
      cloudCover: Number(hourlyCloud[i] ?? 0),
    });
  }

  // Hitung total hujan 3 hari terakhir (sebelum jam sekarang) untuk indeks kejenuhan tanah / longsor
  const past3DaysRainMm = hourlyRain
    .slice(0, Math.max(0, startIndex))
    .reduce((acc, v) => acc + Number(v ?? 0), 0);

  const todayStr = now.toISOString().slice(0, 10);
  const dailyAllTimes: string[] = data.daily?.time ?? [];
  let dailyStartIdx = dailyAllTimes.findIndex((d) => d >= todayStr);
  if (dailyStartIdx < 0) dailyStartIdx = Math.max(0, dailyAllTimes.length - 3);

  const daily: DailyPoint[] = dailyAllTimes
    .slice(dailyStartIdx, dailyStartIdx + 3)
    .map((dateStr: string, offset: number) => {
      const idx = dailyStartIdx + offset;
      const dt = new Date(`${dateStr}T00:00:00`);
      const dayLabel =
        offset === 0
          ? 'Hari Ini'
          : offset === 1
          ? 'Besok'
          : dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
      const rainSumMm = Number(data.daily.rain_sum?.[idx] ?? 0);
      const wCode = Number(data.daily.weather_code?.[idx] ?? 0);
      return {
        date: dateStr,
        dayLabel,
        rainSumMm,
        maxProb: Number(data.daily.precipitation_probability_max?.[idx] ?? 0),
        tempMax: Number(data.daily.temperature_2m_max?.[idx] ?? 0),
        tempMin: Number(data.daily.temperature_2m_min?.[idx] ?? 0),
        weatherCode: wCode,
        weatherLabel: describeWeatherCode(wCode),
        bmkgCategory: classifyBmkgDailyRain(rainSumMm),
      };
    });

  const next6hRainMm = next24Slice.slice(0, 6).reduce((acc, p) => acc + p.rainMm, 0);
  const next24hRainMm = next24Slice.reduce((acc, p) => acc + p.rainMm, 0);
  const maxHourlyRainMm = next24Slice.reduce((max, p) => Math.max(max, p.rainMm), 0);
  const maxRainProb = next24Slice.reduce((max, p) => Math.max(max, p.probability), 0);

  const currentRainMm = Number(data.current?.rain ?? 0);
  const weatherCode = Number(data.current?.weather_code ?? 0);

  const { level, reason } = evaluateFloodRisk(
    currentRainMm,
    next6hRainMm,
    next24hRainMm,
    maxHourlyRainMm,
    district.riskProfile
  );

  return {
    district,
    currentTempC: Number(data.current?.temperature_2m ?? 0),
    apparentTempC: Number(data.current?.apparent_temperature ?? 0),
    currentRainMm,
    currentHumidity: Number(data.current?.relative_humidity_2m ?? 0),
    currentWindKmh: Number(data.current?.wind_speed_10m ?? 0),
    windGustsKmh: Number(data.current?.wind_gusts_10m ?? 0),
    cloudCover: Number(data.current?.cloud_cover ?? 0),
    pressureMsl: Number(data.current?.pressure_msl ?? 1010),
    weatherCode,
    weatherLabel: describeWeatherCode(weatherCode),
    next6hRainMm,
    next24hRainMm,
    past3DaysRainMm,
    maxHourlyRainMm,
    maxRainProb,
    bmkg24hCategory: classifyBmkgDailyRain(next24hRainMm),
    alertLevel: level,
    alertReason: reason,
    hourly: next24Slice,
    daily,
    updatedAt: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}

/**
 * Mengambil data pembanding dari 3 model cuaca global (Best Match, ECMWF Eropa, GFS NOAA AS)
 */
export async function fetchModelComparison(district: District): Promise<ModelComparisonItem[]> {
  const models = [
    { id: 'best_match', name: 'Open-Meteo Best Match', agency: 'Kombinasi Resolusi Tinggi' },
    { id: 'ecmwf_ifs025', name: 'ECMWF IFS 0.25°', agency: 'Pusat Cuaca Eropa (ECMWF)' },
    { id: 'gfs_seamless', name: 'GFS Seamless', agency: 'NOAA Amerika Serikat' },
  ];

  const now = new Date();

  const results = await Promise.all(
    models.map(async (m) => {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${district.lat}&longitude=${district.lon}` +
          `&hourly=rain&models=${m.id}&timezone=Asia%2FJakarta&forecast_days=2`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Model unavailable');
        const data = await res.json();
        const times: string[] = data.hourly?.time ?? [];
        const rains: number[] = data.hourly?.rain ?? [];

        let startIndex = times.findIndex((t) => new Date(t).getTime() >= now.getTime() - 3600000);
        if (startIndex < 0) startIndex = 0;

        const slice24 = rains.slice(startIndex, startIndex + 24).map((v) => Number(v ?? 0));
        const next6hRainMm = slice24.slice(0, 6).reduce((a, b) => a + b, 0);
        const next24hRainMm = slice24.reduce((a, b) => a + b, 0);
        const maxHourlyRainMm = slice24.reduce((mx, v) => Math.max(mx, v), 0);
        const { level } = evaluateFloodRisk(
          slice24[0] ?? 0,
          next6hRainMm,
          next24hRainMm,
          maxHourlyRainMm,
          district.riskProfile
        );

        return {
          modelId: m.id,
          modelName: m.name,
          agency: m.agency,
          next6hRainMm,
          next24hRainMm,
          maxHourlyRainMm,
          alertLevel: level,
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter((item): item is ModelComparisonItem => item !== null);
}
