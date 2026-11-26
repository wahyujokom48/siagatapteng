export type CycloneStatusLevel = 'AMAN' | 'PANTAU' | 'WASPADA' | 'SIAGA';

export interface OffshorePointData {
  id: string;
  name: string;
  role: string;
  lat: number;
  lon: number;
  pressureHpa: number;
  pressureDrop24h: number;
  windKmh: number;
  gustsKmh: number;
  windDirDeg: number;
  windDirText: string;
  cloudCover: number;
  rainMm: number;
  status: CycloneStatusLevel;
  note: string;
}

export interface CycloneWatchReport {
  overallStatus: CycloneStatusLevel;
  headline: string;
  analysisSummary: string;
  patternComparison: string;
  offshorePoints: OffshorePointData[];
  updatedAt: string;
}

const OFFSHORE_POINTS = [
  {
    id: 'barat-nias',
    name: 'Samudra Hindia Barat Nias',
    role: 'Zona pembentukan bibit siklon & pusat tekanan rendah',
    lat: 1.1,
    lon: 96.8,
  },
  {
    id: 'nias-sibolga',
    name: 'Perairan Nias – Sibolga',
    role: 'Jalur masuk ekor awan hujan menuju Teluk Tapian Nauli',
    lat: 1.5,
    lon: 97.9,
  },
  {
    id: 'barat-sumut',
    name: 'Barat Aceh – Sumatera Utara',
    role: 'Zona utara pemicu belokan angin (shearline) & konvergensi',
    lat: 2.8,
    lon: 95.8,
  },
];

function degToCompass(deg: number): string {
  const dirs = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return dirs[idx];
}

export async function fetchCycloneWatch(): Promise<CycloneWatchReport> {
  const points = await Promise.all(
    OFFSHORE_POINTS.map(async (pt): Promise<OffshorePointData> => {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${pt.lat}&longitude=${pt.lon}` +
        `&current=pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,rain` +
        `&hourly=pressure_msl&timezone=Asia%2FJakarta&forecast_days=2`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Gagal memuat data laut ${pt.name}`);
      }
      const data = await res.json();

      const pressureHpa = Number(data.current?.pressure_msl ?? 1010);
      const windKmh = Number(data.current?.wind_speed_10m ?? 0);
      const gustsKmh = Number(data.current?.wind_gusts_10m ?? 0);
      const windDirDeg = Number(data.current?.wind_direction_10m ?? 0);
      const cloudCover = Number(data.current?.cloud_cover ?? 0);
      const rainMm = Number(data.current?.rain ?? 0);

      // Hitung perkiraan penurunan tekanan udara dalam 24 jam ke depan
      const hourlyPress: number[] = data.hourly?.pressure_msl ?? [];
      const minNext24Press =
        hourlyPress.length > 0
          ? Math.min(...hourlyPress.slice(0, 24).map((v) => Number(v ?? pressureHpa)))
          : pressureHpa;
      const pressureDrop24h = Math.max(0, pressureHpa - minNext24Press);

      let status: CycloneStatusLevel = 'AMAN';
      let note = 'Tekanan laut stabil & angin normal. Belum terlihat pusaran badai.';

      if (pressureHpa <= 1003 || gustsKmh >= 55 || (pressureDrop24h >= 5 && gustsKmh >= 40)) {
        status = 'SIAGA';
        note = 'Tekanan sangat rendah / angin badai! Indikasi kuat bibit siklon atau pusat badai aktif.';
      } else if (pressureHpa <= 1007 || gustsKmh >= 38 || (cloudCover >= 90 && rainMm >= 5)) {
        status = 'WASPADA';
        note = 'Tekanan mulai turun & awan tebal aktif di laut. Berpotensi membentuk ekor awan hujan ke daratan.';
      } else if (pressureHpa <= 1009 || gustsKmh >= 26 || cloudCover >= 80) {
        status = 'PANTAU';
        note = 'Awan hujan cukup banyak di perairan, pantau pergerakannya menuju pesisir Sibolga–Tapteng.';
      }

      return {
        id: pt.id,
        name: pt.name,
        role: pt.role,
        lat: pt.lat,
        lon: pt.lon,
        pressureHpa,
        pressureDrop24h,
        windKmh,
        gustsKmh,
        windDirDeg,
        windDirText: degToCompass(windDirDeg),
        cloudCover,
        rainMm,
        status,
        note,
      };
    })
  );

  const rank: Record<CycloneStatusLevel, number> = { AMAN: 0, PANTAU: 1, WASPADA: 2, SIAGA: 3 };
  const worst = [...points].sort((a, b) => rank[b.status] - rank[a.status])[0];
  const minPressure = Math.min(...points.map((p) => p.pressureHpa));
  const maxGust = Math.max(...points.map((p) => p.gustsKmh));

  let headline = 'Belum Terdeteksi Pusaran Siklon di Samudra Hindia Barat Sumatera';
  let analysisSummary = `Tekanan udara terendah di perairan barat Nias–Sibolga saat ini ${minPressure.toFixed(0)} hPa dengan hembusan angin laut tertinggi ${maxGust.toFixed(1)} km/j. Kondisi atmosfer laut relatif stabil.`;
  let patternComparison =
    'Pola atmosfer saat ini BELUM menyerupai pola ekstrem 25 November 2025. Tetap pantau pembaruan setiap 6 jam terutama pada sore–malam hari.';

  if (worst.status === 'SIAGA') {
    headline = 'SIAGA: Terdeteksi Indikasi Kuat Bibit Siklon / Pusaran Badai di Samudra Hindia!';
    analysisSummary = `Tekanan udara laut turun hingga ${minPressure.toFixed(0)} hPa di ${worst.name} dengan hembusan angin ${maxGust.toFixed(1)} km/j. Pusat tekanan rendah ini berpotensi menarik massa awan hujan sangat tebal (ekor siklon) langsung ke pesisir Sibolga dan perbukitan Tapanuli Tengah.`;
    patternComparison =
      'PERINGATAN POLA 25 NOV 2025: Tekanan rendah di barat Sumatera + suplai uap air laut tinggi sangat mirip dengan pemicu hujan ekstrem berkepanjangan. Aktifkan notifikasi & siapkan tas siaga sekarang!';
  } else if (worst.status === 'WASPADA') {
    headline = 'WASPADA: Terdeteksi Tekanan Menurun & Ekor Awan Hujan Aktif di Perairan Nias–Sibolga';
    analysisSummary = `Terpantau tekanan ${minPressure.toFixed(0)} hPa dan hembusan angin ${maxGust.toFixed(1)} km/j di ${worst.name}. Meskipun belum berbentuk siklon penuh, pertumbuhan awan konvektif tebal di laut dapat memicu hujan lebat berdurasi lama saat membentur Bukit Barisan (Sitahuis/Tukka).`;
    patternComparison =
      'Perlu kewaspadaan ekstra: pola awan konvergensi dari laut ini adalah tahap awal yang sering mendahului hujan lebat di Tapteng–Sibolga. Amati Peta Satelit & Tekanan Udara di bawah.';
  } else if (worst.status === 'PANTAU') {
    headline = 'PANTAU: Awan Hujan Mulai Berkumpul di Perairan Barat Sumatera';
    analysisSummary = `Tekanan udara di laut sekitar ${minPressure.toFixed(0)} hPa dengan tutupan awan cukup tebal di ${worst.name}. Belum ada pusaran siklon, namun awan hujan lokal tetap bisa bergeser ke daratan.`;
  }

  return {
    overallStatus: worst.status,
    headline,
    analysisSummary,
    patternComparison,
    offshorePoints: points,
    updatedAt: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}
