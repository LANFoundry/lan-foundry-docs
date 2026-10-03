# Going air-gapped with Enclave

[Vigil, Sentinel, and Warden](../argus-tiers.md) are already privacy-first: no cloud dependency, cameras isolated on their own VLAN, everything reachable only on your own network. But they're still **networked**. Enclave is a different guarantee: no WiFi hardware at all, paired with a router that has none either, on a network that never connects to the internet. There is no wireless attack surface and no internet path to defend in the first place.

This page covers what's actually different about it and how you use a system that, by design, has no network-based way to reach it at all.

---

## Segmented versus air-gapped

Worth being precise about this distinction, since it's easy to conflate:

- **VLAN segmentation** (Vigil/Sentinel/Warden) keeps cameras isolated from the rest of your LAN, but the NVR itself is still reachable over the network — that's how you get `https://frigate.internal`, Tailscale, and WireGuard remote access at all.
- **Air-gapped** (Enclave) removes wireless capability at the hardware level and never connects the network to the internet: the router's WAN port stays unplugged. There's no WiFi radio to compromise, socially engineer, or man-in-the-middle, and no internet connection for anything to come in or go out over. The tradeoff is exactly what you'd expect: no remote access, no reaching it from another device on the LAN by hostname, nothing except what's plugged directly into the box.

If you want the isolation of VLAN segmentation but still want to check footage from your phone, Sentinel is the right tier, not Enclave. Enclave is for the smaller set of people who've decided that even a well-isolated network connection is more exposure than they want.

---

## What's actually different

Enclave shares Sentinel's hardware BOM exactly, same drive count, same RAID level, same Hailo-8 accelerator. Two things change:

- **The motherboard has no WiFi radios.** It's a build-time hardware decision, not a firmware toggle.
- **No headless network interface.** Vigil/Sentinel/Warden assume you'll reach the NVR from another device. Enclave has no practical way to do that, so the attached monitor and keyboard are the interface.

---

## How it's wired

The wiring looks like the networked tiers with one connection missing:

- **Cameras** plug into the managed switch and sit on their own camera VLAN, the same as on Sentinel.
- **The NVR** connects to the switch by Ethernet. It has no WiFi radio to connect any other way.
- **The router** runs OPNsense on hardware with no WiFi radio, and handles the camera VLAN, DHCP, and firewall rules. Its LAN port connects to the switch.
- **The router's WAN port is never connected.** Nothing on this network reaches the internet, and nothing on the internet can reach in.
- **A monitor and keyboard** plug directly into the NVR. They're the only way to use it.

If the router has a WAN port plugged in, the system is behaving like a wired-only Sentinel, not Enclave.

---

## Kiosk mode: how you actually use it

Enclave boots straight into a full-screen view of the Frigate web interface on whatever monitor is plugged in — no login screen, no desktop. This works whether or not the rest of the stack is fully up yet: the kiosk session waits for Frigate to actually respond before loading it, rather than showing a broken connection error.

**Reaching a terminal.** Since the monitor is the only interface, getting to a shell has to be reliable:

- `Ctrl+Alt+T` opens a terminal window directly on top of the running Frigate view. Closing it returns you to Frigate, nothing needs restarting.
- `Ctrl+Alt+F2` switches to a completely separate, normal login console (standard Linux virtual terminal switching, left untouched). `Ctrl+Alt+F1` switches back to the kiosk view.

Both work at all times. Neither is a hidden or fragile escape hatch.

**If the kiosk stays blank or never loads Frigate.** The kiosk waits for Frigate to respond, so a screen that never gets past waiting usually means Frigate itself isn't running. Open a terminal with `Ctrl+Alt+T` (or `Ctrl+Alt+F2` if the kiosk window isn't responding) and check:

```bash
docker ps
docker logs frigate --tail 50
```

If `frigate` is missing or keeps restarting, see [What to do when a container won't start](../troubleshooting/container.md). Once Frigate is up, the kiosk loads it on its own.

---

## Exporting footage

Frigate's own export feature saves a clip to disk. Normally your browser would ask where to save it, but kiosk mode has no address bar or dialogs to interact with — so that's configured to happen automatically instead. Exported clips land in a fixed folder (`~/exports` for the kiosk session) with no prompt.

To get a clip onto a USB drive:

1. Export the clip from Frigate's interface as usual. Frigate saves the export in its own storage first.
2. Open Frigate's **Exports** page and click **Download** on the clip. This is the step that saves it to `~/exports`.
3. Plug in a USB drive. It mounts automatically (no manual `mount` command needed) under `/media/usb0`.
4. `Ctrl+Alt+T` for a terminal, then copy it over and check it arrived:
   ```bash
   cp ~/exports/<filename> /media/usb0/
   ls -lh /media/usb0/
   ```
5. Flush the copy to the drive and unmount it before pulling it out:
   ```bash
   sync
   sudo umount /media/usb0
   ```
   When `umount` returns with no error, it's safe to remove the drive. If it reports the target is busy, close any terminal that's still inside `/media/usb0` and try again.

---

## Recommended router

Enclave's isolation only holds if the router it's paired with matches the same philosophy. Look for OPNsense-compatible hardware with no WiFi radio built in, not a consumer router with wireless switched off in software.

### What to look for

- **x86_64 hardware.** OPNsense is FreeBSD-based and needs a real x86_64 CPU. Some low-cost "router appliance" boards are built for pfSense's ARM builds specifically; that hardware may not run OPNsense at all, so confirm before buying.
- **No WiFi radio, and ideally no slot for one.** A board with an empty M.2 or mini-PCIe WiFi slot is still a board someone could add a radio to later. Hardware that never had the slot to begin with is the closer match to Enclave's own motherboard.
- **Fanless.** This runs 24/7 as an appliance. Passive cooling is one less moving part to fail.
- **Wired Intel NICs.** Cameras ride the LAN port as a tagged VLAN to the managed switch, the same as the [OPNsense VLAN guide](vlan-opnsense.md) assumes, so one LAN port is all Enclave uses. Most appliances in this category also have a WAN port; on Enclave it stays unplugged.

### Options worth looking at

| Option | Trade-off |
|---|---|
| **Protectli Vault** | Purpose-built for pfSense/OPNsense, fanless, multiple Intel NICs. Some models ship with no wireless slot in the chassis at all; look for those specifically rather than one with an empty slot |
| **PC Engines APU2 / APU4 / APU6** | Long-standing favorite in the OPNsense community, fanless, three Intel NICs. Ships without WiFi, but do not populate the mini-PCIe slot it does have |
| **Generic fanless mini-PC appliances** (Qotom and similar) | Widely available and inexpensive, but confirm the specific SKU has no WiFi module before ordering: some product lines sell WiFi and no-WiFi variants side by side under similar names |

This hardware category turns over regularly; verify current model availability and specs before ordering rather than treating this list as fixed.

The VLAN, DHCP, firewall, and local DNS configuration is the same as covered in the [Network Setup](index.md) guides. The difference is that the WAN port is never connected, so anything in those guides that reaches the internet won't work on this network, including upstream DNS lookups and OPNsense's own firmware updates.

---

## What doesn't apply here

[Remote access with Tailscale](tailscale.md) and [Remote access with WireGuard](vpn-wireguard.md) are both **not applicable** to Enclave, since both need outbound network connectivity, which this tier doesn't have. If remote access matters to you, Sentinel is the tier to look at instead.

The same goes for two troubleshooting guides, [Can't reach service by hostname](../troubleshooting/hostname.md) and [Not receiving notifications](../troubleshooting/notifications.md). The rest of [Troubleshooting](../troubleshooting/index.md) applies; run its commands from the local terminal instead of over SSH.

---

## Where to go from here

- [Understanding network segmentation and VLANs](../privacy/blocking-telemetry.md), for the VLAN-level segmentation model Enclave goes a step further than
- [Network Setup](index.md), for the OPNsense configuration itself, unchanged from any other tier
- [Running your own containers safely](../further/container-networking.md), if you're extending the stack and want to keep the same isolation principle for anything you add
