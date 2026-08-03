# AI accelerator setup

By default, Frigate runs object detection on the NVR's CPU. This works, but each detection frame takes 80–150ms to process, which limits how many cameras you can run at high detection rates before the CPU becomes the bottleneck.

A hardware AI accelerator moves that inference workload to dedicated silicon. Detection time drops to 5–15ms on a Hailo-8, and the CPU stays available for recording, transcoding, and running other services.

---

## Which hardware is in your system

| Tier | Accelerator |
|---|---|
| Vigil | Optional add-on (Hailo-8) |
| Sentinel | Hailo-8 PCIe M.2 included |
| Warden | Hailo-8 PCIe M.2 included |

If your system shipped from LAN Foundry with an accelerator installed, the drivers and runtime are already set up. Skip to [Part 2: Verify the accelerator is recognized](#part-2-verify-the-accelerator-is-recognized).

---

## Part 1 — Install the accelerator drivers (post-purchase upgrade)

Follow this section if you are adding a Hailo-8 accelerator to a Vigil system after purchase.

If the accelerator was included when your system shipped, skip to Part 2.

The Hailo-8 driver and HailoRT runtime are distributed by Hailo directly. Follow the installation guide at [hailo.ai/developer-zone](https://hailo.ai/developer-zone/) for the current Ubuntu installation steps. The guide covers adding the Hailo apt repository, installing HailoRT, and loading the kernel module.

After installation, reboot the NVR:

```bash
sudo reboot
```

Then verify the device node is present:

```bash
ls /dev/hailo0
```

---

## Part 2 — Verify the accelerator is recognized

Confirm the device node exists:

```bash
ls /dev/hailo0
```

Confirm the PCI device is visible to the kernel:

```bash
lspci | grep -i hailo
```

A result containing `Hailo Technologies` confirms the hardware is recognized.

If either check returns nothing or a "No such file or directory" error, see the troubleshooting section below before continuing.

---

## Part 3 — Configure Frigate

Open `config.yml` on the NVR. The file is typically at `/opt/lanfoundry/config/frigate/config.yml` or the path shown in your Docker compose file.

Add a `detectors` block to `config.yml`:

```yaml
detectors:
  hailo:
    type: hailo8l
    device: PCIe
```

Add the device passthrough in Docker compose:

```yaml
services:
  frigate:
    devices:
      - /dev/hailo0:/dev/hailo0
```

### Apply the changes

Restart Frigate after editing either file:

```bash
docker restart frigate
```

Check the logs for any errors:

```bash
docker logs frigate --tail 50
```

A successful startup will include a line indicating the detector type that initialized. If you see a warning about falling back to CPU detection, check the troubleshooting section below.

---

## Part 4 — Verify Frigate is using the accelerator

Open the Frigate web interface and navigate to **System** in the top menu, then select **Detectors**.

The detectors panel shows the inference time for each active detector. Use these as a baseline:

| Detector | Expected inference time |
|---|---|
| CPU (no accelerator) | 80–150ms |
| Hailo-8 | 5–15ms |

If the inference time shown is in the CPU range, Frigate is not using the accelerator. See troubleshooting below.

You can also confirm from the logs:

```bash
docker logs frigate 2>&1 | grep -i detector
```

A correctly initialized accelerator will appear by name in the startup output.

---

## Troubleshooting

**Device node not present after installation**

Confirm the system was rebooted after driver install. Then check the kernel log for device initialization messages:

```bash
dmesg | grep -i hailo
```

A line showing the device being registered confirms the driver loaded. No output suggests the driver did not load. Re-run the installation steps and check for any errors during `apt install` or `modprobe`.

**Frigate falling back to CPU detection**

Two common causes: the `devices:` entry is missing from the Docker compose file, or the runtime library is not installed. Verify both, then restart Frigate.

**Permission denied on the device node**

Docker may not have the correct group access to the device. Restart Docker and Frigate:

```bash
sudo systemctl restart docker
docker restart frigate
```

**Still not working**

Reach out to LAN Foundry support at [support@lanfoundry.com](mailto:support@lanfoundry.com) with the output of `docker logs frigate --tail 100` and `dmesg | grep -i hailo`.

---

## Where to go from here

- [Tuning motion sensitivity to reduce false alerts](tuning-sensitivity.md), to get the most out of faster detection. Lower inference time means you can raise detection FPS and tune thresholds more aggressively
- [Setting up recording zones and motion detection](zones-motion.md), if you haven't defined detection zones yet
