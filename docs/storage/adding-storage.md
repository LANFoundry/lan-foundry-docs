# Adding and replacing storage

This guide covers two storage scenarios: replacing a drive that has failed or is showing warning signs, and expanding recording capacity by upgrading pool drives to larger ones. Both involve the same physical swap process; the difference is what happens in ZFS afterward.

If your pool is currently showing DEGRADED or a drive has already failed, start with [Drive and pool errors](../troubleshooting/drive-errors.md) to assess the situation before coming back here for the replacement steps.

---

## Before you start

This guide assumes:

- You can SSH into the NVR
- You have the replacement drive in hand (see below for what to buy)
- You know which drive needs to be replaced. Use `zpool status` and `sudo smartctl -H /dev/sdX` to confirm. See [Checking drive health](drive-health.md) if you haven't run those checks yet

Throughout this guide, `data` is used as the pool name and `/dev/sda`, `/dev/sdb`, etc. as example device names. Your system may use different names. Always confirm with `zpool status` before running any commands.

---

## Choosing a replacement drive

Use a **NAS-rated hard drive** matched to your tier's pool:

| Tier | Pool drives | Recommended class |
|---|---|---|
| Vigil | 3 × same size | NAS or surveillance-class HDD (e.g., WD Red, Seagate IronWolf) |
| Sentinel | 4 × same size | NAS-class HDD |
| Warden | 8 × same size | NAS-class HDD |

For a **failed drive replacement**, use a drive equal to or larger than the one being removed. ZFS uses the smallest drive in a vdev to set the usable size, so a larger replacement works but the extra space won't be accessible until all drives in the vdev are the same larger size.

For a **capacity upgrade**, you'll be replacing every drive in the pool over multiple sessions. Plan to use identical drives for all replacements so the full capacity becomes available after the last swap.

Do not use desktop drives (WD Blue, Seagate Barracuda) in a pool that records continuously. NAS drives handle the sustained write load; desktop drives are rated for lighter duty and fail earlier in this use case.

---

## How resilvering works

When ZFS replaces a drive in the pool, it **resilvers**: it reads all data from the remaining drives and writes it onto the new drive to restore redundancy. This is normal and expected. A few things to know:

- The pool stays **ONLINE and accessible during the resilver**. Frigate continues recording.
- Resilvering takes time. On a lightly used pool with smaller drives it may finish in an hour or two. On a full Warden pool with large drives it can take many hours.
- **Do not remove or replace any other drive while a resilver is in progress.** On RAID-Z2 systems (Sentinel and Warden) you have two-drive tolerance, but using it while resilvering reduces you to one. On Vigil (RAID-Z1) removing a second drive during a resilver destroys the pool.
- After the resilver finishes, the pool returns to **ONLINE** with full redundancy restored.

---

## Scenario 1 — Replace a failed or failing drive

Use this path when `zpool status` shows a drive as FAULTED, REMOVED, or OFFLINE, or when `smartctl` reports a FAILED health result or rising critical attribute counts.

### Step 1 — Identify the drive to replace

Run:

```bash
zpool status
```

Note the device name of the problem drive (for example, `sda`). Then find its serial number and model so you can match it to the physical drive:

```bash
sudo smartctl -i /dev/sda
```

Look for the **Serial Number** in the output. Most drives have the serial printed on a label on the drive itself. Use this to confirm which physical bay holds the drive you're replacing.

For a more stable device identifier that won't change after a reboot:

```bash
ls -l /dev/disk/by-id/ | grep sda
```

Note the `wwn-` or `ata-` identifier for that drive. You can use this path in `zpool replace` instead of `/dev/sda` if you prefer.

### Step 2 — Power down the NVR

Unless your Argus system has documented hot-swap support, shut down cleanly before touching the drives:

```bash
sudo shutdown -h now
```

Wait for the system to fully power off before opening the case.

### Step 3 — Physically swap the drive

Remove the failed drive from its bay. Install the replacement drive in the same bay. Note the device path that bay typically maps to, since after boot the new drive may come up as a different `/dev/sdX` letter if the old drive is gone.

After installing the replacement, power the NVR back on and wait for it to fully boot.

### Step 4 — Confirm the new drive is visible

SSH back into the NVR and confirm the replacement drive appears:

```bash
lsblk
```

Find the new drive. It will not be part of the pool yet. If you're unsure which device is the new drive:

```bash
sudo smartctl -i /dev/sdX
```

Match the serial number to the replacement drive's label.

### Step 5 — Replace the drive in ZFS

Tell ZFS to replace the old drive with the new one. If the old device is still visible (it may appear as FAULTED):

```bash
sudo zpool replace data /dev/sda /dev/sdb
```

Replace `data` with your pool name, `/dev/sda` with the failed drive's device path, and `/dev/sdb` with the new drive's device path.

If the old device is completely gone (removed from the pool), ZFS may let you add the replacement directly:

```bash
sudo zpool replace data /dev/sda
```

ZFS begins resilvering immediately after this command.

### Step 6 — Monitor the resilver

Check progress:

```bash
zpool status
```

Look for a `scan:` line showing `resilver in progress` with a percentage and estimated time remaining. The pool will show DEGRADED until the resilver finishes, which is expected. When complete, the status returns to ONLINE with `0` errors on all drives.

You can check again at any time. The resilver continues in the background regardless.

---

## Scenario 2 — Expand capacity by upgrading drive sizes

If your recording pool is consistently above 80% full and you're not willing to shorten retention, the path forward is replacing every pool drive with a larger one. ZFS does not expand the pool's usable capacity until **all drives in a vdev** are the same larger size.

This means the expansion happens in phases, one drive at a time, with a full resilver between each swap.

### How the process works

1. Replace drive 1 with a larger drive. Resilver completes. Pool is still the old size.
2. Replace drive 2 with a larger drive. Resilver completes. Pool is still the old size.
3. Replace the final drive. Resilver completes. Now the pool can be expanded.

On a Vigil (3-drive RAID-Z1), this is three replacement-and-resilver cycles. On a Sentinel (4-drive RAID-Z2), it's four. On a Warden (8 drives), it's eight.

**Do not rush this.** Each resilver stresses the remaining drives. Give each resilver time to finish before starting the next swap.

### Perform each drive swap

Follow the same steps as Scenario 1 for each drive:

1. Power down
2. Swap one drive
3. Power back on
4. Run `zpool replace` with the new drive
5. Wait for the resilver to finish: `zpool status`
6. Confirm the pool is back to ONLINE with no errors before the next swap

Repeat until all drives in the vdev are the larger size.

### Expand the pool after all drives are replaced

Once every drive in the vdev has been replaced with the larger size, enable automatic expansion and trigger it:

```bash
sudo zpool set autoexpand=on data
sudo zpool online -e data /dev/sda
```

Run `zpool online -e data /dev/sdX` once for each drive in the pool, substituting the correct device names. This tells ZFS to recognize the full capacity of each drive.

Verify the expansion:

```bash
zpool list
```

The **SIZE** column should now reflect the larger total capacity. Frigate will begin using the newly available space automatically.

### A note on RAID-Z topology

ZFS RAID-Z vdevs cannot be expanded by adding new individual drives after creation. If you want to add more drives beyond replacement, that requires restructuring the pool (adding a new vdev). This is a more involved operation that risks data if done incorrectly. Contact LAN Foundry support before attempting it on an Argus system.

---

## What normal looks like

After a successful drive replacement and resilver:

```
  pool: data
 state: ONLINE
  scan: resilvered 1.82T in 01:23:06 with 0 errors on Tue Jun 17 04:11:09 2026

config:

        NAME        STATE     READ WRITE CKSUM
        data        ONLINE       0     0     0
          raidz1-0  ONLINE       0     0     0
            sda     ONLINE       0     0     0
            sdb     ONLINE       0     0     0
            sdc     ONLINE       0     0     0

errors: No known data errors
```

All drives ONLINE, scan line shows `resilvered` with `0 errors`, no errors at the bottom. If the scan line still says `resilver in progress`, check back in a few minutes.

After a capacity expansion:

```bash
zpool list
```

The SIZE column reflects the new total. Frigate does not need a restart to use the space.

---

## Where to go from here

- [Checking drive health](drive-health.md), to verify the new drive is healthy and confirm the pool is stable after resilvering
- [Drive and pool errors](../troubleshooting/drive-errors.md), if the pool does not return to ONLINE after the resilver, or if you see errors during the process
- [Retention policies](retention.md), if you expanded capacity and want to take advantage of the new space with longer retention
- [Backing up your Frigate configuration](../maintenance/backup.md), before any drive work. The pool holds your recordings, but the config lives separately
