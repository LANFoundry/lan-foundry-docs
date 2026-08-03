# Adding Home Assistant

Home Assistant is an open-source home automation platform that runs entirely on your local network. It connects to cameras, sensors, lights, locks, and hundreds of other devices without cloud accounts or subscriptions, and it integrates directly with Frigate for camera events and automations.

This guide covers your installation options and walks through setting up Home Assistant Container on your Argus NVR via Docker.

---

## Before you start

This guide assumes:

- Your Argus NVR is running and Frigate is working normally
- You have SSH access to the NVR
- You're comfortable editing a Docker Compose file

If you want Home Assistant to also control Zigbee, Z-Wave, or other radio devices, you will need a compatible USB adapter connected to the NVR or a separate host. That setup is out of scope here, but Home Assistant's documentation covers it once the base install is working.

---

## Installation options

There are a few ways to run Home Assistant. They are not interchangeable, and the differences matter.

### Home Assistant Container (on the NVR)

Runs Home Assistant as a Docker container alongside Frigate. This is the simplest path if you want everything on one machine.

**Limitations:** Home Assistant Container does not support the **add-on** system. Add-ons are pre-packaged integrations (like the Zigbee2MQTT add-on or the ESPHome add-on) that install alongside Home Assistant as companion services. Without add-on support, you can still run those services in Docker separately, but they won't appear inside the Home Assistant UI's add-on store.

For camera integration with Frigate, notifications, and most common automations, Container is fully capable. The limitation mostly affects advanced radio device integrations and convenience tooling.

### Home Assistant on a separate device

Running Home Assistant OS (the full install) on dedicated hardware gives you the complete feature set: add-ons, the supervisor, and the full backup system. The hardware is your choice.

This option also keeps Home Assistant's resource usage off the NVR entirely. On Vigil systems especially, a separate device is worth considering since Vigil's hardware is sized for the NVR workload with limited headroom.

---

## Install Home Assistant Container on the NVR

### Step 1 — Add Home Assistant to Docker Compose

Open the NVR's Docker Compose file. It is typically at `/opt/frigate/docker-compose.yml` or the path shown in your existing Frigate setup.

Add the following service block alongside the existing Frigate service:

```yaml
  homeassistant:
    image: ghcr.io/home-assistant/home-assistant:stable
    container_name: homeassistant
    restart: unless-stopped
    privileged: true
    network_mode: host
    volumes:
      - /opt/homeassistant/config:/config
      - /etc/localtime:/etc/localtime:ro
```

A few notes on this configuration:

- `network_mode: host` lets Home Assistant discover devices on the local network (mDNS, UPnP). This is the standard approach for Container installs.
- `privileged: true` is required if Home Assistant needs to access USB devices like a Zigbee adapter. If you don't have USB radio devices, you can omit it.
- The config volume path (`/opt/homeassistant/config`) can be changed to any writable directory on the NVR.

### Step 2 — Create the config directory and start the container

```bash
sudo mkdir -p /opt/homeassistant/config
docker compose up -d homeassistant
```

Home Assistant will download and start. The first boot takes a couple of minutes as it initializes the config directory.

### Step 3 — Complete the onboarding

Open a browser and go to `http://192.168.1.100:8123`, replacing the IP with your NVR's address. Home Assistant's onboarding wizard will appear.

Work through the wizard:

1. Create your owner account (username and password)
2. Set your home location and unit preferences
3. Home Assistant will attempt to auto-discover devices on the network. You can skip this and add them later
4. Finish onboarding

You now have a running Home Assistant instance. The web interface is available at port `8123` on the NVR's IP from any browser on your network.

### Step 4 — Verify the container restarts automatically

Reboot the NVR and confirm Home Assistant comes back up on its own:

```bash
sudo reboot
```

After it comes back, check:

```bash
docker ps | grep homeassistant
```

The container should show a status of `Up`. If it doesn't start, check:

```bash
docker logs homeassistant --tail 30
```

---

## Keeping Home Assistant updated

Home Assistant releases updates frequently. To update:

```bash
docker compose pull homeassistant
docker compose up -d homeassistant
```

This pulls the latest `stable` image and restarts the container with it. Your configuration persists in the volume. Back up your config before major updates:

```bash
sudo cp -r /opt/homeassistant/config /opt/homeassistant/config-backup-$(date +%Y%m%d)
```

---

## Where to go from here

- [Frigate and Home Assistant](frigate-home-assistant.md), to connect Frigate cameras and events into Home Assistant
- [Hardware potential](hardware-potential.md), for other services that run well alongside Frigate on the NVR
- [Home Assistant documentation](https://www.home-assistant.io/docs/), for integrations, automations, and advanced configuration
