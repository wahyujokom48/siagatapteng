import { ShieldAlert, PackageCheck, Waves } from 'lucide-react';
import { DistrictWeather, AlertLevel } from '../services/weather';
import { evaluateCriticalRoutes } from '../services/accessAndLandslide';

interface CommandSummaryPanelProps {
  weatherList: DistrictWeather[];
  selected: DistrictWeather;
}

const RANK: Record<AlertLevel, number> = {
  AMAN: 0,
  WASPADA: 1,
  SIAGA: 2,
  AWAS: 3,
};

export function CommandSummaryPanel({ weatherList, selected }: CommandSummaryPanelProps) {
  if (weatherList.length === 0) return null;

  const worst = [...weatherList].sort((a, b) => RANK[b.alertLevel] - RANK[a.alertLevel])[0];

  // 1. Keputusan Evakuasi
  let evacTitle = 'Aman di Rumah';
  let evacLevel: AlertLevel = 'AMAN';
  let evacNote = `Kondisi di ${selected.district.name} terkendali. Tetap aktifkan notifikasi untuk pemantauan otomatis.`;

  if (selected.alertLevel === 'AWAS' || worst.alertLevel === 'AWAS') {
    evacTitle = 'SIAP EVAKUASI SEGERA';
    evacLevel = 'AWAS';
    evacNote = 'Hujan ekstrem terdeteksi! Jauhi bantaran sungai & lereng curam, bersiap menuju dataran tinggi.';
  } else if (selected.alertLevel === 'SIAGA' || worst.alertLevel === 'SIAGA') {
    evacTitle = 'Siapkan Tas Siaga';
    evacLevel = 'SIAGA';
    evacNote = 'Hujan lebat aktif. Kumpulkan dokumen penting, obat, dan pantau ketinggian air sungai setiap 30 menit.';
  } else if (selected.alertLevel === 'WASPADA') {
    evacTitle = 'Pantau Berkala';
    evacLevel = 'WASPADA';
    evacNote = 'Ada potensi hujan sedang. Pastikan saluran air sekitar rumah tidak tersumbat.';
  }

  // 2. Keputusan Logistik & Perjalanan
  const routes = evaluateCriticalRoutes(weatherList);
  const disruptedCount = routes.filter((r) => r.status === 'RAWAN TERPUTUS').length;
  const cautionCount = routes.filter((r) => r.status === 'WASPADA').length;

  let logTitle = 'Akses & Logistik Normal';
  let logLevel: AlertLevel = 'AMAN';
  let logNote = 'Jalur lintas darat & udara (Bandara FLZ) terpantau kondusif. Aktivitas perjalanan normal.';

  if (disruptedCount > 0) {
    logTitle = 'Tunda Perjalanan & Amankan Stok';
    logLevel = 'AWAS';
    logNote = `${disruptedCount} jalur kritis berstatus RAWAN TERPUTUS. Pastikan stok pangan, air bersih, BBM & uang tunai cukup untuk 3–5 hari.`;
  } else if (cautionCount >= 2) {
    logTitle = 'Siapkan Stok 3–5 Hari';
    logLevel = 'SIAGA';
    logNote = `${cautionCount} jalur lintas berstatus WASPADA. Sebaiknya lengkapi kebutuhan pokok & BBM sebelum hujan memburuk.`;
  } else if (cautionCount === 1) {
    logTitle = 'Hati-hati di Jalur Lintas';
    logLevel = 'WASPADA';
    logNote = 'Satu jalur lintas mulai diguyur hujan. Cek detail jalur darat/udara di bawah sebelum berangkat.';
  }

  // 3. Detektor Khusus Air Kiriman Hulu -> Hilir
  const upstreamIds = ['sitahuis', 'tukka', 'sibolga-utara'];
  const upstreamList = weatherList.filter((w) => upstreamIds.includes(w.district.id));
  const worstUpstream = [...upstreamList].sort((a, b) => b.next6hRainMm - a.next6hRainMm)[0];

  let upstreamTitle = 'Hulu Terkendali';
  let upstreamLevel: AlertLevel = 'AMAN';
  let upstreamNote = 'Curah hujan di perbukitan hulu (Sitahuis, Tukka, Sibolga Utara) masih rendah.';

  if (worstUpstream) {
    if (worstUpstream.currentRainMm >= 15 || worstUpstream.next6hRainMm >= 40) {
      upstreamTitle = 'AWAS AIR KIRIMAN (1–2 JAM)';
      upstreamLevel = 'AWAS';
      upstreamNote = `Hulu ${worstUpstream.district.name} diguyur hujan sangat lebat (${worstUpstream.next6hRainMm.toFixed(1)} mm/6j). Wilayah hilir (Pandan, Sarudik, Sibolga Kota) wajib waspada luapan mendadak!`;
    } else if (worstUpstream.currentRainMm >= 7 || worstUpstream.next6hRainMm >= 20) {
      upstreamTitle = 'Waspada Air Kiriman Hulu';
      upstreamLevel = 'SIAGA';
      upstreamNote = `Hujan sedang–lebat di hulu ${worstUpstream.district.name} (${worstUpstream.next6hRainMm.toFixed(1)} mm/6j). Perhatikan perubahan warna air sungai menjadi keruh.`;
    } else if (worstUpstream.next6hRainMm >= 8) {
      upstreamTitle = 'Hulu Mulai Hujan Ringan';
      upstreamLevel = 'WASPADA';
      upstreamNote = `Hulu ${worstUpstream.district.name} terpantau hujan ringan (${worstUpstream.next6hRainMm.toFixed(1)} mm/6j). Tetap pantau perkembangan.`;
    }
  }

  return (
    <section className="command-grid">
      <div className={`command-card ${evacLevel}`}>
        <div className="command-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldAlert size={16} /> Keputusan Evakuasi
          </span>
          <span className={`badge ${evacLevel}`}>{evacLevel}</span>
        </div>
        <div className="command-title">{evacTitle}</div>
        <p className="command-note">{evacNote}</p>
      </div>

      <div className={`command-card ${logLevel}`}>
        <div className="command-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PackageCheck size={16} /> Logistik &amp; Akses
          </span>
          <span className={`badge ${logLevel}`}>{logLevel}</span>
        </div>
        <div className="command-title">{logTitle}</div>
        <p className="command-note">{logNote}</p>
      </div>

      <div className={`command-card ${upstreamLevel}`}>
        <div className="command-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Waves size={16} /> Air Kiriman Hulu → Hilir
          </span>
          <span className={`badge ${upstreamLevel}`}>{upstreamLevel}</span>
        </div>
        <div className="command-title">{upstreamTitle}</div>
        <p className="command-note">{upstreamNote}</p>
      </div>
    </section>
  );
}
