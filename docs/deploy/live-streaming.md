# Live streaming (multistream)

Menu **Live** di Postiz punya dua mode:

| Mode | Cara kerja | Tujuan |
|---|---|---|
| **Live dari OBS / HP** | OBS/Larix/Prism → MediaMTX di VPS → diteruskan tanpa re-encode | YouTube, Facebook Page, TikTok, RTMP lain |
| **Video jadi live** | Video dari Media Library diputar real-time (bisa loop sampai durasi tertentu) | YouTube, Facebook Page, RTMP lain (**bukan TikTok**: TikTok melarang konten rekaman di LIVE) |

- **YouTube**: lewat YouTube Data API (liveBroadcasts). Channel harus sudah bisa live (YouTube Studio → Go live; aktivasi pertama butuh hingga 24 jam). Broadcast dibuat saat live dijadwalkan, jadi muncul sebagai "Upcoming" di channel.
- **Facebook Page**: lewat Graph API `live_videos`. Butuh izin `publish_video`.
- **TikTok**: tidak ada API live publik. Ambil server URL + stream key dari TikTok LIVE Studio / LIVE Center (hanya akun yang memenuhi syarat LIVE) dan tambahkan sebagai tujuan "+ TikTok".
- Instagram (Live Producer), Shopee Live dan layanan lain yang memberi RTMP URL + key: tambahkan sebagai "+ RTMP lain".

## Aktifkan di VPS

```bash
cd /opt/postiz-app && sudo git pull
# 1. secret internal (dibuat di VPS, tidak perlu ditempel ke mana pun)
grep -q '^LIVE_RELAY_SECRET=' backend.env || echo "LIVE_RELAY_SECRET=$(openssl rand -hex 24)" | sudo tee -a backend.env >/dev/null
# 2. (opsional) live ke Facebook Page — setelah izin publish_video ditambahkan di Meta app
grep -q '^FACEBOOK_LIVE=' backend.env || echo 'FACEBOOK_LIVE=true' | sudo tee -a backend.env >/dev/null
# 3. rebuild backend + jalankan MediaMTX
sudo docker build -f Dockerfile.backend -t postiz-backend:local .
sudo docker compose -f docker-compose.vps-small.yaml --env-file backend.env --profile live up -d --force-recreate postiz mediamtx
```

4. Buka port **TCP 1935** di firewall/security group VPS (panel SumoPod; kalau pakai ufw: `sudo ufw allow 1935/tcp`).
5. Facebook: di Meta app tambahkan izin **publish_video** (use case Pages), lalu **Reconnect** setiap Facebook Page di Postiz.

Server untuk OBS otomatis `rtmp://<domain API>:1935/live`. Kalau domain API lewat proxy (mis. Cloudflare oranye), RTMP tidak lewat: set `LIVE_RTMP_PUBLIC_URL=rtmp://<IP VPS>:1935/live` di backend.env.

## Cara cepat

- **● Live sekarang**: judul dan channel otomatis diisi dari live terakhir, langsung dapat server URL + stream key.
- **Cek kesiapan** (muncul di form): server live, YouTube (channel sudah bisa live?), Facebook (izin publish_video, minimal 100 pengikut). ✅ siap, ⚠️ mungkin ditolak, ❌ perlu diperbaiki.
- **Tujuan tersimpan**: centang "Simpan" di baris Shopee Live / TikTok / RTMP lain. Nama + server URL disimpan, stream key tidak (berganti tiap sesi), jadi lain kali cukup klik "+ Shopee Live" dan tempel key baru.

## Setelan OBS

Settings → Stream → Service **Custom**: Server dan Stream key dari kartu live di Postiz.
Settings → Output: H.264, bitrate 2500–4000 kbps, **keyframe interval 2 s**, audio AAC 128 kbps.
Upload VPS perlu ± bitrate × jumlah tujuan (mis. 3 tujuan × 3 Mbps ≈ 9 Mbps).

## Batasan

- Maks. 3 live aktif/terjadwal per workspace, maks. 5 tujuan per live.
- Mode video di-encode ulang (≈1 core di VPS 2 vCPU), jadi hanya 1 live video berjalan bersamaan (`LIVE_MAX_VIDEO`).
- Stream putus > 3 menit → live diakhiri di semua platform. Tidak ada stream masuk 3 jam setelah jadwal → dibatalkan.
- Loop video panjang yang berulang bisa dianggap konten repetitif oleh YouTube/Facebook; gunakan seperlunya.

## Auto-reply komentar live

Centang **Auto-reply komentar live** saat menjadwalkan. Postiz membaca chat YouTube Live dan komentar Facebook Live, lalu membalas dengan aturan dari menu **Automation** (kata kunci → balasan, `{name}` diganti nama penonton). Aturan juga bisa dibatasi per channel.

- Komentar yang sudah ada sebelum auto-reply mulai tidak dibalas.
- Aturan "semua komentar" (every) tidak dipakai di live, supaya chat tidak kebanjiran.
- Maks. 1 balasan per penonton per 5 menit, jeda minimal 20 detik, 60 balasan per live.
- YouTube dicek tiap ≥15 detik (kuota YouTube Data API ±1.200 unit/jam live), Facebook tiap 10 detik.
- TikTok tidak punya API komentar LIVE.
