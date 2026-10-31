# Filtering which events trigger notifications

This guide covers how to control which detections send notifications to your phone. Argus systems ship with frigate-notify set to alert on every object Frigate detects, across every camera, which gets noisy fast. A few lines in frigate-notify's config narrow that down to what actually matters.

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

If no filters are configured, every event on every camera sends a notification. The filters below layer on top of each other, and you can use any combination.

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
