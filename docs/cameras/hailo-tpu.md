# AI accelerator setup

By default, Frigate runs object detection on the NVR's CPU. This works, but each detection frame takes 80–150ms to process, which limits how many cameras you can run at high detection rates before the CPU becomes the bottleneck.

A hardware AI accelerator moves that inference workload to dedicated silicon. Detection time drops to around 7ms on a Hailo-8, and the CPU stays available for recording, transcoding, and running other services.

---

## Which hardware is in your system

| Tier | Accelerator |
|---|---|
| Vigil | Optional add-on (Hailo-8) |
| Sentinel | Hailo-8 PCIe M.2 included |
| Warden | Hailo-8 PCIe M.2 included |
| Enclave | Hailo-8 PCIe M.2 included |

If your system shipped from LAN Foundry with an accelerator installed, the drivers and runtime are already set up. Skip to [Part 4: Verify Frigate is using the accelerator](#part-4-verify-frigate-is-using-the-accelerator).

---

## Part 1 — Install the accelerator drivers (post-purchase upgrade)

Follow this section if you are adding a Hailo-8 accelerator to a Vigil system after purchase, or installing one in your own hardware.

If the accelerator was included when your system shipped, skip to Part 2.

Frigate needs a specific version of the Hailo PCIe driver, one that matches the HailoRT runtime bundled inside the Frigate image. The Frigate project ships an installation script that builds and installs that driver, so use it rather than the packages from Hailo's developer zone.

Download the script:

```bash
wget https://raw.githubusercontent.com/blakeblackshear/frigate/dev/docker/hailo8l/user_installation.sh
```

That URL pulls the script from Frigate's development branch. To match the driver to the Frigate version you are actually running, replace `dev` with your release tag, for example `v0.16.2`. Check your version under **Settings** in the Frigate web interface.

Make it executable and run it:

```bash
sudo chmod +x user_installation.sh
./user_installation.sh
```

The script installs build dependencies, builds the Hailo driver from Hailo's official repository, installs the firmware, and sets up udev rules so Docker can reach the device.

Reboot to load the driver and firmware:

```bash
sudo reboot
```

!!! note "Raspberry Pi users"
    These steps are written for x86 hardware running Ubuntu. On Raspberry Pi OS Bookworm, the kernel ships an older Hailo driver that has to be disabled first. Follow [Frigate's Hailo-8 installation steps](https://docs.frigate.video/frigate/installation/#hailo-8) instead.

!!! warning "Frigate upgrades can change the required driver"
    When a Frigate release moves to a new HailoRT version, the driver on the host has to move with it. If Frigate falls back to CPU detection after an upgrade, re-run the installation script from the new release's tag and reboot. Check Frigate's release notes before [updating containers](../maintenance/container-updates.md).

---

## Part 2 — Verify the accelerator is recognized

Confirm the device node exists:

```bash
ls -l /dev/hailo0
```

Confirm the driver is loaded and check its version:

```bash
lsmod | grep hailo_pci
cat /sys/module/hailo_pci/version
```

Confirm the firmware is installed:

```bash
ls -l /lib/firmware/hailo/hailo8_fw.bin
```

Confirm the PCI device is visible to the kernel:

```bash
lspci | grep -i hailo
```

A result containing `Hailo Technologies` confirms the hardware is recognized.

If any check returns nothing or a "No such file or directory" error, see the troubleshooting section below before continuing.

---

## Part 3 — Configure Frigate

The standard Frigate image (`ghcr.io/blakeblackshear/frigate:stable`) includes Hailo support. No special image tag is needed.

### Pass the device through to the container

Add the device to the Frigate service in your Docker compose file:

```yaml
services:
  frigate:
    devices:
      - /dev/hailo0:/dev/hailo0
```

### Add the detector and model

Open `config.yml` on the NVR. The file is typically at `/opt/lanfoundry/config/frigate/config.yml` or the path shown in your Docker compose file.

Add a `detectors` block and a `model` block:

```yaml
detectors:
  hailo:
    type: hailo8l   # Frigate uses this type for both Hailo-8 and Hailo-8L
    device: PCIe

model:
  width: 320
  height: 320
  input_tensor: nhwc
  input_pixel_format: rgb
  input_dtype: int
  model_type: yolo-generic
  labelmap_path: /labelmap/coco-80.txt
```

The `hailo8l` type is correct for a Hailo-8. Frigate detects which chip is installed and picks the right model for it.

You can make the same change from the Frigate web interface instead: open **Settings > System > Detectors and model**, select **Hailo-8/Hailo-8L** from the detector type dropdown, click **Add**, and set the device to `PCIe`. The model fields above go in the **Custom Model** tab on the same page.

### The detection model

On first startup, Frigate downloads the default model (YOLOv6n) from the Hailo Model Zoo and caches it in `/config/model_cache/hailo`. After that, detection runs fully offline.

!!! note "On Enclave"
    Enclave has no internet connection, so the model can't download on first start. LAN Foundry caches it before the system ships. If you're running your own offline NVR, download `yolov6n.hef` on another machine, copy it into `/config/model_cache/hailo/`, and point Frigate at it with `path: /config/model_cache/hailo/yolov6n.hef` under `model:`.

### Apply the changes

If you edited the compose file, recreate the container so the device passthrough takes effect:

```bash
sudo docker compose up -d frigate
```

If you only edited `config.yml`, a restart is enough:

```bash
sudo docker restart frigate
```

Check the logs for any errors:

```bash
sudo docker logs frigate --tail 50
```

If you see a warning about falling back to CPU detection, check the troubleshooting section below.

---

## Part 4 — Verify Frigate is using the accelerator

### Check which detector is active

In the Frigate web interface, open **Settings > System > Detectors and model**. The detector should be listed as **Hailo-8/Hailo-8L** with device `PCIe`. If it shows CPU, the config change didn't apply.

### Check inference speed

The Frigate web interface doesn't show detector inference speed, but Frigate's stats API does. The full response covers every camera, process, and service, so filter it down to the detectors.

With `jq` (`sudo apt install jq` if it isn't installed):

```bash
sudo docker exec frigate curl -s http://127.0.0.1:5000/api/stats | jq '.detectors'
```

Without `jq`, using the Python that ships with Ubuntu:

```bash
sudo docker exec frigate curl -s http://127.0.0.1:5000/api/stats \
  | python3 -c 'import json,sys; [print(k, round(v["inference_speed"],1), "ms") for k,v in json.load(sys.stdin)["detectors"].items()]'
```

The detector name in the output matches the key under `detectors:` in your config (`hailo` in the example above). Compare its `inference_speed` against these baselines:

| Detector | Expected inference time |
|---|---|
| CPU (no accelerator) | 80–150ms |
| Hailo-8 (YOLOv6n) | 3-10ms |

If the number is in the CPU range, Frigate is not using the accelerator. See troubleshooting below.

You can also confirm from the logs:

```bash
sudo docker logs frigate 2>&1 | grep -i hailo
```

A correctly initialized accelerator shows up in the startup output without errors.

---

## Troubleshooting

**Device node not present after installation**

Confirm the system was rebooted after running the installation script. Then check the kernel log for device initialization messages:

```bash
dmesg | grep -i hailo
```

A line showing the device being registered confirms the driver loaded. No output suggests the driver did not load. Re-run the installation script and check its output for errors.

**Frigate falling back to CPU detection**

Two common causes: the `devices:` entry is missing from the Docker compose file, or the `detectors:` block is missing or misspelled in `config.yml`. Verify both, then recreate the container with `sudo docker compose up -d frigate`.

**Driver and runtime version mismatch**

If the Frigate logs show a HailoRT error mentioning a version or driver mismatch, the driver on the host doesn't match the runtime inside the Frigate image. This usually happens after a Frigate upgrade. Re-run the [installation script](#part-1-install-the-accelerator-drivers-post-purchase-upgrade) using your current Frigate release tag, then reboot.

**`max_desc_page_size` error in the logs**

If the logs show `CHECK failed - max_desc_page_size given 16384 is bigger than hw max desc page size 4096`, force the smaller page size and reboot:

```bash
echo 'options hailo_pci force_desc_page_size=4096' | sudo tee /etc/modprobe.d/hailo_pci.conf
sudo reboot
```

**Permission denied on the device node**

Docker may not have the correct group access to the device. Restart Docker and Frigate:

```bash
sudo systemctl restart docker
sudo docker restart frigate
```

**Still not working**

Reach out to LAN Foundry support at [support@lanfoundry.com](mailto:support@lanfoundry.com) with the output of `sudo docker logs frigate --tail 100` and `dmesg | grep -i hailo`.

---

## Other accelerators

Argus systems ship with the Hailo-8, but Frigate supports several other detector backends. If you're building your own NVR, one of these may suit hardware you already own:

| Option | Form factor | Worth knowing |
|---|---|---|
| **Google Coral Edge TPU** | USB, M.2, Mini PCIe | Inexpensive and widely available, but limited mostly to older SSD/MobileNet models |
| **Intel iGPU, Arc, or NPU (OpenVINO)** | Built into 6th-gen and newer Intel CPUs | No extra hardware needed, but the iGPU also handles video decoding, so detection and decode compete for it |
| **NVIDIA GPU** | PCIe card | Fast and runs larger models, but draws far more power than a dedicated accelerator |
| **AMD GPU (ROCm)** | PCIe card or integrated | Works, with a narrower range of supported cards than NVIDIA |
| **MemryX MX3** | M.2 | Community-supported in Frigate rather than maintained by the core team |

Frigate's own documentation is the source of truth for setup and expected performance on each of these:

- [Recommended hardware: Detectors](https://docs.frigate.video/frigate/hardware/#detectors), for inference times by device
- [Object detectors](https://docs.frigate.video/configuration/object_detectors/), for configuration of each detector type

---

## Where to go from here

- [Tuning motion sensitivity to reduce false alerts](tuning-sensitivity.md), to get the most out of faster detection. Lower inference time means you can raise detection FPS and tune thresholds more aggressively
- [Setting up recording zones and motion detection](zones-motion.md), if you haven't defined detection zones yet
