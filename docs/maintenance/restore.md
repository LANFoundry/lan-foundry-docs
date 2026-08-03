# Restoring from a backup

Something went wrong after a configuration change, an update, or a mistaken edit. Frigate will not start, cameras vanished from the UI, or behavior changed in a way you cannot fix quickly. If you saved a backup using [Backing up your Frigate configuration](backup.md), you can put the known-good files back and restart services.

This guide covers restoring **configuration files** on a running NVR. It does not cover full operating system recovery, ZFS pool rebuilds, or replacing a failed boot drive. Those scenarios need hardware work or LAN Foundry support. See [Drive and pool errors](../troubleshooting/drive-errors.md) for storage emergencies.

---

## Before you start

This guide assumes:

- You have a dated backup of `config.yml` (and ideally your Caddyfile) from another folder on the NVR or from an off-NVR copy
- You can SSH into the NVR or use Portainer
- The Frigate container exists but is misconfigured, or stops immediately after start

If the container problem is not config-related (disk full, network, image update), start with [What to do when a container won't start](../troubleshooting/container.md).

---

## Decide what to restore

| Symptom | Likely restore target |
|---|---|
| Frigate exits on start, YAML errors in logs | `config.yml` |
| Cameras missing or wrong after editing config | `config.yml` |
| Hostnames broken after editing proxy rules | `Caddyfile` |
| Both Frigate and URLs broken | `config.yml` and `Caddyfile` |
| Problem started after `apt upgrade` only | OS issue; config restore may not help |
| Pool DEGRADED or recordings missing | Storage issue; see [drive-errors guide](../troubleshooting/drive-errors.md) |

When in doubt, restore `config.yml` first. It is the most common fix.

---

## Step 1 — Stop Frigate

Restoring while Frigate is writing to `config.yml` can cause conflicts. Stop the container:

```bash
docker stop frigate
```

If Frigate is already stopped or crash-looping, skip this step.

---

## Step 2 — Locate the live config path

```bash
FRIGATE_CONFIG=$(docker inspect frigate --format '{{ range .Mounts }}{{ if eq .Destination "/config" }}{{ .Source }}{{ end }}{{ end }}')
echo "$FRIGATE_CONFIG"
```

The active file is `$FRIGATE_CONFIG/config.yml`.

---

## Step 3 — Preserve the broken file (optional)

Renaming instead of deleting lets you compare later:

```bash
cp "$FRIGATE_CONFIG/config.yml" "$FRIGATE_CONFIG/config.yml.broken-$(date +%Y%m%d)"
```

---

## Step 4 — Copy the backup into place

If the backup is on the NVR (example date):

```bash
cp ~/nvr-backups/2026-06-15/config.yml "$FRIGATE_CONFIG/config.yml"
```

If the backup is on your admin PC, copy it to the NVR first:

```bash
scp ./lan-foundry-backups/2026-06-15/config.yml yourusername@192.168.1.100:~/config.yml.restore
```

Then on the NVR:

```bash
cp ~/config.yml.restore "$FRIGATE_CONFIG/config.yml"
```

### Restore Caddyfile (if needed)

```bash
CADDYFILE=$(docker inspect caddy --format '{{ range .Mounts }}{{ if eq .Destination "/etc/caddy/Caddyfile" }}{{ .Source }}{{ end }}{{ end }}')
cp ~/nvr-backups/2026-06-15/Caddyfile "$CADDYFILE"
docker restart caddy
```

---

## Step 5 — Start Frigate and verify

```bash
docker start frigate
docker logs frigate --tail 50
```

Look for a clean startup without YAML parse errors. Open `https://frigate.internal` and confirm:

- Camera tiles show live video
- Timeline and events look as expected
- Settings match what you remember from before the bad change

If Frigate still fails, read the log line that mentions the error. You may have restored a backup from an older Frigate version that needs small edits for your current image. Compare with the `.broken` file you saved to see what changed.

---

## Restore after a container recreate gone wrong

If an update removed volume mounts or recreated the container with empty config:

1. Confirm where the **old** config still lives. Bind mounts often remain on the host even when the container was recreated. Check the path from `docker inspect frigate`.
2. If the host path was wiped, copy `config.yml` from your off-NVR backup into the mount path from Step 2.
3. Recreate the container using the same volumes and network as before. See [Updating via Portainer](portainer-updates.md) and [What to do when a container won't start](../troubleshooting/container.md).

Certificate data for Caddy usually survives in Docker volumes `caddy-data` and `caddy-config` unless those volumes were deleted. Restoring `config.yml` does not restore TLS certificates, and you typically do not need to.

---

## When restore is not enough

Restore fixes configuration mistakes. It does **not** fix:

- **Full boot drive failure** — the OS and Docker setup may need reinstallation or Argus support
- **ZFS pool failure or corruption** — recordings may be lost independent of `config.yml`
- **Bad container image** — roll back the image tag in Portainer or pull a previous Frigate version

Contact [lanfoundry.com/support](https://lanfoundry.com/support) for Argus hardware if the NVR will not boot, the pool is **FAULTED**, or containers cannot be recreated after following the guides above.

---

## Where to go from here

- [Backing up your Frigate configuration](backup.md), to save a fresh copy after a successful restore
- [What to do when a container won't start](../troubleshooting/container.md), if restore does not fix startup
- [Camera feed not showing in Frigate](../troubleshooting/camera-feed.md), if config is valid but streams fail
- [Updating via Portainer](portainer-updates.md), when you are ready to try updates again
