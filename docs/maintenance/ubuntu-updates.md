# Updating Ubuntu Server

Your NVR applications run in Docker, but the host underneath is **Ubuntu Server**. Security patches, kernel updates, and driver fixes arrive through the system package manager. Keeping the host current is part of a healthy maintenance routine.

Container updates and OS updates are separate jobs. Complete [Backing up your Frigate configuration](backup.md) before maintenance that may require a reboot, and plan container checks after the system comes back up.

---

## Before you start

This guide assumes:

- You can SSH into the NVR or use Cockpit at `https://cockpit.internal`
- You have sudo access

Schedule OS updates during a window when brief recording gaps during reboot are acceptable. Cameras keep recording only while Frigate is running. A reboot stops all containers until the system returns.

---

## What gets updated

| Layer | Tool | This guide |
|---|---|---|
| Ubuntu packages (kernel, drivers, Cockpit) | `apt` | Yes |
| Docker Engine | `apt` (Docker package repository) | Yes, when updates appear |
| Frigate, Caddy, Portainer images | Portainer or `docker pull` | See [Updating via Portainer](portainer-updates.md) |

Updating Ubuntu does **not** automatically update your Frigate container image, and vice versa.

---

## Check for updates

SSH into the NVR:

```bash
sudo apt update
apt list --upgradable
```

Review the list. Routine security updates are expected. If the list includes a new **kernel** or **ZFS**-related packages, plan for a reboot after upgrading.

---

## Apply updates

```bash
sudo apt upgrade
```

Confirm when prompted. For a non-interactive run (optional):

```bash
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y
```

If `apt` proposes removing packages or changing a large number of dependencies, read the prompt before accepting. On a dedicated NVR, large unexpected changes are uncommon but worth a glance.

### Distribution release upgrades

Do **not** run `do-release-upgrade` or move to a new Ubuntu release unless LAN Foundry documentation explicitly instructs you to. Release upgrades are a major operation beyond routine maintenance.

---

## Reboot when required

Kernel updates do not take full effect until reboot:

```bash
sudo reboot
```

After the NVR returns:

1. Wait one to two minutes for Docker to start containers.
2. Confirm containers are running:

```bash
docker ps
```

3. Open `https://frigate.internal` and spot-check cameras.
4. If a container did not start, see [What to do when a container won't start](../troubleshooting/container.md).

Your ZFS recording pool should import automatically on boot. If recordings are unavailable after reboot, check `zpool status` and see [Drive and pool errors](../troubleshooting/drive-errors.md).

---

## Unattended security updates

Ubuntu Server can install security updates automatically. Argus systems may ship with unattended upgrades enabled or partially configured.

Check whether the service is active:

```bash
systemctl status unattended-upgrades
```

Configuration lives in:

- `/etc/apt/apt.conf.d/50unattended-upgrades` — which packages auto-update
- `/etc/apt/apt.conf.d/20auto-upgrades` — whether automatic updates are enabled

Automatic security updates are reasonable for most home NVRs. They can still schedule reboots if a kernel update requires one (`/var/run/reboot-required` appears when a reboot is needed).

Check if a reboot is pending:

```bash
cat /var/run/reboot-required 2>/dev/null && echo "Reboot needed"
```

Reboot during a maintenance window rather than letting the system restart unexpectedly during peak recording hours.

---

## Cockpit updates

Cockpit is installed from Ubuntu packages. It updates when you run `apt upgrade`. No separate Cockpit update step is required beyond host updates.

If Cockpit is unreachable after an update:

```bash
sudo systemctl status cockpit
sudo systemctl restart cockpit
```

---

## Suggested maintenance rhythm

| Task | Suggested frequency |
|---|---|
| Review `apt list --upgradable` | Monthly |
| Apply `apt upgrade` | Monthly, or after security advisories |
| Reboot when `reboot-required` | During your next planned window |
| Update Docker container images | Monthly or when Frigate releases a fix you need |
| Back up `config.yml` | Before any of the above |

---

## Where to go from here

- [Updating via Portainer](portainer-updates.md), for Frigate, Caddy, and Portainer images
- [Backing up your Frigate configuration](backup.md), before reboots or major changes
- [Drive and pool errors](../troubleshooting/drive-errors.md), if the pool does not come online after reboot
- [General Linux troubleshooting resources](../troubleshooting/linux-resources.md), for logs and system commands
