# Setting up notification quiet hours

This guide covers how to stop notifications during hours you don't want them — overnight, during work, or whenever alerts are more nuisance than useful.

ntfy's self-hosted server doesn't have a built-in quiet hours setting. The practical options are phone-side (simplest, no NVR changes) or Frigate-side (stops events from being generated at all). This guide covers both, starting with the easier one.

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

## Option 2 — Disable Frigate detection on a schedule

If you'd rather Frigate stop generating events entirely during certain hours — not just silence them on your phone — you can toggle detection mode via MQTT commands on a schedule.

This approach requires an MQTT broker running alongside Frigate. If you don't have one, this is more involved to set up. The phone-based approach in Option 1 achieves the same result for notifications with much less configuration.

**What this does:** Frigate listens for MQTT messages on its control topics. Sending the right message pauses motion detection on a camera, which prevents events from being created, which means no notifications are generated.

**Adding Mosquitto (MQTT broker) to your stack**

If you don't have an MQTT broker running, add Mosquitto to your Portainer stack:

```yaml
  mosquitto:
    image: eclipse-mosquitto
    container_name: mosquitto
    restart: unless-stopped
    ports:
      - "1883:1883"
    volumes:
      - mosquitto-config:/mosquitto/config
      - mosquitto-data:/mosquitto/data
      - mosquitto-log:/mosquitto/log
```

Add the corresponding volumes entry and deploy.

Then update Frigate's `config.yml` to connect to it:

```yaml
mqtt:
  host: mosquitto
  port: 1883
```

**Sending a control command**

To pause motion detection on a camera:

```bash
mosquitto_pub -h YOUR_NVR_IP -t "frigate/front_door/motion/set" -m "OFF"
```

To re-enable it:

```bash
mosquitto_pub -h YOUR_NVR_IP -t "frigate/front_door/motion/set" -m "ON"
```

Replace `front_door` with your camera name.

**Scheduling the commands**

A cron job on the NVR (or any always-on device) can run these commands on a schedule. For example, to silence all cameras from 11pm to 7am:

```bash
# Disable detection at 11pm
0 23 * * * mosquitto_pub -h 127.0.0.1 -t "frigate/front_door/motion/set" -m "OFF"

# Re-enable at 7am
0 7  * * * mosquitto_pub -h 127.0.0.1 -t "frigate/front_door/motion/set" -m "ON"
```

Add a line for each camera. Edit crontab with `crontab -e` on the NVR.

!!! note "Recording continues during detection pause"
    Pausing motion detection stops Frigate from generating events and sending notifications. Continuous recording (if configured) continues unaffected. Cameras remain online and viewable in the Frigate UI.

---

## Option 3 — Home Assistant automations

If you add Home Assistant to your stack, time-based notification control becomes significantly easier. HA can toggle Frigate detection modes on a schedule through a visual automation editor, without writing MQTT commands or managing cron jobs manually.

See [Adding Home Assistant to the stack](../further/home-assistant.md) for an overview of adding HA to your Argus system. The Frigate–Home Assistant integration is covered in [Integrating Frigate with Home Assistant](../further/frigate-home-assistant.md).

---

## Where to go from here

- [Filtering which events trigger notifications](filtering.md) — if you haven't already, filtering by object type and zone reduces noise before quiet hours becomes necessary
- [Integrating Frigate with Home Assistant](../further/frigate-home-assistant.md) — automation-based notification scheduling and much more
