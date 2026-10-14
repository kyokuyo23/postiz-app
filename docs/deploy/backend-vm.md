# Backend di VM (frontend di Vercel)

Panduan ini menjalankan backend Postiz (API + orchestrator), PostgreSQL, Redis,
Temporal dan Caddy (HTTPS otomatis) di satu VM, misalnya Oracle Cloud Always Free
(ARM, Ubuntu). Frontend tetap di Vercel.

Disusun dari isi repo; belum dijalankan di VM sungguhan.

## 0. Yang dibutuhkan

- VM Ubuntu 22.04/24.04 dengan IP publik, minimal 4 GB RAM (build butuh ~4 GB).
- Port 22, 80, 443 terbuka di firewall/security list. Port lain jangan dibuka.
- Akses DNS domain (IDwebhost → cPanel → Zone Editor).

## 1. DNS

Tambah record **A**: Name `api` → IP publik VM. Jangan ubah record lain.

## 2. Install Docker (di VM)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

## 3. Ambil kode & build image

```bash
git clone https://github.com/kyokuyo23/postiz-app.git
cd postiz-app
docker build -f Dockerfile.dev -t postiz-socialflow:local .
```

Build memakan waktu lama (bisa 20–40 menit di 2 OCPU).

## 4. Isi konfigurasi

```bash
cp backend.env.example backend.env
nano backend.env
```

- Isi `JWT_SECRET`, `POSTGRES_PASSWORD`, `TEMPORAL_DB_PASSWORD` dengan hasil
  `openssl rand -hex 32` (berbeda-beda).
- Domain sudah terisi untuk `distributor-yokomitsu.web.id`.
- Isi `YOUTUBE_CLIENT_ID/SECRET` dan/atau `THREADS_APP_ID/SECRET` bila ingin
  menghubungkan channel. Redirect URI di Google/Meta:
  `https://app.distributor-yokomitsu.web.id/integrations/social/youtube` dan
  `.../integrations/social/threads`.

## 5. Jalankan

```bash
docker compose -f docker-compose.backend.yaml --env-file backend.env up -d
docker compose -f docker-compose.backend.yaml logs -f postiz
```

Cek: `https://api.distributor-yokomitsu.web.id/api/` harus merespons (bukan error
sertifikat).

## 6. Vercel

Di project frontend tambahkan env `UPLOADS_PROXY_URL=https://api.distributor-yokomitsu.web.id/uploads`
lalu Redeploy, agar gambar/video yang di-upload tampil.

## 7. Tes

Buka `https://app.distributor-yokomitsu.web.id`, daftar akun, lalu set
`DISABLE_REGISTRATION=true` di `backend.env` dan jalankan ulang langkah 5.
Cookie `auth` harus ber-Domain `.distributor-yokomitsu.web.id`.

## Update versi

```bash
cd postiz-app && git pull
docker build -f Dockerfile.dev -t postiz-socialflow:local .
docker compose -f docker-compose.backend.yaml --env-file backend.env up -d
```

Setiap start, container menjalankan `prisma db push` (perilaku bawaan Postiz).
Backup dulu: `docker exec postiz-postgres pg_dump -U postiz-user postiz-db > backup.sql`.
