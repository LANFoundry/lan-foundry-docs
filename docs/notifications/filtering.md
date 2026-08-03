# Filtering which events trigger notifications

This guide covers how to control which detections send notifications to your phone. Out of the box, Frigate will alert you on every detected object across every camera, which gets noisy fast. A few config changes narrow that down to what actually matters.

This guide assumes ntfy is set up and you're already receiving notifications. See [Setting up ntfy for push notifications](ntfy-setup.md) if you haven't done that yet.

---

## Before you start

- ntfy is configured and notifications are arriving on your phone
- Frigate's `config.yml` is accessible via Portainer or SSH
- If you want to filter by zone, you'll need zones defined on your cameras. See [Setting up recording zones and motion detection](../cameras/zones-motion.md) for how to create them.

---

## How Frigate decides what to notify

Every time Frigate finishes tracking a detection event, it checks it against your notification configuration. If the event matches — right object type, right zone, above the confidence threshold — it sends a notification to ntfy. If no filters are configured, every detected object on every camera notifies.

The filters below layer on top of each other. You can use any combination.

---

## Step 1 — Filter by object type

The most effective first filter. Rather than alerting on every object Frigate can detect, limit it to the ones you care about.

In `config.yml`, add an `objects` list under your ntfy notification config:

```yaml
notifications:
  ntfy:
    base_url: http://YOUR_NVR_IP:2586
    topic: YOUR_TOPIC
    objects:
      - person
      - car
```

Common object types Frigate can detect: `person`, `car`, `dog`, `cat`, `bicycle`, `motorcycle`, `truck`. Start with just `person` and `car` if you're unsure — you can always add more later.

After saving, restart the Frigate container in Portainer for the change to take effect.

---

## Step 2 — Require detections to enter a specific zone

If object-type filtering still produces more alerts than you want, zone filtering is the next step. This lets you say "only notify me if a person enters the driveway, not just anywhere in frame."

Zones must be created in your camera config before you can filter on them. See [Setting up recording zones and motion detection](../cameras/zones-motion.md) if you haven't set up zones yet.

Once you have a zone defined, add a `required_zones` filter to the relevant camera:

```yaml
cameras:
  front_door:
    objects:
      filters:
        person:
          required_zones:
            - driveway
```

With this config, a person walking along the edge of the frame — technically detected, but not entering the driveway zone — won't trigger a notification. Only detections that cross into `driveway` will.

You can require multiple zones (the object must enter all of them) or adjust per-object as needed.

---

## Step 3 — Disable notifications for specific cameras

If you have an indoor camera you don't want generating alerts at all, you can turn off notifications for it without removing it from your Frigate config.

```yaml
cameras:
  indoor_office:
    notifications:
      enabled: False
```

This disables ntfy notifications for that camera only. Recording and detection continue normally.

---

## Step 4 — Adjust the confidence threshold

Frigate assigns a confidence score between 0 and 1 to each detection. A `min_score` of `0.5` means Frigate is at least 50% confident it detected the object correctly. Lower scores mean more alerts; higher scores mean fewer but more reliable ones.

The default threshold varies by object type, but if you're getting a lot of false positives, raising `min_score` is a good first adjustment:

```yaml
objects:
  filters:
    person:
      min_score: 0.7
```

`0.7` is a reasonable starting point for most setups. If you're missing real events, lower it slightly. If false positives persist, try `0.75` or higher.

This filter lives under `objects` at the top level of `config.yml`, not under the notifications block — it affects detection scoring globally, which in turn affects what notifications are generated.

---

## Putting it together

A typical config combining object filtering, zone filtering, and a confidence threshold:

```yaml
notifications:
  ntfy:
    base_url: http://YOUR_NVR_IP:2586
    topic: YOUR_TOPIC
    objects:
      - person
      - car

cameras:
  front_door:
    objects:
      filters:
        person:
          required_zones:
            - driveway
  indoor_office:
    notifications:
      enabled: False

objects:
  filters:
    person:
      min_score: 0.7
    car:
      min_score: 0.6
```

Restart Frigate after any changes to `config.yml`.

---

## Where to go from here

- [Setting up notification quiet hours](schedules.md) — limit alerts to certain hours of the day
- [Setting up recording zones and motion detection](../cameras/zones-motion.md) — create the zones used for zone-based filtering
