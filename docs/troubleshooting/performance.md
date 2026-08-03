# NVR running slow or dropping frames

Your cameras are connected and Frigate is recording, but live view stutters, motion alerts arrive late, or recordings look choppy. The Frigate interface feels sluggish, or you see warnings about dropped frames in the logs.

This guide walks through finding out what's limiting performance and what you can change to fix it. Slow NVR behavior usually comes down to one of three things: the CPU can't keep up with decoding and object detection, storage can't write fast enough, or your camera streams are asking for more than the hardware is sized to handle.

---

## Before you start

This guide assumes:

- Frigate is running and camera feeds are connected
- The problem is performance or frame drops, not a camera that won't connect at all. If feeds aren't showing, start with [Camera feed not showing in Frigate](camera-feed.md)
- You can reach the NVR over SSH or through Cockpit at `https://cockpit.internal`

Throughout this guide, example IP addresses are used for clarity. Replace them with the addresses from your own network:

- **NVR (main LAN):** `192.168.1.100`
- **Router / OPNsense (main LAN):** `192.168.1.1`
- **Cameras (camera VLAN):** `192.168.10.101`, `192.168.10.102`, and so on

Your subnets may differ if you've chosen different ranges during setup. The addresses above match the other LAN Foundry network guides.

---

## What normal looks like

On a healthy system within its designed camera count and stream settings:

- Live view in Frigate updates smoothly with only occasional brief buffering
- Object detection keeps up with motion in real time or close to it
- Recordings play back without visible stutter or large gaps
- The Frigate web interface and other services on the NVR remain responsive

Some load is expected. Frigate is constantly decoding video, running object detection, and writing recordings to disk. CPU usage will not sit at idle. The question is whether the hardware is keeping up with the work you're asking it to do.

---

## Figure out where it's failing

| What you're seeing | Likely cause | Jump to |
|---|---|---|
| Live view stutters on all cameras | CPU overload or too many high-bitrate streams | [CPU and stream load](#cpu-and-stream-load) |
| Detection is slow or misses obvious motion | Detection running on CPU, or sub stream not used | [Object detection load](#object-detection-load) |
| Recordings skip or have gaps | Storage I/O or full disks | [Storage and disk I/O](#storage-and-disk-io) |
| Problem started after adding cameras | Over tier capacity or stream settings too high | [Camera count and stream settings](#camera-count-and-stream-settings) |
| One camera stutters, others fine | That camera's stream settings | [Check each camera individually](#check-each-camera-individually) |
| Everything slow, not just Frigate | System-wide resource pressure | [Check overall system health](#check-overall-system-health) |

---

## Check overall system health

Start with a snapshot of how hard the NVR is working.

### From Cockpit

Browse to `https://cockpit.internal` on a device on your main LAN. Cockpit shows CPU, memory, and disk usage for the host.

Watch for:

- **CPU sustained above 90%** across all cores while Frigate is running
- **Memory nearly full**, leaving little headroom for buffers
- **Disk usage at or near 100%** on the volume where recordings are stored
- **High disk wait or I/O** indicators during active recording

Cockpit gives you the big picture. If CPU and disk both look comfortable, the problem is more likely stream or Frigate configuration than hardware limits.

### From the command line

SSH into the NVR and run:

```bash
htop
```

Press `F10` or `q` to exit. Look at load average relative to your CPU core count. A load average consistently higher than your core count means the system is overloaded.

Check disk space:

```bash
df -h
```

Any recording volume at 95% or above can cause performance problems even before recordings fail entirely.

Check disk I/O while Frigate is recording:

```bash
iostat -x 2 5
```

If `%util` on your recording drive stays near 100% and `await` is high, storage is struggling to keep up with write load. Install `sysstat` if `iostat` isn't available: `sudo apt install sysstat`.

---

## CPU and stream load

Frigate decodes every camera stream it processes. The main stream from a 4K camera uses significantly more CPU than a 720p sub stream. Running detection on the main stream from several cameras at once can overwhelm even capable hardware.

### Use the sub stream for detection

The single most effective optimization is to point object detection at the camera's lower-resolution sub stream and reserve the main stream for recording only. This is covered in detail in the [stream quality section of the camera feed guide](camera-feed.md#stream-quality-and-encoding-issues).

For Amcrest cameras, that means `subtype=1` for detect and `subtype=0` for record:

```yaml
cameras:
  front_door:
    ffmpeg:
      inputs:
        - path: rtsp://admin:password@192.168.10.101:554/cam/realmonitor?channel=1&subtype=1
          roles:
            - detect
        - path: rtsp://admin:password@192.168.10.101:554/cam/realmonitor?channel=1&subtype=0
          roles:
            - record
```

After changing `config.yml`, restart Frigate:

```bash
docker restart frigate
```

### Lower detection resolution

Even on the sub stream, you can reduce how much work detection does by lowering the detect resolution in Frigate's config:

```yaml
cameras:
  front_door:
    detect:
      width: 1280
      height: 720
      fps: 5
```

Lower `width`, `height`, and `fps` values reduce CPU and accelerator load. Detection at 5 fps is sufficient for most motion alerting use cases.

### Check camera bitrate settings

Cameras can be configured to stream at bitrates higher than necessary. A 1080p camera streaming at 8 Mbps uses four times the decode resources of the same camera at 2 Mbps with little visible benefit for security recording.

If you need to adjust bitrate or stream quality settings inside the camera's web interface, see [Accessing cameras from your computer](camera-feed.md#accessing-cameras-from-your-computer) for reaching cameras on an isolated VLAN from another device on your network.

---

## Object detection load

Object detection is the most CPU-intensive part of Frigate when no hardware accelerator is handling it. Running detection on CPU alone with multiple cameras will cause dropped frames and delayed alerts.

### Confirm your detector is active

In the Frigate web interface, open the **System** page. Look for detector statistics showing inference speed and whether a Hailo accelerator is listed.

From the command line, check Frigate logs for detector startup messages:

```bash
docker logs frigate 2>&1 | grep -i detector
```

You should see confirmation that your configured detector (Hailo or CPU) initialized successfully. Errors here mean object detection is failing or falling back to a mode you didn't intend.

### Argus tier expectations

LAN Foundry Argus systems are sized for specific camera counts and stream loads:

| Tier | Max cameras | Stream target | AI accelerator |
|---|---|---|---|
| **Vigil** | 4 | 1080p at ~2 Mbps each | Optional (Hailo-8 upgrade) |
| **Sentinel** | 6 | 4K at ~4 Mbps each | Hailo-8 included |
| **Warden** | 12 | 4K at ~12 Mbps each | Hailo-8 included |

If you've added cameras beyond your tier's maximum, or configured streams well above these bitrates, performance problems are expected rather than a sign of faulty hardware. The [camera expansion planning](https://lanfoundry.com/support) service can help if you're unsure whether your system has headroom.

Vigil systems without an AI accelerator rely on CPU for object detection. They work well at the default camera count with sub streams for detect, but detection will struggle if you run main streams for detect on all cameras simultaneously.

### Reduce what detection tracks

If you're running near capacity, narrow detection to what you actually need:

- Disable object detection on cameras that only need recording, not alerts
- Reduce the list of tracked objects in Frigate's config to those you care about
- Use motion masks and zones so detection only runs on areas that matter

See the [recording zones and motion detection](../cameras/zones-motion.md) guide for configuration details.

---

## Storage and disk I/O

Recording multiple high-bitrate streams writes a large amount of data continuously. If storage is slow, full, or failing, recordings stutter and the whole system can feel sluggish as writes queue up.

### Check available space

```bash
df -h
```

Frigate needs free space to write new recordings. If a recording volume is nearly full, reduce retention in your Frigate config or free space by removing old footage. See [How Frigate stores recordings](../storage/frigate-storage.md) and [Retention policies](../storage/retention.md).

### Check drive health

Failing drives often degrade in performance before they fail completely. Check pool status with `zpool status` and drive S.M.A.R.T. with `smartctl`. See [Drive and pool errors](drive-errors.md) for the full walkthrough.

Unusual clicking, very slow writes, or non-zero CKSUM counts in `zpool status` point to a hardware problem rather than a configuration issue.

### Recording too many streams at full quality

Recording every camera at main stream 4K simultaneously creates heavy sustained write load. If storage I/O is the bottleneck and you can't upgrade drives, consider recording some cameras at sub stream quality or reducing camera bitrate in the camera settings.

---

## Camera count and stream settings

Performance problems that appear after adding cameras are usually a capacity issue, not a bug.

Ask:

- How many cameras are active compared to your Argus tier maximum?
- Is detection running on the main stream for multiple cameras?
- Did you recently add cameras without adjusting detect resolution or fps?

If you're within tier limits and using sub streams for detect but still seeing drops, check the Frigate logs for ffmpeg errors:

```bash
docker logs frigate --tail 100 | grep -i "drop\|error\|warn"
```

Look for messages about frame drops, decoding errors, or streams falling behind. The log usually names the camera involved.

---

## Check each camera individually

When one camera's feed stutters but others are fine, focus on that camera's stream configuration rather than system-wide settings.

Compare the problem camera's Frigate config entry to a camera that performs well:

- Is it using the main stream for detect while others use the sub stream?
- Is the detect resolution or fps set higher?
- Is the camera streaming at a higher bitrate in its own settings?

Test that camera's stream independently from the NVR:

```bash
ffprobe -rtsp_transport tcp "rtsp://admin:password@192.168.10.101:554/cam/realmonitor?channel=1&subtype=0"
```

If the main stream alone causes high CPU when probed, lower the camera's bitrate or use the sub stream for detect.

---

## Quick reference

| Symptom | First check | Likely fix |
|---|---|---|
| All cameras stutter | Cockpit CPU usage | Sub stream for detect, lower detect fps |
| Slow object detection | Frigate System page, detector logs | Confirm Hailo active, reduce detect load |
| Choppy recordings | `df -h`, `iostat` | Free disk space, check drive health |
| Started after adding cameras | Camera count vs. tier max | Reduce streams or upgrade tier/accelerator |
| One camera stutters | Compare config to working camera | Fix stream URL roles or camera bitrate |
| High CPU, no accelerator | Argus tier and config | Add Hailo-8 or reduce detection scope |
| System wide sluggishness | Cockpit CPU, memory, disk | Address whichever resource is saturated |

---

## Where to go from here

Once performance is back to normal:

- [Setting up an AI accelerator](../cameras/hailo-tpu.md), if you're adding an accelerator to a Vigil system
- [Tuning motion sensitivity to reduce false alerts](../cameras/tuning-sensitivity.md), once detection is keeping up
- [Checking drive health with Cockpit](../storage/drive-health.md), if storage I/O was the bottleneck

**Related troubleshooting**

- [Camera feed not showing in Frigate](camera-feed.md)
- [What to do when a container won't start](container.md)

**If you're still stuck**

Check the [Frigate documentation](https://docs.frigate.video/configuration/) for hardware acceleration and performance tuning options specific to your Frigate version.

---

## LAN Foundry customer support

The guides on this site are free for everyone, whether you bought hardware from us or not. If you've worked through this guide and your NVR is still dropping frames or running poorly, there are a few more places to go depending on your situation.

**If you're running your own hardware**

The Frigate community forum and documentation are your best resources for performance tuning on custom hardware. Bring output from `docker logs frigate --tail 100`, your camera count, and whether you're using an AI accelerator.

**If you purchased an Argus system from LAN Foundry**

Visit [lanfoundry.com/support](https://lanfoundry.com/support) for support options and how to submit a ticket.

When you open a support request, include:

- Your Argus tier (Vigil, Sentinel, or Warden) and how many cameras are active
- What you're seeing (stuttering live view, delayed detection, choppy recordings, etc.)
- Screenshots or notes from Cockpit showing CPU, memory, and disk usage
- Whether a Hailo detector shows as active on Frigate's System page
- Output from `df -h` and the last fifty to one hundred lines of `docker logs frigate` mentioning drops, errors, or detector issues
- Any recent changes (cameras added, config edits, bitrate changes)

The more context you provide, the faster we can pinpoint the issue. If your system is still within its warranty period, check your purchase documentation for what coverage applies.
