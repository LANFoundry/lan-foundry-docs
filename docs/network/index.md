---
hide_feedback: true
---

# Network Setup

Connect the NVR and cameras on your LAN: VLANs, DNS, hostnames, static IPs, and optional remote access.

The guides in this section assume a VLAN-capable router. If you're starting with a standard consumer router, see [How much does your router matter?](../privacy/privacy-levels.md) for what you can do today and what the path to full network isolation looks like.

Each guide stands on its own, so open the one for the part you're working on.

!!! info "Guides that depend on each other"
    - **Static IP before camera VLAN firewall rules.** The rules in the camera VLAN guides target the NVR by its fixed address. Set it afterwards and you'd have to redo those rules.
    - **DNS entries before Caddy hostnames.** Names like `frigate.internal` have to resolve to the NVR before Caddy can answer for them.

- **[Static IP assignment](static-ip.md)** — Give the NVR a fixed address so cameras and DNS always find it.
- **[Camera VLAN in OPNsense](vlan-opnsense.md)** — Create the camera VLAN, DHCP, and firewall rules on OPNsense.
- **[Camera VLAN in TP-Link switch](vlan-tplink.md)** — Assign VLAN tags on Argus TP-Link Easy Smart switches.
- **[DNS entries in OPNsense](dns-opnsense.md)** — Resolve names like `frigate.internal` to the NVR on your LAN.
- **[Caddy reverse proxy](caddy-reverse-proxy.md)** — Reach Frigate, Portainer, and Cockpit by hostname on ports 80 and 443.
- **[Camera VLAN on other routers and switches](vlan-other-routers.md)** — VLAN setup when you are not using OPNsense or TP-Link.
- **[Remote access with Tailscale](tailscale.md)** — Reach the NVR securely from outside your home without opening ports.
- **[Remote access with WireGuard](vpn-wireguard.md)** — A router-hosted alternative to Tailscale with no third-party dependency at all.

The last item on this list is a fork, not a next step: a hardware decision made before setup starts.

- **[Enclave: the air-gapped tier](enclave-tier.md)** — No WiFi hardware at all, kiosk-mode local access instead of a network interface. Skip this unless you specifically ordered the Enclave tier; it replaces remote access entirely rather than adding to it.
