---
hide_feedback: true
---

# Maintenance

Back up configuration, update containers and the OS safely, and recover when something breaks.

Back up **before** editing `config.yml` or updating Frigate. Restore is the guide to reach for when a change goes wrong.

- **[Backing up Frigate config](backup.md)** — Save `config.yml`, Caddyfile, and related settings off the NVR.
- **[Updating via Portainer](portainer-updates.md)** — Pull new container images and recreate stacks without losing mounts.
- **[Updating Ubuntu Server](ubuntu-updates.md)** — Apply system updates on the NVR host with minimal downtime.
- **[Restoring from backup](restore.md)** — Put a known-good `config.yml` back when Frigate will not start or cameras vanish.
