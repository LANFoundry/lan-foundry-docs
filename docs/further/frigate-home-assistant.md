# Frigate and Home Assistant

Once Home Assistant is running, the Frigate integration brings your cameras, detection events, and review activity into the Home Assistant ecosystem. Camera feeds appear as entities, detections trigger automations, and you can build rules around what Frigate sees.

This guide covers adding the integration, understanding what it creates, and a starting automation example.

---

## Before you start

This guide assumes:

- Home Assistant is running and accessible on your network. See [Adding Home Assistant](home-assistant.md) if not
- Frigate is running and cameras have working feeds
- Home Assistant can reach the Frigate web interface on your network (both on the same LAN, or connected via Tailscale)

The NVR's address in the examples below is `192.168.1.100`. Replace it with the actual IP of your NVR.

---

## Step 1 — Add the Frigate integration

In Home Assistant, go to **Settings**, then **Devices and Services**, then click **Add Integration** in the bottom right.

Search for **Frigate** and select it.

You'll be prompted for the Frigate URL. Enter:

```
http://192.168.1.100:5000
```

Click **Submit**. Home Assistant connects to Frigate and imports entities for each configured camera.

If the integration doesn't appear in the search results, it may not yet be included in your version of Home Assistant. In that case, install it through HACS (Home Assistant Community Store) first. HACS setup is covered in the [Home Assistant HACS documentation](https://hacs.xyz/docs/setup/download/).

---

## Step 2 — Review the created entities

After the integration connects, Home Assistant creates a set of entities for each Frigate camera. Navigate to **Settings**, then **Devices and Services**, then find the Frigate integration and open it.

You'll see a device for each camera. Each camera device includes entities like:

| Entity type | What it represents |
|---|---|
| Camera | Live stream from Frigate (snapshot or stream) |
| Binary sensor: motion | On when Frigate detects motion on that camera |
| Sensor: person count | Number of people currently tracked on that camera |
| Sensor: car count | Number of vehicles currently tracked |
| Binary sensor: person detected | On when a person detection event is active |

The exact entities depend on which object types you've configured in Frigate's `config.yml`. If you're tracking only `person` and `car`, you'll see sensors for those. Other object types (dog, package, bicycle) produce sensors when configured.

---

## Step 3 — Build an automation

With camera entities and detection sensors in Home Assistant, you can trigger automations from Frigate events. Here's a simple example: send a Home Assistant notification when a person is detected at the front door.

In Home Assistant, go to **Settings**, then **Automations and Scenes**, then **Create Automation**.

Choose **Create new automation**, then switch to **Edit in YAML** mode and paste:

```yaml
alias: "Notify on front door person detection"
trigger:
  - platform: state
    entity_id: binary_sensor.front_door_person_detected
    to: "on"
condition: []
action:
  - service: notify.mobile_app_your_phone
    data:
      title: "Front door"
      message: "Person detected"
mode: single
```

Replace `binary_sensor.front_door_person_detected` with the actual entity ID from your Frigate integration (visible in the entity list you reviewed in Step 2), and `notify.mobile_app_your_phone` with your phone's notification service entity.

Save the automation. The next time Frigate detects a person on that camera, Home Assistant fires the notification.

This is a basic starting point. Home Assistant automations support conditions (time of day, presence, alarm state), multiple actions (lights, locks, announcements), and zone-aware triggers from Frigate zones configured in `config.yml`.

---

## What normal looks like

After setup:

- The Frigate integration shows as connected in **Settings**, **Devices and Services**
- Each camera appears as a device with its associated sensors
- The camera entity shows a snapshot or stream in the Home Assistant dashboard
- Detection sensors update in near-real-time as Frigate processes frames
- Any automations you've built fire when their trigger conditions are met

If the integration shows as unavailable, confirm Frigate is running (`docker ps | grep frigate`) and that Home Assistant can reach the NVR's IP on port 5000.

---

## Where to go from here

- [Home Assistant documentation on automations](https://www.home-assistant.io/docs/automation/), to build more complex rules around Frigate events
- [Setting up recording zones and motion detection](../cameras/zones-motion.md), to create named zones that can be referenced in Home Assistant automations
- [Tuning motion sensitivity](../cameras/tuning-sensitivity.md), to reduce false triggers that would otherwise fire your automations
- [Community resources](community.md), for the Home Assistant community forums and Frigate Discord
