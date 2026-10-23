# Kredensial platform sosial

Setiap platform butuh "aplikasi developer" milikmu sendiri. Buat di dashboard
platform, isi **Redirect URI** di bawah persis sama, lalu simpan Client ID /
Secret ke VPS dengan:

```
curl -fsSL https://raw.githubusercontent.com/kyokuyo23/postiz-app/main/var/docker/set-credentials.sh | sudo bash
```

Script menanyakan tiap platform (Enter = lewati), menyimpan ke `backend.env`
tanpa menampilkan secret, lalu me-restart backend.

Domain aplikasi: `https://app.distributor-yokomitsu.web.id`

| Platform | Dashboard developer | Redirect URI | Variabel |
|---|---|---|---|
| YouTube | console.cloud.google.com (YouTube Data API v3 + YouTube Analytics API) | `/integrations/social/youtube` | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` |
| Threads | developers.facebook.com (use case Threads API) | `/integrations/social/threads` | `THREADS_APP_ID`, `THREADS_APP_SECRET` |
| Facebook Page | developers.facebook.com (Facebook Login for Business) | `/integrations/social/facebook` | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` |
| Instagram via Facebook | sama dengan Facebook | `/integrations/social/instagram` | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` |
| Instagram (login Instagram) | developers.facebook.com (Instagram API with Instagram Login) | `/integrations/social/instagram-standalone` | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` |
| TikTok | developers.tiktok.com (Login Kit + Content Posting API) | `/integrations/social/tiktok` | `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET` |
| LinkedIn | linkedin.com/developers | `/integrations/social/linkedin` dan `/integrations/social/linkedin-page` | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| X (Twitter) | developer.x.com | `/integrations/social/x` | `X_API_KEY`, `X_API_SECRET` |
| Pinterest | developers.pinterest.com | `/integrations/social/pinterest` | `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` |

Redirect URI lengkap = domain aplikasi + path, mis.
`https://app.distributor-yokomitsu.web.id/integrations/social/threads`.

## Catatan

- Selama aplikasi developer masih mode test/development, hanya akun yang
  didaftarkan sebagai tester di dashboard platform yang bisa connect.
  Publik butuh review dari platform (Google verification, Meta App Review,
  TikTok app review, dll.).
- Inbox komentar & otomasi saat ini mendukung **YouTube** dan **Threads**.
  Threads butuh `THREADS_COMMENT_INBOX=true` di `backend.env` (setelah izin
  `threads_read_replies` aktif di aplikasi Meta). Platform lain: posting saja.
- Jangan pernah mengirim Client Secret lewat chat atau menyimpannya di Git.
