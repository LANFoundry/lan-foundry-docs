# Setting up notification quiet hours

This guide covers how to stop notifications during hours you don't want them — overnight, during work, or whenever alerts are more nuisance than useful.

ntfy itself doesn't have a quiet hours setting, but frigate-notify, the container that sends Frigate's events to ntfy, does. That gives you three practical options: phone-side (simplest, no NVR changes), frigate-notify (one schedule for every phone, detection keeps running), or Frigate-side (stops events from being generated at all). This guide covers all three, starting with the easiest, plus Home Assistant if you already run it.

---

## Before you start

- ntfy is set up and notifications are arriving on your phone
- Your phone is an iPhone or Android device

---

## Option 1 — Phone quiet hours (simplest)

The easiest approach and the right starting point for most people. No changes to your NVR or Frigate config required — you're just telling your phone to silence a specific app on a schedule.

**iOS — Focus modes**

1. Open **Settings** → **Focus**.
2. Tap **Sleep** (or create a new Focus if you want more control).
3. Under **Apps**, add **ntfy** to the list of apps that are silenced during this Focus.
4. Set a schedule: tap **Add Schedule** → choose the days and hours.

iOS activates Sleep Focus automatically at the scheduled time, silencing ntfy notifications until the Focus ends.

For more granular control — silencing ntfy during work hours, for example — create a custom Focus mode and configure it the same way.

**Android**

1. Open **Settings** → **Digital Wellbeing & Parental Controls** → **Bedtime mode**.
2. Set your bedtime schedule and enable **Do Not Disturb** during that time.

Alternatively, configure per-app notification scheduling directly:

1. Open **Settings** → **Apps** → **ntfy** → **Notifications**.
2. Look for **Notification schedule** or **Allow notifications** — the exact path varies by Android version and manufacturer.
3. Set the hours during which ntfy notifications are allowed.

This option is the right choice if you only want quiet hours and don't need Frigate to stop detecting events — recordings continue normally, you just won't be woken up.

---

## Option 2 — Quiet hours in frigate-notify

Option 1 has to be set up on every phone that's subscribed. If several people get your alerts, or you'd rather set the schedule once on the NVR, frigate-notify can hold back notifications during a time window instead. Frigate keeps detecting and recording as normal; the events are still in Frigate's review timeline, they just don't send a notification.

Open `/opt/lanfoundry/config/frigate-notify/config.yml` on the NVR host (`sudo nano /opt/lanfoundry/config/frigate-notify/config.yml`) and add a `quiet` section *inside* the existing `alerts:` section (don't add a second `alerts:` line):

```yaml
alerts:
  quiet:
    start: "23:00"
    end: "07:00"
  ntfy:
    enabled: true
    server: http://ntfy.nvr-network:80
    topic: argus-XXXXXX
    ignoressl: false
```

Times are 24-hour. A window that crosses midnight, like `23:00` to `07:00`, works as you'd expect. Keep your own `topic` value rather than copying `argus-XXXXXX`.

Restart frigate-notify for the change to take effect:

```bash
docker restart frigate-notify
```

!!! note "Quiet hours follow the container's clock"
    frigate-notify compares these times against its own clock, which is UTC unless the container's time zone is set. If quiet hours start and end at the wrong time of day, add `TZ` (for example `TZ=America/Chicago`) to the frigate-notify service's `environment` in your compose stack and redeploy. Check what the container thinks the time is with `docker exec frigate-notify date`.

---

## Option 3 — Disable Frigate detection on a schedule

Options 1 and 2 stop notifications, but Frigate keeps detecting and recording events in the background. If you'd rather Frigate stop generating events entirely during certain hours, you can toggle object detection via MQTT commands on a schedule.

This approach requires an MQTT broker running alongside Frigate. If you don't have one, this is more involved to set up. If you only care about notifications, Option 2 gets you there with much less configuration.

**What this does:** Frigate listens for MQTT messages on its control topics. Sending the right message turns off object detection on a camera, which prevents events from being created, which means frigate-notify has nothing to send.

**Adding Mosquitto (MQTT broker) to your stack**

If you don't have an MQTT broker running, add Mosquitto. Mosquitto 2.x won't accept connections from other containers until a config file tells it to listen, so create one first:

```bash
sudo mkdir -p /opt/lanfoundry/config/mosquitto
sudo nano /opt/lanfoundry/config/mosquitto/mosquitto.conf
```

Paste:

```
listener 1883
allow_anonymous true
persistence true
persistence_location /mosquitto/data/
```

`allow_anonymous true` is only reasonable because of how the service below publishes its port: bound to `127.0.0.1`, so nothing else on your LAN can reach the broker. Frigate reaches it over the shared Docker network, and the cron job below runs on the NVR itself. Without that, anyone on your network could turn detection off.

Then add the service to your Portainer stack:

```yaml
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: mosquitto
    restart: unless-stopped
    networks:
      - nvr-network
    ports:
      - "127.0.0.1:1883:1883"
    volumes:
      - /opt/lanfoundry/config/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - mosquitto-data:/mosquitto/data
```

Add `mosquitto-data` to the stack's top-level `volumes:` section and deploy.

Then point Frigate at the broker. Add this to Frigate's `config.yml` (`/opt/lanfoundry/config/frigate/config.yml` on Argus) and restart Frigate:

```yaml
mqtt:
  enabled: true
  host: mosquitto
  port: 1883
```

**Sending a control command**

The commands below use `mosquitto_pub`, which isn't installed on the NVR host by default:

```bash
sudo apt install mosquitto-clients
```

To turn off object detection on a camera:

```bash
mosquitto_pub -h 127.0.0.1 -t "frigate/front_door/detect/set" -m "OFF"
```

To turn it back on:

```bash
mosquitto_pub -h 127.0.0.1 -t "frigate/front_door/detect/set" -m "ON"
```

Replace `front_door` with your camera name. Use `detect/set`, not `motion/set`: Frigate refuses to turn off motion detection while object detection is still on, so a `motion/set OFF` command on its own does nothing. The detection setting also survives a Frigate restart, so if Frigate restarts overnight, detection stays off until the morning command runs.

**Scheduling the commands**

A cron job on the NVR can run these commands on a schedule. (It has to be the NVR itself, since the broker only listens on `127.0.0.1`.) For example, to silence all cameras from 11pm to 7am:

```bash
# Disable detection at 11pm
0 23 * * * mosquitto_pub -h 127.0.0.1 -t "frigate/front_door/detect/set" -m "OFF"

# Re-enable at 7am
0 7  * * * mosquitto_pub -h 127.0.0.1 -t "frigate/front_door/detect/set" -m "ON"
```

Add a line for each camera. Edit crontab with `crontab -e` on the NVR.

!!! note "Recording continues during detection pause"
    Turning off object detection stops Frigate from generating events, so no notifications are sent. Continuous recording (if configured) continues unaffected. Cameras remain online and viewable in the Frigate UI.

---

## Option 4 — Home Assistant automations

If you add Home Assistant to your stack, time-based notification control becomes significantly easier. HA can toggle Frigate detection modes on a schedule through a visual automation editor, without writing MQTT commands or managing cron jobs manually.

See [Adding Home Assistant to the stack](../further/home-assistant.md) for an overview of adding HA to your Argus system. The Frigate–Home Assistant integration is covered in [Integrating Frigate with Home Assistant](../further/frigate-home-assistant.md).

---

## Where to go from here

- [Filtering which events trigger notifications](filtering.md) — if you haven't already, filtering by object type and zone reduces noise before quiet hours becomes necessary
- [Integrating Frigate with Home Assistant](../further/frigate-home-assistant.md) — automation-based notification scheduling and much more
