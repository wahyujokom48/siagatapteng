import { useEffect, useState } from 'react';
import { Orbit, RefreshCw, AlertTriangle, ShieldCheck, Compass } from 'lucide-react';
import { CycloneWatchReport, fetchCycloneWatch } from '../services/cycloneMonitor';

export function CycloneAnalysisPanel() {
  const [report, setReport] = useState<CycloneWatchReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCycloneWatch();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data pantauan siklon laut.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 20 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const badgeClass = (status: string) => {
    if (status === 'SIAGA') return 'AWAS';
    if (status === 'WASPADA') return 'SIAGA';
    if (status === 'PANTAU') return 'WASPADA';
    return 'AMAN';
  };

  return (
    <div className="card cyclone-card">
      <div className="card-title">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8' }}>
          <Orbit size={18} />
          Analisis Awan Siklon &amp; Bibit Badai (Samudra Hindia Barat Sumatera)
        </span>
        <button className="btn" onClick={loadData} disabled={loading} style={{ padding: '5px 10px', fontSize: '0.76rem' }}>
          <RefreshCw size={13} />
          {loading ? 'Memindai...' : 'Pindai Laut'}
        </button>
      </div>

      {error && <div style={{ fontSize: '0.82rem', color: '#fca5a5', marginBottom: 10 }}>{error}</div>}

      {report && (
        <>
          <div className={`cyclone-summary-box ${badgeClass(report.overallStatus)}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <strong style={{ fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                {report.overallStatus === 'AMAN' ? (
                  <ShieldCheck size={18} color="#4ade80" />
                ) : (
                  <AlertTriangle size={18} color="#fb923c" />
                )}
                {report.headline}
              </strong>
              <span className={`badge ${badgeClass(report.overallStatus)}`}>SIKLON: {report.overallStatus}</span>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#e2e8f0', marginBottom: 8 }}>{report.analysisSummary}</p>
            <div style={{ fontSize: '0.79rem', color: '#bae6fd', borderTop: '1px dashed rgba(148,163,184,0.25)', paddingTop: 8 }}>
              <strong>Perbandingan Pola 25 Nov 2025: </strong>
              {report.patternComparison}
            </div>
          </div>

          <div className="offshore-grid">
            {report.offshorePoints.map((pt) => (
              <div className="offshore-box" key={pt.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <strong style={{ fontSize: '0.84rem' }}>{pt.name}</strong>
                  <span className={`badge ${badgeClass(pt.status)}`}>{pt.status}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{pt.role}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: '0.78rem', marginTop: 4 }}>
                  <span>
                    Tekanan: <strong>{pt.pressureHpa.toFixed(0)} hPa</strong>
                  </span>
                  <span>
                    Hembusan: <strong>{pt.gustsKmh.toFixed(0)} km/j</strong>
                  </span>
                  <span>
                    Awan: <strong>{pt.cloudCover}%</strong>
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Compass size={12} color="#38bdf8" /> Angin dari {pt.windDirText} ({pt.windKmh.toFixed(0)} km/j)
                </div>
                <div style={{ fontSize: '0.74rem', color: '#e0f2fe', marginTop: 2 }}>{pt.note}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Panduan Cara Membaca Pola Awan Siklon untuk Warga */}
      <div className="cyclone-guide">
        <div className="radar-guide-title" style={{ marginBottom: 8 }}>
          Panduan Cepat Mengenali Pola Awan Siklon (Seperti Kejadian 25 Nov 2025)
        </div>
        <div className="checklist">
          <div className="checklist-item">
            <strong>1. Pusaran &amp; Ekor Awan (Pola Koma)</strong>
            Di peta satelit/angin di bawah, siklon terlihat seperti pusaran melingkar di Samudra Hindia (barat Nias)
            dengan &quot;ekor&quot; awan putih/merah pekat memanjang masuk ke daratan Sibolga–Tapteng.
          </div>
          <div className="checklist-item">
            <strong>2. Tekanan Udara Turun (&lt; 1006 hPa)</strong>
            Siklon menyedot udara di sekitarnya. Jika tekanan di Barat Nias turun di bawah 1006 hPa dan muncul huruf
            <strong> &quot;L&quot;</strong> dengan garis rapat, potensi badai hujan meningkat tajam.
          </div>
          <div className="checklist-item">
            <strong>3. Hujan Terjebak di Bukit Barisan</strong>
            Angin barat dari laut mendorong ekor awan siklon menabrak perbukitan Sitahuis–Tukka sehingga hujan turun
            berjam-jam tanpa berhenti—inilah pemicu utama banjir bandang &amp; longsor.
          </div>
        </div>
      </div>
    </div>
  );
}
