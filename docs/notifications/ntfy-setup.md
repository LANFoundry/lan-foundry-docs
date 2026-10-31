# Setting up push notifications

Push notifications on Argus systems use three containers working in sequence: **Frigate** detects events, **frigate-notify** picks them up and formats them, and **ntfy** delivers them to your phone. All three are installed and wired together on Argus systems; what's left for you is choosing a notification topic and subscribing your phone. This guide explains how the chain works, how to set your topic, and how to subscribe.

If you're running your own hardware, see [Running your own hardware?](#running-your-own-hardware) at the bottom of this guide.

---

## How it works

```
Frigate → frigate-notify → ntfy → your phone
```

**frigate-notify** runs alongside Frigate on the same Docker network and polls Frigate's event API every 30 seconds. When a new event is detected, frigate-notify fetches the event details, grabs the snapshot URL from Frigate, and sends a formatted notification to ntfy with the snapshot attached.

**ntfy** receives the notification and queues it for delivery. When your phone's ntfy app is connected to your NVR on the local network, the alert arrives within seconds. If you've configured remote delivery, ntfy forwards the notification through an upstream relay or a VPN so you receive it when you're away from home.

ntfy caches snapshots locally in a volume on the NVR so your phone can download the image when it receives the alert. This is why ntfy requires `base-url` to be configured — it needs to know its own address to construct the attachment download URL it includes in each notification.

---

## What's already set up on your Argus system

### frigate-notify

frigate-notify's config is at `/opt/lanfoundry/config/frigate-notify/config.yml` on the NVR host, mounted read-only into the container. Edit it on the host, not inside the container:

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
    server: http://ntfy.nvr-network:80
    topic: your-topic-name
    ignoressl: false
```

`interval: 30` means frigate-notify checks Frigate for new events every 30 seconds. Notifications may arrive up to 30 seconds after a detection, which is normal. `server` reaches ntfy by its container name on the shared Docker network. `topic` is the name your phone subscribes to; it ships as the placeholder `your-topic-name`, and [Step 1](#step-1-set-your-notification-topic) replaces it with your own.

### ntfy

ntfy's config is at `/opt/lanfoundry/config/ntfy/server.yml` on the NVR host, mounted read-only into the container at `/etc/ntfy`:

```yaml
base-url: https://ntfy.internal
attachment-cache-dir: /var/cache/ntfy/attachments
attachment-total-size-limit: 5G
attachment-file-size-limit: 15M
```

`base-url` tells ntfy what address to include in attachment download URLs. Without it, ntfy rejects any notification that includes an attached image. `attachment-cache-dir` is inside the `ntfy-cache` volume (`/var/cache/ntfy`), which is already mounted by the container — ntfy creates the `attachments` subdirectory automatically on startup.

---

## Step 1 — Set your notification topic

Check what the topic is set to now:

```bash
sudo grep topic /opt/lanfoundry/config/frigate-notify/config.yml
```

If it still shows `your-topic-name`, pick a topic of your own. Make it hard to guess: anyone who can reach your ntfy server and knows the topic name can subscribe to your alerts. Something like `argus-d61b61` works well.

Open the file and replace the placeholder:

```bash
sudo nano /opt/lanfoundry/config/frigate-notify/config.yml
```

Then restart frigate-notify so it picks up the change:

```bash
docker restart frigate-notify
```

Keep note of the topic — you'll enter it in the ntfy app in the next guide.

---

## Step 2 — Verify ntfy is running

Open a browser on your main LAN and go to `https://ntfy.internal`. You should see the ntfy web interface. If you see a certificate warning, click through it — this is expected on first visit and is covered in the [Caddy guide](../network/caddy-reverse-proxy.md#step-2-trust-the-certificate).

If the page doesn't load, check that the ntfy container is running in Arcane and that DNS is configured. See [Can't reach a service by hostname](../troubleshooting/hostname.md) if the hostname isn't resolving.

You can also verify ntfy is receiving notifications from frigate-notify by subscribing to your topic in the web UI. Enter your topic name and click **Subscribe**, then walk in front of a camera. A notification with a snapshot should appear within 30 seconds.

---

## Step 3 — Subscribe on your phone

See [Receiving ntfy alerts on your phone](ntfy-mobile.md) for how to install the ntfy app and subscribe to your topic on iOS or Android.

---

## Step 4 — Enable remote notifications

By default, ntfy only delivers to devices on the same local network as the NVR. To receive alerts when you're away from home, you have two options.

### Option A — ntfy upstream relay

ntfy can forward a copy of each notification to ntfy.sh, which delivers it to your phone via FCM (Android) or APNs (iOS) from anywhere. Your NVR needs outbound internet access for this to work.

Add one line to ntfy's `server.yml` on the NVR host. The file is mounted read-only into the container, so edit it on the host:

```bash
sudo nano /opt/lanfoundry/config/ntfy/server.yml
```

Add `upstream-base-url` below the existing settings:

```yaml
base-url: https://ntfy.internal
attachment-cache-dir: /var/cache/ntfy/attachments
attachment-total-size-limit: 5G
attachment-file-size-limit: 15M
upstream-base-url: "https://ntfy.sh"
```

Restart the ntfy container after saving. The ntfy app on your phone will receive alerts over cellular or any internet connection automatically.

**Privacy note:** When upstream is enabled, the notification text — camera name, event type — and the snapshot attachment pass through ntfy.sh's servers on the way to your phone. No camera footage or RTSP stream is ever involved. If you want to keep notification content entirely off third-party infrastructure on Android, reach the NVR over a VPN instead (Option B).

!!! note "iOS users"
    Apple requires all push notifications to route through Apple's servers (APNs), regardless of whether you use ntfy.sh or another relay. When the ntfy iOS app connects to a self-hosted server, it uses ntfy.sh's relay to reach APNs. Notification text and snapshots transit ntfy.sh's servers on the way to your iPhone, an Apple platform constraint that applies to any self-hosted push service.

### Option B — WireGuard or Tailscale

If your phone can reach the NVR over a VPN, the ntfy app connects to it directly from anywhere. On Android, that means no third-party relay is involved. On iOS, Apple's push requirement still applies (see the note above), so notification text and snapshots transit ntfy.sh on the way to an iPhone either way.

With [WireGuard on your router](../network/vpn-wireguard.md), point the WireGuard client's DNS at your router and the app can keep using `https://ntfy.internal`. Alerts arrive as long as the tunnel is active on your phone.

Tailscale isn't included on Argus systems; if you choose to install it, [read the risks](../privacy/remote-access.md#the-risks-in-plain-english) first. See [Remote access with Tailscale](../privacy/remote-access.md) for setup. The simplest way to make this work is to set up [subnet routing and Split DNS](../privacy/remote-access.md#optional-access-services-by-hostname) there, so `https://ntfy.internal` resolves over Tailscale and the ntfy app can keep using that address. Pointing the app at the NVR's raw Tailscale IP instead can get you the notification text without the snapshot, because ntfy builds snapshot links from its `base-url` (`https://ntfy.internal`). Alerts arrive as long as Tailscale is connected on your phone.

---

## Running your own hardware?

If you're not on an Argus system, here's how to add the notification stack from scratch.

### Add frigate-notify to your Docker stack

In your existing compose file, add the frigate-notify service alongside Frigate, ntfy, and the other containers:

```yaml
services:
  frigate-notify:
    image: ghcr.io/0x2142/frigate-notify:latest
    container_name: frigate-notify
    restart: unless-stopped
    volumes:
      - /opt/lanfoundry/config/frigate-notify/config.yml:/app/config.yml:ro
    networks:
      - nvr-network
```

frigate-notify needs to be on the same Docker network as Frigate and ntfy to reach them by container name. If your network is named differently, adjust the `networks` entry.

Create the config directory and file on the host before starting the container:

```bash
sudo mkdir -p /opt/lanfoundry/config/frigate-notify
sudo nano /opt/lanfoundry/config/frigate-notify/config.yml
```

### Configure frigate-notify

Paste the following into `config.yml`, replacing the topic with something unique to your system. The paths here match the Argus layout; use your own if you prefer, as long as the compose file and the folder agree.

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
    server: http://ntfy.nvr-network:80
    topic: your-unique-topic
    ignoressl: false
```

Pick a topic name that isn't easily guessable — anyone who knows it can subscribe to your notifications. Something like `nvr-a7f3k` works well.

### Configure ntfy

ntfy needs `base-url` and the attachment cache configured or it will reject every notification from frigate-notify with a 400 error. Edit ntfy's `server.yml` on the host, at whatever path you mount to `/etc/ntfy` in the container (`/opt/lanfoundry/config/ntfy/server.yml` in the Argus layout):

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
