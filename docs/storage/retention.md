# Retention policies

Retention settings control how long Frigate keeps video segments, snapshots, and related media on your NVR before deleting them automatically.

Each Argus tier is sized so that **30 days of continuous recording** at that tier's **maximum camera count** fits within healthy ZFS pool limits. Vigil, Sentinel, and Warden use different pool sizes and camera limits, but the retention target is the same: a full month of uninterrupted timeline on every camera when the system is loaded as designed.

Argus systems ship with retention already configured in `config.yml` for that goal. You do not need to change anything on day one if you stay within your tier's camera count and stream targets. This guide explains how that works, when you might adjust it, and how to apply changes safely.

For where files live on disk, see [How Frigate stores recordings](frigate-storage.md). For a full or failing pool, see [Drive and pool errors](../troubleshooting/drive-errors.md).

---

## Before you start

This guide assumes:

- Frigate is running and cameras have the **record** role on at least one stream
- You can SSH into the NVR and edit text files
- You know where `config.yml` lives (see below if not)

Throughout this guide, example IP addresses are used for clarity. Replace them with the addresses from your own network:

- **NVR (main LAN):** `192.168.1.100`

**Back up before you edit.** Retention lives in `config.yml`. A syntax mistake can stop Frigate from starting. See [Backing up your Frigate configuration](../maintenance/backup.md).

---

## How Frigate decides what to keep

Frigate does not store one giant video file per day. It writes short **segments** (roughly ten seconds each) from the **record** stream, then applies retention rules to decide which segments stay on disk. See [How Frigate stores recordings](frigate-storage.md#how-recording-segments-are-organized) for the folder layout.

Retention is controlled in the top-level **`record:`** section of `config.yml`. You can override parts of it per camera under `cameras:`.

### The four retention layers

| Layer | Config key | What it keeps |
|---|---|---|
| **Continuous** | `record.continuous.days` | Every segment, whether or not anything moved |
| **Motion** | `record.motion.days` | Segments where Frigate saw motion |
| **Alerts** | `record.alerts.retain` | Segments that overlap **alert** review items (higher-priority activity) |
| **Detections** | `record.detections.retain` | Segments that overlap **detection** review items (other tracked activity) |

**Alerts** and **detections** are Frigate's review categories, not separate video files. By default, people and cars on your property tend to count as **alerts**. Other tracked objects (dogs, packages, audio events, and similar) often fall under **detections**. You can refine that with zones and labels in a future [zones and motion guide](../cameras/zones-motion.md).

When more than one rule applies to the same segment, Frigate keeps it for the **longest** matching period. A driveway clip that qualifies as both motion and an alert stays until the alert retention expires if that is the longer window.

### Retention modes for alerts and detections

For `alerts` and `detections`, you set both **days** and **mode**:

| Mode | Plain-language meaning |
|---|---|
| **`all`** | Keep every segment in the time range that overlaps the review item |
| **`motion`** | Keep segments with motion during that overlap |
| **`active_objects`** | Keep segments where a tracked object was moving (tightest clip around the activity) |

`continuous` and `motion` layers only use **days**, not mode.

### What actually gets written to disk

Frigate buffers new segments in cache first. Segments are moved to the recording pool only when they match your retention policy. If continuous and motion are both set to `0` days and you only retain **alerts**, quiet periods may never land on disk at all. That saves space but means there is no hidden footage outside alert windows.

---

## Find your config file

```bash
docker inspect frigate --format '{{ range .Mounts }}{{ if eq .Destination "/config" }}{{ .Source }}{{ end }}{{ end }}'
```

Open `config.yml` in that directory. The `record:` block is usually near the top of the file, above individual `cameras:` entries.

---

## How Argus systems are configured

LAN Foundry sizes each Argus tier's ZFS recording pool so that **30 days of continuous footage** on **every camera at once** stays within safe pool usage, with headroom below the 95% threshold where recordings and performance start to suffer.

| Tier | Max cameras | Stream target | Pool layout |
|---|---|---|---|
| **Vigil** | 4 | 1080p at ~2 Mbps each | 3-drive RAID-Z1 |
| **Sentinel** | 6 | 4K at ~4 Mbps each | 4-drive RAID-Z2 |
| **Warden** | 12 | 4K at ~12 Mbps each | 8-drive RAID-Z2 |

The smaller pool on Vigil holds fewer drives, but it also targets fewer cameras at lower bitrates. The larger Warden pool targets more cameras at higher bitrates. Each pairing is calculated for the same **30-day continuous** goal.

See [NVR running slow or dropping frames](../troubleshooting/performance.md#argus-tier-expectations) for tier limits and [Drive and pool errors](../troubleshooting/drive-errors.md#how-storage-is-set-up-on-argus-systems) for pool layout details.

### Stock retention policy

Out of the box, Argus systems use **continuous retention** as the primary policy. Your `config.yml` will include a `record:` block along these lines:

```yaml
record:
  enabled: true
  continuous:
    days: 30
```

That keeps every recording segment for 30 days before Frigate deletes it automatically. You may also see additional keys (`motion`, `alerts`, `detections`, or `snapshots`) in the same file. Those fine-tune how Frigate handles review items and still images. For day-to-day use on a stock system, **`continuous.days: 30`** is the number that defines your main timeline depth.

### What you should expect on a stock system

When you are at or below your tier's max camera count and using stream settings in line with the targets above:

- The Frigate timeline should reach back about **30 days** on each camera
- Pool usage should stay in a healthy range without manual tuning
- You do **not** need to pick a different retention "profile" or copy example configs from Frigate's upstream documentation

If that matches your setup, treat retention as something to **understand**, not something to **change**.

---

## Fine-tuning: longer event history

If you want to go beyond the stock policy without giving up the 30-day continuous timeline, the most practical fine-tune is to keep **motion**, **alerts**, and **detections** longer than **continuous**. That preserves full scrubbing for 30 days while holding on to activity-linked clips in case you need them later.

This is optional. Argus pools are sized for 30-day continuous at tier max cameras, not for extra event history on top. It works well when you have **headroom** (fewer than max cameras, lower bitrates, or a tier with spare capacity). Watch pool usage after any change.

### How it behaves

With `continuous.days: 30` and longer values on the other layers:

| Age of footage | What you still have |
|---|---|
| **0–30 days** | Full continuous timeline on every camera (unchanged) |
| **31–60 days** (or whatever you set) | Only segments that still match **motion**, **alert**, or **detection** rules |

Quiet overnight footage, empty driveway stretches, and similar still roll off at 30 days. A delivery, visitor, or person on camera can remain searchable longer if that moment overlapped an alert or detection. This is **not** the same as extending continuous to 60 days. You cannot scrub minute-by-minute through day 45 the way you can through day 15.

Frigate does not duplicate video for each layer. A segment is kept until the **longest** matching rule expires, as described in [How Frigate decides what to keep](#how-frigate-decides-what-to-keep).

### Recommended starting point

LAN Foundry suggests keeping **continuous at 30 days** and extending review-related layers to **45 or 60 days** if you want a longer safety net for incidents:

```yaml
record:
  enabled: true
  continuous:
    days: 30
  motion:
    days: 45
  alerts:
    retain:
      days: 60
      mode: active_objects
  detections:
    retain:
      days: 60
      mode: active_objects
```

**Why these modes:** `active_objects` keeps the tightest clip around real tracked activity and uses the least extra space. `motion` is a reasonable middle ground. `all` keeps the widest window around each review item and costs the most. Use `all` only on cameras where you truly need maximum context.

You can set different day counts per layer. **Alerts** and **detections** usually add the least storage because they fire less often than raw motion. **Motion** extended beyond continuous adds more, because wind, shadows, and passing traffic trigger it frequently on some cameras.

### Storage impact: usually modest, except on busy cameras

Extending **continuous** from 30 to 60 days roughly **doubles** 24/7 storage on every camera. That is a large hit and fights the Argus pool design.

Extending **alerts** and **detections** to 60 while leaving continuous at 30 only keeps **extra segments in the 30–60 day window** that qualify as alerts or detections. On a typical home setup, that is often a **small** increase relative to total pool usage.

**Motion** at 60 days can add more, because many cameras see motion often:

| Camera type | Typical extra storage from 45–60 day motion/alerts |
|---|---|
| **Back yard, side of house** | Usually modest |
| **Front door, porch** | Moderate |
| **Driveway, street, busy intersection** | Can be **significant**; motion may fire constantly |

A camera pointed at a road or sidewalk may retain a large fraction of its day as "motion" for the extra 15–30 days. On a maxed-out tier, that one feed can push the pool toward 90% faster than quiet cameras.

**Practical approach:**

- Apply **global** extended alert/detection retention if the system is not at tier max
- Use **per-camera overrides** to extend motion or alerts on important views (front door, gate) and leave busy street cameras on shorter motion retention or alerts-only
- After editing, check `df -h` weekly for the first month

Example: global 60-day alerts, but shorter motion on a busy street camera:

```yaml
record:
  enabled: true
  continuous:
    days: 30
  motion:
    days: 45
  alerts:
    retain:
      days: 60
      mode: active_objects
  detections:
    retain:
      days: 60
      mode: active_objects

cameras:
  front_door:
    ffmpeg:
      inputs:
        # ... stream paths and roles ...
    # uses global settings

  street_view:
    ffmpeg:
      inputs:
        # ... stream paths and roles ...
    record:
      motion:
        days: 30
      alerts:
        retain:
          days: 60
          mode: active_objects
```

Here `street_view` does not keep motion-only clips beyond the continuous window, but alert-linked footage can still reach 60 days.

---

## When to adjust retention

Adjust retention when your usage has moved **outside what the tier was sized for**. Common reasons:

| Situation | What to consider |
|---|---|
| **More cameras than your tier max** | Shorten `continuous.days`, disable recording on low-priority cameras, or plan a tier upgrade |
| **Stream bitrates well above tier targets** | Lower bitrate in camera settings, or shorten retention |
| **Pool at 90% or higher** | Shorten retention before you hit 95%. See [Free up space](#free-space-in-a-hurry) |
| **You want longer than 30 days of full timeline** | Raise `continuous.days` (expensive) or use [Fine-tuning: longer event history](#fine-tuning-longer-event-history) for activity-only history beyond 30 days |
| **You want less than 30 days** | Lower `continuous.days` to free space for other changes |

Adding one extra camera on an otherwise stock Sentinel is not always a crisis, but stacking several cameras above tier max **and** running high bitrates **and** keeping 30-day continuous retention will fill the pool faster than the design allows.

---

## Advanced retention shapes (optional)

Frigate supports layered policies beyond simple continuous retention. Argus does **not** ship with these as defaults. They are useful if you **deliberately** want a different tradeoff, usually to save space after you have exceeded tier headroom.

These examples come from [Frigate's recording documentation](https://docs.frigate.video/configuration/record/). Do not apply them on a stock Argus system unless you understand you are moving away from the 30-day continuous design.

### Layered continuous, motion, and review retention

Keeps a few days of everything, then motion-only, then longer windows around alerts and detections:

```yaml
record:
  enabled: true
  continuous:
    days: 3
  motion:
    days: 7
  alerts:
    retain:
      days: 30
      mode: all
  detections:
    retain:
      days: 30
      mode: all
```

### Motion and review items only (no continuous window)

```yaml
record:
  enabled: true
  motion:
    days: 3
  alerts:
    retain:
      days: 30
      mode: motion
  detections:
    retain:
      days: 30
      mode: motion
```

### Alerts only (minimum storage)

```yaml
record:
  enabled: true
  continuous:
    days: 0
  motion:
    days: 0
  alerts:
    retain:
      days: 30
      mode: motion
```

With `continuous.days` and `motion.days` at `0`, quiet periods may never be written to disk. You lose the uninterrupted 30-day timeline that Argus is designed around.

---

## Per-camera overrides

Global `record:` settings apply to every camera unless a camera defines its own `record:` block. On a stock Argus system, every camera inherits **`continuous.days: 30`**.

Use overrides sparingly. Extending retention on one camera consumes pool space that was budgeted across all cameras on the tier.

Example: keep **45 days continuous** on `front_door` while other cameras stay at 30. Raising **alerts** or **detections** on one camera instead often achieves a similar goal with less storage. See [Fine-tuning: longer event history](#fine-tuning-longer-event-history). Only extend continuous per camera if you have fewer than the tier max cameras, or accept that pool usage will climb:

```yaml
record:
  enabled: true
  continuous:
    days: 30

cameras:
  front_door:
    ffmpeg:
      inputs:
        # ... stream paths and roles ...
    record:
      continuous:
        days: 45

  side_yard:
    ffmpeg:
      inputs:
        # ... stream paths and roles ...
    # no record: block — uses global 30-day continuous
```

You can override **continuous**, **motion**, **alerts**, or **detections** independently per camera. After any override, watch pool usage with `df -h` over several days.

### Temporarily stop recording on one camera

To relieve pool pressure without removing the camera from Frigate:

```yaml
cameras:
  garage:
    record:
      enabled: false
```

The live view and detection roles still work. Only recording to the pool stops until you re-enable it.

---

## Snapshots and exports

### Snapshots

Event snapshots (still images under `/media/frigate/clips/`) have their own retention, separate from video segments:

```yaml
snapshots:
  enabled: true
  retain:
    default: 30
```

You can override `retain.default` per camera under `cameras.<name>.snapshots`. Snapshots are much smaller than video but add up over months on busy cameras.

### Exports

Clips and timelapses you export from the Frigate UI are saved under `/media/frigate/exports/`. Frigate does **not** auto-expire exports on a timer. Remove old exports from the **Export** view in the UI when you no longer need them.

---

## Change retention and apply it

### Step 1 — Back up `config.yml`

Follow [Backing up your Frigate configuration](../maintenance/backup.md). At minimum, copy the current file to a dated folder before editing.

### Step 2 — Edit the `record:` section

Change **days** values or **mode** settings. YAML is indentation-sensitive. Use spaces, not tabs, and line up nested keys exactly as in the examples above.

Retention supports **decimals** if you need a partial day (for example `0.5`).

### Step 3 — Restart Frigate

```bash
docker restart frigate
```

If Frigate fails to start, check for YAML errors:

```bash
docker logs frigate --tail 50
```

Restore from backup if needed. See [Restoring from a backup](../maintenance/restore.md).

### Step 4 — Confirm cleanup is working

Frigate runs a cleanup pass on a schedule (default: about every **60 minutes**). After you **shorten** retention, free space may not appear immediately. Check pool usage over the next few hours:

```bash
df -h
zpool list
```

Old segments disappear from the timeline in Frigate as they expire.

---

## Free space in a hurry

If the pool is **95% full or higher**, treat it as urgent. See [Free up space](../troubleshooting/drive-errors.md#free-up-space) in the drive-errors guide.

**Fastest config changes:**

1. Lower `continuous.days` and `motion.days` globally
2. Shorten `alerts.retain.days` and `detections.retain.days` if you can accept less history
3. Set `record.enabled: false` on non-essential cameras until usage is healthy again

**Do not** bulk-delete files under the recordings folder by hand as your first move. That can desync Frigate's database from disk. Retention and the UI are the supported cleanup paths. See [What not to do](frigate-storage.md#what-not-to-do).

### Emergency behavior when the pool is almost empty

If Frigate detects **less than about one hour** of free space remaining, it deletes the **oldest hour of recordings** regardless of your retention settings and logs a warning. That is a last-resort safety valve, not a substitute for planning retention before the pool fills up.

---

## Planning retention around your system

On a stock Argus system within tier limits, retention is already planned for you: **30 days continuous at max camera count**, with pool headroom built in.

If you change the load on the system, revisit retention:

| Factor | Effect |
|---|---|
| **More cameras than tier max** | Uses pool faster than the 30-day design allows |
| **Higher record stream bitrate** | Larger segments; same 30 days needs more space |
| **Longer alert/motion/detection layers above continuous** | Modest on quiet cameras; can be large on busy street-facing feeds |
| **Longer `continuous.days`** | Directly increases storage need on every camera |
| **More exports** | Manual clips in `/media/frigate/exports/` are not auto-expired |

If you add cameras or raise main-stream quality, check `df -h` monthly and adjust before you hit 90%. See [NVR running slow or dropping frames](../troubleshooting/performance.md) for stream and detection tuning that also affects storage load.

---

## What normal looks like

On a stock Argus system at or below tier max cameras:

- The Frigate timeline reaches back about **30 days** on each camera with continuous recording enabled
- Pool usage stays below the danger zone without manual retention edits
- `docker logs frigate` does not repeat "no space left on device"

After you **extend** event retention (alerts, motion, or detections beyond 30 days):

- Days 0–30 still scrub like a normal continuous timeline
- Days 31+ show activity-linked clips only, not uninterrupted footage
- Pool usage may climb slowly; busy cameras drive most of the increase

After you **shorten** retention manually:

- The Frigate timeline still plays recent footage normally
- Older dates roll off the timeline as segments expire (expected)
- `df -h` shows pool usage trending down within a few cleanup cycles when you shortened retention
- `docker logs frigate` does not repeat "no space left on device"

If footage vanishes **sooner** than your configured days, check whether recording was disabled on that camera, whether you are above tier capacity, or whether emergency deletion ran during a full pool.

---

## Where to go from here

- [How Frigate stores recordings](frigate-storage.md), for paths, segments, and the database
- [Drive and pool errors](../troubleshooting/drive-errors.md), when the pool is full or unhealthy
- [Backing up your Frigate configuration](../maintenance/backup.md), before editing `config.yml`
- [Adding your first camera to Frigate](../cameras/first-camera.md#roles-in-configyml), for record vs detect streams
- [Frigate recording documentation](https://docs.frigate.video/configuration/record/), for advanced options such as scheduled recording and sync
