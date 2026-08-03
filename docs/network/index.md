# Network Setup

Connect the NVR and cameras on your LAN: VLANs, DNS, hostnames, static IPs, and optional remote access.

The guides in this section assume a VLAN-capable router. If you're starting with a standard consumer router, see [How much does your router matter?](../privacy/privacy-levels.md) for what you can do today and what the path to full network isolation looks like.

Typical order for a new Argus install: camera VLAN on the router and switch, static IP for the NVR, DNS entries, then Caddy for friendly hostnames.

- **[Camera VLAN in OPNsense](vlan-opnsense.md)** — Create the camera VLAN, DHCP, and firewall rules on OPNsense.
- **[Camera VLAN in TP-Link Switch](vlan-tplink.md)** — Assign VLAN tags on Argus TP-Link Easy Smart switches.
- **[DNS entries in OPNsense](dns-opnsense.md)** — Resolve names like `frigate.internal` to the NVR on your LAN.
- **[Caddy reverse proxy](caddy-reverse-proxy.md)** — Reach Frigate, Portainer, and Cockpit by hostname on ports 80 and 443.
- **[Static IP assignment](static-ip.md)** — Give the NVR a fixed address so cameras and DNS always find it.
- **[Camera VLAN on other Routers/Switches](vlan-other-routers.md)** — VLAN setup when you are not using OPNsense or TP-Link.
- **[Remote access with Tailscale](tailscale.md)** — Reach the NVR securely from outside your home without opening ports.
