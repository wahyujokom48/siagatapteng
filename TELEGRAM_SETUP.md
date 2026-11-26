# Cara Mengaktifkan Bot Telegram Peringatan Dini 24/7 (Gratis di Netlify)

Aplikasi ini sudah dilengkapi **Netlify Scheduled Function** (`netlify/functions/telegram-alert.mjs`) yang otomatis mengecek cuaca hulu Sitahuis, Tukka, Pandan, Sibolga, dan tekanan laut Barat Nias **setiap 15 menit 24 jam penuh** meski browser Anda ditutup.

## 3 Langkah Aktivasi
1. **Buat Bot di Telegram**:
   - Buka Telegram, cari **`@BotFather`**, kirim pesan `/newbot`.
   - Ikuti petunjuknya, lalu salin **HTTP API Token** yang diberikan (contoh: `123456:ABC-DEF...`).
2. **Dapatkan Chat ID Anda / Grup Keluarga**:
   - Mulai chat dengan bot baru Anda (klik *Start*), atau masukkan bot ke grup keluarga.
   - Cari **`@userinfobot`** di Telegram (atau buka `https://api.telegram.org/bot<TOKEN_ANDA>/getUpdates` di browser) untuk melihat angka **Chat ID** Anda.
3. **Masukkan ke Netlify**:
   - Buka dashboard site Anda di **Netlify → Site configuration → Environment variables**.
   - Tambahkan 2 variabel:
     - `TELEGRAM_BOT_TOKEN` = *(token dari BotFather)*
     - `TELEGRAM_CHAT_ID` = *(angka Chat ID Anda/grup)*
   - Klik **Trigger deploy** di menu Deploys. Selesai! Bot akan otomatis mengirim peringatan ke Telegram begitu ada status `SIAGA`/`AWAS` atau tekanan rendah siklon.
