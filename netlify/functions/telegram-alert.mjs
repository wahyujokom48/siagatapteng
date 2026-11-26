// Netlify Scheduled Function: berjalan otomatis setiap 15 menit 24/7
// 1) Mengirim peringatan darurat otomatis jika ada SIAGA/AWAS atau indikasi Siklon Barat Nias
// 2) Mengirim Laporan Persiapan Berangkat Kerja (07:00 WIB) & Pulang Kerja (16:30 WIB)

const POINTS = [
  { id: 'rumah', name: 'Rumah (Pandan)', lat: 1.68681, lon: 98.822743 },
  { id: 'kantor', name: 'Kantor (Sibolga Utara)', lat: 1.745144, lon: 98.777456 },
  { id: 'sitahuis', name: 'Sitahuis (Hulu)', lat: 1.805, lon: 98.825 },
  { id: 'tukka', name: 'Tukka (Hulu)', lat: 1.72, lon: 98.87 },
  { id: 'laut', name: 'Samudra Hindia Barat Nias', lat: 1.1, lon: 96.8, isOcean: true },
];

async function sendTelegram(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });
}

export default async function handler() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diatur di Netlify Environment Variables.');
    return new Response('Telegram env vars not configured', { status: 200 });
  }

  // Hitung jam & menit WIB (UTC+7)
  const nowUtc = new Date();
  const wibTime = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  const hourWib = wibTime.getUTCHours();
  const minuteWib = wibTime.getUTCMinutes();

  const isMorningCommute = hourWib === 7 && minuteWib < 15; // 07:00 - 07:14 WIB
  const isEveningCommute = hourWib === 16 && minuteWib >= 30 && minuteWib < 45; // 16:30 - 16:44 WIB

  const alerts = [];
  const summaryMap = {};

  for (const pt of POINTS) {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${pt.lat}&longitude=${pt.lon}` +
        `&current=temperature_2m,rain,pressure_msl,wind_gusts_10m` +
        `&hourly=rain,precipitation_probability&timezone=Asia%2FJakarta&forecast_days=1`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      const temp = Number(data.current?.temperature_2m ?? 0);
      const rainNow = Number(data.current?.rain ?? 0);
      const pressure = Number(data.current?.pressure_msl ?? 1010);
      const gusts = Number(data.current?.wind_gusts_10m ?? 0);

      const hourlyRain = data.hourly?.rain ?? [];
      const hourlyProb = data.hourly?.precipitation_probability ?? [];
      const next3hRain = hourlyRain.slice(0, 3).reduce((a, b) => a + Number(b ?? 0), 0);
      const next3hProb = Math.max(0, ...hourlyProb.slice(0, 3).map((v) => Number(v ?? 0)));
      const next6hRain = hourlyRain.slice(0, 6).reduce((a, b) => a + Number(b ?? 0), 0);

      summaryMap[pt.id] = { temp, rainNow, pressure, gusts, next3hRain, next3hProb, next6hRain };

      if (pt.isOcean) {
        if (pressure <= 1005 || gusts >= 45) {
          alerts.push(
            `🌀 *SIKLON/BADAI LAUT (${pt.name})*: Tekanan ${pressure.toFixed(0)} hPa, Hembusan ${gusts.toFixed(0)} km/j`
          );
        }
      } else if (rainNow >= 10 || next6hRain >= 35) {
        const level = rainNow >= 20 || next6hRain >= 60 ? 'AWAS' : 'SIAGA';
        alerts.push(
          `🌧️ *${level} — ${pt.name}*: Hujan saat ini ${rainNow.toFixed(1)} mm/j, Akumulasi 6 jam ${next6hRain.toFixed(1)} mm`
        );
      }
    } catch {
      // Lanjut ke titik berikutnya
    }
  }

  let sentCount = 0;

  // 1) Kirim Laporan Rutin Berangkat (07:00 WIB) atau Pulang Kerja (16:30 WIB)
  if ((isMorningCommute || isEveningCommute) && summaryMap.rumah && summaryMap.kantor) {
    const r = summaryMap.rumah;
    const k = summaryMap.kantor;
    const maxRain3h = Math.max(r.next3hRain, k.next3hRain);
    const maxProb3h = Math.max(r.next3hProb, k.next3hProb);
    const maxWind = Math.max(r.gusts, k.gusts);

    let saranJasHujan = '✅ *Tidak perlu jas hujan* — jalur Pandan–Sibolga terpantau aman/cerah.';
    if (maxRain3h >= 10) {
      saranJasHujan =
        '🚨 *WAJIB JAS HUJAN & HATI-HATI!* Potensi hujan lebat di rute Pandan–Sarudik–Sibolga. Waspadai genangan & perbukitan Sibolga Utara.';
    } else if (maxRain3h >= 0.5 || maxProb3h >= 45) {
      saranJasHujan =
        '☔ *Sebaiknya bawa jas hujan / payung* — ada peluang hujan di jalur perjalanan dalam 3 jam ke depan.';
    }

    const title = isMorningCommute
      ? '☀️ *LAPORAN BERANGKAT KERJA (07:00 WIB)*'
      : '🌇 *LAPORAN PULANG KERJA (16:30 WIB)*';

    const commuteMsg =
      `${title}\n` +
      `Rute: Rumah (Pandan) ↔ Kantor (Sibolga Utara)\n\n` +
      `🏠 *Rumah (Pandan)*: ${r.temp.toFixed(1)}°C | Hujan 3j: ${r.next3hRain.toFixed(1)} mm (${r.next3hProb}%)\n` +
      `🏢 *Kantor (Sibolga)*: ${k.temp.toFixed(1)}°C | Hujan 3j: ${k.next3hRain.toFixed(1)} mm (${k.next3hProb}%)\n` +
      `💨 *Angin maks*: ${maxWind.toFixed(0)} km/j\n\n` +
      `*Persiapan:*\n${saranJasHujan}\n\n` +
      `Pantau detail: https://siagatapteng.netlify.app`;

    await sendTelegram(token, chatId, commuteMsg);
    sentCount++;
  }

  // 2) Kirim Peringatan Darurat 24/7 jika ada SIAGA/AWAS atau Siklon
  if (alerts.length > 0) {
    const alertMsg =
      `🚨 *PERINGATAN DINI SIAGA TAPTENG & SIBOLGA*\n\n` +
      alerts.join('\n') +
      `\n\nSegera pantau aliran sungai, siapkan tas siaga, dan buka https://siagatapteng.netlify.app`;

    await sendTelegram(token, chatId, alertMsg);
    sentCount++;
  }

  return new Response(`Checked ${POINTS.length} points (WIB ${hourWib}:${minuteWib}), messages sent: ${sentCount}`, {
    status: 200,
  });
}

export const config = {
  schedule: '*/15 * * * *',
};
