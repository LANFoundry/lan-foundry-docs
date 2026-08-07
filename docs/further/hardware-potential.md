# Hardware potential

Your Argus NVR is running Ubuntu Server with Docker on dedicated hardware. The NVR workload (recording, detection, retention) is the priority, and the system is sized for that. But the hardware has headroom, and Docker makes it straightforward to run additional services alongside Frigate without disrupting it.

This page is meant to be inspirational rather than prescriptive. These aren't LAN Foundry-supported configurations, but they fit naturally on a local infrastructure machine and stay true to the same philosophy: your data, on your hardware, in your building.

---

## The principle

Every service listed here runs locally. Nothing leaves your network unless you explicitly set it up to do so. That is the same principle behind the Argus NVR itself, and it's why these services pair well with it rather than working against it.

A camera system that stays local while your DNS resolves through a third-party server, or your files sync to a commercial cloud, is only half of the picture. The NVR hardware gives you a place to consolidate more of your infrastructure if you want to.

---

## Know your headroom

Not every Argus tier has the same room to spare. NVR workloads always take priority. If Frigate and the recording pool are already under pressure, adding another service will make that worse.

A rough sense of what each tier can comfortably carry:

| Tier | NVR workload | Room for additional services |
|---|---|---|
| **Vigil** | 4 cameras, 1080p | Tight. Lightweight services only (Pi-hole, AdGuard). Avoid memory-heavy apps. |
| **Sentinel** | 6 cameras, 4K | Moderate. Home Assistant runs well. Avoid multiple large services simultaneously. |
| **Warden** | 12 cameras, 4K | Comfortable. Can run several services alongside Frigate without issue. |

Watch resource usage after adding anything new:

```bash
docker stats
htop
```

If Frigate starts dropping detection frames or recording stutters after adding a service, the new container is competing for resources. Either remove it or move it to dedicated hardware.

---

## What runs well alongside Frigate

### DNS-level ad and tracker blocking

**AdGuard Home** and **Pi-hole** intercept DNS requests on your network and block known ad and tracking domains before they ever make a connection. This is different from a browser extension: it covers every device on your network, including smart TVs, phones, and cameras.

Both run well in Docker and consume almost no resources. On any Argus tier, either is a reasonable addition.

The privacy angle here goes beyond blocking ads: trackers and telemetry from devices on your network get dropped at the DNS level, reinforcing the same isolation that your camera VLAN provides at the network level.

### Home automation

**Home Assistant** is an open-source home automation platform that runs locally. It can connect to cameras, door sensors, lights, locks, thermostats, and nearly any other smart home device — all without routing through a cloud service or third-party server.

Running it on the NVR means your automation logic stays on your own hardware. Frigate integrates directly with Home Assistant, so camera events can trigger automations: a person detected at the front door turns on the porch light, or unlocks the door for a known face.

See [Adding Home Assistant](home-assistant.md) for installation options and trade-offs.

### Remote access

**Tailscale** creates an encrypted peer-to-peer network between your devices. You install it on the NVR and on your phone or laptop, and you can reach the Frigate interface, Home Assistant, and anything else on your network from anywhere, without opening ports on your router or running a VPN server.

Tailscale has a free tier that covers personal use. It is not fully open source (the control plane is a hosted service), but the traffic itself is encrypted and peer-to-peer. For a fully self-hosted alternative, **Headscale** is an open-source implementation of the Tailscale control server.

### File storage and sync

**Nextcloud** is a self-hosted file sync and collaboration platform, a local alternative to Dropbox or Google Drive. It runs in Docker and can sync files from phones and computers to the NVR.

On Sentinel and Warden, this runs comfortably alongside Frigate if you are not at tier max cameras. Nextcloud is more memory-intensive than the DNS tools above, so check resource usage after deployment. It also benefits from dedicated storage separate from the ZFS recording pool; if you add it, consider whether you have a spare drive or partition available.

### Media server

**Jellyfin** is a self-hosted media server for video, music, and photos. If your NVR hardware has a GPU or Quick Sync capable CPU, Jellyfin can transcode media to your TV or phone without a cloud account.

This one is more resource-competitive with Frigate since both do video work. On Warden it runs fine. On Vigil or Sentinel, be cautious: transcoding during peak recording hours can create contention. Jellyfin works best on Argus hardware when most playback is direct (no transcoding needed) or when cameras are not at full load.

---

## Adding a service to Docker Compose

Additional services go in the same Docker Compose file as Frigate, or in a separate file managed alongside it. The general pattern:

```yaml
services:
  adguardhome:
    image: adguard/adguardhome
    container_name: adguardhome
    restart: unless-stopped
    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "3000:3000/tcp"
    volumes:
      - /opt/adguardhome/work:/opt/adguardhome/work
      - /opt/adguardhome/conf:/opt/adguardhome/conf
```

The exact configuration depends on the service. Refer to each project's Docker documentation for their specific compose snippet. Prefer `restart: unless-stopped` so services come back after an NVR reboot.

AdGuard Home needs those published ports; it's a DNS server, so every device on your LAN has to reach it. Not everything does. See [Running your own containers safely](container-networking.md) before you publish ports out of habit for something that only needs to talk to one other container.

---

## Where to go from here

- [Adding Home Assistant](home-assistant.md), to run local home automation alongside Frigate
- [Running your own containers safely](container-networking.md), to keep whatever you add off your LAN unless it actually needs to be there
- [Community resources](community.md), for links to self-hosted project communities and further reading
