# Filtering which events trigger notifications

This guide covers how to control which detections send notifications to your phone. Argus systems ship with frigate-notify set to alert on every object Frigate detects, across every camera, which gets noisy fast. A few lines in frigate-notify's config narrow that down to what actually matters, and cut down repeated alerts for the same activity.

This guide assumes push notifications are set up and you're already receiving them. See [Setting up push notifications](ntfy-setup.md) if you haven't done that yet.

---

## Before you start

- Notifications are arriving on your phone
- You can edit `/opt/lanfoundry/config/frigate-notify/config.yml` on the NVR over SSH (with `sudo nano`). It's mounted read-only into the container, so edit it on the host
- If you want to filter by zone, you'll need zones defined on your cameras. See [Setting up recording zones and motion detection](../cameras/zones-motion.md) for how to create them.

---

## How filtering works

```
Frigate → frigate-notify → ntfy → your phone
```

Frigate detects objects and records events. It doesn't send notifications itself. **frigate-notify** checks Frigate for new events every 30 seconds and decides which ones become notifications, so that's where notification filters live: in the `alerts` section of `/opt/lanfoundry/config/frigate-notify/config.yml`.

If no filters are configured, every event on every camera sends a notification. The filters below layer on top of each other, and you can use any combination. If you're getting several alerts for the same bit of activity, see [Step 5](#step-5-reduce-repeated-notifications). Frigate's own notification cooldown setting doesn't apply to frigate-notify.

!!! warning "Add filters under the existing `alerts:` and `frigate:` keys"
    frigate-notify's `config.yml` already has an `alerts:` section (holding the `ntfy:` settings) and a `frigate:` section. Add the snippets below *inside* those sections rather than pasting a second `alerts:` or `frigate:` line. A second `alerts:` line either stops the config from loading or replaces the first section, ntfy settings included. [Putting it together](#putting-it-together) shows a complete file.

---

## Step 1: Filter by object type

The most effective first filter. Rather than alerting on every object Frigate can detect, limit it to the ones you care about.

Under `alerts:`, add a `labels` section with an `allow` list:

```yaml
alerts:
  labels:
    allow:
      - person
      - car
```

With an `allow` list set, every other object type is ignored. Common object types Frigate can detect: `person`, `car`, `dog`, `cat`, `bicycle`, `motorcycle`, `truck`. Start with just `person` and `car` if you're unsure. You can always add more later.

If you'd rather keep most object types and drop one or two, use `block` instead. Anything in `block` is always ignored, even if it's also in `allow`:

```yaml
alerts:
  labels:
    block:
      - bird
```

---

## Step 2: Only notify for specific zones

If object-type filtering still produces more alerts than you want, zone filtering is the next step. This lets you say "only notify me if a person is in the driveway, not anywhere in frame."

Zones must be created in your camera config in Frigate before you can filter on them. See [Setting up recording zones and motion detection](../cameras/zones-motion.md) if you haven't set up zones yet.

Under `alerts:`, add a `zones` section:

```yaml
alerts:
  zones:
    unzoned: drop
    allow:
      - driveway
```

- `allow` lists the zones that can send notifications. Events in other zones are ignored.
- `unzoned: drop` also ignores events that aren't in *any* zone. Without it, frigate-notify still notifies on unzoned events even when an `allow` list is set, which is usually not what you want.
- `block` (optional) lists zones that never send notifications, and takes priority over `allow`.

One limitation to know about: Argus's frigate-notify setup checks Frigate's API for new events rather than following each event live, so it sees an event's zones once, at the moment it picks the event up. Someone who crosses into the driveway after that check may not trigger a notification. Each event sends at most one notification either way.

---

## Step 3: Turn off notifications for specific cameras

If you have an indoor camera you don't want generating alerts at all, you can exclude it from notifications without removing it from Frigate.

This one goes under the existing `frigate:` section, not `alerts:`:

```yaml
frigate:
  cameras:
    exclude:
      - indoor_office
```

Use the camera name exactly as it appears in Frigate's `config.yml`. Recording and detection on that camera continue normally; it just never sends a notification.

---

## Step 4: Raise the confidence threshold

Frigate gives each detection a confidence score. frigate-notify can skip events below a minimum score, which cuts down false positives like a shadow briefly detected as a person.

Under `alerts:`, add `min_score` to the `labels` section:

```yaml
alerts:
  labels:
    min_score: 70
```

frigate-notify uses a **0–100** scale here, based on the highest score Frigate gave the object during the event. `70` means "only notify if Frigate was at least 70% confident at some point." If you're missing real events, lower it. If false positives persist, try `75` or `80`.

This only affects notifications. Frigate keeps detecting and recording low-confidence objects as before. Frigate's own `config.yml` has separate score thresholds (on a 0–1 scale) that change what it detects in the first place, which affects recordings and the review timeline too. Start with frigate-notify's setting; it's easier to undo.

---

## Step 5: Reduce repeated notifications

If one person walking up the driveway, or a car parked in view, sends you a burst of alerts, frigate-notify is reporting each tracked object separately. This step groups them so you get one alert per stretch of activity.

!!! note "Frigate's notification cooldown doesn't apply here"
    Frigate has its own `notifications` settings, including a `cooldown`, in its config and web UI. Those only control Frigate's built-in browser notifications. frigate-notify reads events from Frigate's API and never sees that setting, so changing it has no effect on your phone alerts. frigate-notify has no time-based cooldown of its own. The options below are how you cut down repeats.

!!! warning "These settings go in frigate-notify's config, not Frigate's"
    `app:` and `alerts:` belong in frigate-notify's `/opt/lanfoundry/config/frigate-notify/config.yml`. If you add them to Frigate's config (through the Config Editor in Frigate's web UI, or Frigate's `config.yml`), Frigate refuses to load it with `Extra inputs are not permitted`. The only setting on this page that goes in Frigate's config is `review:`, in [Getting detection alerts back](#getting-detection-alerts-back).

### Why the repeats happen

Argus ships frigate-notify with `mode: events`, which sends a notification for every object Frigate tracks. One person, two cars, and a dog crossing the same camera are four separate events, so they become four alerts. The same object can also be tracked as a new event if it leaves view, or is lost for a moment, and comes back.

### Switch to reviews mode

Frigate groups everything happening on a camera during a stretch of activity into a single **review item**, the entries you see on Frigate's Review page. Review items on the same camera never overlap. In reviews mode, frigate-notify sends one alert per review item instead of one per object.

In frigate-notify's `config.yml`, change the existing `mode` line under `app:`:

```yaml
app:
  mode: reviews
```

Frigate sorts review items into **Alerts** and **Detections**. By default, only `person` and `car` count as Alerts, and reviews mode only notifies on Alerts. If that's all you want notifications for, you're done. To get detections too, see [Getting detection alerts back](#getting-detection-alerts-back).

### Limit each event to one notification

As a safety net, add `notify_once` under `alerts:`, in a `general:` block next to the existing `ntfy:` settings:

```yaml
alerts:
  general:
    notify_once: true
  ntfy:
    # ...your existing ntfy settings...
```

This guarantees at most one notification per event or review item, even if frigate-notify picks the same one up again. It works in either mode.

### Getting detection alerts back

In reviews mode, objects that Frigate files as Detections rather than Alerts don't send notifications. There are two ways to get them back.

**Notify on all detections.** Add `notify_detections` to the same `general:` block in frigate-notify's `config.yml`:

```yaml
alerts:
  general:
    notify_once: true
    notify_detections: true
```

`notify_detections` only works in reviews mode. Detections are grouped into review items the same way Alerts are, so this is much quieter than going back to `mode: events`.

**Promote specific objects to Alerts.** If all detections is still too noisy and only one or two object types matter, add them to Frigate's list of Alerts instead, and leave `notify_detections` off. This one goes in **Frigate's** config, not frigate-notify's:

```yaml
review:
  alerts:
    labels:
      - person
      - car
      - dog
```

Keep `person` and `car` in the list, or they stop being Alerts. To only count an object when it's in a zone you've drawn, add `required_zones` under `alerts:` with your zone names (for example `- driveway`). This also changes what Frigate's Review page shows as Alerts. Save and restart Frigate after the change.

### Apply the change

Restart frigate-notify after editing its config, and check the logs for errors:

```bash
sudo docker restart frigate-notify
sudo docker logs frigate-notify --tail 30
```

The filters in Steps 1–4 are separate settings in the same `alerts:` section, and you can use them alongside reviews mode. After switching modes, walk in front of a camera to confirm alerts still arrive for what you want.

---

## Putting it together

A complete frigate-notify `config.yml` combining object filtering, zone filtering, an excluded camera, and a confidence threshold, built on the Argus defaults from [Setting up push notifications](ntfy-setup.md#frigate-notify):

```yaml
app:
  mode: events

frigate:
  server: http://frigate.nvr-network:5000
  public_url: https://frigate.internal
  ignoressl: false
  webapi:
    enabled: true
    interval: 30
  startup_check:
    attempts: 5
    interval: 30
  cameras:
    exclude:
      - indoor_office

alerts:
  labels:
    min_score: 70
    allow:
      - person
      - car
  zones:
    unzoned: drop
    allow:
      - driveway
  ntfy:
    enabled: true
    server: http://ntfy.nvr-network:80
    topic: argus-XXXXXX
    ignoressl: false
```

Keep your own `topic` value. Don't copy `argus-XXXXXX` over it.

To use reviews mode from [Step 5](#step-5-reduce-repeated-notifications) as well, change these two parts of the file and leave the rest as shown:

```yaml
app:
  mode: reviews

alerts:
  general:
    notify_once: true
    notify_detections: true   # optional: also notify on Frigate Detections
  labels:
    # ...as above...
```

Restart frigate-notify after any change to its `config.yml`:

```bash
sudo docker restart frigate-notify
sudo docker logs frigate-notify --tail 30
```

Check the logs for config errors, then walk in front of a camera to confirm notifications still arrive for the events you kept. If nothing arrives at all, see [Not receiving notifications](../troubleshooting/notifications.md#check-frigate-notify).

---

## Where to go from here

- [Setting up notification quiet hours](schedules.md), to limit alerts to certain hours of the day
- [Setting up recording zones and motion detection](../cameras/zones-motion.md), to create the zones used for zone-based filtering
