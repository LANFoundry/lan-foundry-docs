# General Linux troubleshooting resources

This guide is not a step-by-step fix for a single problem. It is a map of where to go when you have worked through the LAN Foundry troubleshooting guides and still need help, or when your question is about Linux, Docker, or the NVR host rather than Frigate configuration or camera streams.

Argus systems run **Ubuntu Server** without a desktop. Most administration happens over **SSH** or **Cockpit** for basic host metrics. Deeper storage checks use the command line (`zpool`, `smartctl`) as described in [Drive and pool errors](drive-errors.md).

---

## Before you start

This guide assumes:

- You can reach the NVR on your network, usually by SSH or Cockpit at `https://cockpit.internal`
- You have sudo access on the NVR, or the credentials LAN Foundry provided with your system

If you cannot reach the NVR at all, that is a connectivity or boot problem, not a general Linux learning exercise. Confirm power, Ethernet link lights, and whether the machine responds to ping at its static IP before diving into logs.

---

## Start with a LAN Foundry troubleshooting guide

Many problems that feel like "Linux issues" are actually DNS, Docker, storage, or camera configuration. Check whether a dedicated guide already covers your symptom:

| Symptom | Start here |
|---|---|
| Hostname won't load in a browser | [Can't reach a service by hostname](hostname.md) |
| Frigate, Caddy, or Portainer won't start | [What to do when a container won't start](container.md) |
| Camera tile blank or stream failed | [Camera feed not showing in Frigate](camera-feed.md) |
| NVR slow, stuttering, or dropping frames | [NVR running slow or dropping frames](performance.md) |
| Drive warnings, pool degraded, recording gaps | [Drive and pool errors](drive-errors.md) |
| Push alerts not arriving | [Not receiving notifications](notifications.md) |

If none of those fit, the sections below point to official documentation and communities for the underlying platform.

---

## Connecting to the NVR

### SSH from another computer on your LAN

From macOS, Linux, or Windows (with OpenSSH installed):

```bash
ssh yourusername@192.168.1.100
```

Replace `yourusername` with your Ubuntu account and `192.168.1.100` with the NVR's static IP.

### Cockpit web console

Browse to `https://cockpit.internal` or `https://192.168.1.100:9090` from a device on your main LAN. Cockpit is useful for CPU, memory, and disk usage overview. It does not replace `zpool status` or `smartctl` for recording pool health.

### Copying files off the NVR

Use `scp` or `rsync` over SSH when you need to pull logs or config backups to another machine. See [Backing up Frigate config](../maintenance/backup.md) for config-specific guidance.

---

## Essential commands on the NVR

You do not need to be a Linux administrator to maintain an Argus system, but a short list of commands covers most inspection tasks.

| Task | Command |
|---|---|
| Current directory and files | `pwd`, `ls -la` |
| Disk space | `df -h` |
| Memory and CPU snapshot | `htop` (install with `sudo apt install htop` if missing) |
| Network interfaces and IPs | `ip addr` |
| Test reachability | `ping -c 3 192.168.10.101` |
| Recent system messages | `sudo dmesg \| tail -50` |
| System log (today) | `sudo journalctl --since today` |
| Follow a service log | `sudo journalctl -u cockpit -f` |

Press `Ctrl+C` to stop a command that is following output live.

---

## Docker and containers

Your NVR services (Frigate, Caddy, Portainer) run as Docker containers. The host runs Ubuntu; the applications run inside containers.

| Task | Command |
|---|---|
| Running containers | `docker ps` |
| All containers including stopped | `docker ps -a` |
| Logs for a container | `docker logs frigate --tail 100` |
| Follow logs live | `docker logs frigate -f` |
| Restart a container | `docker restart frigate` |
| Container mount paths | `docker inspect frigate --format '{{ json .Mounts }}'` |

For container startup failures, configuration errors, and network issues between Caddy and Frigate, use [What to do when a container won't start](container.md) first.

**Official documentation**

- [Docker documentation](https://docs.docker.com/)
- [Docker Engine post-install notes for Linux](https://docs.docker.com/engine/install/linux-postinstall/) (permissions and `docker` group)
- [Frigate documentation](https://docs.frigate.video/)

**Community**

- [Frigate GitHub discussions](https://github.com/blakeblackshear/frigate/discussions)
- [r/frigate](https://www.reddit.com/r/frigate/) on Reddit

---

## Storage and ZFS

Argus recording storage uses **ZFS** on NAS-rated hard drives. Cockpit's Storage page does not show full pool health on a stock Ubuntu install. Use the CLI:

| Task | Command |
|---|---|
| Pool health | `zpool status` |
| Pool capacity | `zpool list` |
| Drive S.M.A.R.T. summary | `sudo smartctl -H /dev/sdX` |
| Full S.M.A.R.T. report | `sudo smartctl -a /dev/sdX` |

Replace `/dev/sdX` with the device name from `zpool status`. See [Drive and pool errors](drive-errors.md) for interpretation and urgency.

**Official documentation**

- [OpenZFS documentation](https://openzfs.github.io/openzfs-docs/)
- [smartmontools documentation](https://www.smartmontools.org/)

---

## Networking

Network and firewall problems on Argus systems usually involve OPNsense rules, VLANs, or DNS rather than Ubuntu networking misconfiguration.

| Task | Command (on the NVR) |
|---|---|
| Test RTSP port on a camera | `nc -zv 192.168.10.101 554` |
| Test Ubiquiti RTSP port | `nc -zv 192.168.10.101 7447` |
| Test an RTSP stream | `ffprobe -rtsp_transport tcp "rtsp://..."` |

For DNS, Caddy, VLANs, and firewall layout, start with [Setting up a camera VLAN in OPNsense](../network/vlan-opnsense.md) or [Can't reach a service by hostname](hostname.md) depending on your symptom.

**Official documentation**

- [OPNsense documentation](https://docs.opnsense.org/)
- [Ubuntu Server networking](https://ubuntu.com/server/docs)

---

## Ubuntu Server and system services

Argus systems run a current **Ubuntu Server LTS** release. Cockpit runs as a system service on the host. If Cockpit is down but SSH works:

```bash
sudo systemctl status cockpit
sudo systemctl start cockpit
```

Other host services follow the same pattern: `status`, `start`, `stop`, and `restart` with `systemctl`.

**Official documentation**

- [Ubuntu Server documentation](https://ubuntu.com/server/docs)
- [systemd journal documentation](https://www.freedesktop.org/software/systemd/man/latest/journalctl.html)

**Community**

- [Ask Ubuntu](https://askubuntu.com/) (search before posting; many NVR-specific questions are better asked in Frigate or LAN Foundry support channels)

---

## What to bring when asking for help

Whether you post in a community forum or open a LAN Foundry support ticket, diagnostics save time. Gather what applies to your problem:

**Always useful**

- Argus tier (Vigil, Sentinel, or Warden) if you purchased from LAN Foundry
- Ubuntu version: `lsb_release -a`
- What you expected vs. what happened
- What changed recently (updates, new cameras, config edits)

**Container problems**

- `docker ps -a`
- `docker logs <container> --tail 100`

**Storage problems**

- `zpool status`
- `df -h`
- `sudo smartctl -a /dev/sdX` for any flagged drive

**Camera or Frigate problems**

- Relevant `config.yml` camera block (redact passwords and tokens)
- `docker logs frigate --tail 100`
- Result of `ffprobe` or `ping` from the NVR to the camera IP

**Network problems**

- Whether the issue is all devices or one device
- `nslookup frigate.internal` from a affected client
- OPNsense firewall log entries if traffic is blocked

---

## Where to go from here

**LAN Foundry troubleshooting**

- [Can't reach a service by hostname](hostname.md)
- [What to do when a container won't start](container.md)
- [Camera feed not showing in Frigate](camera-feed.md)
- [NVR running slow or dropping frames](performance.md)
- [Drive and pool errors](drive-errors.md)

**Broader community**

- [Community resources](../further/community.md), for forums, projects, and places to learn beyond troubleshooting

**If you're still stuck**

Search for the exact error string from your logs. Official project documentation (Frigate, Docker, OpenZFS, OPNsense) often documents specific error messages more precisely than general Linux tutorials.

---

## LAN Foundry customer support

The guides on this site are free for everyone, whether you bought hardware from us or not. If you have worked through the relevant troubleshooting guide and the resources above and still need help, there are a few more places to go depending on your situation.

**If you're running your own hardware**

Community forums for Frigate, Docker, Ubuntu, and your camera manufacturer are the right next step. Bring the diagnostic output listed in [What to bring when asking for help](#what-to-bring-when-asking-for-help).

**If you purchased an Argus system from LAN Foundry**

Visit [lanfoundry.com/support](https://lanfoundry.com/support) for support options and how to submit a ticket.

When you open a support request, include:

- Your Argus tier and a short description of the problem
- Which LAN Foundry troubleshooting guides you already followed
- Output from the commands relevant to your issue (`docker logs`, `zpool status`, `journalctl`, etc.)
- Whether the problem started after a specific change (update, new camera, power event)

The more context you provide, the faster we can pinpoint the issue. If your system is still within its warranty period, check your purchase documentation for what coverage applies.
