import { DistrictWeather } from './weather';

export type LandslideRiskLevel = 'RENDAH' | 'SEDANG' | 'TINGGI' | 'SANGAT TINGGI';

export function evaluateLandslideRisk(
  past3DaysRainMm: number,
  next24hRainMm: number,
  riskProfile: 'Tinggi' | 'Sedang'
): { level: LandslideRiskLevel; total4DayMm: number; reason: string } {
  const total4DayMm = past3DaysRainMm + next24hRainMm;
  const factor = riskProfile === 'Tinggi' ? 0.85 : 1.0;

  if (total4DayMm >= 180 * factor) {
    return {
      level: 'SANGAT TINGGI',
      total4DayMm,
      reason: 'Tanah sangat jenuh air, risiko tinggi longsor di lereng curam & tebing jalan',
    };
  }

  if (total4DayMm >= 100 * factor) {
    return {
      level: 'TINGGI',
      total4DayMm,
      reason: 'Tanah mulai jenuh, waspada retakan tanah & longsoran kecil',
    };
  }

  if (total4DayMm >= 50 * factor) {
    return {
      level: 'SEDANG',
      total4DayMm,
      reason: 'Kelembapan tanah meningkat, tetap waspada di area perbukitan',
    };
  }

  return {
    level: 'RENDAH',
    total4DayMm,
    reason: 'Kondisi tanah relatif stabil',
  };
}

export type RouteStatus = 'LANCAR' | 'WASPADA' | 'RAWAN TERPUTUS';

export interface CriticalRoute {
  id: string;
  name: string;
  type: 'DARAT' | 'UDARA';
  corridor: string;
  status: RouteStatus;
  summary: string;
  metrics: string;
}

function evaluateLandCorridor(
  id: string,
  name: string,
  corridor: string,
  districts: DistrictWeather[]
): CriticalRoute {
  if (districts.length === 0) {
    return {
      id,
      name,
      type: 'DARAT',
      corridor,
      status: 'WASPADA',
      summary: 'Data cuaca koridor belum tersedia. Pantau info lalu lintas setempat.',
      metrics: 'Data belum dimuat',
    };
  }

  let worstStatus: RouteStatus = 'LANCAR';
  let max4Day = 0;
  let maxNext6h = 0;
  let worstDistrictName = districts[0].district.name;

  for (const w of districts) {
    const past3 = w.past3DaysRainMm ?? 0;
    const landslide = evaluateLandslideRisk(past3, w.next24hRainMm, w.district.riskProfile);

    if (landslide.total4DayMm > max4Day) {
      max4Day = landslide.total4DayMm;
      worstDistrictName = w.district.name;
    }
    if (w.next6hRainMm > maxNext6h) {
      maxNext6h = w.next6hRainMm;
    }

    const isHighRisk =
      landslide.level === 'SANGAT TINGGI' ||
      landslide.level === 'TINGGI' ||
      w.alertLevel === 'AWAS' ||
      w.alertLevel === 'SIAGA';

    const isModerateRisk =
      landslide.level === 'SEDANG' || w.alertLevel === 'WASPADA';

    if (isHighRisk) {
      worstStatus = 'RAWAN TERPUTUS';
    } else if (isModerateRisk && worstStatus !== 'RAWAN TERPUTUS') {
      worstStatus = 'WASPADA';
    }
  }

  let summary = 'Akses darat terpantau aman dan kondusif untuk dilalui.';
  if (worstStatus === 'RAWAN TERPUTUS') {
    summary = `Risiko tinggi longsor tebing atau genangan di sekitar ${worstDistrictName}. Hindari perjalanan non-darurat.`;
  } else if (worstStatus === 'WASPADA') {
    summary = `Potensi hujan sedang & jalan licin di koridor ${worstDistrictName}. Kurangi kecepatan dan waspada lereng.`;
  }

  return {
    id,
    name,
    type: 'DARAT',
    corridor,
    status: worstStatus,
    summary,
    metrics: `Akumulasi 4 hari maks: ${max4Day.toFixed(1)} mm · Hujan 6 jam: ${maxNext6h.toFixed(1)} mm`,
  };
}

export function evaluateCriticalRoutes(weatherList: DistrictWeather[]): CriticalRoute[] {
  const byId = new Map<string, DistrictWeather>();
  for (const w of weatherList) {
    byId.set(w.district.id, w);
  }

  const pick = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((item): item is DistrictWeather => Boolean(item));

  const daratTarutung = evaluateLandCorridor(
    'darat-tarutung',
    'Jalur Sibolga – Tarutung (via Sitahuis)',
    'Sitahuis · Sibolga Utara',
    pick(['sitahuis', 'sibolga-utara'])
  );

  const daratBarus = evaluateLandCorridor(
    'darat-barus',
    'Jalur Sibolga – Barus (via Kolang & Sorkam)',
    'Kolang · Sorkam · Barus',
    pick(['kolang', 'sorkam', 'barus'])
  );

  const daratPadangsidimpuan = evaluateLandCorridor(
    'darat-padangsidimpuan',
    'Jalur Sibolga – Padangsidimpuan (via Pinangsori)',
    'Pinangsori · Sibabangun · Badiri',
    pick(['pinangsori', 'sibabangun', 'badiri'])
  );

  const flzWeather = byId.get('pinangsori');
  let udaraFlz: CriticalRoute;

  if (!flzWeather) {
    udaraFlz = {
      id: 'udara-flz',
      name: 'Jalur Udara: Bandara Dr. F.L. Tobing (FLZ Pinangsori)',
      type: 'UDARA',
      corridor: 'Pinangsori (FLZ)',
      status: 'WASPADA',
      summary: 'Data cuaca Bandara Pinangsori belum tersedia. Cek status maskapai secara berkala.',
      metrics: 'Data belum dimuat',
    };
  } else {
    let status: RouteStatus = 'LANCAR';
    let summary = 'Cuaca area Bandara Pinangsori terpantau kondusif untuk penerbangan.';

    if (
      flzWeather.weatherCode >= 95 ||
      flzWeather.windGustsKmh >= 40 ||
      flzWeather.currentRainMm >= 15
    ) {
      status = 'RAWAN TERPUTUS';
      summary =
        'Potensi penundaan/pengalihan penerbangan akibat badai/angin kencang/jarak pandang rendah.';
    } else if (
      flzWeather.windGustsKmh >= 25 ||
      flzWeather.next6hRainMm >= 15 ||
      flzWeather.cloudCover >= 90
    ) {
      status = 'WASPADA';
      summary = 'Awan tebal/hujan sedang di area bandara, pantau jadwal maskapai.';
    }

    udaraFlz = {
      id: 'udara-flz',
      name: 'Jalur Udara: Bandara Dr. F.L. Tobing (FLZ Pinangsori)',
      type: 'UDARA',
      corridor: 'Pinangsori (FLZ)',
      status,
      summary,
      metrics: `Hembusan angin: ${flzWeather.windGustsKmh.toFixed(0)} km/j · Awan: ${flzWeather.cloudCover}% · Hujan: ${flzWeather.currentRainMm.toFixed(1)} mm`,
    };
  }

  return [daratTarutung, daratBarus, daratPadangsidimpuan, udaraFlz];
}
