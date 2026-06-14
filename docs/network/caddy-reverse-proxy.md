# Configuring Caddy as a reverse proxy

By default, accessing Frigate, Portainer, and Cockpit requires knowing the NVR's IP address and the specific port each service runs on, something like `192.168.1.100:5000` for Frigate or `192.168.1.100:9090` for Cockpit. A reverse proxy sits in front of all those services and lets you reach them by clean hostnames instead, like `frigate.local` or `cockpit.local`, on standard ports 80 and 443.

Caddy handles this cleanly with minimal configuration, manages HTTPS certificates automatically, and runs as a container alongside the rest of your stack.

---

## Before you start

This guide assumes:

- Your NVR has a static IP address. If not, complete the [static IP assignment](static-ip.md) guide first
- Docker is installed and running on the NVR
- DNS entries for `frigate.local`, `portainer.local`, and `cockpit.local` are pointing to your NVR's static IP. If you haven't set those up yet, see the [DNS entries in OPNsense](dns-opnsense.md) guide first, or see the mDNS section at the bottom of this guide if you can't configure DNS on your router

---

## How it works

Caddy runs as a container on the same Docker network as Frigate and Portainer. When a request comes in for `frigate.local`, Caddy receives it and forwards it to the Frigate container on the internal Docker network using the container name as the hostname. Caddy never needs to know the NVR's IP address — it communicates with other containers by name.

Cockpit is the exception since it runs on the host rather than in a container. Caddy reaches it through `host.docker.internal`, which is Docker's built-in way for containers to communicate with the host machine.

```
Your device
    frigate.local → Caddy → frigate:5000
    portainer.local → Caddy → portainer:9000
    cockpit.local → Caddy → host.docker.internal:9090
```

---

## Step 1 — Create a shared Docker network

All containers that Caddy needs to reach must be on the same Docker network. Create a network called `nvr-network`:

```bash
docker network create nvr-network
```

If you already have Frigate and Portainer running, connect them to this network:

```bash
docker network connect nvr-network frigate
docker network connect nvr-network portainer
```

---

## Step 2 — Create the Caddyfile

The Caddyfile is Caddy's configuration file. Create a directory for your Caddy configuration:

```bash
mkdir -p ~/nvr/caddy
cd ~/nvr/caddy
```

Create the Caddyfile:

```bash
nano Caddyfile
```

Add the following:

```caddy
{
  local_certs
}

frigate.local {
  tls internal
  reverse_proxy frigate:5000
}

portainer.local {
  tls internal
  reverse_proxy portainer:9000
}

cockpit.local {
  tls internal
  reverse_proxy host.docker.internal:9090
}
```

A few things to note:

- The `local_certs` directive in the global block tells Caddy to use its internal certificate authority for all sites
- `tls internal` on each site tells Caddy to issue a locally trusted certificate for that hostname
- Frigate and Portainer are reached by container name since they're on the same Docker network
- Cockpit is reached through `host.docker.internal` since it runs on the host

Save with `Ctrl+O`, then `Enter`, then exit with `Ctrl+X`.

---

## Step 3 — Run the Caddy container

```bash
docker run -d \
  --name caddy \
  --network nvr-network \
  --add-host host.docker.internal:host-gateway \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy-data:/data \
  -v caddy-config:/config \
  --restart unless-stopped \
  caddy:latest
```

The `--add-host host.docker.internal:host-gateway` flag is what allows Caddy to reach Cockpit on the host. Without it, `host.docker.internal` won't resolve inside the container.

---

## Step 4 — Accepting the self-signed certificate

Because Caddy is acting as its own certificate authority, your browser won't automatically trust it. The first time you visit each hostname you'll see a security warning. This is expected and not a sign that something is wrong.

In most browsers you can proceed by:

- **Chrome/Edge:** Click "Advanced" then "Proceed to [hostname] (unsafe)"
- **Firefox:** Click "Advanced" then "Accept the Risk and Continue"
- **Safari:** Click "Show Details" then "visit this website"

You'll need to do this once per hostname per browser. After that, the browser remembers your exception and won't show the warning again.

If you want to avoid the warning entirely on your personal devices, you can install Caddy's root certificate as a trusted CA. Caddy stores it at `/data/caddy/pki/authorities/local/root.crt` inside the container. Copy it to your device and install it as a trusted root certificate. This is optional and most users are comfortable clicking through the warning once.

---

## Step 5 — Verify each service is reachable

Open a browser on a device on your main LAN and navigate to each hostname:

- `https://frigate.local` — should load the Frigate interface
- `https://portainer.local` — should load the Portainer setup or login page
- `https://cockpit.local` — should load the Cockpit login page

If any of them fail to load, check the Caddy logs for errors:

```bash
docker logs caddy
```

Common issues and what they mean:

- `dial tcp: lookup frigate: no such host` — the Frigate container is not on `nvr-network`. Run `docker network connect nvr-network frigate` and restart Caddy
- `connection refused` on Cockpit — the `--add-host` flag may not have been included when running the container. Remove and recreate the container with the full command from Step 3
- Browser can't reach the hostname at all — DNS is not resolving. Check your OPNsense DNS entries or see the mDNS section below

---

## mDNS fallback — accessing services without a DNS server

If you can't configure DNS entries on your router, mDNS lets devices on your local network find each other by hostname without any central DNS server. This is the technology behind `.local` addresses.

On Ubuntu Server, mDNS is handled by Avahi. Install it if it's not already running:

```bash
sudo apt install avahi-daemon
sudo systemctl enable --now avahi-daemon
```

Avahi will automatically advertise your NVR's hostname on the local network. By default this will be your machine's hostname with `.local` appended, something like `nvr.local`. Devices on the same network can reach the NVR at that address without any DNS configuration.

The limitation of this approach is that each service still needs its own hostname for Caddy to route correctly. With mDNS you have two options:

**Option A — Use subpaths instead of subdomains**

Configure Caddy to route by path rather than hostname:

```caddy
nvr.local {
  tls internal
  handle /frigate* {
    reverse_proxy frigate:5000
  }
  handle /portainer* {
    reverse_proxy portainer:9000
  }
  handle /cockpit* {
    reverse_proxy host.docker.internal:9090
  }
}
```

This means your services are at `https://nvr.local/frigate`, `https://nvr.local/portainer`, and `https://nvr.local/cockpit`. Less clean than separate hostnames but works without a DNS server.

!!! note
    Subpath routing may require additional configuration for some services. Frigate in particular can behave unexpectedly when served from a non-root path. Test thoroughly before relying on this approach.

**Option B — Edit the hosts file on each device**

On each device that needs to access the NVR, add entries to the hosts file pointing the service hostnames to the NVR's static IP. On Linux and Mac this is `/etc/hosts`, on Windows it's `C:\Windows\System32\drivers\etc\hosts`:

```
192.168.1.100  frigate.local
192.168.1.100  portainer.local
192.168.1.100  cockpit.local
```

This works cleanly but requires editing the hosts file on every device, which is impractical for most households. It's best suited for a single admin device rather than a household-wide solution.

For most setups, configuring DNS in OPNsense or your router is the recommended path. The mDNS options above are fallbacks for situations where router DNS configuration isn't possible.

---

## Where to go from here

With Caddy running, your NVR services are accessible by hostname from anywhere on your main LAN. The next step is making sure your camera VLAN is properly isolated so that only the NVR can reach your cameras directly. If you haven't done that yet, the [blocking camera cloud telemetry](../privacy/blocking-telemetry.md) guide covers the full firewall rule setup.

If you want to access your NVR remotely from outside your home network, the remote access with Tailscale guide in the Getting Started section covers that once you have your unit set up.
