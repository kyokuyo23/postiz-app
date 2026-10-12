# Free self-hosting on an Oracle Cloud Always Free VM

Derived from reading `docker-compose.yaml` and `var/docker/nginx.conf`; it has
**not** been run on a live VM. Free-tier limits change, so check Oracle's current
terms first.

## Key finding: one host is enough

The official image runs nginx on port 5000 and serves the frontend at `/` and the
backend at `/api/` (`var/docker/nginx.conf`). Frontend and backend therefore share
one origin, and the `auth` cookie is first-party. **Vercel is not required** for
this setup. Use Vercel only if you specifically want the frontend there (see
`vercel.md`; then `api.` must be a separate host).

## Sizing

Postiz docs: minimum 2 vCPU / 2 GB, 4 GB+ for scheduled workflows. This compose
file also starts Temporal + Elasticsearch + two extra Postgres/Redis instances,
so use the ARM A1 shape (2 OCPU / 12 GB at the time of writing), not the 1 GB
AMD micro shape. "Out of capacity" errors when creating A1 VMs are common; retry
or try another availability domain.

## Steps

1. **VM**: Ubuntu 22.04/24.04 ARM, public IP. In the VCN security list open only
   TCP 22, 80, 443. Do **not** open 7233, 8080, 8969, 4007 (the compose file
   publishes them; Temporal and its UI have no authentication).
2. **Docker**: install Docker Engine + compose plugin.
3. **DNS** (IDwebhost → cPanel Zone Editor or DNS Management): add only an
   `A` record `app` → the VM's public IP. Do not change `@`, `www`, `MX` or the
   nameservers of an existing website.
4. **Get the files**: clone this repo (or copy `docker-compose.yaml` and
   `dynamicconfig/`).
5. **Edit `docker-compose.yaml`** (service `postiz`):

   ```yaml
   MAIN_URL: 'https://app.distributor-yokomitsu.web.id'
   FRONTEND_URL: 'https://app.distributor-yokomitsu.web.id'
   NEXT_PUBLIC_BACKEND_URL: 'https://app.distributor-yokomitsu.web.id/api'
   BACKEND_INTERNAL_URL: 'http://localhost:3000'
   JWT_SECRET: '<output of: openssl rand -hex 32>'
   DISABLE_REGISTRATION: 'false'   # set to 'true' after creating your account
   ```

   Also change the default Postgres password in both `DATABASE_URL` and
   `POSTGRES_PASSWORD`, and remove the `spotlight` service and the `ports:`
   entries for `temporal`, `temporal-ui` and `spotlight`.
6. **HTTPS** (the cookie is `Secure`): add Caddy, which gets a certificate
   automatically. Create `Caddyfile`:

   ```
   app.distributor-yokomitsu.web.id {
     reverse_proxy postiz:5000
   }
   ```

   and add to `docker-compose.yaml`, then change the `postiz` `ports:` entry to
   `expose: ["5000"]`:

   ```yaml
   caddy:
     image: caddy:2
     restart: always
     ports: ["80:80", "443:443"]
     volumes:
       - ./Caddyfile:/etc/caddy/Caddyfile
       - caddy-data:/data
     networks: [postiz-network]
   ```

   plus `caddy-data:` under `volumes:`.
7. **Start**: `docker compose up -d`, then `docker compose logs -f postiz`.
8. **Test**: open `https://app.distributor-yokomitsu.web.id`, register, and check
   DevTools → Application → Cookies: `auth` with Domain
   `.distributor-yokomitsu.web.id`.

## Notes

- Uploads use local storage (`postiz-uploads` volume); back it up or switch to
  Cloudflare R2 (`STORAGE_PROVIDER=cloudflare`).
- The official image does **not** contain the hardening from PR #1; the repo has
  no production Dockerfile in the root, so building from this branch needs one.
- Social logins (Facebook, TikTok, ...) still need each platform's app
  credentials and, for Meta, App Review. Redirect URIs use the same
  `https://app.distributor-yokomitsu.web.id` origin.
- Back up with `docker compose exec postiz-postgres pg_dump`.
