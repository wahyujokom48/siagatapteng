import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  PhoneCall,
  Plane,
  RotateCcw,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { DistrictWeather } from '../services/weather';
import { evaluateCriticalRoutes, RouteStatus } from '../services/accessAndLandslide';

interface EmergencyReadinessPanelProps {
  weatherList: DistrictWeather[];
}

const CHECKLIST_STORAGE_KEY = 'siaga_tapteng_checklist_v1';

const CHECKLIST_ITEMS = [
  { id: 'water', label: 'Air bersih 3–5 hari (minimal 3 liter/orang/hari)' },
  { id: 'food', label: 'Beras, makanan instan, & kebutuhan bayi/lansia' },
  { id: 'medicine', label: 'Obat-obatan pribadi & kotak P3K dasar' },
  { id: 'flashlight', label: 'Senter, lilin/lampu darurat, & baterai cadangan' },
  { id: 'powerbank', label: 'Powerbank terisi penuh & kabel pengisi daya' },
  { id: 'cash', label: 'Uang tunai secukupnya (antisipasi ATM/jaringan mati)' },
  { id: 'docs', label: 'Dokumen penting (KTP, KK, ijazah, surat berharga) dalam plastik kedap air' },
  { id: 'fuel', label: 'BBM kendaraan minimal setengah tangki untuk evakuasi cepat' },
];

function getStatusBadgeClass(status: RouteStatus): string {
  if (status === 'RAWAN TERPUTUS') return 'route-badge route-danger';
  if (status === 'WASPADA') return 'route-badge route-warn';
  return 'route-badge route-safe';
}

export const EmergencyReadinessPanel: React.FC<EmergencyReadinessPanelProps> = ({
  weatherList,
}) => {
  const routes = useMemo(() => evaluateCriticalRoutes(weatherList), [weatherList]);

  const [checkedIds, setCheckedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((item): item is string => typeof item === 'string');
        }
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checkedIds));
    } catch {
      // ignore storage errors
    }
  }, [checkedIds]);

  const toggleItem = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const resetChecklist = () => {
    setCheckedIds([]);
  };

  const completedCount = checkedIds.length;
  const totalCount = CHECKLIST_ITEMS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Card 1: Pemantauan Jalur Akses Kritis */}
      <section className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Route size={20} />
          <span>Pemantauan Jalur Akses Kritis (Darat &amp; Udara)</span>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', opacity: 0.85 }}>
          Estimasi kondisi koridor utama Tapanuli Tengah – Sibolga berdasarkan kejenuhan tanah 4 hari
          terakhir, curah hujan 6 jam ke depan, dan angin di area bandara.
        </p>

        <div className="routes-grid">
          {routes.map((route) => {
            const isDanger = route.status === 'RAWAN TERPUTUS';
            const isSafe = route.status === 'LANCAR';
            return (
              <div key={route.id} className="route-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    marginBottom: '0.45rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    {route.type === 'UDARA' ? <Plane size={18} /> : <Car size={18} />}
                    <strong style={{ fontSize: '0.95rem' }}>{route.name}</strong>
                  </div>
                  <span className={getStatusBadgeClass(route.status)}>
                    {isSafe ? (
                      <CheckCircle2 size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    ) : (
                      <AlertTriangle
                        size={13}
                        style={{ marginRight: 4, verticalAlign: 'middle' }}
                      />
                    )}
                    {route.status}
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', opacity: 0.75, marginBottom: '0.35rem' }}>
                  Koridor: {route.corridor}
                </div>
                <p
                  style={{
                    margin: '0 0 0.5rem',
                    fontSize: '0.86rem',
                    lineHeight: 1.45,
                    color: isDanger ? '#fca5a5' : undefined,
                  }}
                >
                  {route.summary}
                </p>
                <div style={{ fontSize: '0.78rem', opacity: 0.75 }}>{route.metrics}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Card 2: Checklist Siaga Isolasi & Tas Darurat */}
      <section className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          <div
            className="card-title"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}
          >
            <ClipboardCheck size={20} />
            <span>Checklist Siaga Isolasi &amp; Tas Darurat (Tersimpan Otomatis di HP)</span>
          </div>
          <button
            type="button"
            onClick={resetChecklist}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '0.5rem',
              border: '1px solid rgba(148, 163, 184, 0.35)',
              background: 'transparent',
              color: 'inherit',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.84rem',
              marginBottom: '0.35rem',
            }}
          >
            <span>
              Kesiapan: <strong>{completedCount}/{totalCount}</strong> item siap
            </span>
            <strong>{progressPct}%</strong>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '999px',
              background: 'rgba(148, 163, 184, 0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                borderRadius: '999px',
                background: progressPct === 100 ? '#22c55e' : '#38bdf8',
                transition: 'width 0.25s ease',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.55rem' }}>
          {CHECKLIST_ITEMS.map((item) => {
            const checked = checkedIds.includes(item.id);
            return (
              <label
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.55rem',
                  padding: '0.55rem 0.7rem',
                  borderRadius: '0.55rem',
                  background: checked
                    ? 'rgba(34, 197, 94, 0.12)'
                    : 'rgba(148, 163, 184, 0.08)',
                  border: checked
                    ? '1px solid rgba(34, 197, 94, 0.35)'
                    : '1px solid rgba(148, 163, 184, 0.18)',
                  cursor: 'pointer',
                  fontSize: '0.86rem',
                  lineHeight: 1.4,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleItem(item.id)}
                  style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                />
                <span style={{ textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.8 : 1 }}>
                  {item.label}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Card 3: Kanal Resmi Anti-Hoaks & Kontak Darurat */}
      <section className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={20} />
          <span>Kanal Resmi Anti-Hoaks &amp; Kontak Darurat</span>
        </div>
        <p style={{ margin: '0 0 0.85rem', fontSize: '0.86rem', opacity: 0.85 }}>
          Selalu verifikasi informasi banjir, longsor, dan penutupan jalan melalui kanal resmi
          pemerintah sebelum membagikan pesan berantai.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '0.9rem' }}>
          <a
            href="https://www.bmkg.go.id"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.55rem',
              background: 'rgba(56, 189, 248, 0.14)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: 'inherit',
              textDecoration: 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
            }}
          >
            <span>BMKG (Cuaca &amp; Peringatan Dini)</span>
            <ExternalLink size={14} />
          </a>

          <a
            href="https://bnpb.go.id"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.55rem',
              background: 'rgba(56, 189, 248, 0.14)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: 'inherit',
              textDecoration: 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
            }}
          >
            <span>BNPB (Info Bencana Nasional)</span>
            <ExternalLink size={14} />
          </a>

          <a
            href="https://inarisk.bnpb.go.id"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.55rem',
              background: 'rgba(56, 189, 248, 0.14)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: 'inherit',
              textDecoration: 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
            }}
          >
            <span>InaRISK (Peta Risiko Bencana)</span>
            <ExternalLink size={14} />
          </a>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          <a
            href="tel:112"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '0.55rem',
              background: 'rgba(239, 68, 68, 0.16)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              color: 'inherit',
              textDecoration: 'none',
              fontSize: '0.88rem',
              fontWeight: 700,
            }}
          >
            <PhoneCall size={15} />
            <span>112 — Layanan Darurat Nasional (Bebas Pulsa)</span>
          </a>

          <a
            href="tel:115"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '0.55rem',
              background: 'rgba(245, 158, 11, 0.16)',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              color: 'inherit',
              textDecoration: 'none',
              fontSize: '0.88rem',
              fontWeight: 700,
            }}
          >
            <PhoneCall size={15} />
            <span>115 — BASARNAS (Evakuasi &amp; SAR)</span>
          </a>
        </div>
      </section>
    </div>
  );
};
