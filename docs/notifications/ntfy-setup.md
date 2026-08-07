# Setting up push notifications

Push notifications on Argus systems use three containers working in sequence: **Frigate** detects events, **frigate-notify** picks them up and formats them, and **ntfy** delivers them to your phone. All three are pre-configured on Argus systems. This guide explains how the chain works, how to find your unique notification topic, and how to subscribe on your phone.

If you're running your own hardware, see [Running your own hardware?](#running-your-own-hardware) at the bottom of this guide.

---

## How it works

```
Frigate → frigate-notify → ntfy → your phone
```

**frigate-notify** runs alongside Frigate on the same Docker network and polls Frigate's event API every 30 seconds. When a new event is detected, frigate-notify fetches the event details, grabs the snapshot URL from Frigate, and sends a formatted notification to ntfy with the snapshot attached.

**ntfy** receives the notification and queues it for delivery. When your phone's ntfy app is connected to your NVR on the local network, the alert arrives within seconds. If you've configured remote delivery, ntfy forwards the notification through an upstream relay or Tailscale so you receive it when you're away from home.

ntfy caches snapshots locally in a volume on the NVR so your phone can download the image when it receives the alert. This is why ntfy requires `base-url` to be configured — it needs to know its own address to construct the attachment download URL it includes in each notification.

---

## What's pre-configured on your Argus system

### frigate-notify

frigate-notify's config is at `~/nvr/frigate-notify/app.yml` on the NVR host:

```yaml
app:
  mode: events

frigate:
  server: http://frigate.nvr-network:5000
  ignoressl: false
  webapi:
    enabled: true
    interval: 30
  startup_check:
    attempts: 5
    interval: 30

alerts:
  ntfy:
    enabled: true
    server: http://ntfy
    topic: argus-XXXXXX
    ignoressl: false
```

`interval: 30` means frigate-notify checks Frigate for new events every 30 seconds. Notifications may arrive up to 30 seconds after a detection, which is normal. `topic` is set to a unique value per system at the time of configuration — your actual topic is printed on your Argus welcome card and stored in the config file.

### ntfy

ntfy's config is stored in the `ntfy-config` Docker volume, mounted at `/etc/ntfy/server.yml` inside the container:

```yaml
base-url: https://ntfy.internal
attachment-cache-dir: /var/cache/ntfy/attachments
attachment-total-size-limit: 5G
attachment-file-size-limit: 15M
```

`base-url` tells ntfy what address to include in attachment download URLs. Without it, ntfy rejects any notification that includes an attached image. `attachment-cache-dir` is inside the `ntfy-cache` volume (`/var/cache/ntfy`), which is already mounted by the container — ntfy creates the `attachments` subdirectory automatically on startup.

---

## Step 1 — Find your notification topic

Your topic name is on your Argus welcome card. If you need to look it up on the NVR directly:

```bash
grep topic ~/nvr/frigate-notify/app.yml
```

The output will look like:

```
    topic: argus-d61b61
```

Keep note of this value — you'll enter it in the ntfy app in the next guide.

---

## Step 2 — Verify ntfy is running

Open a browser on your main LAN and go to `https://ntfy.internal`. You should see the ntfy web interface. If you see a certificate warning, click through it — this is expected on first visit and is covered in the [Caddy guide](../network/caddy-reverse-proxy.md#step-2-trust-the-certificate).

If the page doesn't load, check that the ntfy container is running in Portainer and that DNS is configured. See [Can't reach a service by hostname](../troubleshooting/hostname.md) if the hostname isn't resolving.

You can also verify ntfy is receiving notifications from frigate-notify by subscribing to your topic in the web UI. Enter your topic name and click **Subscribe**, then walk in front of a camera. A notification with a snapshot should appear within 30 seconds.

---

## Step 3 — Subscribe on your phone

See [Receiving ntfy alerts on your phone](ntfy-mobile.md) for how to install the ntfy app and subscribe to your topic on iOS or Android.

---

## Step 4 — Enable remote notifications

By default, ntfy only delivers to devices on the same local network as the NVR. To receive alerts when you're away from home, you have two options.

### Option A — ntfy upstream relay

ntfy can forward a copy of each notification to ntfy.sh, which delivers it to your phone via FCM (Android) or APNs (iOS) from anywhere. Your NVR needs outbound internet access for this to work.

Add one line to the ntfy `server.yml` via Portainer (Volumes → `ntfy-config` → Browse → `server.yml`):

```yaml
base-url: https://ntfy.internal
attachment-cache-dir: /var/cache/ntfy/attachments
attachment-total-size-limit: 5G
attachment-file-size-limit: 15M
upstream-base-url: "https://ntfy.sh"
```

Restart the ntfy container after saving. The ntfy app on your phone will receive alerts over cellular or any internet connection automatically.

**Privacy note:** When upstream is enabled, the notification text — camera name, event type — and the snapshot attachment pass through ntfy.sh's servers on the way to your phone. No camera footage or RTSP stream is ever involved. If you want to keep notification content entirely off third-party infrastructure, use Tailscale instead.

!!! note "iOS users"
    Apple requires all push notifications to route through Apple's servers (APNs), regardless of whether you use ntfy.sh or another relay. When the ntfy iOS app connects to a self-hosted server, it uses ntfy.sh's relay to reach APNs. Notification text and snapshots transit ntfy.sh's servers on the way to your iPhone. This is an Apple platform constraint — it applies to every self-hosted push notification solution on iOS, not just ntfy.

### Option B — Tailscale

With Tailscale running on both the NVR and your phone, the ntfy app connects directly to the NVR's Tailscale address from anywhere in the world — no third-party relay involved, no notification content leaving your infrastructure.

See [Accessing the NVR remotely with Tailscale](../network/tailscale.md) for setup. Once Tailscale is running, point the ntfy app at the NVR's Tailscale IP or hostname instead of `https://ntfy.internal`. Alerts arrive as long as Tailscale is connected on your phone.

---

## Running your own hardware?

If you're not on an Argus system, here's how to add the notification stack from scratch.

### Add frigate-notify to your Docker stack

In your existing compose file, add the frigate-notify service alongside Frigate, ntfy, and the other containers:

```yaml
services:
  frigate-notify:
    image: 0x2142/frigate-notify:latest
    container_name: frigate-notify
    restart: unless-stopped
    volumes:
      - ~/nvr/frigate-notify/app.yml:/etc/frigate-notify/config.yaml
    networks:
      - nvr-network
```

frigate-notify needs to be on the same Docker network as Frigate and ntfy to reach them by container name. If your network is named differently, adjust the `networks` entry.

Create the config directory and file on the host before starting the container:

```bash
mkdir -p ~/nvr/frigate-notify
nano ~/nvr/frigate-notify/app.yml
```

### Configure frigate-notify

Paste the following into `app.yml`, replacing the topic with something unique to your system:

```yaml
app:
  mode: events

frigate:
  server: http://frigate.nvr-network:5000
  ignoressl: false
  webapi:
    enabled: true
    interval: 30
  startup_check:
    attempts: 5
    interval: 30

alerts:
  ntfy:
    enabled: true
    server: http://ntfy
    topic: your-unique-topic
    ignoressl: false
```

Pick a topic name that isn't easily guessable — anyone who knows it can subscribe to your notifications. Something like `nvr-a7f3k` works well.

### Configure ntfy

ntfy needs `base-url` and the attachment cache configured or it will reject every notification from frigate-notify with a 400 error. Edit ntfy's `server.yml` (in the `ntfy-config` volume via Portainer, or directly at the path mounted into the container):

```yaml
base-url: https://ntfy.internal
attachment-cache-dir: /var/cache/ntfy/attachments
attachment-total-size-limit: 5G
attachment-file-size-limit: 15M
```

Replace `https://ntfy.internal` with whatever hostname or address your ntfy instance is accessible at. This must match what your phone's ntfy app will use to download snapshots.

Ensure your ntfy container mounts a persistent volume at `/var/cache/ntfy` — ntfy creates the `attachments` subdirectory automatically, but the parent directory needs to be writable and persistent across restarts.

### Restart and verify

```bash
docker compose up -d frigate-notify
docker restart ntfy
docker logs frigate-notify --tail 30
```

Watch the logs for successful event processing. Walk in front of a camera and confirm a notification appears in the ntfy web UI within 30 seconds. If you see `failed to send request, got status code 400`, check that `base-url` is set in ntfy's `server.yml` and that ntfy was restarted after the change.

---

## Where to go from here

- [Receiving ntfy alerts on your phone](ntfy-mobile.md) — install the ntfy app and subscribe to your topic
- [Filtering which events trigger notifications](filtering.md) — narrow down which cameras, objects, and zones send alerts
- [Setting up notification quiet hours](schedules.md) — silence notifications at night or on a schedule
