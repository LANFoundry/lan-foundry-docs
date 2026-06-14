# Setting Up DNS Host Overrides in OPNsense for NVR Services

This guide walks you through adding DNS entries in OPNsense so your NVR services (Frigate, Portainer, and Cockpit) are accessible via clean hostnames like `frigate.nvr.local` instead of IP addresses with port numbers. This works in conjunction with Caddy running as a reverse proxy on your NVR.

---

## Prerequisites

Before starting, make sure you have:

- OPNsense router up and running
- Your NVR assigned a **static IP address** (either set on the NVR itself or via a DHCP reservation in OPNsense)
- Caddy configured and running on the NVR (see the Caddy setup guide)
- Client devices using OPNsense as their DNS server

> **Note on static IPs:** Setting the static IP directly on the Ubuntu Server network interface is more reliable than a DHCP reservation. If the DHCP service ever restarts or the lease expires at an unexpected time, a DHCP reservation can temporarily assign the wrong address. A static IP configured on the host itself never changes regardless of what the router does.

---

## Step 1 — Navigate to the DNS Host Overrides Page

1. Log in to your OPNsense web interface
2. In the top navigation, go to **Services → Unbound DNS → Host Overrides**

You should see a page with a table of any existing host overrides and an **Add** button in the top right corner.

---

## Step 2 — Add a Host Override for Frigate

Click the **+** (Add) button and fill in the fields as follows:

| Field | Value |
|---|---|
| **Enabled** | Checked |
| **Host** | `frigate` |
| **Domain** | `nvr.local` |
| **Type** | `A (IPv4)` |
| **IP** | Your NVR's static IP address (e.g. `192.168.10.50`) |
| **Description** | `Frigate NVR - Camera Management` |

Click **Save**.

---

## Step 3 — Add a Host Override for Portainer

Click **+** again and fill in:

| Field | Value |
|---|---|
| **Enabled** | Checked |
| **Host** | `portainer` |
| **Domain** | `nvr.local` |
| **Type** | `A (IPv4)` |
| **IP** | Your NVR's static IP address (same as above) |
| **Description** | `Portainer - Container Management` |

Click **Save**.

---

## Step 4 — Add a Host Override for Cockpit

Click **+** again and fill in:

| Field | Value |
|---|---|
| **Enabled** | Checked |
| **Host** | `cockpit` |
| **Domain** | `nvr.local` |
| **Type** | `A (IPv4)` |
| **IP** | Your NVR's static IP address (same as above) |
| **Description** | `Cockpit - System Management` |

Click **Save**.

---

## Step 5 — Apply the Changes

After saving all three entries, click the **Apply** button at the top of the Host Overrides page. OPNsense will reload the Unbound DNS service with the new entries active.

---

## Step 6 — Verify DNS Resolution

From any device on your network that uses OPNsense as its DNS server, open a terminal and run:

```
nslookup frigate.nvr.local
```

You should get back your NVR's static IP address. Repeat for `portainer.nvr.local` and `cockpit.nvr.local` to confirm all three are resolving correctly.

If you get no response or a "server can't find" error, see the Troubleshooting section below.

---

## Step 7 — Access Your Services

With DNS resolving and Caddy running on the NVR, you can now access your services at:

- `https://frigate.nvr.local`
- `https://portainer.nvr.local`
- `https://cockpit.nvr.local`

No port numbers needed. Caddy handles routing traffic to the correct service based on the hostname.

> **Browser certificate warning:** Your browser will likely show a certificate warning the first time you visit each address. This is expected when using a self-signed certificate on a local network. You can safely proceed past the warning, or set up a local certificate authority (CA) to issue trusted certificates for your `nvr.local` domain — this is covered in a separate guide.

---

## Troubleshooting

**DNS not resolving on client devices**

Make sure your client devices are actually using OPNsense as their DNS server. You can check this in your network settings — the DNS server listed should be your OPNsense LAN IP (commonly `192.168.1.1` or similar). If you are on a network using a different DNS server, OPNsense's host overrides won't apply.

**nslookup resolves correctly but browser still shows a connection error**

DNS is working but Caddy may not be running or may not be configured correctly. Check that the Caddy container is running in Portainer, and review the Caddy container logs for errors. See the Caddy Setup guide for details.

**All three hostnames resolve to the right IP but only one service loads**

This points to a Caddy configuration issue rather than a DNS issue. Double check that your Caddyfile has all three site blocks defined and that container names match exactly what is in your Docker Compose file.

**Changes didn't take effect after clicking Apply**

Try flushing the DNS cache on your client device. On Windows, run `ipconfig /flushdns` in Command Prompt. On macOS, run `sudo dscacheutil -flushcache`. On Linux, the command varies by distribution but is commonly `sudo systemd-resolve --flush-caches`.

---

## What's Next

With DNS set up, the next step is making sure Caddy is correctly configured to route traffic for all three hostnames to their respective containers over your Docker network. See the [Caddy Reverse Proxy Setup](caddy-reverse-proxy.md) guide for a walkthrough of the Docker Compose configuration and Caddyfile.
