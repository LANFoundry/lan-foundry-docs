# Updating containers

Frigate, Caddy, and Arcane run as Docker containers. Image updates ship bug fixes, security patches, and new features from each project. This guide walks through pulling newer images and restarting containers safely using Arcane.

!!! note "On Enclave"
    This guide pulls updates from the internet, which [Enclave](../network/enclave-tier.md) never connects to. Enclave ships with current software, and updating it after delivery is up to you: it means bringing container images onto the system from another machine, which these guides don't cover. LAN Foundry doesn't provide post-delivery updates for any tier.

Updates can change behavior or require configuration adjustments. **Back up first.** See [Backing up your Frigate configuration](backup.md) before pulling new images.

---

## Before you start

This guide assumes:

- Arcane is running at `https://arcane.internal` (or the NVR IP on port 3552)
- You can log in to Arcane
- Frigate, Caddy, and Arcane containers already exist and were working before the update

If a container will not start after an update, see [What to do when a container won't start](../troubleshooting/container.md). If you need to roll back `config.yml`, see [Restoring from a backup](restore.md).

---

## What gets updated

| Container | Image source (typical) | Notes |
|---|---|---|
| **frigate** | `ghcr.io/blakeblackshear/frigate` | Read [Frigate release notes](https://github.com/blakeblackshear/frigate/releases) before major version jumps |
| **caddy** | `caddy` | Usually backward compatible; Caddyfile syntax rarely breaks on minor updates |
| **arcane** | `ghcr.io/getarcaneapp/manager` | Update Arcane last so the UI stays available while updating other services |

Cockpit and the Ubuntu host are **not** updated here. See [Updating Ubuntu Server](ubuntu-updates.md) for the operating system.

---

## Recommended approach

1. **Back up** `config.yml` and your Caddyfile ([backup guide](backup.md)).
2. **Update one service at a time**, starting with Frigate or Caddy, and confirm it still works before moving to the next.
3. **Read release notes** for Frigate when moving between minor or major versions.
4. **Update during a quiet window** when missed recordings are acceptable if something goes wrong.

Avoid pulling `latest` blindly on a production NVR without checking what changed. If you pin a specific tag (for example `ghcr.io/blakeblackshear/frigate:0.15.0`), change that tag in the compose file intentionally rather than always tracking `latest`.

---

## Update a container in Arcane

These steps apply to each container you want to update. Repeat for `frigate`, `caddy`, and `arcane`.

### Step 1 — Check for a newer image

1. Log in to Arcane.
2. Go to **Containers** and click the container name (for example `frigate`).
3. If a newer image is available, the detail header shows an **Update available** badge.

If you pin a specific tag, Arcane only finds updates for that tag. To move to a new version, edit the tag in the project's compose file first (see Step 2).

### Step 2 — Redeploy with the new image

Every service in the stack is defined in a Compose project under `/opt/lanfoundry/stacks/`. Updating through the project keeps the compose file as the single source of truth.

1. Go to **Projects** and open the project that contains the service.
2. If you're changing a pinned tag, edit the `image:` line in the compose editor and **Save**.
3. Click **Redeploy**. Arcane pulls the latest images for the project and restarts its containers.

To update a single container in place, use **Update** from the badge on the container's detail page, or **Redeploy** from the container's actions. Arcane pulls the image and recreates the container with the same name, mounts, networks, and restart policy.

Either way, your data is safe: Frigate's config, recordings mount, and Caddy's certificate volumes live in Docker volumes or bind mounts, which redeploying leaves in place. Don't use **Destroy** on a project to update it; that removes the project's resources and can delete volumes if you choose to.

Wait for the container to return to **running** status.

### Step 3 — Verify the service

| Container | Quick check |
|---|---|
| **frigate** | Open `https://frigate.internal`, confirm live camera tiles and timeline |
| **caddy** | Open `https://frigate.internal`, `https://arcane.internal`, and `https://cockpit.internal` |
| **arcane** | Arcane UI still loads after updating itself |

Check logs if anything looks wrong:

```bash
docker logs frigate --tail 50
docker logs caddy --tail 50
```

---

## Update from the command line

If Arcane is down, use SSH. Each project is a folder under `/opt/lanfoundry/stacks/` with its own compose file, so the standard Compose commands work:

```bash
cd /opt/lanfoundry/stacks/<project-name>
docker compose pull
docker compose up -d
```

`docker compose up -d` recreates only the containers whose image changed, keeping the same volume mounts and network settings from the compose file.

For Frigate, a simple `docker restart` does **not** switch to a newly pulled image. The container has to be recreated, which `docker compose up -d` or Arcane's **Redeploy** does for you.

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
3. **Arcane** — management UI last

Skipping straight to a full `docker compose pull` on everything at once makes it harder to tell which update caused a problem.

---

## Where to go from here

- [Updating Ubuntu Server](ubuntu-updates.md), for host OS and kernel updates
- [Backing up your Frigate configuration](backup.md), if you have not backed up recently
- [Restoring from a backup](restore.md), to roll back configuration after a bad update
- [What to do when a container won't start](../troubleshooting/container.md), if a container fails after redeploying
