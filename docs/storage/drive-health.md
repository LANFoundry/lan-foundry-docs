# Checking drive health

Your NVR writes camera footage around the clock. The recording drives work harder than a typical desktop disk, and a failing drive that goes unnoticed can mean lost footage, pool degradation, or an unplanned recovery. Routine health checks catch problems early, when you still have time to act.

This guide covers the two commands that matter: `zpool status` for pool and data integrity, and `smartctl` for drive-level hardware health. Neither requires deep Linux knowledge. Running them takes about two minutes.

For what to do when these commands return warnings or errors, see [Drive and pool errors](../troubleshooting/drive-errors.md).

---

## Before you start

This guide assumes:

- You can SSH into the NVR, or use the terminal in Cockpit at `https://cockpit.internal`
- Frigate is running normally

Cockpit shows a general system overview, but it does **not** report ZFS pool health or detailed S.M.A.R.T. data on a stock Ubuntu install. The commands in this guide are the reliable way to check recording storage on Argus systems.

---

## How often to check

| Check | Frequency | Command |
|---|---|---|
| Pool health and error counts | Weekly | `zpool status` |
| Pool free space | Weekly | `zpool list` and `df -h` |
| S.M.A.R.T. health summary | Monthly | `sudo smartctl -H /dev/sdX` |
| Full S.M.A.R.T. attribute report | Every 3 months, or after any warning | `sudo smartctl --all /dev/sdX` |
| Last scrub result | Monthly (check result, not trigger) | `zpool status` |

A weekly glance at `zpool status` and `zpool list` catches most problems early. The monthly S.M.A.R.T. check and scrub confirm the data on disk is intact.

---

## Step 1 — Check pool health

SSH into the NVR and run:

```bash
zpool status
zpool list
```

`zpool status` shows the state of the recording pool and each drive member. What you're looking for:

- **State:** should show `ONLINE`
- **Every drive in the pool:** should show `ONLINE`
- **READ, WRITE, CKSUM columns:** should all be `0`

A healthy pool looks roughly like this (drive count and names vary by tier):

```
  pool: data
 state: ONLINE
  scan: scrub repaired 0B in 00:04:12 with 0 errors on Sun Jun  1 02:24:07 2026

config:

        NAME        STATE     READ WRITE CKSUM
        data        ONLINE       0     0     0
          raidz1-0  ONLINE       0     0     0
            sda     ONLINE       0     0     0
            sdb     ONLINE       0     0     0
            sdc     ONLINE       0     0     0

errors: No known data errors
```

The pool name on your system may differ. `zpool list` shows free and used space:

```bash
NAME    SIZE  ALLOC   FREE  CKPOINT  EXPANDSZ   FRAG    CAP  DEDUP    HEALTH  ALTROOT
data   5.45T  2.10T  3.35T        -         -     2%    38%  1.00x    ONLINE  -
```

Keep an eye on **CAP** (capacity used). Plan to act before it reaches **95%**. See [Retention policies](retention.md) or [Drive and pool errors](../troubleshooting/drive-errors.md#free-up-space) if you're getting close.

**If the state is anything other than ONLINE**, or if any READ, WRITE, or CKSUM column is non-zero, see [Drive and pool errors](../troubleshooting/drive-errors.md) for next steps. CKSUM errors on a specific drive are a particularly reliable indicator of a failing pool member.

---

## Step 2 — Review the last scrub result

A **scrub** reads every block of data on the pool and verifies it against ZFS checksums. It finds corruption that S.M.A.R.T. won't catch: data that silently degraded on disk or got corrupted in memory during a write.

ZFS on Ubuntu runs scrubs automatically on a regular schedule via a built-in systemd timer. You don't need to set one up. The last scrub result appears in `zpool status` output, in the `scan:` line:

```
  scan: scrub repaired 0B in 00:04:12 with 0 errors on Sun Jun  1 02:24:07 2026
```

`0 errors` means the last scrub found nothing wrong. If the scan line shows repaired or unrepaired blocks, or if it has been an unexpectedly long time since the last scrub ran, see [Drive and pool errors](../troubleshooting/drive-errors.md#zfs-pool-problems).

To trigger a scrub manually at any time:

```bash
sudo zpool scrub POOLNAME
```

Replace `POOLNAME` with the name shown in `zpool status`. The scrub runs in the background and does not interrupt normal use. Check progress with `zpool status` and look for `scrub in progress` in the scan line.

---

## Step 3 — Check S.M.A.R.T. on pool drives

S.M.A.R.T. is each hard drive's built-in self-monitoring system. It tracks error counts, temperature, and wear indicators that predict failure before it happens.

First, confirm `smartmontools` is installed:

```bash
sudo apt install smartmontools
```

Identify which devices are your pool drives. `zpool status` lists them. Look for entries under `config:` like `sda`, `sdb`, `sdc`. These are the pool members. The boot NVMe (usually `nvme0n1`) is separate.

Quick health summary on each pool drive:

```bash
sudo smartctl -H /dev/sda
sudo smartctl -H /dev/sdb
sudo smartctl -H /dev/sdc
```

A healthy result shows:

```
SMART overall-health self-assessment test result: PASSED
```

If any drive shows `FAILED` or `WARNING`, move immediately to a full attribute report and the troubleshooting guide. Do not wait for the drive to stop working on its own.

Full attribute report for a more detailed look:

```bash
sudo smartctl --all /dev/sda
```

The key attributes to watch are described in detail in [Drive and pool errors](../troubleshooting/drive-errors.md#read-the-smart-warning). The short version: reallocated sectors, pending sectors, uncorrectable errors, and UDMA/CRC errors are the ones that signal a problem. A few reallocated sectors on an older drive is worth monitoring. A rising count, pending sectors, or any uncorrectable errors means plan a replacement.

Run these checks on every drive in the pool, not just one. Drives from the same batch sometimes fail close together.

---

## Step 4 — Check the boot drive

The M.2 NVMe boot drive runs Ubuntu and Docker. It sees far less write load than the recording pool, but it is still worth checking every few months.

```bash
sudo smartctl -H /dev/nvme0n1
```

Adjust the device name to match `lsblk` output if your system uses a different identifier. A **PASSED** result means the boot drive is healthy. A warning or failure here affects the OS, not the recording pool directly. If the boot drive fails, the NVR won't start. See [Drive and pool errors](../troubleshooting/drive-errors.md#boot-drive-problems) if something looks wrong.

On **Warden** systems, there are two mirrored M.2 boot drives. Check both:

```bash
sudo smartctl -H /dev/nvme0n1
sudo smartctl -H /dev/nvme1n1
```

---

## What normal looks like

After running through the checks, this is what a healthy system shows:

| Check | Healthy result |
|---|---|
| `zpool status` state | `ONLINE` |
| All pool drives | `ONLINE` |
| READ / WRITE / CKSUM error counts | All `0` |
| `zpool list` capacity | Below 90% |
| `smartctl -H` on each pool drive | `PASSED` |
| `smartctl -H` on boot NVMe | `PASSED` |
| Scrub result | `0 errors` |

If everything above is green, there is nothing to act on. Check again next month.

---

## Where to go from here

- [Drive and pool errors](../troubleshooting/drive-errors.md), when any of the checks above return a warning, DEGRADED pool, or S.M.A.R.T. failure
- [Retention policies](retention.md), if pool capacity is getting close to full
- [How Frigate stores recordings](frigate-storage.md), for understanding what is on the pool and what drives usage
- [Adding more storage](adding-storage.md), when a pool drive needs replacing or you want to expand capacity
