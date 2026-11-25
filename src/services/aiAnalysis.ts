import { DistrictWeather, ModelComparisonItem } from './weather';

export interface ThreeHourBlock {
  label: string;
  totalRainMm: number;
  maxProb: number;
  avgCloud: number;
  status: 'AMAN' | 'WASPADA' | 'SIAGA' | 'AWAS';
  summary: string;
}

export interface AiAnalysisReport {
  headline: string;
  plainSummary: string;
  cycloneAnalysis: string;
  cycloneRisk: 'Rendah' | 'Waspada' | 'Tinggi';
  peakWindowText: string;
  modelConsensusText: string;
  actionItems: string[];
}

export function interpretRainCurrent(mm: number): string {
  if (mm <= 0.1) return 'Tidak sedang hujan';
  if (mm < 2.5) return 'Gerimis / hujan ringan';
  if (mm < 10) return 'Hujan sedang — jalan mulai basah/licin';
  if (mm < 20) return 'Hujan lebat — waspada genangan & aliran sungai';
  return 'Hujan sangat lebat/ekstrem — potensi banjir tinggi!';
}

export function interpretAccumulation6h(mm: number): string {
  if (mm < 5) return 'Curah hujan 6 jam ke depan sangat rendah (aman)';
  if (mm < 15) return 'Hujan ringan–sedang, drainase normal masih aman';
  if (mm < 35) return 'Hujan cukup banyak, mulai pantau air sungai';
  if (mm < 60) return 'Akumulasi tinggi! Waspada luapan sungai & longsor';
  return 'Akumulasi sangat berbahaya! Risiko tinggi banjir bandang';
}

export function interpretTemp(temp: number, humidity: number): string {
  if (humidity >= 88 && temp <= 26) return 'Udara sangat lembap & sejuk (ciri khas menjelang/saat hujan)';
  if (humidity >= 85) return 'Udara gerah & sangat lembap — uap air pembentuk awan hujan tinggi';
  if (temp >= 32) return 'Cuaca panas — penguapan tinggi bisa memicu hujan sore/malam';
  return 'Suhu & kelembapan udara dalam kondisi normal';
}

export function interpretWind(wind: number, gusts: number): string {
  if (gusts >= 45 || wind >= 30) return 'Angin kencang! Waspada pohon tumbang & indikasi awan badai/siklon';
  if (gusts >= 28 || wind >= 18) return 'Angin cukup kencang, sering menyertai awan hujan tebal';
  return 'Angin tenang hingga sepoi-sepoi (normal)';
}

export function interpretClouds(cloudCover: number): string {
  if (cloudCover >= 90) return 'Langit tertutup awan sangat tebal / mendung pekat';
  if (cloudCover >= 65) return 'Banyak awan berkumpul, potensi hujan meningkat';
  if (cloudCover >= 30) return 'Berawan sebagian, cahaya matahari masih masuk';
  return 'Langit cenderung cerah / sedikit awan';
}

export function interpretPressure(hpa: number): string {
  if (hpa < 1004) return 'Tekanan sangat rendah! Indikasi kuat pusat badai / bibit siklon';
  if (hpa < 1008) return 'Tekanan menurun — awan konvektif / badai hujan mudah terbentuk';
  if (hpa <= 1014) return 'Tekanan udara stabil / normal untuk wilayah tropis';
  return 'Tekanan tinggi — cuaca cenderung lebih stabil';
}

/**
 * Mengelompokkan prakiraan 24 jam menjadi 8 blok selang waktu 3 jam
 */
export function buildThreeHourBlocks(weather: DistrictWeather): ThreeHourBlock[] {
  const blocks: ThreeHourBlock[] = [];
  const hourly = weather.hourly;

  for (let i = 0; i < hourly.length; i += 3) {
    const slice = hourly.slice(i, i + 3);
    if (slice.length === 0) continue;

    const startLabel = slice[0].hourLabel;
    const endHourNum = (parseInt(slice[slice.length - 1].hourLabel.slice(0, 2), 10) + 1) % 24;
    const endLabel = `${String(endHourNum).padStart(2, '0')}:00`;

    const totalRainMm = slice.reduce((acc, p) => acc + p.rainMm, 0);
    const maxProb = slice.reduce((mx, p) => Math.max(mx, p.probability), 0);
    const avgCloud = Math.round(slice.reduce((acc, p) => acc + p.cloudCover, 0) / slice.length);

    let status: ThreeHourBlock['status'] = 'AMAN';
    let summary = 'Cerah/berawan, aman untuk beraktivitas.';

    if (totalRainMm >= 30) {
      status = 'AWAS';
      summary = 'Hujan ekstrem! Sangat berisiko banjir bandang & longsor. Jauhi sungai.';
    } else if (totalRainMm >= 15) {
      status = 'SIAGA';
      summary = 'Hujan lebat diperkirakan turun. Pantau debit air & siapkan evakuasi.';
    } else if (totalRainMm >= 3 || maxProb >= 65) {
      status = 'WASPADA';
      summary = 'Berpotensi hujan ringan hingga sedang. Siapkan payung & pantau cuaca.';
    } else if (totalRainMm > 0.2) {
      status = 'AMAN';
      summary = 'Potensi gerimis tipis, kondisi secara umum masih aman.';
    }

    blocks.push({
      label: `${startLabel} – ${endLabel} WIB`,
      totalRainMm,
      maxProb,
      avgCloud,
      status,
      summary,
    });
  }

  return blocks;
}

/**
 * Mesin Analisis AI (Rule-based Expert System) yang menerjemahkan seluruh data
 * meteorologi, indikator siklon, dan konsensus 3 model menjadi kesimpulan bahasa awam.
 */
export function generateAiAnalysis(
  weather: DistrictWeather,
  models: ModelComparisonItem[],
  allDistricts: DistrictWeather[]
): AiAnalysisReport {
  const blocks = buildThreeHourBlocks(weather);
  const peakBlock = [...blocks].sort((a, b) => b.totalRainMm - a.totalRainMm)[0];

  // Cek kondisi hulu (Sitahuis & Tukka) karena sangat memengaruhi banjir bandang Tapteng-Sibolga
  const upstreamHigh = allDistricts.filter(
    (d) =>
      (d.district.id === 'sitahuis' || d.district.id === 'tukka' || d.district.id === 'sibolga-utara') &&
      (d.alertLevel === 'SIAGA' || d.alertLevel === 'AWAS')
  );

  // Evaluasi potensi awan badai / bibit siklon
  let cycloneRisk: AiAnalysisReport['cycloneRisk'] = 'Rendah';
  let cycloneAnalysis =
    `Tekanan udara di ${weather.district.name} berada di ${weather.pressureMsl.toFixed(0)} hPa dengan hembusan angin ${weather.windGustsKmh.toFixed(1)} km/j. Tidak terdeteksi tanda-tanda pusaran siklon atau badai besar di atas wilayah ini saat ini.`;

  if (weather.pressureMsl < 1005 || weather.windGustsKmh >= 42 || weather.weatherCode >= 95) {
    cycloneRisk = 'Tinggi';
    cycloneAnalysis =
      `WASPADA AWAN BADAI / SIKLON: Tekanan udara rendah (${weather.pressureMsl.toFixed(0)} hPa) disertai hembusan angin kencang (${weather.windGustsKmh.toFixed(1)} km/j) dan tutupan awan ${weather.cloudCover}%. Kondisi ini menandakan aktivitas awan Cumulonimbus tebal atau pengaruh bibit siklon di Samudra Hindia Barat Sumatera.`;
  } else if (weather.pressureMsl < 1009 || weather.windGustsKmh >= 28 || weather.cloudCover >= 88) {
    cycloneRisk = 'Waspada';
    cycloneAnalysis =
      `Terdeteksi penumpukan awan tebal (${weather.cloudCover}%) dengan tekanan ${weather.pressureMsl.toFixed(0)} hPa. Belum mengarah ke siklon besar, namun awan hujan aktif berpotensi menurunkan hujan lokal yang cukup deras. Pantau pergerakan awan di peta satelit di bawah.`;
  }

  // Konsensus 3 model
  let modelConsensusText = 'Sedang memuat perbandingan 3 model cuaca global...';
  if (models.length > 0) {
    const avg24 = models.reduce((s, m) => s + m.next24hRainMm, 0) / models.length;
    const min24 = Math.min(...models.map((m) => m.next24hRainMm));
    const max24 = Math.max(...models.map((m) => m.next24hRainMm));
    const spread = max24 - min24;

    if (spread <= 15) {
      modelConsensusText = `Ketiga model global (Best Match, ECMWF Eropa, GFS AS) cukup sepakat memprediksi hujan sekitar ${avg24.toFixed(1)} mm dalam 24 jam ke depan (tingkat keyakinan tinggi).`;
    } else {
      modelConsensusText = `Ada perbedaan prediksi antar model (${min24.toFixed(1)} mm hingga ${max24.toFixed(1)} mm dalam 24 jam). Gunakan angka tertinggi (${max24.toFixed(1)} mm) sebagai acuan kehati-hatian.`;
    }
  }

  // Waktu paling rawan
  const peakWindowText =
    peakBlock && peakBlock.totalRainMm > 0.5
      ? `Puncak potensi hujan diperkirakan terjadi pada pukul ${peakBlock.label} dengan perkiraan curah hujan ${peakBlock.totalRainMm.toFixed(1)} mm (peluang ${peakBlock.maxProb}%).`
      : `Dalam 24 jam ke depan belum terlihat puncak hujan yang signifikan di ${weather.district.name}.`;

  // Headline & Plain Summary
  let headline = `Kondisi ${weather.district.name} Saat Ini Relatif Aman`;
  let plainSummary = `Secara keseluruhan, cuaca di ${weather.district.name} (${weather.district.region}) saat ini ${weather.weatherLabel.toLowerCase()} dengan curah hujan rendah. Akumulasi hujan 6 jam ke depan hanya sekitar ${weather.next6hRainMm.toFixed(1)} mm sehingga belum ada ancaman banjir bandang.`;

  if (weather.alertLevel === 'AWAS') {
    headline = `BAHAYA: Potensi Hujan Ekstrem & Banjir Bandang di ${weather.district.name}!`;
    plainSummary = `Analisis AI mendeteksi curah hujan sangat berbahaya di ${weather.district.name} (akumulasi 6 jam ${weather.next6hRainMm.toFixed(1)} mm, 24 jam ${weather.next24hRainMm.toFixed(1)} mm). Kondisi ini sangat berisiko memicu banjir bandang dan tanah longsor.`;
  } else if (weather.alertLevel === 'SIAGA') {
    headline = `SIAGA: Hujan Lebat Berpotensi Mengguyur ${weather.district.name}`;
    plainSummary = `Hujan dengan intensitas lebat terpantau/diprediksi di ${weather.district.name} (${weather.next6hRainMm.toFixed(1)} mm dalam 6 jam). Warga di dekat aliran ${weather.district.riverBasin} dan perbukitan harus meningkatkan kewaspadaan penuh.`;
  } else if (weather.alertLevel === 'WASPADA') {
    headline = `WASPADA: Ada Potensi Hujan Sedang di ${weather.district.name}`;
    plainSummary = `Diperkirakan akan turun hujan sedang dalam 6–24 jam ke depan (${weather.next24hRainMm.toFixed(1)} mm). Belum masuk kategori banjir bandang, tetapi tetap pantau perkembangan cuaca terutama jika hujan turun terus-menerus di daerah hulu.`;
  }

  if (upstreamHigh.length > 0) {
    const upNames = upstreamHigh.map((u) => u.district.name).join(', ');
    plainSummary += ` PERHATIAN HULU: Wilayah hulu/perbukitan (${upNames}) sedang berstatus SIAGA/AWAS — aliran air kiriman dapat menuju hilir dalam 1–3 jam!`;
  }

  // Rekomendasi tindakan
  const actionItems: string[] = [];
  if (weather.alertLevel === 'AWAS' || weather.alertLevel === 'SIAGA') {
    actionItems.push(`Jauhi bantaran ${weather.district.riverBasin} dan lereng bukit curam.`);
    actionItems.push('Siapkan tas siaga (KTP, KK, obat, senter, powerbank) dan pantau grup info BPBD.');
    actionItems.push('Jika air sungai berubah keruh pekat atau terdengar suara gemuruh dari hulu, segera evakuasi ke tempat tinggi.');
  } else if (weather.alertLevel === 'WASPADA') {
    actionItems.push('Pastikan selokan/parit di depan rumah bersih dari sampah agar air lancar.');
    actionItems.push('Aktifkan tombol Notifikasi di atas agar HP langsung berbunyi jika hujan memburuk.');
    actionItems.push('Pantau peta satelit awan di bawah untuk melihat apakah awan tebal bergerak dari arah laut/bukit.');
  } else {
    actionItems.push('Aktivitas harian dapat berjalan normal; tetap aktifkan notifikasi untuk pemantauan otomatis.');
    actionItems.push('Cek kembali prakiraan per 3 jam sebelum bepergian jauh atau melintasi daerah rawan longsor.');
  }

  return {
    headline,
    plainSummary,
    cycloneAnalysis,
    cycloneRisk,
    peakWindowText,
    modelConsensusText,
    actionItems,
  };
}
