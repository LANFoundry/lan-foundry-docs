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

---

## Amcrest IP cameras

**Status:** Verified  
**Argus role:** Included on Vigil, Sentinel, Warden, and Enclave  
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
| **Enclave** | 4K at ~4 Mbps | Same as Sentinel — [Enclave shares Sentinel's hardware BOM exactly](../network/enclave-tier.md#whats-actually-different) |

Match bitrates in the camera's web interface if live view or recordings stutter. See [NVR running slow or dropping frames](../troubleshooting/performance.md).

### Argus-specific notes

- Cloud and phone-home features should remain disabled. See [Understanding network segmentation and VLANs](../privacy/blocking-telemetry.md) for why isolation matters.
- OSD (timestamp overlays) is adjusted in the camera web UI, not in Frigate.
- If you change the camera password, update every stream URL in `config.yml`.

### Specific models

We will add individual Amcrest model numbers here as we document the exact SKUs bundled with each Argus tier. The RTSP path above applies to the Dahua-based Amcrest IP camera line used on Argus systems today.

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

If you run Argus hardware with a camera not listed here, or you have corrections to an existing entry, contact us through [lanfoundry.com/support](https://lanfoundry.com/support). Useful details:

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
