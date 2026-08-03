# How much does your router matter?

A local NVR is a meaningful privacy upgrade over cloud cameras regardless of what router you have. But how much your router can do determines how completely you can isolate your cameras from the internet and from the rest of your network. This page explains what you gain at each level so you can start where you are and know what the next step looks like.

---

## Level 1: Local NVR on your existing network

If you have a standard consumer router from your ISP or a home networking brand, you can run Argus today. Plug the NVR into your network, connect your cameras, and your footage stays on the NVR.

**What you gain immediately:**

- Footage lives on drives you own and control, not on a vendor's servers
- No cloud account required to review recordings
- No subscription fee to access your own footage
- No vendor employees or contractors with access to your cameras
- No footage leaving your home unless you explicitly set that up

This covers the majority of the privacy risk that cloud cameras create. The incidents that made headlines at Ring and Wyze, which are described in [Why a local security camera system?](why-local-nvr.md), happened because footage was stored on vendor infrastructure that other people could access. That risk goes away entirely when footage never leaves your network.

**What you don't have yet:**

- Cameras are on the same network segment as your computers, phones, and other devices. If a camera has a software vulnerability, it has some access to the rest of your network.
- Cameras can still reach the internet. Most IP cameras will try to phone home to manufacturer servers for firmware updates, NTP, or telemetry. You can't block this without network segmentation.

For most households, Level 1 is a substantial improvement over where they started. You are not doing something wrong by starting here.

---

## Level 2: Camera VLAN isolation

A VLAN (Virtual Local Area Network) puts your cameras on their own isolated network segment. Combined with firewall rules, this means cameras can only talk to the NVR and nothing else.

**What you gain:**

- Cameras cannot reach the internet. They cannot phone home to the manufacturer, cannot pull firmware updates over the internet, and cannot send any data outside your home.
- Cameras cannot reach your computers, phones, or other devices. A compromised camera cannot be used to attack anything else on your network.
- Your main network devices cannot reach the camera segment, which is the correct direction of traffic for a security system.

**What this requires:**

A VLAN-capable router. Your consumer ISP router almost certainly does not support VLANs. You need a router that supports VLAN tagging and firewall rules between network segments.

Argus ships with a managed switch that handles VLAN tagging on the camera side. The piece you need to add is the router.

**What qualifies as a VLAN-capable router:**

Any router that supports IEEE 802.1Q VLAN tagging and has a firewall that can filter traffic between VLANs. OPNsense running on a small PC is the most common choice in the local NVR community. Ubiquiti EdgeRouter hardware, some higher-end consumer routers from ASUS and TP-Link, and pfSense also fall into this category.

---

## Level 3: Full network control

With a capable router and full configuration, you get everything in Level 2 plus:

- Local DNS so every device on your network resolves `frigate.internal` and the other service hostnames without editing hosts files
- Granular firewall rules with logging and visibility
- VPN remote access via WireGuard or Tailscale, so you can reach the NVR from outside your home without exposing ports to the internet

This is what LAN Foundry's network guides walk through. The guides assume a router that can handle VLANs and local DNS. OPNsense is what they're written against, but the concepts apply to any capable router.

---

## Why LAN Foundry doesn't cover router setup

Getting a VLAN-capable router installed and configured depends on variables that differ significantly between households: ISP type (fiber, copper, coax, 5G), whether your ISP provides a modem-router combo that can be placed in bridge mode, how many LAN ports you need, whether you need 2.5G or 10G uplinks, SFP vs RJ45, and how your existing network is laid out.

Covering all of that well at this stage would mean becoming a general networking company. Router setup is not something LAN Foundry supports currently. That scope may expand as the business grows.

What we can do is point you to the right resources. If you're moving to OPNsense, the [OPNsense documentation](https://docs.opnsense.org) and the [OPNsense community forum](https://forum.opnsense.org) are the right starting points. Once OPNsense (or an equivalent) is running, the LAN Foundry [Network Setup](../network/index.md) guides pick up from there.

---

## Starting with what you have

If you have a consumer router today, the right move is to set up Argus on your existing network and get it working. You get the majority of the privacy benefit immediately. Moving to a VLAN-capable router is a meaningful next step when you're ready for it, not a prerequisite for getting started.

The guides in this library work at both levels. The camera VLAN and DNS guides require a capable router. The Frigate setup, notifications, storage, and maintenance guides work regardless of your network gear.

---

## Where to go from here

- [Blocking cloud telemetry](blocking-telemetry.md) — what VLAN segmentation actually does and why cameras should be isolated
- [Network Setup overview](../network/index.md) — camera VLANs, DNS, Caddy hostnames, and static IPs once you have VLAN-capable hardware
- [Adding your first camera to Frigate](../cameras/first-camera.md) — getting cameras working on your existing network today
