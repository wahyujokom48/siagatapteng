import { Home, Briefcase, Umbrella, Navigation } from 'lucide-react';
import { DistrictWeather } from '../services/weather';
import { evaluateLandslideRisk } from '../services/accessAndLandslide';

interface PersonalCommutePanelProps {
  weatherList: DistrictWeather[];
  onSelectDistrict: (id: string) => void;
}

export function PersonalCommutePanel({ weatherList, onSelectDistrict }: PersonalCommutePanelProps) {
  const home = weatherList.find((w) => w.district.id === 'rumah-saya');
  const office = weatherList.find((w) => w.district.id === 'kantor-saya');
  const midRoute = weatherList.find((w) => w.district.id === 'sarudik');
  const tukka = weatherList.find((w) => w.district.id === 'tukka');
  const sitahuis = weatherList.find((w) => w.district.id === 'sitahuis');

  if (!home || !office) return null;

  // Analisis sekitar rumah (Pandan + hulu terdekat Tukka/Sitahuis)
  const homeLandslide = evaluateLandslideRisk(
    home.past3DaysRainMm ?? 0,
    home.next24hRainMm,
    home.district.riskProfile
  );
  const nearbyHigh = [tukka, sitahuis, midRoute].filter(
    (d) => d && (d.alertLevel === 'SIAGA' || d.alertLevel === 'AWAS')
  );

  let homePotentialNote =
    'Area sekitar rumah (Pandan) saat ini relatif aman. Belum ada indikasi genangan besar maupun air kiriman dari arah Tukka/Sarudik.';
  if (home.alertLevel === 'AWAS' || nearbyHigh.length > 0) {
    const names = nearbyHigh.map((n) => n?.district.name).join(', ');
    homePotentialNote = `PERHATIAN SEKITAR RUMAH: Terdeteksi hujan lebat/ekstrem${
      names ? ` di wilayah sekitar (${names})` : ''
    }. Waspadai potensi genangan cepat di area Pandan & aliran air kiriman dari arah perbukitan Tukka.`;
  } else if (home.alertLevel === 'SIAGA' || home.alertLevel === 'WASPADA') {
    homePotentialNote = `Ada potensi hujan di sekitar rumah (${home.next6hRainMm.toFixed(
      1
    )} mm dalam 6 jam). Pastikan parit depan rumah lancar dan pantau perkembangan hujan di Tukka & Sitahuis.`;
  }

  // Analisis perjalanan Rumah -> Kantor (~8.2 km via Pandan - Sarudik - Sibolga)
  const routePoints = [home, midRoute, office].filter((p): p is DistrictWeather => Boolean(p));
  const next3hMaxRain = Math.max(
    ...routePoints.map((p) => p.hourly.slice(0, 3).reduce((acc, h) => acc + h.rainMm, 0))
  );
  const next3hMaxProb = Math.max(
    ...routePoints.map((p) => Math.max(0, ...p.hourly.slice(0, 3).map((h) => h.probability)))
  );
  const maxRouteWind = Math.max(...routePoints.map((p) => p.windGustsKmh));
  const worstRouteAlert = routePoints.some((p) => p.alertLevel === 'AWAS')
    ? 'AWAS'
    : routePoints.some((p) => p.alertLevel === 'SIAGA')
    ? 'SIAGA'
    : routePoints.some((p) => p.alertLevel === 'WASPADA')
    ? 'WASPADA'
    : 'AMAN';

  let raincoatAdvice = 'Tidak perlu jas hujan — cuaca jalur Pandan–Sibolga cenderung cerah/berawan.';
  let raincoatTag = 'AMAN TANPA JAS HUJAN';
  let raincoatBadge = 'AMAN';

  if (next3hMaxRain >= 10 || worstRouteAlert === 'AWAS' || worstRouteAlert === 'SIAGA') {
    raincoatTag = 'WAJIB JAS HUJAN & HATI-HATI';
    raincoatBadge = 'AWAS';
    raincoatAdvice = `Hujan lebat terpantau/diprediksi di jalur rumah–kantor (${next3hMaxRain.toFixed(
      1
    )} mm dalam 3 jam, peluang ${next3hMaxProb}%). Wajib pakai jas hujan (bukan ponco longgar jika angin ${maxRouteWind.toFixed(
      0
    )} km/j), waspadai genangan di Sarudik–Sibolga Selatan dan potensi longsoran kecil di perbukitan Sibolga Utara.`;
  } else if (next3hMaxRain >= 0.5 || next3hMaxProb >= 45) {
    raincoatTag = 'BAWA JAS HUJAN / PAYUNG';
    raincoatBadge = 'WASPADA';
    raincoatAdvice = `Ada peluang hujan ${next3hMaxProb}% dalam 3 jam ke depan (${next3hMaxRain.toFixed(
      1
    )} mm) di sepanjang rute Pandan–Sarudik–Sibolga. Sebaiknya masukkan jas hujan/payung ke tas atau jok motor sebelum berangkat.`;
  }

  return (
    <section className="card personal-panel">
      <div className="card-title">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8' }}>
          <Navigation size={18} />
          Analisis Pribadi: Sekitar Rumah &amp; Perjalanan ke Kantor (±8,2 km)
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
            onClick={() => onSelectDistrict('rumah-saya')}
          >
            <Home size={13} /> Detail Rumah
          </button>
          <button
            className="btn"
            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
            onClick={() => onSelectDistrict('kantor-saya')}
          >
            <Briefcase size={13} /> Detail Kantor
          </button>
        </div>
      </div>

      <div className="personal-grid">
        {/* Kartu Sekitar Rumah */}
        <div className="personal-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.92rem' }}>
              <Home size={16} color="#38bdf8" /> Sekitar Rumah Anda (Pandan)
            </strong>
            <span className={`badge ${home.alertLevel}`}>{home.alertLevel}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 8 }}>
            Cuaca: <strong>{home.weatherLabel}</strong> ({home.currentTempC.toFixed(1)}°C) • Hujan 6j:{' '}
            <strong>{home.next6hRainMm.toFixed(1)} mm</strong> • Risiko Longsor: <strong>{homeLandslide.level}</strong>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.45 }}>{homePotentialNote}</p>
        </div>

        {/* Kartu Perjalanan ke Kantor */}
        <div className="personal-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.92rem' }}>
              <Umbrella size={16} color="#fbbf24" /> Persiapan ke Kantor (Sibolga Utara)
            </strong>
            <span className={`badge ${raincoatBadge}`}>{raincoatTag}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 8 }}>
            Rute: Pandan → Sarudik → Sibolga • Cuaca Kantor: <strong>{office.weatherLabel}</strong> (
            {office.currentTempC.toFixed(1)}°C) • Angin maks: <strong>{maxRouteWind.toFixed(0)} km/j</strong>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.45 }}>{raincoatAdvice}</p>
        </div>
      </div>
    </section>
  );
}
