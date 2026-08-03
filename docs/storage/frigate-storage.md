# How Frigate stores recordings

Frigate keeps your camera footage on the NVR itself, not in a cloud service. Understanding where those files live and how they are organized helps you plan retention, troubleshoot missing footage, and avoid filling the recording pool unexpectedly.

On Argus systems, recordings are written to the **ZFS pool** (NAS hard drives), separate from the M.2 boot drive that runs Ubuntu and Docker. This guide explains Frigate's storage layout inside the container, where that maps on your NVR, and what drives disk usage.

For retention settings and how to change how long footage is kept, see [Retention policies](retention.md). For a full pool or drive emergency, see [Drive and pool errors](../troubleshooting/drive-errors.md).

---

## Before you start

This guide assumes:

- Frigate is running and at least one camera is configured with the **record** role
- You can SSH into the NVR

Throughout this guide, example IP addresses are used for clarity. Replace them with the addresses from your own network:

- **NVR (main LAN):** `192.168.1.100`

You do not need to browse recording files for day-to-day use. The Frigate web interface is the normal way to review footage. This guide is for when you want to understand what is happening on disk.

---

## Where recordings live on Argus

Argus uses two storage layers:

| Layer | Hardware | What is stored |
|---|---|---|
| **Boot drive** | M.2 NVMe | Ubuntu, Docker, Frigate `config.yml`, database path mount |
| **Recording pool** | ZFS RAID-Z on NAS HDDs | Video segments, snapshots, exports |

Camera video does **not** go on the boot M.2 under normal operation. It goes to the ZFS pool through a Docker volume mount.

Pool layout by tier (Vigil 3-drive RAID-Z1, Sentinel 4-drive RAID-Z2, Warden 8-drive RAID-Z2) is described in [Drive and pool errors](../troubleshooting/drive-errors.md#how-storage-is-set-up-on-argus-systems).

---

## Inside the Frigate container

Frigate uses fixed paths inside the container. Docker maps these to folders on the host.

| Container path | Purpose |
|---|---|
| `/config` | `config.yml`, SQLite database (`frigate.db`), Frigate settings |
| `/media/frigate/recordings` | Continuous recording segments (`.mp4`) |
| `/media/frigate/clips` | Snapshots tied to events (Frigate may rename this to snapshots in future versions) |
| `/media/frigate/exports` | Clips and timelapses you export from the UI |
| `/tmp/cache` | Short-lived buffer while segments are finalized (often a memory-backed tmpfs) |

Your `config.yml` lives under `/config`. The **database** that indexes recordings and events also lives under `/config`, not under `/media/frigate`.

### Find the host paths on your NVR

```bash
docker inspect frigate --format '{{ range .Mounts }}{{ .Source }} -> {{ .Destination }}{{ "\n" }}{{ end }}'
```

Look for:

- A mount to **`/config`** (configuration and database)
- A mount to **`/media/frigate`** (recordings and related media)

The host folder for `/media/frigate` should sit on your **ZFS pool**, not on the root filesystem of the boot drive. If you are unsure, compare the mount path to `df -h` and `zpool list` output, or see [Drive and pool errors](../troubleshooting/drive-errors.md).

---

## How recording segments are organized

Continuous recordings are stored under:

```
/media/frigate/recordings/
```

Frigate uses a **fixed folder layout** you should not rearrange manually:

```
YYYY-MM-DD/HH/<camera_name>/MM.SS.mp4
```

Times are in **UTC**, not your local timezone. If you browse files over SSH and the hours look "wrong," that is expected.

Example for a camera named `front_door`:

```
recordings/2026-06-15/14/front_door/30.45.mp4
```

Each file is a short segment of video, typically on the order of ten seconds. Frigate writes segments directly from the camera stream **without re-encoding** the main recording stream, which keeps CPU load lower but means file size tracks your camera bitrate.

Frigate's documentation states this structure is internal and **not intended to be managed by hand**. Use the Frigate UI for review and export, and use retention settings to free space. See [Retention policies](retention.md) when you need to change how long segments are kept.

---

## Recordings, events, and snapshots

These terms show up in the Frigate UI and in storage planning:

| Term | What it is | Where it lives |
|---|---|---|
| **Recording** | Continuous (or motion-triggered) video segments from the **record** stream | `/media/frigate/recordings/` |
| **Event** | Something Frigate detected (motion, person, car, etc.) | Indexed in `frigate.db`; linked to time ranges in recordings |
| **Snapshot** | Still image for an event | `/media/frigate/clips/` |
| **Export** | Clip or timelapse you saved from the UI | `/media/frigate/exports/` |

Object detection runs on whichever input has the **detect** role. On most Argus setups that is a lower-resolution sub stream, separate from the **record** stream used for full-quality footage. You can assign both roles to one stream instead. See [Adding your first camera to Frigate](../cameras/first-camera.md#roles-in-configyml).

When you scrub the timeline in Frigate, you are browsing indexed segments in the database plus the `.mp4` files on disk. If files are missing but the database still lists them, playback can fail until Frigate reconciles storage (covered in the [Frigate recording documentation](https://docs.frigate.video/configuration/record/)).

---

## What drives storage usage

Recording pool usage grows with:

- **Number of cameras** with recording enabled
- **Stream quality and bitrate** on the **record** stream (main stream on Amcrest)
- **Retention settings** (how many days Frigate keeps footage before deleting old segments)
- **Events and snapshots** (usually smaller than 24/7 video, but not zero)
- **Exports** you create manually (kept until you remove them)

Argus tiers are sized for **30 days of continuous recording** at each tier's max camera count. Adding cameras or raising bitrates without adjusting retention fills the pool faster than the design allows. See [Retention policies](retention.md).

---

## Check how full the recording pool is

Use the CLI rather than Cockpit for accurate ZFS pool usage.

```bash
df -h
zpool list
```

Identify the filesystem that matches your `/media/frigate` host mount. Plan to act before the pool reaches **95% full**. Above that, Frigate may fail to write new segments, recordings can gap, and the whole system may feel sluggish.

Quick check from Frigate logs if you suspect write failures:

```bash
docker logs frigate --tail 50 | grep -i "space\|record\|disk"
```

For pool health (not just capacity), use `zpool status`. See [Drive and pool errors](../troubleshooting/drive-errors.md).

---

## What not to do

- **Do not delete or move files under `recordings/` by hand** unless you know exactly what you are doing and Frigate is stopped. Manual deletes can orphan database entries or leave the UI out of sync with disk.
- **Do not store recordings on the boot M.2** to "free up" the pool. The boot drive is small and not sized for footage archives.
- **Do not confuse config backup with recording backup.** [Backing up your Frigate configuration](../maintenance/backup.md) saves `config.yml`, not weeks of video. Protecting footage is a retention and pool capacity question, not a config backup question.

If you need emergency space, reduce retention in `config.yml` and restart Frigate, or follow the cleanup guidance in [Retention policies](retention.md). For a pool that is already full, see [Drive and pool errors](../troubleshooting/drive-errors.md#free-up-space).

---

## Config and database vs video files

| Data | Typical location | Back up with |
|---|---|---|
| `config.yml` | Host path mounted to `/config` | [Backup guide](../maintenance/backup.md) |
| `frigate.db` | Same `/config` mount | Backup guide (optional but useful) |
| Recording `.mp4` segments | Host path mounted to `/media/frigate` | Retention policy; not a full manual copy |

If you restore `config.yml` from backup after a bad edit, your recordings on disk are unchanged. See [Restoring from a backup](../maintenance/restore.md).

---

## Where to go from here

- [Retention policies](retention.md), to control how long recordings and events are kept
- [Drive and pool errors](../troubleshooting/drive-errors.md), when the pool is full or unhealthy
- [NVR running slow or dropping frames](../troubleshooting/performance.md), when storage I/O affects performance
- [Backing up your Frigate configuration](../maintenance/backup.md), for `config.yml` before config changes
- [Frigate recording documentation](https://docs.frigate.video/configuration/record/), for advanced record modes and sync options
