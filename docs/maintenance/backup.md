# Backing up your Frigate configuration

Your camera recordings live on the ZFS pool, but the instructions that tell Frigate how to run live in small configuration files on the NVR. Losing `config.yml` after a bad edit, a failed update, or drive work on the boot disk means rebuilding camera entries, zones, and notification settings by hand.

This guide covers what to back up, when to do it, and how to keep copies somewhere safe outside the NVR.

---

## Before you start

This guide assumes:

- You can SSH into the NVR or open Arcane at `https://arcane.internal`
- Frigate is already running and configured

Backups described here protect **configuration**, not your entire recording archive. Footage on the ZFS pool is a separate concern. See [Drive and pool errors](../troubleshooting/drive-errors.md) for storage health and [How Frigate stores recordings](../storage/frigate-storage.md) for how footage is organized on disk.

---

## What to back up

| Item | Why it matters |
|---|---|
| **`config.yml`** | Camera streams, detection, zones, notifications, retention |
| **Caddyfile** | Hostname routing for Frigate, Arcane, and Cockpit |
| **Compose projects** | Every service's definition, in `/opt/lanfoundry/stacks/` |
| **Arcane's `ENCRYPTION_KEY`** | Set in Arcane's compose file; without it, a restored `arcane-data` volume can't decrypt the secrets Arcane stored |
| **Optional: environment files** | Only if you use a `.env` file or custom variables with your containers |

You do **not** need to back up Docker images. They can be pulled again from the registry. You also do not need to copy the full recording pool for a routine config backup.

### Find your Frigate config directory

Frigate mounts its config directory into the container at `/config`. On the host:

```bash
sudo docker inspect frigate --format '{{ range .Mounts }}{{ if eq .Destination "/config" }}{{ .Source }}{{ end }}{{ end }}'
```

The file you want is `config.yml` inside that folder.

### Find your Caddyfile

If you followed the [Caddy reverse proxy guide](../network/caddy-reverse-proxy.md), the Caddyfile is on the host at the path you mounted when creating the container. Check mounts with:

```bash
sudo docker inspect caddy --format '{{ range .Mounts }}{{ .Source }} -> {{ .Destination }}{{ "\n" }}{{ end }}'
```

Look for the mount mapped to `/etc/caddy/Caddyfile`.

---

## When to back up

Create a fresh backup:

- **Before editing `config.yml`** (adding cameras, zones, or notification changes)
- **Before updating container images** via [Arcane](container-updates.md)
- **Before Ubuntu package updates** that may require a reboot ([Updating Ubuntu Server](ubuntu-updates.md))
- **After a working configuration** you do not want to recreate

If you edit config often, weekly backups to another device are a good habit even when nothing is scheduled to change.

---

## Back up from the command line

### Create a dated backup folder on the NVR

```bash
BACKUP_DIR=~/nvr-backups/$(date +%Y-%m-%d)
mkdir -p "$BACKUP_DIR"
```

Adjust `~/nvr-backups` if you prefer a different location on the **boot drive**. Keeping backups only on the recording pool works until the pool is full or degraded, so store at least one copy elsewhere.

### Copy Frigate config

```bash
FRIGATE_CONFIG=$(sudo docker inspect frigate --format '{{ range .Mounts }}{{ if eq .Destination "/config" }}{{ .Source }}{{ end }}{{ end }}')
cp "$FRIGATE_CONFIG/config.yml" "$BACKUP_DIR/config.yml"
```

### Copy Caddyfile (if present)

```bash
CADDYFILE=$(sudo docker inspect caddy --format '{{ range .Mounts }}{{ if eq .Destination "/etc/caddy/Caddyfile" }}{{ .Source }}{{ end }}{{ end }}')
if [ -n "$CADDYFILE" ] && [ -f "$CADDYFILE" ]; then
  cp "$CADDYFILE" "$BACKUP_DIR/Caddyfile"
fi
```

### Copy compose projects

```bash
sudo cp -r /opt/lanfoundry/stacks "$BACKUP_DIR/stacks"
```

This includes Arcane's own compose file, and with it the `ENCRYPTION_KEY`.

### Verify the backup

```bash
ls -la "$BACKUP_DIR"
```

You should see `config.yml`, the `stacks` folder, and optionally `Caddyfile`.

---

## Copy backups off the NVR

A backup that exists only on the NVR does not help if the boot drive fails or the system is lost. Copy backups to another computer on your LAN regularly.

From **your admin PC** (replace username, IP, and date):

```bash
scp -r yourusername@192.168.1.100:~/nvr-backups/2026-06-15 ./lan-foundry-backups/
```

`rsync` works well for repeated syncs:

```bash
rsync -avz yourusername@192.168.1.100:~/nvr-backups/ ./lan-foundry-backups/
```

Store backups on a machine you control, not on a cloud sync folder unless you are comfortable with camera layout and credentials living there. `config.yml` contains RTSP passwords and notification tokens.

---

## Back up from Arcane

If you prefer the web UI:

1. Browse to `https://arcane.internal`.
2. Open the **frigate** container and note the host path mounted to `/config` in its mounts.
3. Use SSH or Cockpit's file tools to copy `config.yml` from that path into a dated folder, or use SCP as above.

Under **Projects**, each project's compose file is visible in the editor, which is a quick way to confirm what's in `/opt/lanfoundry/stacks/` before you copy it.

Arcane does not replace off-NVR copies. It helps you find paths, not archive files to another machine.

---

## What a good backup habit looks like

- Dated folders (`2026-06-15`, `2026-06-22`) so you can roll back to more than one point in time
- At least one copy off the NVR (admin PC, NAS, or external drive)
- A backup taken immediately before any change you are unsure about

Keep three to five recent dated backups and delete older ones if disk space on your admin PC is tight.

---

## Where to go from here

- [Updating containers](container-updates.md), after you have a current backup
- [Restoring from a backup](restore.md), when you need to put an old `config.yml` back
- [What to do when a container won't start](../troubleshooting/container.md), if Frigate fails after a config change
- [Drive and pool errors](../troubleshooting/drive-errors.md), if the problem is storage rather than configuration
