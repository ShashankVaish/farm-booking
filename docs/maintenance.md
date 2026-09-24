# Server maintenance

How to keep the production API server healthy and fast: health and speed
checks, a safe reboot, freeing disk, adding swap, and what to do when
something is slow. Deploying a new release is covered in
[deployment.md](deployment.md).

## What runs where

| Part | Where | Effect if the server is down |
| --- | --- | --- |
| Website (Next.js) | Vercel | Pages still load |
| API, Postgres, Redis | The VPS (`vps-j2am`, Ubuntu 24.04, 1 vCPU, 2 GB RAM, 20 GB SSD) | Login, search results, bookings and payments stop working |
| Reverse proxy (Caddy **or** Nginx, not both) | The VPS, as a system service | Same as above |

All three containers are set to `restart: always` in
[docker-compose.prod.yml](../docker-compose.prod.yml), so they come back on
their own after a reboot, as long as Docker itself starts at boot.

Connect to the server:

```bash
ssh root@148.113.8.216 -p 20028
cd ~/farm-booking            # wherever the repo lives on the server
```

Every `docker compose` command below is run from that directory.

> **Never run** `docker volume prune`, `docker system prune --volumes`, or
> `docker compose down -v`. They delete the `postgres_data` and `uploads_data`
> volumes, which hold the database and every uploaded photo.

---

## 1. Health check

Run this weekly, and whenever something feels wrong.

```bash
docker compose -f docker-compose.prod.yml ps        # all three "Up", postgres/redis "(healthy)"
curl -s https://api.baagly.com/health               # the API answers
df -h /                                             # disk use; keep "Use%" under 80%
free -h                                             # memory and swap
uptime                                              # load average; above 1.0 on 1 vCPU means it is busy
docker stats --no-stream                            # CPU and memory per container
```

What healthy looks like:

| Check | Healthy | Act when |
| --- | --- | --- |
| Disk (`df -h /`) | under 70% | over 80%: run [section 4](#4-free-disk-space) |
| Memory (`free -h`, "used") | under 1.5 GB | stays above 1.7 GB: see [section 7](#7-when-to-upgrade-the-plan) |
| Swap | exists (2 GB) | missing: run [section 5](#5-add-swap-memory) |
| Load (`uptime`) | under 1.0 | above 1.0 for long periods |
| API memory (`docker stats`) | under 400 MB | growing steadily each day (possible leak; restart the API and report it) |

## 2. Measure speed

Run these from **your own computer**, not the server, so the numbers include
the real network path a guest sees.

```bash
# API alone
curl -s -o /dev/null -w 'API    connect %{time_connect}s  first byte %{time_starttransfer}s  total %{time_total}s\n' https://api.baagly.com/health

# A real API query (search)
curl -s -o /dev/null -w 'Search total %{time_total}s\n' 'https://api.baagly.com/api/search?limit=6'

# The website's homepage (rendered on Vercel, calls the API)
curl -s -o /dev/null -w 'Site   first byte %{time_starttransfer}s  total %{time_total}s\n' https://www.baagly.com/
```

Run each three times and look at the middle value; the first call is often
slower.

How to read the results:

| Result | Meaning | Fix |
| --- | --- | --- |
| API under 0.3 s, site over 1 s | The server is fine; the delay is between Vercel and the API | [Section 6](#6-vercel-function-region) |
| API `connect` over 0.2 s | Network path to the server is slow | Check the provider's status page; nothing to fix in code |
| Search over 1 s but `/health` fast | The database query is slow | Check `docker stats`; send the numbers to a developer |
| Everything slow, `uptime` load above 1 | The server is overloaded | Restart the API ([section 3](#3-restart-and-reboot)); if it keeps happening, [section 7](#7-when-to-upgrade-the-plan) |

Record the numbers in the log at the bottom of this file, so a change over
time is visible.

## 3. Restart and reboot

### Restart just the API (no downtime for the database)

The quickest fix for an API that is slow or stuck. Takes about 20 seconds.

```bash
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml logs --tail=40 api     # look for "Nest application successfully started"
```

### Reboot the whole server

Needed after Ubuntu kernel updates (the server prints
`*** System restart required ***` on login), or when the whole machine is
unresponsive. The API is down for 1–2 minutes. Pick a quiet time, not while a
guest might be paying; PhonePe retries any webhook it could not deliver, so no
payment is lost either way.

**Before rebooting:**

```bash
systemctl is-enabled docker                          # must print: enabled
systemctl is-enabled caddy 2>/dev/null; systemctl is-enabled nginx 2>/dev/null
                                                     # the proxy you use must print: enabled
docker compose -f docker-compose.prod.yml ps         # note what is running now
```

If Docker is not `enabled`, run `sudo systemctl enable docker` first, or the
containers will not start after the reboot. It is also worth checking that
the dashboard's **Backups** panel shows a snapshot from today.

**Reboot** with the dashboard's **Reboot** button, or:

```bash
sudo reboot
```

**After 1–2 minutes**, reconnect and check:

```bash
docker compose -f docker-compose.prod.yml ps         # all three "Up"
curl -s https://api.baagly.com/health
```

If a container is missing, start the stack again (this does not rebuild or
touch data):

```bash
docker compose -f docker-compose.prod.yml up -d
```

## 4. Free disk space

Docker keeps every old image and its build cache from past deploys. On a
20 GB disk that fills up within a few months, and **when the disk is full
Postgres stops and the site goes down.** Run this monthly, and whenever disk
use passes 80%.

```bash
df -h /                                  # before
docker system df                         # what Docker is using

docker builder prune -f                  # build cache: safe, usually the biggest win
docker image prune -a -f                 # images no running container uses: safe
docker container prune -f                # stopped containers: safe

sudo journalctl --vacuum-size=200M       # old system logs
sudo apt-get autoremove -y && sudo apt-get clean   # old packages and download cache

df -h /                                  # after
```

Stop Docker's own container logs from growing forever: create
`/etc/docker/daemon.json` with the content below (if the file already exists,
add the two keys to it instead), then restart Docker. This restarts the
containers, so do it at a quiet time.

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "3" }
}
```

```bash
sudo systemctl restart docker
docker compose -f docker-compose.prod.yml up -d      # recreate containers so they pick up the log limit
```

## 5. Add swap memory

With 2 GB of RAM, a deploy (`docker compose up --build`) can run out of
memory, and Linux then kills a process, sometimes Postgres. Swap is a safety
net that lets the server slow down instead of crash. Set it up once.

```bash
swapon --show                            # prints nothing if there is no swap yet

sudo fallocate -l 2G /swapfile           # use 1G if the disk is tight
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab     # keep it after reboot

# Use swap only when RAM is really full, not before
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
sudo sysctl -p /etc/sysctl.d/99-swappiness.conf

free -h                                  # "Swap:" now shows 2.0Gi
```

## 6. Vercel function region

The website's pages are rendered on Vercel and fetch their data from the API.
Vercel runs that code in Washington, USA by default, while the API server is
in India, so every page waits on round trips across the world. This is usually
the single biggest speed gain, and it needs no server change:

1. Vercel → the project → **Settings → Functions → Function Region**.
2. Choose **Mumbai, India (bom1)** and save.
3. Redeploy (Deployments → latest → **Redeploy**).
4. Re-run the site timing from [section 2](#2-measure-speed) and compare.

## 7. When to upgrade the plan

At a few percent CPU, a bigger server will not make the site faster. Upgrade
to **2 vCPU / 4 GB RAM** when one of these keeps happening:

- memory "used" stays above 1.7 GB even after restarting the API;
- `uptime` load stays above 1.0 during normal traffic;
- deploys fail or take more than 10 minutes to build.

The "Dedicated IPv4" add-on changes the address and SSH port only; it does not
make the site faster.

## 8. Keep Ubuntu updated

Monthly, at a quiet time:

```bash
sudo apt-get update && sudo apt-get upgrade -y
ls /var/run/reboot-required 2>/dev/null && echo "Reboot needed"   # then follow section 3
```

## 9. Logs, when something is wrong

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 api        # recent API output
docker compose -f docker-compose.prod.yml logs -f api                # follow live; Ctrl-C to stop watching
docker compose -f docker-compose.prod.yml logs --tail=100 postgres
docker compose -f docker-compose.prod.yml logs api | grep -i phonepe # payment gateway messages
sudo journalctl -u caddy --since "1 hour ago"                        # or: -u nginx
```

### Email and WhatsApp queue

Emails and WhatsApp messages are not sent while the user waits. The request
puts a job in Redis (BullMQ queue `delivery`) and a worker inside the API
container sends it. A failed email is retried 5 times (after 15 s, 30 s,
1 min, 2 min); after that it stays in the failed list. If Redis is down, the
API sends in-process instead, without retries, so users never notice.

```bash
# on startup the API should log: "Delivery queue ready on Redis (worker running)."
docker compose -f docker-compose.prod.yml logs api | grep -i "delivery"

# how many are waiting, being sent, waiting to retry, and given up
docker exec baagly-redis redis-cli llen bull:delivery:wait
docker exec baagly-redis redis-cli llen bull:delivery:active
docker exec baagly-redis redis-cli zcard bull:delivery:delayed
docker exec baagly-redis redis-cli zcard bull:delivery:failed
```

A growing `wait` count means the worker is not running or cannot keep up.
Restart the API. A growing `failed` count means the SMTP server is refusing
mail: look for `failed (attempt 5/5), giving up` in the API log for the reason.

## 10. Backups

The hosting provider's **Backups** add-on takes a daily snapshot of the whole
server, visible on the VPS dashboard. **Restore** replaces the entire server
with that snapshot: everything after it (bookings, payments, sign-ups) is
lost. Use it only for a broken server, never to undo a single mistake.

For a database-only copy before risky work:

```bash
docker exec baagly-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > ~/baagly-$(date +%F).dump
ls -lh ~/baagly-*.dump
```

Copy the file off the server (from your own computer:
`scp -P 20028 root@148.113.8.216:~/baagly-*.dump .`), and delete old dumps
from the server so they do not fill the disk.

---

## Maintenance checklist

| How often | Task | Section |
| --- | --- | --- |
| Weekly | Health check | [1](#1-health-check) |
| Weekly | Speed check, write the numbers in the log below | [2](#2-measure-speed) |
| Monthly | Free disk space | [4](#4-free-disk-space) |
| Monthly | Ubuntu updates, reboot if required | [8](#8-keep-ubuntu-updated), [3](#3-restart-and-reboot) |
| Once | Add swap | [5](#5-add-swap-memory) |
| Once | Docker log size limit | [4](#4-free-disk-space) |
| Once | Vercel function region set to Mumbai | [6](#6-vercel-function-region) |

## Speed log

| Date | API `/health` total | Search total | Site first byte | Disk use | Notes |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
