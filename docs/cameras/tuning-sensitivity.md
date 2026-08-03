# Tuning motion sensitivity to reduce false alerts

Zones and motion masks handle most false alerts by telling Frigate where to look and what to ignore. When you're still getting unwanted events after that, the next step is adjusting detection thresholds. This guide covers the knobs that control how much motion Frigate needs to see before it acts, and how confident it needs to be in an object before it triggers an event.

---

## Before you start

This guide assumes:

- Frigate is running with at least one camera configured
- You've already set up zones and motion masks where needed. See [Setting up recording zones and motion detection](zones-motion.md) if not
- You can edit `config.yml` and SSH into the NVR to restart Frigate

Changes in this guide take effect after restarting Frigate:

```bash
docker restart frigate
```

Check logs after any restart to confirm there are no YAML errors:

```bash
docker logs frigate --tail 30
```

---

## Use the debug overlay first

Before changing any numbers, use Frigate's debug overlay to see exactly what it's responding to. This tells you whether you're fighting a motion detection problem or an object detection problem, which determines which settings to adjust.

In the Frigate web interface, open a camera's live view and enable the debug overlay. Depending on your Frigate version, look for a **Debug** button or a bounding box toggle in the camera controls.

With the overlay on:

- **Green boxes** show detected motion regions
- **Colored bounding boxes** show tracked objects with their label and confidence score

If you're seeing motion boxes constantly in areas with no actual movement, the motion threshold is too low. If Frigate is detecting objects at low confidence scores that turn out to be nothing, the score threshold needs adjustment.

---

## Motion detection sensitivity

Frigate's motion detection watches for pixel-level changes between frames. You can control how sensitive it is and how large a motion region has to be before it counts.

These settings go under `motion:` for each camera:

```yaml
cameras:
  front_door:
    motion:
      threshold: 30
      contour_area: 10
```

### `threshold`

Controls how much a pixel has to change to be counted as motion. The default is `30`. Lower values make detection more sensitive. Higher values require more dramatic change.

| Value | Effect |
|---|---|
| `10`–`20` | Very sensitive. Picks up subtle lighting shifts, shadows, insects |
| `30` | Default. Works well for most outdoor cameras |
| `40`–`60` | Less sensitive. Useful for cameras with frequent minor lighting changes, like near a window |

If your camera triggers constantly during sunny-to-cloudy transitions or when headlights sweep across the frame, raising `threshold` to `40` or `50` is a reasonable first step.

### `contour_area`

Sets the minimum number of changed pixels that have to cluster together before Frigate registers motion. The default is `10`. Raising this filters out small, isolated motion sources like insects flying past the lens or slight sensor noise.

```yaml
    motion:
      threshold: 30
      contour_area: 100
```

A value around `100` ignores small blobs while still catching a person or vehicle. Go too high and you risk missing slow-moving objects at the far edge of the frame.

### `lightning_threshold`

If a large portion of the frame changes at once, such as when a light turns on or off, Frigate can misread it as massive motion. The `lightning_threshold` setting detects these global frame changes and suppresses the motion event.

```yaml
    motion:
      lightning_threshold: 0.9
```

The value is a fraction from `0` to `1`, representing the percentage of the frame that changed. The default is `0.9` (90%). If you're getting spurious motion events when lights turn on, lower this value toward `0.7` or `0.8`.

---

## Object detection thresholds

Frigate's object detection assigns a confidence score between 0 and 1 to each detected object. You can set a floor on what score qualifies as a real detection, and filter by object size.

These settings go under `objects.filters` either globally or per camera:

```yaml
objects:
  filters:
    person:
      min_score: 0.6
      threshold: 0.7
      min_area: 5000
      max_area: 100000
```

### `min_score`

The minimum confidence score a single detection frame must reach before Frigate considers it at all. The default is `0.5`. Raising this to `0.6` or `0.65` cuts out low-confidence flickers that never would have become real events anyway.

### `threshold`

The minimum **average** score across multiple frames before Frigate records the detection as a tracked event. This is the more important setting of the two. The default is `0.7`.

A detection must clear `min_score` on individual frames and then average `threshold` across enough frames to become an event. Raising `threshold` toward `0.75` or `0.8` reduces events caused by brief, uncertain detections without making the system miss real objects.

```yaml
objects:
  filters:
    person:
      min_score: 0.6
      threshold: 0.75
```

### `min_area` and `max_area`

Filter objects by their pixel area in the detection frame (not the full recording frame, since detection typically runs on the lower-resolution sub stream).

`min_area` ignores objects that are too small. This helps when Frigate is picking up distant movement that barely resolves as a person shape: a bird at the far end of the yard, or a neighbor walking past in the background.

`max_area` ignores objects that fill too much of the frame. Useful when a camera angle causes close-passing objects to briefly register as a huge bounding box.

```yaml
objects:
  filters:
    person:
      min_area: 5000
      max_area: 100000
    car:
      min_area: 10000
```

To find the right values for your setup, enable the debug overlay and watch the bounding box size when a false positive occurs. The overlay shows approximate dimensions you can use to set a sensible floor.

---

## Applying filters per camera

Global `objects.filters` apply to every camera. You can override or add filters for a specific camera if one location has different characteristics than the others:

```yaml
objects:
  filters:
    person:
      threshold: 0.7

cameras:
  backyard:
    objects:
      filters:
        person:
          threshold: 0.8
          min_area: 8000
```

The backyard camera uses stricter settings because it has more background movement, while other cameras keep the global defaults.

---

## A practical tuning sequence

If you're getting too many false alerts and aren't sure where to start:

1. **Enable the debug overlay** and watch what triggers. Note whether it's motion boxes, object bounding boxes, or both.
2. **If motion boxes are firing constantly in empty areas**, raise `threshold` by 10 and restart. Repeat until motion detection feels stable.
3. **If objects are being detected at low scores**, raise the object `threshold` to `0.75`. Check the score shown in the bounding box debug overlay.
4. **If small or distant objects are triggering events**, add a `min_area` filter and start with a value that excludes the false-positive size.
5. **If you're still seeing a specific area cause problems**, add or extend a motion mask for that area in the zone editor rather than raising global thresholds further.

Make one change at a time and restart Frigate between each. Multiple changes at once make it hard to know which one fixed the problem, or which one broke something else.

---

## What normal looks like

After tuning:

- The debug overlay shows motion boxes only when something is actually moving in areas you care about
- Object bounding boxes appear at scores above your threshold, on objects that match the size you expect
- The event timeline shows meaningful detections rather than constant low-confidence noise
- Notification volume drops to events worth acting on

If alerts are too quiet after tuning, the thresholds may be too high. Lower `threshold` by `0.05` at a time until real events start coming through again.

---

## Where to go from here

- [Filtering which events trigger notifications](../notifications/filtering.md), to control which object types and zones send alerts to your phone
- [Setting up recording zones and motion detection](zones-motion.md), if you haven't set up spatial filters yet
- [Setting up an AI accelerator](hailo-tpu.md), to improve detection accuracy and move object detection off the CPU
