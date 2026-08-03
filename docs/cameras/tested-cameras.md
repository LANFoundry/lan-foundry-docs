# Tested camera list

This is a living reference for cameras we have verified with Frigate on the Argus software stack. It focuses on stream URLs, authentication, and practical notes rather than repeating the full setup walkthrough.

For step-by-step instructions, see [Adding your first camera to Frigate](first-camera.md). If a configured camera won't show a feed, see [Camera feed not showing in Frigate](../troubleshooting/camera-feed.md).

!!! note "This page evolves"
    We add entries as we verify hardware in the lab and on customer systems. If a camera is not listed here, it may still work through ONVIF and RTSP. See [What is ONVIF and why does it matter](../privacy/what-is-onvif.md) for background on compatibility.

---

## How to read this list

| Column | Meaning |
|---|---|
| **Status** | Whether LAN Foundry has verified the camera on Argus hardware |
| **Argus role** | Included with a tier, available as an upgrade, or DIY-only |
| **RTSP auth** | How credentials appear in the stream URL |
| **Detect stream** | Lower-bandwidth input for Frigate object detection |
| **Record stream** | Higher-quality input for continuous recording |

**Status values**

| Status | Meaning |
|---|---|
| **Verified** | Tested on Argus hardware by LAN Foundry |
| **Pending** | Expected to work based on manufacturer docs; awaiting hands-on Argus verification |
| **Community** | Reported working by users; not validated by LAN Foundry |

---

## Quick reference

| Camera | Status | Argus role | RTSP port | Auth |
|---|---|---|---|---|
| Amcrest IP cameras | Verified | Included (all tiers) | `554` | `admin` + password in URL |
| Ubiquiti G5 series | Pending | Vigil upgrade option | `7447` (typical) | Per-stream token |
| Ubiquiti G6 series | Pending | Sentinel / Warden upgrade option | `7447` (typical) | Per-stream token |

---

## Amcrest IP cameras

**Status:** Verified  
**Argus role:** Included on Vigil, Sentinel, and Warden  
**ONVIF:** Profile S (typical on Amcrest models we ship)

Argus systems ship with Amcrest cameras pre-configured for local NVR use: DHCP enabled, RTSP enabled, username `admin`, and a factory password documented in your Argus welcome materials. We do not publish default passwords in this documentation.

### RTSP URLs

Replace `YOUR_PASSWORD` and the camera IP address. Each physical camera uses its own IP on the camera VLAN with `channel=1`.

**Main stream (record):**

```
rtsp://admin:YOUR_PASSWORD@192.168.10.101:554/cam/realmonitor?channel=1&subtype=0
```

**Sub stream (detect):**

```
rtsp://admin:YOUR_PASSWORD@192.168.10.101:554/cam/realmonitor?channel=1&subtype=1
```

### Frigate roles

| Stream | `subtype` | Frigate role | Notes |
|---|---|---|---|
| Sub | `1` | `detect` | Use this for object detection on all tiers |
| Main | `0` | `record` | Full-quality continuous recording |

### Recommended settings

| Argus tier | Typical main stream target | Detect notes |
|---|---|---|
| **Vigil** | 1080p at ~2 Mbps | Sub stream for detect; Hailo-8 optional |
| **Sentinel** | 4K at ~4 Mbps | Sub stream for detect; Hailo included |
| **Warden** | 4K at ~12 Mbps | Sub stream for detect; Hailo included |

Match bitrates in the camera's web interface if live view or recordings stutter. See [NVR running slow or dropping frames](../troubleshooting/performance.md).

### Argus-specific notes

- Cloud and phone-home features should remain disabled. See [Understanding network segmentation and VLANs](../privacy/blocking-telemetry.md) for why isolation matters.
- OSD (timestamp overlays) is adjusted in the camera web UI, not in Frigate.
- If you change the camera password, update every stream URL in `config.yml`.

### Specific models

We will add individual Amcrest model numbers here as we document the exact SKUs bundled with each Argus tier. The RTSP path above applies to the Dahua-based Amcrest IP camera line used on Argus systems today.

---

## Ubiquiti G5 series

**Status:** Pending verification on Argus  
**Argus role:** Upgrade option for **Vigil**  
**ONVIF:** Limited; RTSP is the supported third-party integration path

!!! note "Pending hands-on verification"
    LAN Foundry has not yet completed end-to-end verification of G5 cameras on Argus hardware. The information below reflects our expected configuration based on Ubiquiti documentation and Frigate community practice. This section will be updated when G5 cameras are validated in the lab. If you have G5 cameras on order, treat the stream URLs in your Argus welcome materials as authoritative until this page is marked **Verified**.

### How G5 differs from Amcrest

| | Amcrest | Ubiquiti G5 |
|---|---|---|
| Authentication | `admin:password@` in the URL | Unique token per stream; no username/password in the URL |
| RTSP port | `554` | Typically `7447` on the camera |
| Stream selection | `subtype=0` / `subtype=1` | Separate URL per quality level (high / medium / low) |
| Setup UI | Camera web interface | UniFi Protect or UniFi device settings |
| Argus pre-config | DHCP, RTSP, password | DHCP, RTSP enabled, tokens recorded at the factory |

### RTSP URL format

Each enabled stream gets its own URL:

```
rtsp://192.168.10.101:7447/YOUR_UNIQUE_STREAM_TOKEN
```

Tokens are not interchangeable between cameras or between quality levels. On Argus systems, copy the URLs from your welcome materials. If you enable RTSP yourself, the UniFi app shows the URL under each camera's **Settings**, **Advanced** or **Share Livestream** section.

### Frigate roles

| UniFi stream quality | Frigate role |
|---|---|
| Low or medium | `detect` |
| High | `record` |

### Common G5 models

We expect to verify these models first on Vigil upgrades. Exact SKUs may vary by availability:

| Model | Form factor | Notes |
|---|---|---|
| G5 Bullet | Outdoor bullet | |
| G5 Dome | Outdoor dome | |
| G5 Turret Ultra | Outdoor turret | Higher resolution variant |

### Network notes

- Allow port **7447** from the NVR to the camera VLAN in OPNsense, not just port `554`. See the firewall rule in [Setting up a camera VLAN in OPNsense](../network/vlan-opnsense.md).
- If Ubiquiti provides an `rtsps://` URL on port `7441`, convert to `rtsp://` on port `7447` and remove any `?enableSrtp` suffix before using the URL in Frigate.

---

## Ubiquiti G6 series

**Status:** Pending verification on Argus  
**Argus role:** Upgrade option for **Sentinel** and **Warden**  
**ONVIF:** Limited; RTSP is the supported third-party integration path

!!! note "Pending hands-on verification"
    Same as G5: expected configuration is documented here, but LAN Foundry has not yet marked G6 cameras as **Verified** on Argus hardware. Update this page after lab testing with your specific G6 models.

G6 cameras follow the same RTSP model as G5: token-based URLs on port `7447`, separate URLs per stream quality, and configuration through UniFi device settings rather than a simple `admin` web login.

### RTSP URL format

```
rtsp://192.168.10.101:7447/YOUR_UNIQUE_STREAM_TOKEN
```

Use the **low** or **medium** quality URL for `detect` and the **high** quality URL for `record`. Tokens come from your Argus welcome materials or from the UniFi app after enabling RTSP on each stream.

### Common G6 models

We expect to verify these models first on Sentinel and Warden upgrades:

| Model | Form factor | Notes |
|---|---|---|
| G6 Bullet | Outdoor bullet | |
| G6 Dome | Outdoor dome | |
| G6 Instant | Compact indoor | |
| G6 Pro | Higher-end outdoor | |
| G6 Turret | Outdoor turret | |

Model availability and naming may change as Ubiquiti updates their product line. Confirm the exact model on your order or welcome materials.

### Tier fit

| Tier | Upgrade camera line | Typical stream target |
|---|---|---|
| **Sentinel** | G6 | 4K at ~4 Mbps (align with [performance expectations](../troubleshooting/performance.md)) |
| **Warden** | G6 | 4K at ~12 Mbps |

---

## Cameras not on this list

ONVIF compliance alone does not guarantee a smooth Frigate experience. A camera may connect but offer poor RTSP documentation, aggressive cloud lock-in, or stream paths that change after firmware updates.

If you want to try a camera we have not verified:

1. Confirm **ONVIF Profile S** and a documented **RTSP** URL in the manufacturer's specs.
2. Disable cloud and telemetry features in the camera UI before putting it on your camera VLAN.
3. Test the stream from the NVR with `ffprobe` before adding it to `config.yml`.
4. Start with a sub stream or lower resolution for `detect`.

Community reports for other brands (Reolink, Hikvision, Axis, etc.) may appear here over time with a **Community** status if we cannot validate them on Argus hardware ourselves.

---

## Reporting results

If you run Argus hardware with a camera not listed here, or you have corrections to an existing entry (especially after we mark Ubiquiti **Verified**), contact us through [lanfoundry.com/support](https://lanfoundry.com/support). Useful details:

- Camera make, model, and firmware version
- Argus tier
- RTSP URLs used (redact passwords and tokens)
- Whether detect and record streams are stable over 24 hours

---

## Where to go from here

- [Adding your first camera to Frigate](first-camera.md), for the full setup walkthrough
- [Camera feed not showing in Frigate](../troubleshooting/camera-feed.md), when a stream fails after setup
- [What is ONVIF and why does it matter](../privacy/what-is-onvif.md), when evaluating cameras we have not tested
- [NVR running slow or dropping frames](../troubleshooting/performance.md), when stream bitrates need adjustment
