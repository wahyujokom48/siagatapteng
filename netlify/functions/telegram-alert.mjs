// Netlify Scheduled Function: berjalan otomatis setiap 15 menit 24/7
// Mengirim peringatan dini ke Telegram jika terdeteksi status SIAGA/AWAS di Tapteng-Sibolga atau Bibit Siklon Barat Nias

const POINTS = [
  { name: 'Sitahuis (Hulu)', lat: 1.805, lon: 98.825 },
  { name: 'Tukka (Hulu)', lat: 1.72, lon: 98.87 },
  { name: 'Pandan', lat: 1.6908, lon: 98.8286 },
  { name: 'Sibolga Kota', lat: 1.7395, lon: 98.785 },
  { name: 'Samudra Hindia Barat Nias', lat: 1.1, lon: 96.8, isOcean: true },
];

export default async function handler() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diatur di Netlify Environment Variables.');
    return new Response('Telegram env vars not configured', { status: 200 });
  }

  const alerts = [];

  for (const pt of POINTS) {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${pt.lat}&longitude=${pt.lon}` +
        `&current=rain,pressure_msl,wind_gusts_10m&hourly=rain&timezone=Asia%2FJakarta&forecast_days=1`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      const rainNow = Number(data.current?.rain ?? 0);
      const pressure = Number(data.current?.pressure_msl ?? 1010);
      const gusts = Number(data.current?.wind_gusts_10m ?? 0);
      const next6h = (data.hourly?.rain ?? []).slice(0, 6).reduce((a, b) => a + Number(b ?? 0), 0);

      if (pt.isOcean) {
        if (pressure <= 1005 || gusts >= 45) {
          alerts.push(
            `🌀 *SIKLON/BADAI LAUT (${pt.name})*: Tekanan ${pressure.toFixed(0)} hPa, Hembusan ${gusts.toFixed(0)} km/j`
          );
        }
      } else if (rainNow >= 10 || next6h >= 35) {
        const level = rainNow >= 20 || next6h >= 60 ? 'AWAS' : 'SIAGA';
        alerts.push(
          `🌧️ *${level} — ${pt.name}*: Hujan saat ini ${rainNow.toFixed(1)} mm/j, Akumulasi 6 jam ${next6h.toFixed(1)} mm`
        );
      }
    } catch {
      // Lanjut ke titik berikutnya
    }
  }

  if (alerts.length > 0) {
    const message =
      `🚨 *PERINGATAN DINI SIAGA TAPTENG & SIBOLGA*\n\n` +
      alerts.join('\n') +
      `\n\nSegera pantau aliran sungai, siapkan tas siaga, dan cek dashboard Siaga Tapteng.`;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  }

  return new Response(`Checked ${POINTS.length} points, alerts sent: ${alerts.length}`, { status: 200 });
}

export const config = {
  schedule: '*/15 * * * *',
};
