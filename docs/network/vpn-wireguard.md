# Remote access with WireGuard

Tailscale, covered in [Remote access with Tailscale](tailscale.md), is the option Argus ships pre-installed and ready to go. WireGuard is the option for people who'd rather not depend on anyone else's infrastructure at all, not even a control plane that only sees device metadata and never your traffic, the way Tailscale's does.

WireGuard is a VPN protocol, not a service. There's no account to sign up for and nothing hosted on your behalf. If your router has a built-in WireGuard server, you're building a private, encrypted tunnel straight into your own network using nothing but your own hardware. The cost of that independence is that you do the work Tailscale otherwise automates: the router needs to support it in the first place, you forward a port yourself, and you configure each device by hand.

---

## WireGuard vs. Tailscale

Read this before you start setting anything up. Both get you into your home network from anywhere; they differ in who's doing the work and what you're trusting.

| | **Tailscale** | **WireGuard on your router** |
|---|---|---|
| **Runs on** | A container on the NVR | Your router itself |
| **Third-party dependency** | Tailscale's hosted control plane (sees device metadata, not traffic) | None |
| **Setup effort** | Install once, sign in on each device | Configure the router, forward a port, hand-configure each device |
| **Works behind CGNAT / hard networks** | Yes, falls back to a relay if a direct connection is blocked | Not reliably; needs a port actually reachable from the internet |
| **Requires router support** | No | Yes, only some routers include a WireGuard server |
| **Hostname access (`frigate.internal`, etc.)** | Needs Split DNS configured | Works by just pointing the client at your router's DNS, no extra configuration |

If your router doesn't have a built-in WireGuard server, or you're behind CGNAT (common with some ISPs, especially on cellular or satellite connections), Tailscale is the more reliable path; it's also already sitting on your Argus system. Keep reading if your router supports WireGuard and you'd rather keep remote access entirely in-house.

---

## Before you start

This guide assumes:

- A router with a **built-in WireGuard server**. This isn't universal. OPNsense supports it through the `os-wireguard` plugin; several consumer and prosumer router lines (Ubiquiti, MikroTik, GL.iNet, and some ASUS models, among others) include it natively. Check your router's documentation if you're not sure.
- Admin access to that router.
- A WireGuard client app on the device you want to connect from (phone, laptop).

The steps below use OPNsense as the concrete example, since it's the router used throughout the rest of this section, but the underlying concepts (server keypair, tunnel address range, peer, forwarded port) apply to any router's WireGuard implementation. The menu names will differ.

---

## Step 1 — Configure the WireGuard server on the router

A WireGuard server needs three things before it can accept a connection: its own identity, a private address space to hand out, and a record of who's allowed to connect.

**A keypair, not a password.** WireGuard authenticates with public-key cryptography instead of a shared secret. The router generates a private key it never shares and a public key it gives out freely. Anyone who wants to connect does the same, and each side trusts the other by public key, not by anything transmitted over the connection. On OPNsense, this happens automatically when you create an instance under **VPN → WireGuard → Instances → Add**.

**A tunnel address range.** This is a private IP subnet that exists only inside the VPN tunnel, separate from your actual LAN. Something like `10.10.10.0/24` is typical. The router takes an address in this range for itself, and each connecting device gets its own address from the same range once connected. This is why your phone can reach the NVR at its normal LAN address even though the phone itself is never actually on your LAN, the router bridges the two.

**A peer.** A peer is the router's record of one specific device it will accept a connection from: that device's public key, and which tunnel address it gets assigned. On OPNsense, add one under **VPN → WireGuard → Peers → Add** for each device you want to connect (your phone, your laptop). WireGuard has no concept of a shared login; every device you want to use gets configured individually.

Once the instance and at least one peer exist, enable the WireGuard service under **VPN → WireGuard → Settings**.

---

## Step 2 — Forward the WireGuard port

Your phone, out on the internet, has no way to find your router unless something is listening on a specific port it can reach. WireGuard needs exactly one: by convention, UDP 51820, though you can pick another.

On OPNsense, add a **port forward** under **Firewall → NAT → Port Forward**: WAN interface, UDP, the WireGuard port, forwarding to the router's own LAN address (since the WireGuard server runs on the router itself, this is a forward to the firewall's own IP, which OPNsense supports directly).

This is the one place in this setup that genuinely widens your attack surface: a UDP port is now reachable from anywhere on the internet. That's an intentional tradeoff, not an oversight, and it's the same tradeoff any self-hosted VPN makes. What keeps it safe is that WireGuard doesn't respond to anything that isn't cryptographically valid; an unauthenticated packet is silently dropped, not rejected with an error that would confirm the port is even open. Forward only this one port, and resist the urge to also forward the router's admin UI "just in case," that's a separate, much larger risk.

---

## Step 3 — Client setup

WireGuard clients are available for iOS, Android, macOS, Windows, and Linux from [wireguard.com/install](https://www.wireguard.com/install/).

When you created a peer in Step 1, OPNsense (and most routers) can generate a matching client config, usually as a QR code you scan with the phone app, or a `.conf` file you import on desktop. That file contains:

- The peer's own private key (paired with the public key the router already has on file)
- The router's public key and its public IP or hostname, so the client knows who to connect to
- `AllowedIPs`, which tells the client which traffic should go through the tunnel at all. Set to your tunnel range plus your LAN subnet (something like `10.10.10.0/24, 192.168.1.0/24`), only traffic bound for those addresses uses the VPN; everything else (browsing the web, for example) goes out normally.

Import the config, activate the tunnel, and the device is connected.

---

## Step 4 — Reach NVR services remotely

Once connected, use the NVR's normal LAN address and ports, the same ones you'd use at home:

| Service | URL |
|---|---|
| Frigate | `http://192.168.1.100:5000` |
| Cockpit | `https://192.168.1.100:9090` |
| ntfy | `http://192.168.1.100:2586` |
| Home Assistant (if installed) | `http://192.168.1.100:8123` |

Replace `192.168.1.100` with your NVR's actual static IP.

Hostname access (`https://frigate.internal`, and so on) works too, and needs less setup than the equivalent Tailscale path: point the WireGuard client's DNS setting at your router's LAN IP, and any device on the tunnel resolves `*.internal` names the same way a device physically on your LAN does. Tailscale needs Split DNS configured separately because its DNS resolution doesn't automatically know about your router; here, the router *is* the VPN server, so it's already in the loop.

---

## What normal looks like

When everything is working:

- The WireGuard client shows the tunnel as active, with a nonzero handshake time and data transferred
- You can open Frigate at the NVR's LAN IP from a phone that is not on your home Wi-Fi
- Hostname URLs like `https://frigate.internal` load if you configured the client's DNS to point at your router
- OPNsense's **VPN → WireGuard → Status** page shows the peer with a recent handshake

If the tunnel shows as active but nothing loads, check that the peer's `AllowedIPs` actually includes your LAN subnet, not just the tunnel range. If there's no handshake at all, confirm the port forward is in place and that you're using the router's actual public IP or a hostname that resolves to it.

---

## Where to go from here

- [Remote access with Tailscale](tailscale.md), for the option that needs no router support and no port forwarding
- [Caddy reverse proxy](caddy-reverse-proxy.md), for how the `.internal` hostnames this guide reaches actually work
- [Hardware potential](../further/hardware-potential.md), for other services worth running that become more useful once remote access is in place
