import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CloudRain,
  Bell,
  BellRing,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Droplets,
  Wind,
  Thermometer,
  MapPin,
  Siren,
  Gauge,
  Cloud,
  Scale,
  CalendarDays,
  Share2,
  Sparkles,
  Radar,
  Clock,
  Mountain,
  WifiOff,
} from 'lucide-react';
import { MONITORED_DISTRICTS, RegionGroup } from './data/districts';
import {
  DistrictWeather,
  fetchDistrictWeather,
  fetchModelComparison,
  ModelComparisonItem,
  AlertLevel,
} from './services/weather';
import {
  getNotificationStatus,
  requestNotificationPermission,
  sendDisasterNotification,
  NotificationStatus,
} from './services/notifications';
import {
  buildThreeHourBlocks,
  generateAiAnalysis,
  interpretAccumulation6h,
  interpretClouds,
  interpretPressure,
  interpretRainCurrent,
  interpretTemp,
  interpretWind,
} from './services/aiAnalysis';
import { evaluateLandslideRisk } from './services/accessAndLandslide';
import { EmergencyReadinessPanel } from './components/EmergencyReadinessPanel';

const WEATHER_CACHE_KEY = 'siaga_tapteng_weather_cache_v1';

const ALERT_RANK: Record<AlertLevel, number> = {
  AMAN: 0,
  WASPADA: 1,
  SIAGA: 2,
  AWAS: 3,
};

type RadarLayer = 'rain' | 'wind' | 'satellite' | 'pressure';

interface RadarLegendEntry {
  color: string;
  label: string;
  meaning: string;
}

const RADAR_LAYERS: {
  id: RadarLayer;
  label: string;
  zoom: number;
  desc: string;
  guideTitle: string;
  legends: RadarLegendEntry[];
  watchTip: string;
}[] = [
  {
    id: 'wind',
    label: 'Awan & Siklon (Angin)',
    zoom: 6,
    desc: 'Tampilan luas Samudra Hindia & Sumatera untuk melihat pusaran angin/bibit siklon.',
    guideTitle: 'Cara Membaca Peta Awan & Siklon (Angin)',
    legends: [
      {
        color: '#38bdf8',
        label: 'Biru / Hijau Muda (< 20 km/j)',
        meaning: 'Angin tenang hingga sepoi-sepoi. Kondisi normal dan aman.',
      },
      {
        color: '#facc15',
        label: 'Kuning / Oranye (25–45 km/j)',
        meaning: 'Angin kencang. Biasanya membawa massa awan hujan tebal menuju pesisir Sibolga–Tapteng.',
      },
      {
        color: '#dc2626',
        label: 'Merah / Ungu (> 50 km/j) + Pusaran',
        meaning: 'Indikasi kuat badai / bibit siklon tropis! Sangat berisiko memicu hujan ekstrem & gelombang tinggi.',
      },
    ],
    watchTip:
      'Perhatikan garis animasi putih yang berputar melingkar di Samudra Hindia (sebelah barat Pulau Nias/Sibolga). Jika pusaran mengarah ke timur (daratan Sumatera), potensi hujan ekstrem meningkat tajam.',
  },
  {
    id: 'rain',
    label: 'Radar Hujan & Petir',
    zoom: 8,
    desc: 'Fokus area Tapanuli Tengah – Sibolga untuk melihat pergerakan awan hujan & petir.',
    guideTitle: 'Cara Membaca Radar Hujan & Petir',
    legends: [
      {
        color: '#60a5fa',
        label: 'Biru Muda / Hijau (0.5–5 mm/j)',
        meaning: 'Hujan ringan hingga sedang. Umumnya masih aman untuk aktivitas luar ruang.',
      },
      {
        color: '#f97316',
        label: 'Kuning / Oranye (5–15 mm/j)',
        meaning: 'Hujan lebat. Mulai waspadai genangan air dan kenaikan debit sungai di hulu.',
      },
      {
        color: '#e11d48',
        label: 'Merah / Ungu (> 15 mm/j) + Ikon Petir',
        meaning: 'Hujan sangat lebat / badai petir! Risiko tinggi banjir bandang jika bertahan lebih dari 2 jam.',
      },
    ],
    watchTip:
      'Amati arah gerak warna oranye/merah. Jika menumpuk lama di wilayah perbukitan (Sitahuis, Tukka, Sibolga Utara), waspadai air kiriman ke wilayah hilir (Pandan, Sarudik, Sibolga Kota).',
  },
  {
    id: 'satellite',
    label: 'Satelit Awan Tebal',
    zoom: 7,
    desc: 'Citra satelit awan secara langsung — warna putih/merah pekat menandakan awan hujan tebal.',
    guideTitle: 'Cara Membaca Citra Satelit Awan',
    legends: [
      {
        color: '#64748b',
        label: 'Abu-abu Tipis / Transparan',
        meaning: 'Awan tipis atau langit cerah. Kecil kemungkinan turun hujan lebat.',
      },
      {
        color: '#f8fafc',
        label: 'Putih Pekat / Padat',
        meaning: 'Awan hujan tebal sedang berkumpul dan berpotensi menurunkan hujan sedang–lebat.',
      },
      {
        color: '#ef4444',
        label: 'Kuning / Merah / Ungu (Infra Merah)',
        meaning: 'Puncak awan Cumulonimbus sangat tinggi & dingin — sumber utama hujan ekstrem dan badai petir.',
      },
    ],
    watchTip:
      'Gunakan mode ini pada sore hingga malam hari untuk melihat apakah gumpalan awan putih pekat dari laut mulai masuk menutupi daratan Tapanuli Tengah.',
  },
  {
    id: 'pressure',
    label: 'Tekanan Udara (Bibit Siklon)',
    zoom: 6,
    desc: 'Garis isobar tekanan rendah (L) menandakan pusat tarikan awan badai / siklon.',
    guideTitle: 'Cara Membaca Tekanan Udara (Bibit Siklon)',
    legends: [
      {
        color: '#22c55e',
        label: '1010 – 1015 hPa (Normal)',
        meaning: 'Tekanan udara stabil untuk wilayah tropis. Tidak ada tarikan badai besar.',
      },
      {
        color: '#eab308',
        label: '1005 – 1009 hPa (Menurun)',
        meaning: 'Tekanan mulai rendah. Awan hujan lebih mudah tumbuh dan berkumpul di sekitar wilayah ini.',
      },
      {
        color: '#ef4444',
        label: 'Huruf "L" / < 1004 hPa (Sangat Rendah)',
        meaning: 'Pusat tekanan rendah (Low Pressure / Bibit Siklon). Menarik angin & awan hujan besar dari sekitarnya.',
      },
    ],
    watchTip:
      'Semakin rapat garis putih melingkar di sekitar huruf "L", semakin kencang angin dan semakin besar potensi cuaca ekstrem di wilayah tersebut.',
  },
];

export default function App() {
  const [weatherList, setWeatherList] = useState<DistrictWeather[]>([]);
  const [selectedId, setSelectedId] = useState<string>('pandan');
  const [regionFilter, setRegionFilter] = useState<'Semua' | RegionGroup>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [radarLayer, setRadarLayer] = useState<RadarLayer>('wind');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineCache, setIsOfflineCache] = useState<boolean>(false);
  const [notifStatus, setNotifStatus] = useState<NotificationStatus>(getNotificationStatus());
  const [lastUpdated, setLastUpdated] = useState<string>('-');

  const [modelComparison, setModelComparison] = useState<ModelComparisonItem[]>([]);
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false);

  const loadAllWeather = useCallback(async (triggerAlerts = false) => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(MONITORED_DISTRICTS.map((d) => fetchDistrictWeather(d)));
      const nowTime = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setWeatherList(results);
      setLastUpdated(nowTime);
      setIsOfflineCache(false);

      try {
        localStorage.setItem(
          WEATHER_CACHE_KEY,
          JSON.stringify({ weatherList: results, lastUpdated: nowTime })
        );
      } catch {
        // Abaikan jika storage penuh
      }

      if (triggerAlerts) {
        const critical = results.filter((r) => r.alertLevel === 'SIAGA' || r.alertLevel === 'AWAS');
        if (critical.length > 0) {
          const names = critical.map((c) => `${c.district.name} (${c.alertLevel})`).join(', ');
          await sendDisasterNotification(
            'PERINGATAN DINI BANJIR TAPTENG & SIBOLGA!',
            `Potensi hujan lebat/ekstrem terdeteksi di: ${names}. Segera pantau aliran sungai & siapkan evakuasi.`
          );
        }
      }
    } catch (err) {
      // Fallback ke data cache terakhir agar aplikasi tetap berguna saat sinyal padam
      try {
        const cached = localStorage.getItem(WEATHER_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.weatherList) && parsed.weatherList.length > 0) {
            setWeatherList(parsed.weatherList);
            setLastUpdated(parsed.lastUpdated ?? '-');
            setIsOfflineCache(true);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Abaikan error parse cache
      }
      setError(err instanceof Error ? err.message : 'Gagal mengambil data cuaca Open-Meteo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllWeather(true);
    const interval = setInterval(() => {
      loadAllWeather(true);
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadAllWeather]);

  const selected = weatherList.find((w) => w.district.id === selectedId) ?? weatherList[0];

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingComparison(true);
    fetchModelComparison(selected.district)
      .then((items) => {
        if (!cancelled) setModelComparison(items);
      })
      .finally(() => {
        if (!cancelled) setLoadingComparison(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.district.id]);

  const threeHourBlocks = useMemo(
    () => (selected ? buildThreeHourBlocks(selected) : []),
    [selected]
  );

  const aiReport = useMemo(
    () => (selected ? generateAiAnalysis(selected, modelComparison, weatherList) : null),
    [selected, modelComparison, weatherList]
  );

  const handleEnableNotifications = async () => {
    const status = await requestNotificationPermission();
    setNotifStatus(status);
    if (status === 'granted') {
      await sendDisasterNotification(
        'Notifikasi Siaga Tapteng & Sibolga Aktif',
        'Anda akan otomatis menerima peringatan dini jika terdeteksi curah hujan berbahaya.'
      );
    }
  };

  const handleSimulateAlert = async () => {
    if (notifStatus !== 'granted') {
      const status = await requestNotificationPermission();
      setNotifStatus(status);
      if (status !== 'granted') {
        alert('Izin notifikasi belum diaktifkan di browser Anda.');
        return;
      }
    }
    await sendDisasterNotification(
      'SIMULASI AWAS BANJIR BANDANG — TUKKA, PANDAN & SIBOLGA',
      'Curah hujan hulu Sitahuis-Tukka mencapai 38 mm/jam (akumulasi 6 jam 74 mm). Harap jauhi bantaran sungai dan bersiap evakuasi!',
      'siaga-tapteng-simulasi'
    );
  };

  const handleShareWhatsApp = () => {
    if (!selected || !aiReport) return;
    const text =
      `*LAPORAN PANTAU HUJAN & ANALISIS AI — SIAGA TAPTENG & SIBOLGA*\n` +
      `Wilayah: *${selected.district.name}* (${selected.district.region})\n` +
      `Status: *${selected.alertLevel}*\n` +
      `Kesimpulan AI: ${aiReport.plainSummary}\n` +
      `Puncak Hujan: ${aiReport.peakWindowText}\n` +
      `Indikasi Siklon/Badai: ${aiReport.cycloneRisk}\n` +
      `Update: ${lastUpdated} WIB`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const filteredList = weatherList.filter((item) => {
    const matchRegion = regionFilter === 'Semua' || item.district.region === regionFilter;
    const matchSearch =
      searchQuery.trim() === '' ||
      item.district.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.district.riverBasin.toLowerCase().includes(searchQuery.toLowerCase());
    return matchRegion && matchSearch;
  });

  const highestAlert: DistrictWeather | undefined = [...weatherList].sort(
    (a, b) => ALERT_RANK[b.alertLevel] - ALERT_RANK[a.alertLevel]
  )[0];

  const maxChartRain = selected ? Math.max(10, ...selected.hourly.map((h) => h.rainMm)) : 10;
  const extremeBenchmarkPct = selected ? Math.min(100, (selected.next24hRainMm / 150) * 100) : 0;
  const activeRadar = RADAR_LAYERS.find((r) => r.id === radarLayer) ?? RADAR_LAYERS[0];

  const windyEmbedUrl = selected
    ? `https://embed.windy.com/embed2.html?lat=${selected.district.lat}&lon=${selected.district.lon}` +
      `&detailLat=${selected.district.lat}&detailLon=${selected.district.lon}` +
      `&width=650&height=400&zoom=${activeRadar.zoom}&level=surface&overlay=${activeRadar.id}` +
      `&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=true&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C`
    : '';

  return (
    <div className="container">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">
            <CloudRain size={24} />
          </div>
          <div>
            <h1>Siaga Tapteng &amp; Sibolga</h1>
            <p>Pantau Potensi Hujan, Awan Siklon &amp; Analisis AI Peringatan Dini Banjir Bandang</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className={`btn ${notifStatus === 'granted' ? '' : 'btn-primary'}`}
            onClick={handleEnableNotifications}
            disabled={notifStatus === 'unsupported'}
          >
            {notifStatus === 'granted' ? <BellRing size={16} /> : <Bell size={16} />}
            {notifStatus === 'granted'
              ? 'Notifikasi Aktif'
              : notifStatus === 'denied'
              ? 'Notifikasi Diblokir'
              : 'Aktifkan Notifikasi'}
          </button>

          <button className="btn btn-success" onClick={handleShareWhatsApp} disabled={!selected}>
            <Share2 size={16} />
            Bagikan ke WA
          </button>

          <button className="btn btn-danger" onClick={handleSimulateAlert}>
            <Siren size={16} />
            Tes Peringatan
          </button>

          <button className="btn" onClick={() => loadAllWeather(false)} disabled={loading}>
            <RefreshCw size={16} />
            {loading ? 'Memuat...' : 'Perbarui'}
          </button>
        </div>
      </header>

      {isOfflineCache && (
        <div className="offline-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <WifiOff size={18} />
            <span>
              <strong>Mode Offline:</strong> Sinyal terputus — menampilkan data terakhir ({lastUpdated} WIB). Checklist
              siaga &amp; kontak darurat tetap bisa digunakan.
            </span>
          </div>
          <button className="btn" onClick={() => loadAllWeather(false)}>
            Coba Sambungkan
          </button>
        </div>
      )}

      {error && (
        <div className="banner AWAS">
          <div>
            <strong>Gagal memuat data cuaca:</strong> {error}
          </div>
          <button className="btn" onClick={() => loadAllWeather(false)}>
            Coba Lagi
          </button>
        </div>
      )}

      {highestAlert && (
        <section className={`banner ${highestAlert.alertLevel}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {highestAlert.alertLevel === 'AMAN' ? (
              <ShieldCheck size={28} color="#4ade80" />
            ) : (
              <AlertTriangle size={28} color={highestAlert.alertLevel === 'AWAS' ? '#f87171' : '#fb923c'} />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                Status Tertinggi Kawasan: {highestAlert.alertLevel} — {highestAlert.district.name} (
                {highestAlert.district.region})
              </div>
              <div style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>{highestAlert.alertReason}</div>
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Update: {lastUpdated} WIB (otomatis tiap 15 menit)
          </div>
        </section>
      )}

      <main className="grid-layout">
        <aside className="card">
          <div className="card-title">
            <span>Titik Pantauan ({filteredList.length})</span>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Tapteng &amp; Sibolga</span>
          </div>

          <div className="filter-tabs">
            {(['Semua', 'Tapanuli Tengah', 'Kota Sibolga'] as const).map((tab) => (
              <button
                key={tab}
                className={`filter-tab ${regionFilter === tab ? 'active' : ''}`}
                onClick={() => setRegionFilter(tab)}
              >
                {tab === 'Tapanuli Tengah' ? 'Tapteng' : tab === 'Kota Sibolga' ? 'Sibolga' : 'Semua'}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="search-input"
            placeholder="Cari kecamatan atau nama sungai..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="district-list">
            {weatherList.length === 0 && loading && (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: 12 }}>
                Mengambil data curah hujan 14 titik Tapteng &amp; Sibolga...
              </div>
            )}
            {filteredList.map((item) => (
              <button
                key={item.district.id}
                className={`district-item ${selected?.district.id === item.district.id ? 'active' : ''}`}
                onClick={() => setSelectedId(item.district.id)}
              >
                <div>
                  <div className="district-name">
                    {item.district.name}{' '}
                    <span className="district-region-tag">
                      • {item.district.region === 'Kota Sibolga' ? 'Sibolga' : 'Tapteng'}
                    </span>
                  </div>
                  <div className="district-sub">
                    {item.district.elevationNote} • {item.next6hRainMm.toFixed(1)} mm / 6j
                  </div>
                </div>
                <span className={`badge ${item.alertLevel}`}>{item.alertLevel}</span>
              </button>
            ))}
          </div>
        </aside>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {selected && aiReport && (
            <>
              {/* Panel Asisten Analisis AI */}
              <div className="ai-card">
                <div className="card-title" style={{ marginBottom: 10 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8' }}>
                    <Sparkles size={18} />
                    Kesimpulan &amp; Analisis AI (Bahasa Sederhana)
                  </span>
                  <span className={`badge ${selected.alertLevel}`}>
                    Risiko Siklon/Badai: {aiReport.cycloneRisk}
                  </span>
                </div>

                <div className="ai-headline">{aiReport.headline}</div>
                <p className="ai-text">{aiReport.plainSummary}</p>

                <div className="ai-grid">
                  <div className="ai-subbox">
                    <strong>Analisis Awan Badai &amp; Siklon</strong>
                    {aiReport.cycloneAnalysis}
                  </div>
                  <div className="ai-subbox">
                    <strong>Waktu Paling Rawan Hujan</strong>
                    {aiReport.peakWindowText}
                  </div>
                  <div className="ai-subbox">
                    <strong>Kesepakatan 3 Model Global</strong>
                    {aiReport.modelConsensusText}
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', marginTop: 8 }}>
                  Saran Tindakan Saat Ini:
                </div>
                <ul className="ai-actions-list">
                  {aiReport.actionItems.map((act, idx) => (
                    <li key={idx}>{act}</li>
                  ))}
                </ul>
              </div>

              {/* Detail Kondisi Cuaca + Kesimpulan Setiap Angka */}
              <div className="card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.12rem' }}>
                    <MapPin size={18} color="#38bdf8" />
                    Kec. {selected.district.name} — {selected.district.region}
                  </span>
                  <span className={`badge ${selected.alertLevel}`}>STATUS: {selected.alertLevel}</span>
                </div>

                <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginBottom: 16 }}>
                  {selected.district.riverBasin} • Profil Risiko: <strong>{selected.district.riskProfile}</strong> •
                  Kategori 24j BMKG: <strong>{selected.bmkg24hCategory}</strong>
                </p>

                <div className="stats-grid">
                  <div className="stat-box">
                    <div className="stat-label">
                      <CloudRain size={14} color="#38bdf8" /> Hujan Saat Ini
                    </div>
                    <div className="stat-value">{selected.currentRainMm.toFixed(1)} mm/j</div>
                    <div className="stat-note">Peluang puncak {selected.maxRainProb}%</div>
                    <div className="stat-conclusion">{interpretRainCurrent(selected.currentRainMm)}</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">
                      <Droplets size={14} color="#60a5fa" /> Akumulasi 6 Jam
                    </div>
                    <div className="stat-value">{selected.next6hRainMm.toFixed(1)} mm</div>
                    <div className="stat-note">24 jam: {selected.next24hRainMm.toFixed(1)} mm</div>
                    <div className="stat-conclusion">{interpretAccumulation6h(selected.next6hRainMm)}</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">
                      <Thermometer size={14} color="#f59e0b" /> Suhu &amp; Lembap
                    </div>
                    <div className="stat-value">{selected.currentTempC.toFixed(1)}°C</div>
                    <div className="stat-note">
                      Terasa {selected.apparentTempC.toFixed(1)}°C • Lembap {selected.currentHumidity}%
                    </div>
                    <div className="stat-conclusion">
                      {interpretTemp(selected.currentTempC, selected.currentHumidity)}
                    </div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">
                      <Wind size={14} color="#a78bfa" /> Angin &amp; Hembusan
                    </div>
                    <div className="stat-value">{selected.currentWindKmh.toFixed(1)} km/j</div>
                    <div className="stat-note">Hembusan maks {selected.windGustsKmh.toFixed(1)} km/j</div>
                    <div className="stat-conclusion">
                      {interpretWind(selected.currentWindKmh, selected.windGustsKmh)}
                    </div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">
                      <Cloud size={14} color="#94a3b8" /> Tutupan Awan
                    </div>
                    <div className="stat-value">{selected.cloudCover}%</div>
                    <div className="stat-note">Kondisi: {selected.weatherLabel}</div>
                    <div className="stat-conclusion">{interpretClouds(selected.cloudCover)}</div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-label">
                      <Gauge size={14} color="#34d399" /> Tekanan Udara
                    </div>
                    <div className="stat-value">{selected.pressureMsl.toFixed(0)} hPa</div>
                    <div className="stat-note">Indikator bibit siklon/badai</div>
                    <div className="stat-conclusion">{interpretPressure(selected.pressureMsl)}</div>
                  </div>

                  {(() => {
                    const landslide = evaluateLandslideRisk(
                      selected.past3DaysRainMm ?? 0,
                      selected.next24hRainMm,
                      selected.district.riskProfile
                    );
                    return (
                      <div className="stat-box">
                        <div className="stat-label">
                          <Mountain size={14} color="#fb923c" /> Risiko Longsor
                        </div>
                        <div className="stat-value">{landslide.level}</div>
                        <div className="stat-note">
                          3 hari lalu: {(selected.past3DaysRainMm ?? 0).toFixed(1)} mm • Total 4h:{' '}
                          {landslide.total4DayMm.toFixed(1)} mm
                        </div>
                        <div className="stat-conclusion">{landslide.reason}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Penjabaran Prediksi Hujan Per 3 Jam */}
              <div className="card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={18} color="#38bdf8" />
                    Penjabaran Prediksi Hujan Per 3 Jam (24 Jam Ke Depan)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Mudah dibaca per rentang waktu</span>
                </div>

                <div className="three-hour-grid">
                  {threeHourBlocks.map((b) => (
                    <div className="three-hour-card" key={b.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.82rem' }}>{b.label}</strong>
                        <span className={`badge ${b.status}`}>{b.status}</span>
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>
                        {b.totalRainMm.toFixed(1)} mm{' '}
                        <span style={{ fontSize: '0.74rem', fontWeight: 500, color: '#94a3b8' }}>
                          (peluang {b.maxProb}%)
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#cbd5e1', lineHeight: 1.35 }}>{b.summary}</div>
                    </div>
                  ))}
                </div>

                <div className="card-title" style={{ marginTop: 18 }}>
                  <span>Grafik Curah Hujan Per Jam (mm/jam)</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Puncak: {selected.maxHourlyRainMm.toFixed(1)} mm/jam
                  </span>
                </div>
                <div className="chart-wrap">
                  <div className="chart-bars">
                    {selected.hourly.map((pt) => {
                      const heightPct = Math.min(100, (pt.rainMm / maxChartRain) * 100);
                      const isHeavy = pt.rainMm >= 10;
                      return (
                        <div
                          className="bar-col"
                          key={pt.time}
                          title={`${pt.hourLabel}: ${pt.rainMm} mm (Peluang ${pt.probability}%, Awan ${pt.cloudCover}%)`}
                        >
                          <span className="bar-val">{pt.rainMm > 0 ? pt.rainMm.toFixed(1) : ''}</span>
                          <div
                            className={`bar-fill ${isHeavy ? 'heavy' : ''}`}
                            style={{ height: `${Math.max(3, heightPct)}%` }}
                          />
                          <span className="bar-label">{pt.hourLabel.slice(0, 2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Peta Satelit Awan, Radar Hujan & Siklon Interaktif */}
              <div className="card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Radar size={18} color="#38bdf8" />
                    Peta Satelit Awan, Radar Hujan &amp; Pantauan Siklon (Live)
                  </span>
                </div>

                <div className="radar-tabs">
                  {RADAR_LAYERS.map((layer) => (
                    <button
                      key={layer.id}
                      className={`btn ${radarLayer === layer.id ? 'btn-primary' : ''}`}
                      onClick={() => setRadarLayer(layer.id)}
                    >
                      {layer.label}
                    </button>
                  ))}
                </div>

                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 10 }}>{activeRadar.desc}</p>

                <div className="radar-frame-wrap">
                  <iframe
                    title="Peta Satelit Awan & Siklon Tapanuli Tengah Sibolga"
                    className="radar-frame"
                    src={windyEmbedUrl}
                    loading="lazy"
                  />
                </div>

                {/* Panduan & Analisis Indikator Peta (otomatis menyesuaikan mode yang dipilih) */}
                <div className="radar-guide">
                  <div className="radar-guide-title">{activeRadar.guideTitle}</div>
                  <div className="radar-legend-grid">
                    {activeRadar.legends.map((leg) => (
                      <div className="radar-legend-item" key={leg.label}>
                        <span className="legend-dot" style={{ background: leg.color }} />
                        <div>
                          <strong style={{ color: '#f8fafc', display: 'block', marginBottom: 2 }}>{leg.label}</strong>
                          {leg.meaning}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="radar-live-note">
                    <strong>Analisis Peta Live ({selected.district.name}): </strong>
                    {radarLayer === 'wind' &&
                      `Angin saat ini ${selected.currentWindKmh.toFixed(1)} km/j (hembusan ${selected.windGustsKmh.toFixed(1)} km/j) — ${interpretWind(selected.currentWindKmh, selected.windGustsKmh)}. `}
                    {radarLayer === 'rain' &&
                      `Curah hujan terpantau ${selected.currentRainMm.toFixed(1)} mm/jam (akumulasi 6 jam ${selected.next6hRainMm.toFixed(1)} mm) — ${interpretRainCurrent(selected.currentRainMm)}. `}
                    {radarLayer === 'satellite' &&
                      `Tutupan awan di atas ${selected.district.name} saat ini ${selected.cloudCover}% — ${interpretClouds(selected.cloudCover)}. `}
                    {radarLayer === 'pressure' &&
                      `Tekanan udara saat ini ${selected.pressureMsl.toFixed(0)} hPa — ${interpretPressure(selected.pressureMsl)}. `}
                    {activeRadar.watchTip}
                  </div>
                </div>
              </div>

              {/* Panel Data Pembanding Multi-Model & Ambang Ekstrem BMKG */}
              <div className="card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Scale size={18} color="#38bdf8" />
                    Data Pembanding Multi-Model Cuaca Global ({selected.district.name})
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Validasi silang 3 sumber model</span>
                </div>

                {loadingComparison ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.84rem', padding: '10px 0' }}>
                    Membandingkan data model Best Match, ECMWF (Eropa), dan GFS (NOAA AS)...
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>Model Meteorologi</th>
                          <th>Hujan 6 Jam</th>
                          <th>Hujan 24 Jam</th>
                          <th>Puncak / Jam</th>
                          <th>Indikasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelComparison.map((m) => (
                          <tr key={m.modelId}>
                            <td>
                              <strong>{m.modelName}</strong>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{m.agency}</div>
                            </td>
                            <td>{m.next6hRainMm.toFixed(1)} mm</td>
                            <td>{m.next24hRainMm.toFixed(1)} mm</td>
                            <td>{m.maxHourlyRainMm.toFixed(1)} mm/j</td>
                            <td>
                              <span className={`badge ${m.alertLevel}`}>{m.alertLevel}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="benchmark-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <strong>Pembanding Ambang Hujan Ekstrem BMKG (150 mm / 24 jam)</strong>
                    <span>
                      {selected.next24hRainMm.toFixed(1)} mm / 150 mm ({extremeBenchmarkPct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${Math.max(2, extremeBenchmarkPct)}%` }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Acuan kewaspadaan pasca banjir bandang 25 Nov 2025: &gt;50 mm/hari (Lebat), &gt;100 mm/hari (Sangat
                    Lebat), &gt;150 mm/hari (Ekstrem).
                  </div>
                </div>
              </div>

              {/* Prakiraan 3 Hari Ke Depan */}
              <div className="card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarDays size={18} color="#38bdf8" />
                    Prakiraan Potensi Hujan 3 Hari Ke Depan
                  </span>
                </div>
                <div className="daily-grid">
                  {selected.daily.map((d) => (
                    <div className="daily-card" key={d.date}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.dayLabel}</div>
                      <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginBottom: 6 }}>{d.weatherLabel}</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{d.rainSumMm.toFixed(1)} mm</div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 2 }}>{d.bmkgCategory}</div>
                      <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: 6 }}>
                        Peluang: {d.maxProb}% • Suhu: {d.tempMin.toFixed(0)}°–{d.tempMax.toFixed(0)}°C
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Jalur Akses Kritis (Darat & Udara), Checklist Siaga Isolasi & Kanal Resmi Anti-Hoaks */}
              <EmergencyReadinessPanel weatherList={weatherList} />
            </>
          )}
        </section>
      </main>

      <footer className="footer-note">
        Data cuaca real-time, pembanding multi-model (Best Match, ECMWF, GFS NOAA), serta peta radar awan &amp; siklon
        untuk Kabupaten Tapanuli Tengah &amp; Kota Sibolga.
      </footer>
    </div>
  );
}
