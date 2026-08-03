# Drive and pool errors

Recordings have gaps, Frigate is complaining about disk space or write errors, or you suspect a drive in your NVR is failing. This guide helps you figure out whether you're dealing with a full pool, a drive that's starting to fail, or something else entirely, and what to do about it.

On an NVR, the recording drives work harder than a typical desktop disk. Frigate writes video continuously, often around the clock. That makes free space and drive health worth paying attention to before something fails without warning.

Argus systems use **ZFS** for recording storage. The most reliable way to check pool health and drive S.M.A.R.T. status is over **SSH** with `zpool` and `smartctl`. Cockpit is useful for basic host metrics (CPU, memory, overall disk usage), but it does **not** show ZFS pool status or detailed S.M.A.R.T. data on a stock Ubuntu install.

---

## Before you start

This guide assumes:

- You can **SSH into the NVR**, or use Cockpit at `https://cockpit.internal` for basic system overview
- Frigate has been recording, or was until the problem started
- You're troubleshooting storage on the NVR itself, not a camera's SD card

Throughout this guide, example IP addresses are used for clarity. Replace them with the addresses from your own network:

- **NVR (main LAN):** `192.168.1.100`
- **Router / OPNsense (main LAN):** `192.168.1.1`

If Frigate won't load at all and containers are crashing, also check [What to do when a container won't start](container.md). If everything runs but feels slow without any drive warnings, start with [NVR running slow or dropping frames](performance.md).

---

## How storage is set up on Argus systems

Argus systems use **two separate storage layers**: a small fast drive for the operating system, and a larger pool of NAS-rated hard drives where Frigate stores recordings.

### Boot drive (operating system)

| Tier | Boot storage | If it fails |
|---|---|---|
| **Vigil** | Single M.2 NVMe | The NVR may not boot until the drive is replaced and the OS restored. Recordings on the pool may still be intact. |
| **Sentinel** | Single M.2 NVMe | Same as Vigil. |
| **Warden** | Mirrored M.2 pair (RAID 1) | One boot drive can fail and the system keeps running. Replace the failed drive to restore boot redundancy. |

The M.2 drives run Ubuntu, Docker, and your configuration. They are **not** where Frigate writes camera footage.

### Recording pool (ZFS RAID-Z)

Frigate recordings live on a **ZFS pool** made from NAS-rated hard drives. ZFS spreads data across the drives with parity so a single failed disk (or more, depending on layout) does not immediately destroy your footage.

| Tier | Pool layout | Drive count | Failure tolerance |
|---|---|---|---|
| **Vigil** | RAID-Z1 | 3 HDDs | 1 drive can fail before data is at risk |
| **Sentinel** | RAID-Z2 | 4 HDDs | 2 drives can fail before data is at risk |
| **Warden** | RAID-Z2 | 8 HDDs | 2 drives can fail before data is at risk |

When this guide talks about recording problems, gaps in footage, or a full disk, it usually means the **ZFS pool**, not the M.2 boot drive.

If you built your own NVR with a different layout, the same S.M.A.R.T. and pool-health principles apply. Focus on whichever volume Frigate writes recordings to.

---

## Full pool is not the same as a failing drive

These problems look similar but need different fixes. Check both before assuming the hardware is bad.

| What you're seeing | Likely cause | First step |
|---|---|---|
| Pool usage at 95% or above in `df -h` | Retention or too much recording | [Free up space](#free-up-space) |
| S.M.A.R.T. warning on a pool HDD | Drive wear or hardware fault | [Check S.M.A.R.T. on pool drives](#step-2-check-smart-on-pool-drives) |
| Recordings choppy, SMART looks fine | Heavy write load or nearly full pool | [NVR running slow or dropping frames](performance.md#storage-and-disk-io) |
| SMART failed, clicking, or read errors on a pool drive | Drive failure in progress | [Act now](#act-now-smart-failed-or-physical-symptoms) |
| Pool status DEGRADED in `zpool status` | A pool member failed or is missing | [ZFS pool problems](#zfs-pool-problems) |
| NVR won't boot | Boot M.2 problem | [Boot drive problems](#boot-drive-problems) |

---

## Figure out what you're seeing

| What you see | Likely cause | Jump to |
|---|---|---|
| `smartctl` reports a warning on a pool HDD | Early warning on a recording drive | [Read the S.M.A.R.T. warning](#read-the-smart-warning) |
| `smartctl` health check FAILED | Imminent failure risk | [Act now](#act-now-smart-failed-or-physical-symptoms) |
| `zpool status` shows DEGRADED or resilvering | Failed HDD in the ZFS pool | [ZFS pool problems](#zfs-pool-problems) |
| "No space left on device" in Frigate logs | Pool full | [Free up space](#free-up-space) |
| Gaps in recordings, SMART looks fine | I/O pressure or config issue | [Frigate and recording symptoms](#frigate-and-recording-symptoms) |
| Pool drive UNAVAIL in `zpool status` | Cable, backplane, or dead drive | [Drive not detected](#drive-not-detected) |
| Clicking or grinding from the NVR | Physical HDD failure | [Act now](#act-now-smart-failed-or-physical-symptoms) |
| System won't boot, pool was healthy | Boot M.2 failure | [Boot drive problems](#boot-drive-problems) |

---

## Step 1 — Check pool health

SSH into the NVR and run:

```bash
zpool status
zpool list
df -h
lsblk
```

`zpool status` is the most important command for recording health. Look for:

- **ONLINE** on all pool drives (healthy)
- **DEGRADED** (a drive failed; pool still running with reduced redundancy)
- **FAULTED** (pool is not usable; recordings may be inaccessible)
- **UNAVAIL** on a drive (missing or not responding)
- **resilvering** or **scrub** in progress (rebuild or consistency check running)

The **READ**, **WRITE**, and **CKSUM** columns in `zpool status` show I/O and checksum errors per drive. Non-zero **CKSUM** values on a pool drive mean ZFS detected data integrity problems on that device. That warrants immediate attention.

Example of what healthy output looks like conceptually: the pool state is `ONLINE`, every pool member shows `ONLINE`, and error counts are zero.

Save the output if you plan to open a support ticket. A copy of `zpool status` is more useful than a Cockpit screenshot for storage problems.

---

## Step 2 — Check S.M.A.R.T. on pool drives

S.M.A.R.T. is each drive's self-monitoring system. Argus recording pools use **NAS-rated hard drives**, which report the attributes in the table below.

First, identify which devices belong to the pool. `zpool status` lists them by device name (such as `/dev/sda`). Those are the drives to check, not the NVMe boot device.

Install smartmontools if needed:

```bash
sudo apt install smartmontools
```

Quick health check on a pool drive (replace `/dev/sdX` with the correct device):

```bash
sudo smartctl -H /dev/sdX
```

Full attribute report:

```bash
sudo smartctl --all /dev/sdX
```

Repeat for each drive in the pool if you're doing a general health survey. If one drive in `zpool status` already shows errors or UNAVAIL, start with that device.

---

## Read the S.M.A.R.T. warning

These are the attributes that matter most for NAS hard drives in a 24/7 recording workload.

| Attribute | Plain language | When to worry |
|---|---|---|
| **Reallocated sectors** | Bad spots the drive swapped out | A few on an old drive: monitor. A number that keeps rising: plan replacement. |
| **Pending sectors** | Problem areas not yet remapped | Any non-zero value: back up and replace soon. |
| **Uncorrectable errors** | Data the drive could not fix | Treat as serious. Do not wait. |
| **Temperature** | Current drive heat | Sustained high temps shorten life. Check case airflow and drive bays. |
| **UDMA/CRC errors** | Communication errors on the cable or backplane | Sometimes cabling, not the platter. Worth reseating before RMA. |

A single early warning on an otherwise healthy drive is a reason to **watch closely and back up**, not necessarily to panic. A **FAILED** health result, uncorrectable errors, clicking, or a **DEGRADED** pool mean **act now**.

### Boot M.2 drives (OS only)

The M.2 boot drive on Vigil and Sentinel, and the mirrored pair on Warden, are NVMe devices. They see far less write load than the recording pool. Check them separately if the NVR won't boot:

```bash
sudo smartctl -H /dev/nvme0n1
sudo smartctl --all /dev/nvme0n1
```

Adjust the device name to match `lsblk`. Warnings on a boot M.2 affect system uptime but do not directly mean your recordings are corrupt.

---

## What Cockpit can and can't tell you

Cockpit at `https://cockpit.internal` is still worth opening for a quick overview:

- **CPU, memory, and load** while troubleshooting performance-related storage symptoms
- **Overall filesystem usage** if the recording mount appears in the Storage page

On a stock Ubuntu Server install, Cockpit's Storage page **does not** reliably show:

- ZFS pool health, vdev layout, or degraded/resilvering state
- Per-drive S.M.A.R.T. attributes for pool hard drives

Do not assume storage is healthy just because Cockpit looks quiet. **`zpool status` and `smartctl` are the source of truth** for Argus recording storage.

!!! note "Optional ZFS UI (future)"
    A third-party Cockpit module ([45Drives cockpit-zfs](https://github.com/45Drives/cockpit-zfs)) can add ZFS pool management to the web UI. LAN Foundry does not ship it on Argus systems today. The 45Drives package repository currently supports Ubuntu 22.04 LTS, not the Ubuntu Server version used on Argus hardware.

    We are monitoring their releases. When they officially support the Ubuntu Server version on Argus systems, we may add cockpit-zfs to the stack and publish an installation guide. Until then, use the SSH commands in this guide for pool health and S.M.A.R.T. checks.

---

## Free up space

A full recording pool causes recording failures, Frigate errors, and sluggish behavior that can look like hardware failure. Always rule this out first.

Check usage:

```bash
df -h
zpool list
```

Look at the filesystem where Frigate stores recordings. Anything at **95% or above** needs attention.

**Short-term relief:**

- Reduce retention in your Frigate `config.yml` and restart Frigate
- Remove old recordings you no longer need from the storage path Frigate uses
- Temporarily disable recording on non-essential cameras

**Longer term:**

- See [How Frigate stores recordings](../storage/frigate-storage.md) and [Retention policies](../storage/retention.md)
- See [Adding more storage](../storage/adding-storage.md) if you need more capacity

After freeing space, confirm Frigate is writing again by checking the timeline for new events. If problems persist with plenty of free space and healthy S.M.A.R.T. on all pool drives, a drive may be failing even though the pool is not full.

---

## Frigate and recording symptoms

Storage trouble often shows up in Frigate before `zpool status` reports a fault.

**What you might notice:**

- Gaps in the recording timeline
- Live view freezing while other cameras work
- Events missing video clips
- Frigate container restarting on its own

**Check Frigate logs:**

```bash
docker logs frigate --tail 100
```

Look for messages mentioning **no space**, **I/O error**, **read-only filesystem**, or **failed to write**. A full pool produces different messages than a dying drive, but both need prompt action.

If Frigate won't stay running, see [What to do when a container won't start](container.md). If feeds are fine but video stutters, see [NVR running slow or dropping frames](performance.md).

---

## ZFS pool problems

When a hard drive in the recording pool fails, ZFS keeps the pool online if redundancy allows it. The pool enters a **DEGRADED** state. You have lost failure tolerance until the bad drive is replaced and the pool finishes **resilvering** (rebuilding).

### What each tier can survive

| Tier | Layout | While healthy | After one drive fails |
|---|---|---|---|
| **Vigil** (RAID-Z1, 3 drives) | 1 parity drive | Tolerates 1 failure | **No redundancy left.** Replace the failed drive immediately. |
| **Sentinel** (RAID-Z2, 4 drives) | 2 parity drives | Tolerates 2 failures | 1 failure remaining. Replace the failed drive promptly. |
| **Warden** (RAID-Z2, 8 drives) | 2 parity drives | Tolerates 2 failures | 1 failure remaining. Replace the failed drive promptly. |

A second failure on Vigil while the pool is already degraded can mean **lost recordings**. On Sentinel and Warden, a second failure while degraded is also an emergency, but you still have one parity drive in reserve until a third fails on Sentinel (two on Warden before total loss).

### What to do when the pool is DEGRADED

1. **Do not ignore it.** The pool is running without full redundancy.
2. **Back up your Frigate config** and any footage you cannot afford to lose.
3. **Identify the failed drive** from `zpool status`. Note the device name, slot, and serial number if visible.
4. **Replace the failed HDD** with a compatible NAS-rated drive. Exact replacement procedure will be covered in [Adding more storage](../storage/adding-storage.md).
5. **Let the resilver complete** before heavy maintenance. Rebuilding stresses the remaining drives.

Monitor progress:

```bash
zpool status
```

While degraded, avoid unnecessary reboots and large bulk copies unless you're actively backing up. The priority is replacing the failed member and restoring full redundancy.

If `zpool status` shows **FAULTED**, the pool is not serving data normally. Contact support if you are on Argus hardware.

---

## Boot drive problems

Boot drive issues affect whether the NVR starts. They are separate from recording pool health.

| Tier | Symptom | What it usually means |
|---|---|---|
| **Vigil / Sentinel** | NVR won't boot, won't reach Cockpit or SSH | Single M.2 boot drive failure or corruption |
| **Warden** | Boot mirror degraded (check `mdadm` or installer docs) | One M.2 boot drive failed; system runs on the survivor |

**If the NVR won't boot but the pool drives should be fine:**

- The recording HDDs may still contain your footage even though the OS will not start
- Do not remove or reformat pool drives trying to fix a boot problem
- Contact support for Argus systems. Boot recovery is different from pool drive replacement

**If Warden's boot mirror is degraded:**

- Replace the failed M.2 boot drive to restore OS redundancy
- This is independent of the eight-drive recording pool. You can have a healthy pool and a degraded boot mirror at the same time, or the reverse

Boot M.2 drives see relatively light write load compared to the recording pool. S.M.A.R.T. warnings on a boot NVMe are worth fixing, but they are not caused by Frigate recording volume.

---

## Drive not detected

If `zpool status` shows a pool drive as **UNAVAIL** or **REMOVED**:

1. **Check whether Frigate is still recording.** A missing drive may have already moved the pool to DEGRADED.
2. **Power cycle once** if the system is otherwise unresponsive. Do not reboot repeatedly during a resilver.
3. **If you're comfortable opening the case**, confirm the drive is fully seated in its bay and any backplane connections are secure.
4. **Check recent kernel messages:**

```bash
sudo dmesg | tail -50
```

Look for `I/O error`, drive reset messages, or SCSI errors tied to the missing device.

If the drive does not reappear after a single reboot and reseat, treat it as failed and plan replacement. On Vigil, the pool has no redundancy left while a RAID-Z1 member is missing.

If an **M.2 boot drive** is missing, the NVR may not boot at all. That is a boot recovery problem, not a pool problem.

---

## What to do by severity

### Monitor (early warning)

Use this when `smartctl` shows a minor warning on a pool drive, overall health is still PASSED, `zpool status` is ONLINE, and recordings are normal.

- Note the warning and the date in your own records
- Check again in a week with `smartctl -H` and `zpool status`
- Back up your Frigate `config.yml`. See [Backing up Frigate config](../maintenance/backup.md)

### Act soon (warnings plus symptoms)

Use this when warnings are worsening, you see pending or uncorrectable sectors, recordings are occasionally missing, or the pool just turned DEGRADED.

- Back up Frigate config and any critical clips immediately
- Reduce write load: shorter retention, lower camera bitrates, fewer simultaneous record streams
- Order a replacement NAS-rated HDD matched to your tier's pool
- Do not wipe or reformat the old drive until data and config are safe elsewhere

### Act now (S.M.A.R.T. failed or physical symptoms)

Use this when a pool drive health is **FAILED**, uncorrectable errors are present, you hear clicking or grinding, the pool is **FAULTED**, or a drive is not detected.

- **Stop assuming the drive is reliable.** Further writes may fail without warning.
- **Back up what you can** while the pool still responds. Do not wait for a convenient time.
- **Do not run destructive tests** such as long bad-sector scans unless support specifically asks you to.
- **Replace the failed pool drive** and allow the resilver to finish. On Vigil, treat any DEGRADED pool as urgent because there is no redundancy margin left.
- If the system will not boot, treat it as a boot drive issue and contact support with your tier and last known `zpool status` if you have it.

---

## Quick reference

| Symptom | First check | Likely fix |
|---|---|---|
| Pool nearly full | `df -h`, `zpool list` | Free space, reduce retention |
| S.M.A.R.T. warning, recordings OK | `smartctl -H`, `zpool status` | Monitor, back up config, plan replacement |
| S.M.A.R.T. FAILED | `smartctl --all`, `zpool status` | Replace drive, resilver pool |
| Pool DEGRADED | `zpool status` | Replace failed HDD, allow resilver |
| Pool FAULTED | `zpool status` | Contact support; do not experiment |
| CKSUM errors on a drive | `zpool status` | Failing member; check SMART, replace drive |
| Frigate write errors, space available | `docker logs frigate` | Failing pool member; check SMART |
| Pool drive missing | `zpool status`, `dmesg` | Reseat drive, replace if still missing |
| Clicking or grinding | Physical inspection | Replace HDD, resilver pool |
| NVR won't boot | `lsblk`, boot NVMe SMART | Boot drive recovery, not pool repair |
| Slow NVR, healthy pool | [Performance guide](performance.md) | I/O load or config, not necessarily hardware |

---

## Where to go from here

Once the immediate issue is under control:

- [NVR running slow or dropping frames](performance.md), if the pool is healthy but the system feels sluggish
- [Checking drive health with Cockpit](../storage/drive-health.md), for routine monitoring once things are stable
- [Backing up Frigate config](../maintenance/backup.md), so a drive swap does not mean rebuilding from scratch
- [Adding more storage](../storage/adding-storage.md), when replacing a pool drive or expanding capacity

**Related troubleshooting**

- [What to do when a container won't start](container.md), if Frigate will not stay running
- [NVR running slow or dropping frames](performance.md), if recordings stutter but S.M.A.R.T. looks clean

**If you're still stuck**

The [OpenZFS documentation](https://openzfs.github.io/openzfs-docs/) and [smartmontools documentation](https://www.smartmontools.org/) go deeper on pool management and S.M.A.R.T. attributes. Bring `zpool status` and `smartctl` output to community forums if you're on DIY hardware.

---

## LAN Foundry customer support

The guides on this site are free for everyone, whether you bought hardware from us or not. If you've worked through this guide and you still have drive warnings, missing recordings, or a degraded pool, there are a few more places to go depending on your situation.

**If you're running your own hardware**

Community forums for your drive manufacturer, the OpenZFS project, and the Frigate project are good resources. Include `zpool status`, `smartctl --all` output for the affected drive, `df -h`, and the last fifty lines of `docker logs frigate` that mention storage or I/O.

**If you purchased an Argus system from LAN Foundry**

Your system was validated before it shipped, so unexpected drive faults are something we can help you work through. Visit [lanfoundry.com/support](https://lanfoundry.com/support) for support options and how to submit a ticket.

When you open a support request, include:

- Your Argus tier (Vigil, Sentinel, or Warden)
- Full output of `zpool status` and `df -h`
- `sudo smartctl --all /dev/sdX` for any flagged pool drive (adjust device name)
- Whether the boot M.2 is involved (NVR won't boot) or only a pool HDD
- When the warning or symptom started, and whether there was a power outage or move recently
- Whether Frigate is still recording, and any relevant lines from `docker logs frigate --tail 50`

The more context you provide, the faster we can pinpoint the issue. If your system is still within its warranty period, check your purchase documentation for what coverage applies.
