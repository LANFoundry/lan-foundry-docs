# The Argus software stack

Argus runs on a set of open-source tools that were chosen for specific reasons: they work well together, they're actively maintained, they don't require cloud accounts, and they can be understood and repaired by the person running them. This page explains what each piece does, why we chose it over alternatives, and what you'd use instead if you wanted to swap something out.

---

## Why containers?

All of the Argus services run as Docker containers on the NVR host. This is worth explaining because it's not obvious why you'd run a camera system this way rather than installing software directly on the machine.

**Isolation.** Each service lives in its own container. A Frigate update can't break ntfy. A misconfigured Caddy can't crash Portainer. When something goes wrong, the blast radius is contained.

**Clean updates.** Updating a service means pulling a new container image and restarting one container. The host OS and every other service keep running. Rolling back is equally simple: point the container at an older image tag.

**Reproducibility.** LAN Foundry ships Argus systems with the full stack already running and configured. Docker makes it possible to produce the same environment every time, on every system, without manual steps that could vary.

**Separation of data from software.** Configuration and recorded footage live in named Docker volumes, separate from the container images. When you update Frigate, your recordings and config stay untouched because they're not inside the container.

The main tradeoff is a layer of abstraction to learn. When something goes wrong, you're checking container logs and Docker networks rather than system logs directly. That's why Portainer and Dozzle are in the stack; they make that layer navigable without living in the terminal.

---

## The services

### Frigate — NVR and AI Object Detection

Frigate handles everything camera-related: ingesting RTSP streams, running object detection on live footage, writing recordings to disk, and serving the web interface where you review events.

**Why Frigate:** It's the only mature open-source NVR that ships with real local AI object detection built in. Detection runs entirely on the NVR, with no cloud API and no subscription. It supports hardware acceleration via Hailo-8, NVIDIA GPU, or Intel QuickSync, which keeps CPU load manageable even on modest hardware. The configuration model (zones, masks, roles) is thoughtful, and the project is actively developed.

This is roughly what the Frigate service looks like in our Docker Compose stack. `shm_size` scales with camera count and resolution; the device passthrough lines only apply if you're using Hailo acceleration:

```yaml
services:
  frigate:
    container_name: frigate
    image: ghcr.io/blakeblackshear/frigate:stable
    restart: unless-stopped
    networks:
      - nvr-network
    shm_size: "256mb"          # scale up with camera count/resolution
    ports:
      - "5000:5000"            # web UI / API
      - "8554:8554"            # RTSP restream
      - "8555:8555/tcp"        # WebRTC
      - "8555:8555/udp"
    environment:
      FRIGATE_RTSP_PASSWORD: "change-me"
    volumes:
      - /opt/lanfoundry/config/frigate:/config
      - /mnt/recordings:/media/frigate
      - type: tmpfs
        target: /tmp/cache
        tmpfs:
          size: 1000000000
    # devices:                 # uncomment for Hailo/iGPU passthrough
    #   - /dev/hailo0:/dev/hailo0
    #   - /dev/dri:/dev/dri
```

**Alternatives:**

| Option | Trade-off |
|---|---|
| **MotionEye** | Simpler setup, motion-only detection with no object classification |
| **ZoneMinder** | Long-established, but complex config and dated UI |
| **Shinobi** | Lighter weight, JavaScript-based, but less active development |
| **Scrypted** | Modern, plugin-based, good HomeKit support, but less mature for NVR use |
| **Agent DVR / iSpy** | Windows-native, good UI, not open-source |

---

### Docker — Containerization

Docker is the runtime that runs all other services as isolated containers.

**Why Docker:** It's the most widely understood container platform with the largest ecosystem of pre-built images. Every service in the Argus stack ships an official Docker image. Portainer, the container management UI we include, is built around Docker. The community resources, troubleshooting forums, and documentation for Frigate, ntfy, and Caddy all assume Docker.

**Alternatives:**

| Option | Trade-off |
|---|---|
| **Podman** | Docker-compatible CLI, rootless by default, good for security-focused setups |
| **LXC / Proxmox** | OS-level isolation rather than process-level, more overhead, better for running full OS environments |
| **Bare metal** | No abstraction layer, but updates are manual per-service and harder to reproduce across systems |
| **NixOS** | Fully declarative, highly reproducible, but steep learning curve |

---

### Caddy — Reverse Proxy

Caddy sits in front of all the services and routes requests to them by hostname. Instead of typing `192.168.1.100:5000` to reach Frigate, you type `https://frigate.internal`. Caddy also handles HTTPS using its own internal certificate authority, so all connections are encrypted even on the local network.

**Why Caddy:** Its local certificate authority support (`local_certs` + `tls internal`) requires no external infrastructure or DNS challenges. It just works on a private network. The configuration is minimal: five lines per service compared to twenty or more with nginx. It handles automatic certificate issuance and renewal without certbot or cron jobs.

The Caddy service in the stack:

```yaml
services:
  caddy:
    container_name: caddy
    image: caddy:2-alpine
    restart: unless-stopped
    networks:
      - nvr-network
    depends_on:
      - frigate
      - ntfy
      - dozzle
    ports:
      - "80:80"
      - "443:443"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - /opt/lanfoundry/config/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
```

And the Caddyfile it mounts:

```caddyfile
{
  local_certs
}

frigate.internal {
  tls internal
  reverse_proxy frigate.nvr-network:5000
}

portainer.internal {
  tls internal
  reverse_proxy https://portainer.nvr-network:9443 {
    transport http {
      tls_insecure_skip_verify
    }
  }
}

cockpit.internal {
  tls internal
  reverse_proxy https://host.docker.internal:9090 {
    transport http {
      tls_insecure_skip_verify
    }
  }
}

ntfy.internal {
  tls internal
  reverse_proxy ntfy.nvr-network:80
}

dozzle.internal {
  tls internal
  reverse_proxy dozzle.nvr-network:8080
}
```

**Alternatives:**

| Option | Trade-off |
|---|---|
| **nginx Proxy Manager** | Web UI for managing proxy rules, good for non-technical users, more overhead |
| **Traefik** | Automatic service discovery from Docker labels, powerful but complex configuration |
| **HAProxy** | High-performance, widely used, but no built-in HTTPS certificate management |
| **nginx (raw)** | Highly configurable, no cert automation without certbot |

---

### ntfy — Push Notifications

ntfy is a self-hosted push notification server. When frigate-notify sends it a notification, ntfy queues it and delivers it to subscribed devices: your phone, a browser tab, anything running the ntfy app or subscribed via the API.

**Why ntfy:** It requires no account, no third-party service, and no ongoing subscription. You run it, you control it. It has well-maintained apps for iOS and Android. On Android, it supports UnifiedPush, which routes notifications entirely within your own infrastructure without passing through Google's servers. For iOS, notifications must transit Apple's servers regardless of what notification service you use. This is an Apple platform constraint, not an ntfy limitation.

The ntfy service:

```yaml
services:
  ntfy:
    container_name: ntfy
    image: binwiederhier/ntfy:latest
    restart: unless-stopped
    networks:
      - nvr-network
    ports:
      - "2586:80"
    volumes:
      - ntfy-cache:/var/cache/ntfy
      - /opt/lanfoundry/config/ntfy:/etc/ntfy:ro
    command: serve
```
 And its server config:

```yaml
# ntfy server.yml
# Upstream relay to ntfy.sh is intentionally disabled for privacy-first
# operation — notifications never leave your network by default. To enable
# remote push later (notification text transits ntfy.sh), add:
#   upstream-base-url: "https://ntfy.sh"
# then restart the ntfy container.

base-url: https://ntfy.internal
attachment-cache-dir: /var/cache/ntfy/attachments
attachment-total-size-limit: 5G
attachment-file-size-limit: 15M
```

**Alternatives:**

| Option | Trade-off |
|---|---|
| **Gotify** | Simpler, self-hosted, but no native iOS push support without external relay |
| **Pushover** | Polished apps, reliable delivery, but not self-hosted; requires account and one-time $5 per platform |
| **Telegram bot** | Free and widely used, but requires a Telegram account and routes through Telegram's servers |
| **Home Assistant** | If HA is already in your stack, its notification system covers most of the same ground |
| **Frigate's built-in ntfy** | Simpler config, no frigate-notify needed, but less flexible filtering and no snapshot attachments in older versions |

---

### frigate-notify — Event Routing

frigate-notify runs alongside Frigate and bridges its event API to notification providers. It polls Frigate every 30 seconds for new events, formats a notification, attaches the event snapshot, and sends it to ntfy.

**Why frigate-notify:** Frigate's built-in notification support is improving but has historically been limited in filtering options and attachment support. frigate-notify gives finer-grained control over which events trigger alerts, supports multiple notification providers simultaneously, and handles snapshot attachment reliably.

The frigate-notify service:

```yaml
services:
  frigate-notify:
    container_name: frigate-notify
    image: ghcr.io/0x2142/frigate-notify:latest
    restart: unless-stopped
    networks:
      - nvr-network
    depends_on:
      - frigate
      - ntfy
    volumes:
      - /opt/lanfoundry/config/frigate-notify/config.yml:/app/config.yml:ro
```
 And its config, wired to ntfy by default:

```yaml
# frigate-notify config.yml
app:
  mode: events

frigate:
  server: http://frigate.nvr-network:5000
  ignoressl: false
  webapi:
    enabled: true
    interval: 30
  startup_check:
    attempts: 5
    interval: 30

alerts:
  ntfy:
    enabled: true
    server: http://ntfy.nvr-network:80
    topic: your-topic-name
    ignoressl: false
```

Other providers (Discord, Gotify, Pushover, Telegram, SMTP, and more) can be enabled alongside or instead of ntfy — see the [frigate-notify docs](https://github.com/0x2142/frigate-notify) for the full provider list.

**Alternatives:**

| Option | Trade-off |
|---|---|
| **Frigate's built-in ntfy** | No extra container, simpler config, sufficient for most setups |
| **Home Assistant automations** | Very flexible if HA is already in the stack, but requires HA setup |
| **Custom scripts** | Full control, but you maintain them |
| **Frigate webhooks** | Trigger any HTTP endpoint on an event, no intermediary needed |

---

### Portainer — Container Management

Portainer is a web UI for managing Docker. It shows running containers, lets you start and stop services, browse volume contents, view logs, and manage Docker Compose stacks, all from a browser rather than the command line.

**Why Portainer:** It makes the Docker layer navigable for people who aren't comfortable with the CLI. Being able to restart a container, browse a config volume, or check container status in a browser without SSH access significantly lowers the barrier for day-to-day management. It's also how we recommend editing configuration files; Portainer's volume browser handles this without requiring SSH or `docker exec`.

Portainer is bootstrapped first, before the rest of the stack, so it can then deploy everything else as a managed stack:

```yaml
services:
  portainer:
    container_name: portainer
    image: portainer/portainer-ce:lts
    restart: always
    networks:
      - nvr-network
    ports:
      - "9443:9443"
      - "8000:8000"
    command: --no-setup-token
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data

networks:
  nvr-network:
    name: nvr-network
    external: true
```

**Alternatives:**

| Option | Trade-off |
|---|---|
| **Dockge** | Focused on Compose stacks, modern UI, lighter weight, less full-featured |
| **Yacht** | Simple, minimal, less active development |
| **Lazydocker** | Terminal UI, fast, no web access, requires CLI comfort |
| **Raw Docker CLI** | No overhead, full control, requires CLI comfort and SSH access |

---

### Cockpit — Host System Management

Cockpit provides a browser-based dashboard for the NVR host operating system. CPU, memory, disk usage, running services, system logs, and basic network info, all accessible at `https://cockpit.internal` without SSH.

**Why Cockpit:** It's maintained by Red Hat and packaged in Ubuntu's standard repositories, which means it gets security updates through the normal OS update process. It adds almost no overhead, and covers the most common reason you'd want to SSH into the host: checking that the system is healthy. It doesn't retain history or alert on thresholds, but for a dedicated NVR it doesn't need to.

**Alternatives:**

| Option | Trade-off |
|---|---|
| **Webmin** | More features, older codebase, heavier |
| **Glances** | Lightweight real-time system view, no persistent management features |
| **netdata** | Beautiful dashboards, historical data, more setup and resource use |
| **Grafana + Prometheus** | Full observability stack, significant setup and overhead for a single-node NVR |
| **SSH only** | No overhead, requires CLI comfort |

---

### Dozzle — Container Log Viewer

Dozzle is a real-time Docker log viewer. It streams logs from all running containers to a browser tab, without storing them or requiring any persistent configuration.

**Why Dozzle:** The most common reason to look at logs is to diagnose something that just went wrong. Dozzle makes that instant: open `https://dozzle.internal`, log in, click a container, and watch the logs live. It's read-only, stateless, and adds no meaningful overhead. It covers the 90% of log-checking cases that don't require log retention or search. It ships behind basic auth by default, since raw container logs can include IPs and other operational details you may not want open to anyone on the LAN.

```yaml
services:
  dozzle:
    container_name: dozzle
    image: amir20/dozzle:latest
    restart: unless-stopped
    networks:
      - nvr-network
    environment:
      DOZZLE_NO_ANALYTICS: "true"
      DOZZLE_USERNAME: admin
      DOZZLE_PASSWORD: "change-me"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

Notice there's no `ports:` line. Dozzle is only reachable through Caddy, by container name, over the shared `nvr-network`, not published to your LAN at all. That pattern is worth reusing for anything you add yourself; see [Running your own containers safely](further/container-networking.md).

**Alternatives:**

| Option | Trade-off |
|---|---|
| **Portainer's log view** | Already in the stack, slightly less ergonomic for live tailing |
| **`docker logs` CLI** | No extra container, requires SSH access |
| **Grafana Loki** | Full log aggregation and search, significant setup and storage overhead |

---

### Tailscale — Remote Access (optional)

Tailscale is included in the stack but inactive by default. It's the answer for anyone who wants to check their footage away from home but doesn't have a router capable of running a proper WireGuard VPN gateway.

**Why Tailscale:** It requires no port forwarding, no static IP, and no firewall rules on the router. It builds a private mesh network between your devices using WireGuard under the hood, so remote access to the NVR host works the same whether you're on your phone's cellular connection or someone else's Wi-Fi. Because we can't assume every customer's router supports VLANs and site-to-site VPN the way OPNsense does, having a container-level option keeps remote access possible without touching the router.

The container ships without a pre-auth key, so it sits idle until you opt in:

```yaml
services:
  tailscale:
    container_name: tailscale
    image: tailscale/tailscale:stable
    restart: unless-stopped
    network_mode: host
    cap_add:
      - NET_ADMIN
      - NET_RAW
    devices:
      - /dev/net/tun:/dev/net/tun
    environment:
      TS_HOSTNAME: "argus-nvr"
      TS_STATE_DIR: /var/lib/tailscale
      TS_USERSPACE: "false"
      TS_AUTHKEY: ""        # blank = inactive until you authenticate
    volumes:
      - tailscale-state:/var/lib/tailscale
```

With no auth key, the container runs but never joins a network. To activate it, either pass a pre-auth key generated from the [Tailscale admin console](https://login.tailscale.com/admin/machines) at install time, or authenticate manually after the fact:

```bash
docker exec tailscale tailscale up
```

This is the option for customers without router-level VPN — it's not a replacement for VLAN segmentation at the network edge. See [OPNsense](#opnsense--firewall-and-router) below for the more capable router-based approach.

**Alternatives:**

| Option | Trade-off |
|---|---|
| **OPNsense WireGuard** | Router-level VPN, no extra container, requires router hardware capable of running OPNsense |
| **Ubiquiti UniFi VPN** | Polished, but cloud-account dependent |
| **ZeroTier** | Similar mesh model to Tailscale, smaller community |
| **Manual WireGuard** | Full control, no coordination server, more setup |

---

### OPNsense — Firewall and Router

OPNsense is the open-source firewall and router that sits at the edge of the network. It handles DHCP, DNS (via Unbound and Dnsmasq), VLAN segmentation, and firewall rules that keep cameras isolated from the rest of the network.

**Why OPNsense:** It's actively developed, has a clear UI, and supports the features needed for a proper camera network: VLANs, local DNS with host overrides, firewall rules between network segments, and WireGuard VPN. The Unbound DNS integration is how `frigate.internal` resolves correctly on every device on the network without editing a hosts file.

OPNsense is not part of the Argus container stack. It runs on a separate device, a dedicated mini-PC or router hardware. Argus does not ship with a router.

**Alternatives:**

| Option | Trade-off |
|---|---|
| **pfSense** | Very similar feature set, different license history and community governance |
| **OpenWRT** | Runs on consumer router hardware, lighter, less UI polish |
| **Ubiquiti UniFi** | Polished hardware and software, but cloud-account dependent for full features |
| **Consumer router** | Simple setup, but limited or no VLAN and local DNS support; not recommended for camera network isolation |

---

## Swapping components

The stack is not tightly coupled. The services communicate over a shared Docker network using container names, and the only real dependency chain is:

- **Frigate** needs cameras on the network to pull RTSP from
- **frigate-notify** needs Frigate to be running to poll for events
- **ntfy** needs `base-url` set if you want snapshot attachments
- **Caddy** needs DNS entries to exist before hostnames resolve

Everything else is independent. You can run the stack without Cockpit, without Dozzle, or without Portainer if you prefer CLI management. You can replace ntfy with Gotify by changing the provider block in frigate-notify's config. You can skip frigate-notify entirely and use Frigate's built-in notification support.

The guides on this site describe the default Argus configuration. Where an alternative is straightforward to substitute, the relevant guide notes it.

---

## Where to go from here

- [Setting up network segmentation and VLANs](privacy/blocking-telemetry.md) — the network layer the stack runs on
- [Configuring Caddy as a reverse proxy](network/caddy-reverse-proxy.md) — how hostname routing works
- [Setting up push notifications](notifications/ntfy-setup.md) — the Frigate → frigate-notify → ntfy chain in detail
- [Going Further](further/index.md) — Home Assistant integration and community resources
