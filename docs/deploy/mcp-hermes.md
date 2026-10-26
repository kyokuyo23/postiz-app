# Hubungkan Hermes Agent ke Postiz (MCP)

Postiz punya server MCP bawaan di backend:

```
https://api.distributor-yokomitsu.web.id/api/mcp
```

Login memakai **API key** organisasi (Postiz → Settings → Public API).
Halaman itu juga menampilkan config siap-copy untuk "Hermes Agent".

## Config Hermes

`~/.hermes/config.yaml`:

```yaml
mcp_servers:
  postiz:
    url: "https://api.distributor-yokomitsu.web.id/api/mcp"
    headers:
      Authorization: "Bearer <API_KEY_POSTIZ>"
```

Cek: `hermes mcp test postiz`, lalu `hermes chat` (atau `/reload-mcp` di sesi
yang sedang jalan). Tool muncul dengan awalan `mcp_postiz_`.

## Tool yang tersedia

Posting:
- `integrationList`, `groupList`: daftar channel
- `integrationSchema` / validation, `triggerTool`: aturan & data per platform
- `schedulePostTool`: buat / jadwalkan posting
- `uploadFromUrl`: upload media dari URL

Engagement (inbox komentar & otomasi):
- `engagementChannels`: channel yang mendukung inbox + status sync
- `commentsList`: daftar komentar (filter status/channel/cari)
- `commentReply`: balas komentar (publik di platform)
- `commentSetStatus`: tandai RESOLVED / IGNORED / PENDING
- `commentHide`: sembunyikan / tampilkan komentar
- `commentsSyncNow`: ambil komentar baru sekarang
- `automationsList`, `automationSetActive`: lihat / nyalakan-matikan aturan

Tool generate gambar/video butuh kunci AI tambahan dan tidak aktif secara default.

## Keamanan

API key memberi akses penuh ke organisasi (termasuk posting dan membalas
komentar). Simpan hanya di config Hermes, jangan di Git atau chat. Kalau bocor,
buat ulang di Settings → Public API.
