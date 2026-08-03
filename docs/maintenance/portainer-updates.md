# Updating via Portainer

Frigate, Caddy, and Portainer run as Docker containers. Image updates ship bug fixes, security patches, and new features from each project. This guide walks through pulling newer images and restarting containers safely using Portainer.

Updates can change behavior or require configuration adjustments. **Back up first.** See [Backing up your Frigate configuration](backup.md) before pulling new images.

---

## Before you start

This guide assumes:

- Portainer is running at `https://portainer.internal` (or the NVR IP on port 9000)
- You can log in to Portainer
- Frigate, Caddy, and Portainer containers already exist and were working before the update

If a container will not start after an update, see [What to do when a container won't start](../troubleshooting/container.md). If you need to roll back `config.yml`, see [Restoring from a backup](restore.md).

---

## What gets updated

| Container | Image source (typical) | Notes |
|---|---|---|
| **frigate** | `ghcr.io/blakeblackshear/frigate` | Read [Frigate release notes](https://github.com/blakeblackshear/frigate/releases) before major version jumps |
| **caddy** | `caddy` | Usually backward compatible; Caddyfile syntax rarely breaks on minor updates |
| **portainer** | `portainer/portainer-ce` | Update Portainer last so the UI stays available while updating other services |

Cockpit and the Ubuntu host are **not** updated here. See [Updating Ubuntu Server](ubuntu-updates.md) for the operating system.

---

## Recommended approach

1. **Back up** `config.yml` and your Caddyfile ([backup guide](backup.md)).
2. **Update one service at a time**, starting with Frigate or Caddy, and confirm it still works before moving to the next.
3. **Read release notes** for Frigate when moving between minor or major versions.
4. **Update during a quiet window** when missed recordings are acceptable if something goes wrong.

Avoid pulling `latest` blindly on a production NVR without checking what changed. If you pin a specific tag (for example `ghcr.io/blakeblackshear/frigate:0.15.0`), pull that tag intentionally rather than always tracking `latest`.

---

## Update a container in Portainer

These steps apply to each container you want to update. Repeat for `frigate`, `caddy`, and `portainer`.

### Step 1 — Pull the new image

1. Log in to Portainer.
2. Go to **Images** in the left sidebar.
3. Find the image used by your container (for example `ghcr.io/blakeblackshear/frigate`).
4. Click the image name, then click **Pull the image** (or use **Pull image** from the Images list and enter the image name and tag).

Wait for the pull to complete. Portainer shows when the new image is available locally.

### Step 2 — Recreate the container with the new image

1. Go to **Containers**.
2. Click the container name (for example `frigate`).
3. Click **Recreate** (wording may vary slightly by Portainer version).

Read the confirmation dialog carefully:

- **Re-pull image** should be enabled if you already pulled in Step 1.
- **Preserve volumes** must stay enabled. Your Frigate config, recordings mount, and Caddy certificate volumes live in Docker volumes or bind mounts. Recreating without volumes destroys that data.

4. Confirm and wait for the container to return to **running** status.

### Step 3 — Verify the service

| Container | Quick check |
|---|---|
| **frigate** | Open `https://frigate.internal`, confirm live camera tiles and timeline |
| **caddy** | Open `https://frigate.internal`, `https://portainer.internal`, and `https://cockpit.internal` |
| **portainer** | Portainer UI still loads after updating itself |

Check logs if anything looks wrong:

```bash
docker logs frigate --tail 50
docker logs caddy --tail 50
```

---

## Update from the command line

If Portainer is down, use SSH:

```bash
docker pull ghcr.io/blakeblackshear/frigate:stable
docker pull caddy:latest
docker pull portainer/portainer-ce:latest
```

Then recreate each container using the **same** `docker run` options, volume mounts, and network settings as before, with the new image. Portainer stores the original run parameters on each container's **Duplicate/Edit** screen if you need a reference.

For Frigate, a simple restart does **not** switch to a newly pulled image unless you recreate the container or use a compose stack that pins image IDs. After `docker pull`, use Portainer **Recreate** or stop/remove and run again with the updated image tag.

---

## After updating Frigate

Frigate release notes occasionally mention configuration changes. After a Frigate update:

- Open the Frigate UI and confirm all cameras still stream
- Watch `docker logs frigate --tail 100` for deprecation warnings
- Test motion detection or a notification if you rely on them

If the container exits immediately, the log usually points to a config key that changed between versions. Restore your backup config if needed, then adjust settings using the current [Frigate documentation](https://docs.frigate.video/).

---

## Suggested update order

1. **Frigate** — core NVR function; verify cameras and recording
2. **Caddy** — reverse proxy; verify all hostnames
3. **Portainer** — management UI last

Skipping straight to a full `docker pull` on everything at once makes it harder to tell which update caused a problem.

---

## Where to go from here

- [Updating Ubuntu Server](ubuntu-updates.md), for host OS and kernel updates
- [Backing up your Frigate configuration](backup.md), if you have not backed up recently
- [Restoring from a backup](restore.md), to roll back configuration after a bad update
- [What to do when a container won't start](../troubleshooting/container.md), if a container fails after recreate
