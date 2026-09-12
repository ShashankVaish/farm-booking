# Deploying Baagly to production

Production is two independent halves:

| Half | Runs on | Serves | Deployed by |
| --- | --- | --- | --- |
| Web (Next.js) | Vercel | `https://www.baagly.com` | a push to the production branch |
| API (NestJS) + Postgres + Redis | one Ubuntu server | `https://api.baagly.com` | `git pull` + `docker compose` on that box |

The browser only ever talks to `www.baagly.com`. Next rewrites `/api/*`,
`/uploads/*` and `/health` through to `api.baagly.com` (see
`apps/web/next.config.ts`), which is why sign-in cookies work and why there is
no CORS preflight on normal traffic.

Because the two halves deploy separately, **a release that touches both is not
finished until both have been deployed.** A Vercel deploy alone will call API
endpoints that do not exist yet.

---

## 0. Decide what the release actually needs

Run this against the range you are shipping:

```bash
git diff --stat origin/main..HEAD -- apps/api apps/web deploy apps/api/prisma
```

- Anything under `apps/web/` → **Vercel deploy needed** (step 2).
- Anything under `apps/api/` → **server rebuild needed** (step 3).
- Anything under `apps/api/prisma/migrations/` → the rebuild will apply a schema
  migration. Take a database backup first (step 3a).
- Anything under `deploy/` → the reverse proxy needs reloading by hand
  (step 3e). A container rebuild does **not** reload Nginx or Caddy.

---

## 1. Get the code onto the production branch

Work happens on `feature/frontend`; production builds from `main`.

```bash
# on your machine
cd /g/coding/goo/farm-booking

npm --prefix apps/api run typecheck && npm --prefix apps/api test
npm --prefix apps/web run typecheck && npm --prefix apps/web run lint && npm --prefix apps/web test
npm --prefix apps/web run build        # catches build-only failures Vercel would hit

git push origin feature/frontend
gh pr create --base main --head feature/frontend --title "Release: <what changed>"
gh pr merge --merge                    # or merge it in the GitHub UI
```

Merging into `main` is what triggers Vercel. Confirm which branch Vercel treats
as production under **Project → Settings → Git → Production Branch** if you are
unsure.

---

## 2. Web — Vercel

A merge to `main` starts a production build automatically. Watch it at
**Deployments** in the Vercel dashboard, or:

```bash
vercel ls baagly          # if the Vercel CLI is linked
```

### Environment variables

Set under **Settings → Environment Variables**, scope *Production*:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.baagly.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.baagly.com` |
| `NEXT_PUBLIC_BRAND_NAME` | `Baagly` |

No secrets belong here. Every `NEXT_PUBLIC_*` value is inlined into the browser
bundle by anyone who views the page source.

**`NEXT_PUBLIC_*` is baked in at build time.** Editing one in the dashboard
changes nothing on the live site until you redeploy — use **Deployments → ⋯ →
Redeploy**, with *Use existing build cache* switched **off**.

### Domain

`www.baagly.com` is the primary domain; `baagly.com` redirects to it. In
Cloudflare the apex `A` record must be **DNS only** (grey cloud) — proxying it
puts Cloudflare in front of Vercel's own certificate and the domain fails to
verify.

### Verify

```bash
curl -sI https://www.baagly.com | head -1
curl -s https://www.baagly.com/api/properties?limit=1 | head -c 200   # proxied to the API
```

---

## 3. API — Ubuntu server

SSH in and work from the repo checkout:

```bash
ssh <user>@<server>
cd ~/farm-booking            # wherever the repo lives
git rev-parse --abbrev-ref HEAD    # confirm it is on main
```

### 3a. Back up the database first

Always, but especially when the release adds a migration:

```bash
mkdir -p ~/backups          # redirection does NOT create the directory; without
                            # this the shell fails with "No such file or
                            # directory" and you deploy with no backup at all
docker exec baagly-postgres pg_dump -U baagly baagly \
  | gzip > ~/backups/baagly-$(date +%F-%H%M).sql.gz
ls -lh ~/backups | tail -3  # confirm the file exists and is not 0 bytes
```

Check that `ls` output. `>` opens the destination file *before* `pg_dump` runs,
so a failure appears as a one-line shell error immediately above a screenful of
Docker build output — easy to scroll straight past and assume you are covered.

If anything goes wrong, restore with:

```bash
gunzip -c ~/backups/<file>.sql.gz | docker exec -i baagly-postgres psql -U baagly -d baagly
```

### 3b. Pull the release

```bash
git fetch origin
git status --short          # must be clean; .env.production is gitignored and stays put
git pull origin main
```

### 3c. Check for new environment variables

```bash
diff <(grep -oP '^[A-Z_]+(?==)' .env.production.example | sort) \
     <(grep -oP '^[A-Z_]+(?==)' .env.production | sort)
```

Anything listed only on the left is a new variable this release expects. Add it
with `nano .env.production` before rebuilding — the API validates its config at
boot and will refuse to start rather than run half-configured.

Generate secrets with `openssl rand -hex 32`. Not base64: its `/`, `+` and `=`
have to be escaped inside `DATABASE_URL` and get mangled when pasted through
`nano` or `sed`.

Before rebuilding, check that nothing is still holding a placeholder. These
values ship in the public example file, so a leftover `CHANGE_ME` is a secret
that anyone reading the GitHub repo already knows:

```bash
grep -n 'CHANGE_ME' .env.production        # must print nothing
```

If `POSTGRES_PASSWORD` contains any of `@ : / ? # [ ] %`, it must be
percent-encoded where it appears inside `DATABASE_URL` — `@` becomes `%40`.
Unencoded it still tends to work, because most URL parsers split on the *last*
`@` in the authority, but that is luck rather than a rule and it breaks the
moment the password gains a second special character.

### 3d. Rebuild and restart

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=80 api
```

What you should see in the logs, in order:

```
[entrypoint] waiting for the database at postgresql://baagly:****@postgres:5432/baagly
[entrypoint] database is up. Applying migrations…
No pending migrations to apply.          # or the list of migrations applied
[entrypoint] starting the API.
... "Nest application successfully started"
... MailService: "SMTP ready as in***@baagly.com."
```

Ctrl-C stops tailing the log; it does not stop the container.

Uploads live on the `uploads_data` named volume and Postgres on
`postgres_data`, so `--build` and `up -d` do not touch either. Never pass
`-v` to `docker compose down` on this server: it deletes both.

### 3e. Reload the reverse proxy — only if `deploy/` changed

The proxy config is not inside a container, so nothing you do with Docker
reloads it. Whichever one you run:

```bash
# Nginx
sudo cp deploy/nginx/api.baagly.com.conf /etc/nginx/sites-available/api.baagly.com
sudo nginx -t && sudo systemctl reload nginx

# Caddy
sudo cp deploy/caddy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Run only one of them. Both want ports 80 and 443, and having both installed is
what breaks certbot: Caddy answers the ACME challenge and Nginx never sees it.

### 3f. Verify

Run these from your own machine, not the server — they test the whole path
including DNS, TLS and the proxy.

```bash
curl -s https://api.baagly.com/health
curl -s 'https://api.baagly.com/api/properties?limit=1' | head -c 200
```

**Is the new API code actually live?** Ask for a route that only exists in the
new build. `401` means the route is there and merely wants a token; `404` means
you are still on the old image:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.baagly.com/api/owner/become-host
```

**Did the proxy really reload?** Push a body bigger than Nginx's 1 MB default.
`413` is Nginx rejecting it; anything else means the request reached the API:

```bash
head -c 20000000 /dev/urandom > /tmp/blob.bin
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.baagly.com/api/media/upload -F 'file=@/tmp/blob.bin'
rm /tmp/blob.bin
```

**Is the OAuth redirect URI right?** Read it out of the real redirect rather
than trusting the file — this is the setting that silently breaks sign-in:

```bash
curl -s -D - -o /dev/null 'https://www.baagly.com/api/auth/google' \
  | grep -i '^location' | grep -o 'redirect_uri=[^&]*'
```

It must decode to `https://www.baagly.com/...`, never `api.baagly.com`.

**Is the new web build live?** Check for a marker that changed in the release
rather than eyeballing the page — Vercel serving a stale build looks identical:

```bash
curl -s https://www.baagly.com/auth/login | grep -c 'register?role=OWNER'   # 0 = new build
```

---

## 4. Smoke test the live site

In a real browser, signed out, then signed in:

1. `https://www.baagly.com` lists properties, and so does `/explore`.
2. Clicking anywhere on a property card — photo, title, price row — opens the
   listing.
3. On a phone, scroll below the gallery on a property page and wait ten
   seconds: the slideshow advances without dragging the page back up.
4. Sign in with Google from a brand-new Google account; it creates the account
   and lands on the dashboard.
5. From a guest account open `/host` → **Become a host** → the host dashboard
   opens in place, and `/dashboard` still shows that account's trips and
   wishlist.
6. Start a listing, upload one photo (there is no four-photo minimum), and try a
   photo between 8 MB and 25 MB — it must upload rather than fail with a 413.

---

## Rolling back

**Web.** Vercel keeps every build. **Deployments → pick the last good one → ⋯ →
Promote to Production.** Instant, no rebuild.

**API.**

```bash
git log --oneline -5
git checkout <last-good-sha>
docker compose -f docker-compose.prod.yml up -d --build
```

A migration is not undone by checking out an older commit. If the bad release
migrated the schema, restore the dump from step 3a instead.

---

## Payments — PayU

The API takes payments through PayU's hosted checkout. The guest's browser is
sent to PayU with a signed form, pays there, and is posted back to the site.

### Server configuration (`.env.production`)

| Name | Value |
| --- | --- |
| `PAYU_KEY` | Merchant key from the PayU dashboard |
| `PAYU_SALT` | Merchant salt from the PayU dashboard — a secret, treat it like a password |
| `PAYU_MODE` | `test` until PayU approves the account, then `live` |

The Razorpay variables are gone; delete them from `.env.production` if they
are still there. The API logs redact `PAYU_KEY` and `PAYU_SALT`.

### PayU dashboard configuration

PayU has to be told where to send the guest back. Set **all three** of these to
the same URL:

```
https://www.baagly.com/api/payments/return
```

- **Success URL** (surl)
- **Failure URL** (furl)
- **Webhook / server-to-server callback**, if you enable one

That URL is the site's own host, not `api.baagly.com`: the guest lands on the
same origin their session lives on, and the site proxies `/api/*` to the API.
Both the browser return and the webhook are hash-verified and then re-checked
against PayU's own API before a booking is confirmed — a posted "success"
proves nothing on its own.

### Verify

```bash
# the return route answers with a redirect, not an error, even for junk
curl -s -o /dev/null -w '%{http_code} %{redirect_url}
' -X POST https://api.baagly.com/api/payments/return -d 'x=1'
# expected: 302 https://www.baagly.com/dashboard/trips?payment=unknown
```

Then make a real test-mode payment from the site and confirm the booking flips
to confirmed and the confirmation email arrives.

---

## Still outstanding

These are known gaps, not steps in the release:

- `GOOGLE_OAUTH_REDIRECT_URI` must be
  `https://www.baagly.com/api/auth/google/callback` in `.env.production` **and**
  registered under that exact string in the Google Cloud console. It is
  deliberately the site host, not the API host: sign-in starts at
  `www.baagly.com/api/auth/google`, so the state cookie belongs to
  `www.baagly.com`.
- `SMS_PROVIDER` is `console`, so mobile OTP codes are only written to the log.
  Set it to `renflair` with a funded `RENFLAIR_API_KEY` before relying on it.
- Uploads exist on one server's disk with no off-box copy. A lost disk loses
  every property photo. Move them to S3/R2, or at minimum rsync
  `uploads_data` off the machine on a schedule.
- The `pg_dump` in step 3a is manual. It should be a nightly cron job.
