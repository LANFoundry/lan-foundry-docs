# Argus tiers at a glance

Argus comes in four tiers. **Vigil**, **Sentinel**, and **Warden** step up in camera count, storage, and redundancy, and all three are networked: cameras sit on their own VLAN, and the NVR is reachable from your own network and, if you set it up, remotely. **Enclave** uses Sentinel's hardware with no wireless and no internet connection at all, and is used only from a monitor and keyboard plugged into the box.

Other guides refer to these tiers by name. This page is the one place they're all side by side. If you're running your own hardware, you can skip it; nothing elsewhere in these guides requires an Argus system.

---

## Hardware

| | **Vigil** | **Sentinel** | **Warden** | **Enclave** |
|---|---|---|---|---|
| **Cameras (tier max)** | 4 | 6 | 12 | 6 |
| **Stream target** | 1080p at ~2 Mbps each | 4K at ~4 Mbps each | 4K at ~12 Mbps each | 4K at ~4 Mbps each |
| **Recording pool** | 3 HDDs, RAID-Z1 | 4 HDDs, RAID-Z2 | 8 HDDs, RAID-Z2 | 4 HDDs, RAID-Z2 |
| **Pool drives that can fail** | 1 | 2 | 2 | 2 |
| **Boot drive** | Single M.2 NVMe | Single M.2 NVMe | Mirrored M.2 NVMe pair | Single M.2 NVMe |
| **AI accelerator** | Optional (Hailo-8 add-on) | Hailo-8 included | Hailo-8 included | Hailo-8 included |
| **Managed switch** | TP-Link TL-SG108PE | TP-Link TL-SG1210MPE | TP-Link TL-SG1218MP | Same as Sentinel |
| **WiFi on the NVR** | Yes | Yes | Yes | **None** (no radio on the motherboard) |

Every tier is sized so that **30 days of continuous recording** at its maximum camera count fits within healthy pool limits. Enclave shares Sentinel's hardware exactly apart from the motherboard, so its numbers match Sentinel's.

Where these come from, in more depth:

- Camera counts and stream targets: [NVR slow or dropping frames](troubleshooting/performance.md#argus-tier-expectations) and [Recording retention](storage/retention.md)
- Pool layouts, failure tolerance, and boot drives: [Drive and pool errors](troubleshooting/drive-errors.md#how-storage-is-set-up-on-argus-systems)
- AI accelerator: [Setting up an AI accelerator](cameras/hailo-tpu.md)
- Switches: [Camera VLAN in TP-Link switch](network/vlan-tplink.md)

---

## Network and access

| | **Vigil, Sentinel, Warden** | **Enclave** |
|---|---|---|
| **Network model** | VLAN-segmented: cameras isolated on their own VLAN | Air-gapped: no WiFi on the NVR or router, and the router's WAN port is never connected |
| **Internet connection** | Yes, through your router | None |
| **Reaching the NVR from your LAN** | By hostname, like `https://frigate.internal` | Not available |
| **Remote access** | Not included. Add [WireGuard](network/vpn-wireguard.md) on your router, or [Tailscale](privacy/remote-access.md) if you choose to install it | Not available |
| **Push notifications** | [ntfy](notifications/ntfy-setup.md) on your phone | Not available; events show on the attached monitor |
| **How you use it day to day** | Browser on any device on your network | Kiosk mode on an attached monitor and keyboard |

The networked tiers trade a small, well-isolated network exposure for remote viewing and phone alerts. Enclave gives those up entirely. If you want to check footage from your phone, Sentinel is the closer fit; see [Enclave: the air-gapped tier](network/enclave-tier.md) for what using Enclave actually looks like.

---

## Which guides apply to your tier

Almost every guide on this site applies to all four tiers. The exceptions need either a network path to the NVR or an internet connection, and Enclave has neither:

- [Remote access with WireGuard](network/vpn-wireguard.md) and [Remote access with Tailscale](privacy/remote-access.md)
- [Setting up push notifications](notifications/ntfy-setup.md) and [Not receiving notifications](troubleshooting/notifications.md)
- [Can't reach service by hostname](troubleshooting/hostname.md)
- [Updating containers](maintenance/container-updates.md) and [Updating Ubuntu Server](maintenance/ubuntu-updates.md), which pull updates from the internet. Enclave ships with current software; updating it afterwards is up to you

On Enclave, commands that other guides run over SSH run from a terminal on the attached monitor instead. See [Kiosk mode: how you actually use it](network/enclave-tier.md#kiosk-mode-how-you-actually-use-it).
