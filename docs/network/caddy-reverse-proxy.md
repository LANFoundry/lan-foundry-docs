# Caddy reverse proxy

By default, reaching Frigate, Portainer, Cockpit, ntfy, and Dozzle requires knowing the NVR's IP address and the specific port each service runs on — something like `192.168.1.100:5000` for Frigate or `192.168.1.100:9090` for Cockpit. Caddy sits in front of all those services and lets you reach them by clean hostnames on standard HTTPS, like `frigate.internal` or `cockpit.internal`.

On Argus systems, Caddy comes pre-configured. This guide explains how it works, how to trust the certificate on your devices, and how to verify each service is reachable.

If you're running your own hardware, see [Running your own hardware?](#running-your-own-hardware) at the bottom of this guide.

---

## Before you start

This guide assumes:

- DNS entries for all five service hostnames are pointing to your NVR's static IP. See [DNS entries in OPNsense](dns-opnsense.md) if you haven't set those up yet
- You can reach the Frigate web interface by IP to confirm the NVR is running

---

## How it works

Caddy runs as a container on the same Docker network as Frigate, Portainer, ntfy, and Dozzle. When a request comes in for `frigate.internal`, Caddy receives it and forwards it to the right container using the container name as the backend address. Frigate, ntfy, and Dozzle serve plain HTTP on the backend. Portainer and Cockpit already serve HTTPS with their own self-signed certificates, so Caddy proxies to them over HTTPS and skips backend certificate verification.

Cockpit is the exception to the container pattern — it runs directly on the host rather than in Docker. Caddy reaches it through `host.docker.internal`, Docker's built-in address for reaching the host machine from inside a container.

```
Your device
    frigate.internal   → Caddy → frigate:5000            (HTTP)
    portainer.internal → Caddy → portainer:9443           (HTTPS, skip verify)
    cockpit.internal   → Caddy → host.docker.internal:9090 (HTTPS, skip verify)
    ntfy.internal      → Caddy → ntfy:80                  (HTTP)
    dozzle.internal    → Caddy → dozzle:8080              (HTTP)
```

---

## What's pre-configured on your Argus system

The Caddyfile on your NVR is located at `/opt/lanfoundry/config/caddy/Caddyfile`. Its contents:

```caddy
{
  local_certs
}

frigate.internal {
  tls internal
  reverse_proxy frigate:5000
}

portainer.internal {
  tls internal
  reverse_proxy https://portainer:9443 {
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
  reverse_proxy ntfy:80
}

dozzle.internal {
  tls internal
  reverse_proxy dozzle:8080
}
```

A few things worth understanding:

- **`local_certs`** in the global block tells Caddy to act as its own certificate authority and issue certificates internally rather than using Let's Encrypt. This is correct for a local network with no public domain.
- **`tls internal`** on each site tells Caddy to issue a locally trusted certificate for that hostname. Your browser won't automatically trust it until you accept it once or install Caddy's root certificate (see Step 1).
- **`tls_insecure_skip_verify`** on the Portainer and Cockpit blocks tells Caddy to accept the self-signed certificate those services use on their backend. This is safe on a local network where you control both ends of the connection.

---

## Step 1 — Configure Cockpit to allow the proxy origin

Cockpit validates the `Origin` header on WebSocket connections and rejects anything that doesn't match its expected hostname. When you access Cockpit directly at `https://192.168.1.100:9090`, the origin check passes. When you access it through Caddy at `https://cockpit.internal`, the origin is different and Cockpit drops the WebSocket connection after login — the page will load but then disconnect or go blank.

The fix is a one-time config file on the NVR host:

```bash
sudo mkdir -p /etc/cockpit
sudo tee /etc/cockpit/cockpit.conf <<'EOF'
[WebService]
Origins = https://cockpit.internal wss://cockpit.internal
ProtocolHeader = X-Forwarded-Proto
EOF
sudo systemctl restart cockpit
```

`Origins` tells Cockpit which hostnames are allowed to open WebSocket connections. `ProtocolHeader` tells it to trust the `X-Forwarded-Proto` header that Caddy sets, so Cockpit knows the upstream connection is HTTPS even though the backend connection from Caddy to Cockpit is also HTTPS.

On Argus systems, this file is pre-configured. If you purchased an Argus NVR, you can skip to Step 2.

---

## Step 2 — Trust the certificate

Caddy acts as its own certificate authority. Your browser won't automatically trust it, so the first time you visit each hostname you'll see a security warning. This is expected — it means Caddy is running and HTTPS is working, not that something is wrong.

Accept the warning in your browser:

- **Chrome / Edge:** Click **Advanced**, then **Proceed to [hostname] (unsafe)**
- **Firefox:** Click **Advanced**, then **Accept the Risk and Continue**
- **Safari:** Click **Show Details**, then **visit this website**

You'll need to do this once per hostname per browser profile. After that, the browser remembers the exception.

If you want to eliminate the warning entirely on your personal devices, you can install Caddy's root certificate as a trusted CA. It's stored inside the Caddy container at `/data/caddy/pki/authorities/local/root.crt`. Copy it to your device and install it as a trusted root certificate. This is optional — most users are comfortable clicking through once per hostname.

---

## Step 3 — Verify your services

Open a browser on a device on your main LAN and navigate to each hostname:

- `https://frigate.internal` — Frigate live view and event timeline
- `https://portainer.internal` — Portainer container management
- `https://cockpit.internal` — Cockpit system overview
- `https://ntfy.internal` — ntfy notification web interface
- `https://dozzle.internal` — Dozzle container log viewer

Each should load after you accept the certificate warning on the first visit. If a service loads, both DNS and Caddy are working for that hostname.

---

## Troubleshooting

If a hostname doesn't load, check the Caddy logs first:

```bash
docker logs caddy
```

Common errors and what they mean:

| Error | Cause | Fix |
|---|---|---|
| `dial tcp: lookup frigate: no such host` | Container not on `nvr-network` | `docker network connect nvr-network frigate` |
| `connection refused` on Cockpit or Portainer | Backend not running or wrong port | Confirm the service is up and the Caddyfile backend address matches |
| Cockpit loads but disconnects after login | WebSocket origin rejected | Complete Step 1 (cockpit.conf) and restart Cockpit |
| Browser can't reach the hostname at all | DNS not resolving | Check OPNsense host overrides in [DNS entries in OPNsense](dns-opnsense.md) |
| Hostname works on one device but not another | Device using a different DNS server | See [Can't reach a service by hostname](../troubleshooting/hostname.md#windows-dns-troubleshooting) |

---

## Running your own hardware?

If you're not on an Argus system, here's how to set Caddy up from scratch.

### Create a shared Docker network

All containers Caddy needs to reach must share a Docker network:

```bash
docker network create nvr-network
```

Connect your existing containers to the network:

```bash
docker network connect nvr-network frigate
docker network connect nvr-network portainer
docker network connect nvr-network ntfy
docker network connect nvr-network dozzle
```

Cockpit runs on the host, not in Docker — it's reached through `host.docker.internal` instead.

### Create the Caddyfile

```bash
mkdir -p ~/nvr/caddy
nano ~/nvr/caddy/Caddyfile
```

Paste the Caddyfile from the [What's pre-configured on your Argus system](#whats-pre-configured-on-your-argus-system) section above. Adjust any service names or ports to match your own stack.

Save with `Ctrl+O`, then `Enter`, then exit with `Ctrl+X`.

### Run the Caddy container

```bash
docker run -d \
  --name caddy \
  --network nvr-network \
  --add-host host.docker.internal:host-gateway \
  -p 80:80 \
  -p 443:443 \
  -v ~/nvr/caddy/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy-data:/data \
  -v caddy-config:/config \
  --restart unless-stopped \
  caddy:latest
```

The `--add-host host.docker.internal:host-gateway` flag is what allows Caddy to reach Cockpit on the host. Without it, `host.docker.internal` won't resolve inside the container.

---

## mDNS fallback — accessing services without a DNS server

If you can't configure DNS entries on your router, mDNS is an alternative. Avahi advertises your NVR's machine hostname on the local network — by default something like `nvr.local` — without any central DNS server. The limitation is that individual service hostnames (`frigate.internal`, `portainer.internal`, etc.) can't be advertised this way, so you have two options.

!!! note "Windows users"
    mDNS is unreliable on Windows-heavy networks. If you have OPNsense or any router that supports local DNS entries, use that instead. See [DNS entries in OPNsense](dns-opnsense.md).

**Option A — Use subpaths instead of subdomains**

Install Avahi if it's not already running:

```bash
sudo apt install avahi-daemon
sudo systemctl enable --now avahi-daemon
```

Then configure Caddy to route by path rather than hostname:

```caddy
nvr.local {
  tls internal
  handle /frigate* {
    reverse_proxy frigate:5000
  }
  handle /portainer* {
    reverse_proxy https://portainer:9443 {
      transport http {
        tls_insecure_skip_verify
      }
    }
  }
  handle /cockpit* {
    reverse_proxy https://host.docker.internal:9090 {
      transport http {
        tls_insecure_skip_verify
      }
    }
  }
  handle /ntfy* {
    reverse_proxy ntfy:80
  }
  handle /dozzle* {
    reverse_proxy dozzle:8080
  }
}
```

Services are then at `https://nvr.local/frigate`, `https://nvr.local/portainer`, and so on.

!!! note
    Subpath routing may require additional configuration for some services. Frigate in particular can behave unexpectedly when served from a non-root path. Test thoroughly before relying on this approach.

**Option B — Edit the hosts file on each device**

On each device that needs to access the NVR, add entries to the hosts file pointing all service hostnames to the NVR's static IP. On Linux and Mac: `/etc/hosts`. On Windows: `C:\Windows\System32\drivers\etc\hosts`:

```
192.168.1.100  frigate.internal
192.168.1.100  portainer.internal
192.168.1.100  cockpit.internal
192.168.1.100  ntfy.internal
192.168.1.100  dozzle.internal
```

This works cleanly but requires editing the hosts file on every device, which is impractical for most households. It's best suited for a single admin device.

---

## Where to go from here

With Caddy running, all NVR services are accessible by hostname from your main LAN.

- [Setting up a camera VLAN in OPNsense](vlan-opnsense.md) — isolate your cameras from the rest of your network
- [Blocking camera cloud telemetry](../privacy/blocking-telemetry.md) — firewall rules to prevent cameras from phoning home
- [Remote access with Tailscale](tailscale.md) — reach your NVR from outside your home network
