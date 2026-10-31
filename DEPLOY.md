# Deploying Freeleads on a Hostinger VPS (SSH)

Freeleads is a Node.js server, so it runs on the **VPS**, not on shared web hosting. One script does the
whole setup: Node.js 22, a locked-down system service, Nginx, a free HTTPS certificate and daily database
backups.

```
Browser ──HTTPS──▶ Nginx :443 ──▶ Freeleads (Node.js 22) on 127.0.0.1:3000 ──▶ SQLite /var/lib/freeleads
                   (Let's Encrypt)    systemd service "freeleads", user "freeleads"
```

It is built to live **next to other sites on the same VPS** (for example Autosensia). It never replaces
the system Node.js, another Nginx site or another app's port: Freeleads gets its own Node.js
(`/opt/freeleads-node`), its own user, the first free port from 3000, and its own Nginx site.

## 1. Point the domain at the VPS (hPanel)

1. hPanel → **VPS** → your server: note its **IPv4 address**.
2. hPanel → **Domains** → your domain → **DNS / Nameservers**:
   - `A` record, name `@` → the VPS IPv4 (or name `app` for a subdomain such as `app.example.com`).
   - Optional: `A` record, name `www` → the same IPv4 (then add `--www` below).
   - Delete any other `A`/`AAAA` record with the same name that points somewhere else.
3. Wait until `ping your-domain` answers with the VPS IP (a few minutes, sometimes up to a few hours).

If the VPS uses Hostinger's panel **Firewall**, allow TCP ports **22, 80 and 443**.

## 2. Run the setup over SSH

```bash
ssh root@YOUR_VPS_IP

curl -fsSL https://raw.githubusercontent.com/elking47/Freeleads/main/deploy/setup-vps.sh -o setup-vps.sh
sudo bash setup-vps.sh --domain your-domain.com --www --email you@example.com
```

Options: `--www` (also serve `www.`), `--branch NAME` (default `main`), `--port N` (default: first free
port from 3000), `--skip-tls` (set up HTTPS later). Run `bash setup-vps.sh --help` for details.

At the end it prints `Freeleads is live at: https://your-domain.com`. If DNS was not ready yet, the site
is up over HTTP and the script tells you what to fix; re-run the same command once DNS points at the VPS.
**Logins only work over HTTPS** (secure cookies), so make sure that step succeeds.

The script can be re-run at any time: it keeps the existing secret, port and database.

## 3. Deploy updates

Push your changes to GitHub (`main`), then on the VPS:

```bash
sudo freeleads-update
```

It backs up the database, pulls the code, runs `npm ci`, restarts the app and checks that it answers. If
the app doesn't come back up, it prints the rollback command.

## Day-to-day

| Task | Command |
|---|---|
| Status | `sudo systemctl status freeleads` |
| Live log | `sudo journalctl -u freeleads -f` |
| Restart | `sudo systemctl restart freeleads` |
| Change settings (delivery hour, timezone…) | `sudo nano /etc/freeleads/freeleads.env` then restart |
| Back up now | `sudo bash /opt/freeleads/deploy/backup.sh` |
| Restore a backup | `sudo systemctl stop freeleads`, then `gunzip -c /var/backups/freeleads/freeleads-DATE.db.gz \| sudo tee /var/lib/freeleads/freeleads.db >/dev/null`, `sudo rm -f /var/lib/freeleads/freeleads.db-wal /var/lib/freeleads/freeleads.db-shm`, `sudo chown freeleads: /var/lib/freeleads/freeleads.db`, `sudo systemctl start freeleads` |
| HTTPS renewal | Automatic (Certbot timer). Test: `sudo certbot renew --dry-run` |

## Where things are

| Path | Contents |
|---|---|
| `/opt/freeleads` | Code (owned by root, read-only for the app) |
| `/opt/freeleads-node` | Node.js 22 used only by Freeleads (checksum-verified from nodejs.org) |
| `/etc/freeleads/freeleads.env` | Production settings, including the generated `SESSION_SECRET` (root only) |
| `/var/lib/freeleads/freeleads.db` | Database (the only folder the app can write to) |
| `/var/backups/freeleads/` | Daily backups at 03:15, 14 days kept. Copy them off the server from time to time |
| `/etc/systemd/system/freeleads.service` | Service (sandboxed, restarts on crash, starts on boot) |
| `/etc/nginx/sites-available/freeleads` | Reverse proxy; Certbot adds the HTTPS block |

## Troubleshooting

- **`502 Bad Gateway`**: the app is down. Run `sudo journalctl -u freeleads -n 50`.
- **Certbot fails**: the domain doesn't point at the VPS yet, or port 80 is blocked (Hostinger firewall or
  `ufw`). Check with `getent hosts your-domain.com`.
- **Can't log in, but the site loads**: you are on `http://`. Finish the HTTPS step.
- **Another site on the VPS shows instead of Freeleads**: check that no other Nginx site uses the same
  `server_name` (`grep -r server_name /etc/nginx/sites-enabled/`).
