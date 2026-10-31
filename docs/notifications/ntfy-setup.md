# Setting up push notifications

Push notifications on Argus systems use three containers working in sequence: **Frigate** detects events, **frigate-notify** picks them up and formats them, and **ntfy** delivers them to your phone. All three are installed and wired together on Argus systems; what's left for you is choosing a notification topic and subscribing your phone. This guide explains how the chain works, how to set your topic, and how to subscribe.

If you're running your own hardware, see [Running your own hardware?](#running-your-own-hardware) at the bottom of this guide.

---

## How it works

```
Frigate → frigate-notify → ntfy → your phone
```

**frigate-notify** runs alongside Frigate on the same Docker network and polls Frigate's event API every 30 seconds. When a new event is detected, frigate-notify fetches the event details, grabs the snapshot URL from Frigate, and sends a formatted notification to ntfy with the snapshot attached.

**ntfy** receives the notification and queues it for delivery. When your phone's ntfy app is connected to your NVR on the local network, the alert arrives within seconds. To receive alerts away from home, either have frigate-notify publish to ntfy.sh or connect your phone to the NVR over a VPN (see [Step 4](#step-4-enable-remote-notifications)).

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
  public_url: https://frigate.internal
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

`interval: 30` means frigate-notify checks Frigate for new events every 30 seconds. Notifications may arrive up to 30 seconds after a detection, which is normal.

Under `frigate:`, the two addresses do different jobs. `server` is how frigate-notify reaches Frigate's API over the Docker network, and it only works from inside that network. `public_url` is the address frigate-notify puts in the clip and event links in each notification, so it has to be one your phone or browser can open. If you haven't set up [Caddy](../network/caddy-reverse-proxy.md) and DNS, set it to `http://YOUR_NVR_IP:5000` instead.

Under `alerts: ntfy:`, `server` reaches ntfy by its container name on the shared Docker network. `topic` is the name your phone subscribes to; it ships as the placeholder `your-topic-name`, and [Step 1](#step-1-set-your-notification-topic) replaces it with your own.

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
sudo docker restart frigate-notify
```

Keep note of the topic — you'll enter it in the ntfy app in the next guide.

---

## Step 2 — Verify ntfy is running

Open a browser on your main LAN and go to `https://ntfy.internal`. You should see the ntfy web interface. If you see a certificate warning, click through it — this is expected on first visit and is covered in the [Caddy guide](../network/caddy-reverse-proxy.md#step-2-trust-the-certificate).

You can also reach ntfy directly by IP and port at `http://YOUR_NVR_IP:2586` (for example `http://192.168.1.100:2586`). 2586 is the default host port mapped to ntfy, and this address works even if DNS or Caddy isn't set up yet.

If neither address loads, check that the ntfy container is running in Arcane and that DNS is configured. See [Can't reach a service by hostname](../troubleshooting/hostname.md) if the hostname isn't resolving.

You can also verify ntfy is receiving notifications from frigate-notify by subscribing to your topic in the web UI. Enter your topic name and click **Subscribe**, then walk in front of a camera. A notification with a snapshot should appear within 30 seconds.

---

## Step 3 — Subscribe on your phone

See [Receiving ntfy alerts on your phone](ntfy-mobile.md) for how to install the ntfy app and subscribe to your topic on iOS or Android.

---

## Step 4 — Enable remote notifications

By default, frigate-notify sends alerts to the ntfy server on your NVR, and your phone only gets them while it can reach the NVR. To receive alerts when you're away from home, you have two options.

### Option A — Publish alerts through ntfy.sh

frigate-notify sends each alert straight to the public ntfy.sh server instead of the one on your NVR. Your phone subscribes to the same topic on ntfy.sh and receives alerts anywhere it has an internet connection, with no VPN. Your NVR needs outbound internet access for this to work.

**1. Pick a new topic.** On ntfy.sh, anyone who knows a topic name can subscribe to it, so the topic name works like a password. Generate a long random one:

```bash
echo "argus-$(openssl rand -hex 12)"
```

**2. Point frigate-notify at ntfy.sh.** Open its config on the NVR host:

```bash
sudo nano /opt/lanfoundry/config/frigate-notify/config.yml
```

Under `alerts: ntfy:`, change `server` to `https://ntfy.sh` and set `topic` to the one you just generated:

```yaml
alerts:
  ntfy:
    enabled: true
    server: https://ntfy.sh
    topic: argus-your-random-topic
    ignoressl: false
```

Then restart frigate-notify:

```bash
sudo docker restart frigate-notify
```

**3. Subscribe on ntfy.sh.** In the ntfy app, subscribe to the new topic on `ntfy.sh`, the app's default server, rather than on `ntfy.internal`. Remove the old `ntfy.internal` subscription, because alerts no longer go there.

Things to know about this option:

- The alert text (camera name, object type) and the snapshot are stored on ntfy.sh's servers. No video or camera stream ever leaves your network.
- Snapshots on ntfy.sh expire after a few hours on the free tier, so old alerts lose their image.
- Alerts reach you at home too, as long as your phone has internet.
- Clip links in the alert still point at your NVR (`public_url`), so they only open on your home network or over a VPN.

!!! warning "`upstream-base-url` does not give you remote alerts"
    ntfy's `upstream-base-url` setting sounds like it forwards alerts to ntfy.sh, but it only sends ntfy.sh a message ID. That ID wakes the iOS app, which then has to download the actual alert from your NVR. Away from home, the phone can't reach your NVR, so nothing shows up. On Android the setting does nothing. To get alerts without a VPN, use the frigate-notify change above.

### Option B — WireGuard or Tailscale

If your phone can reach the NVR over a VPN, the ntfy app connects to it directly from anywhere, and nothing passes through ntfy.sh. Keep frigate-notify pointed at your NVR's ntfy and keep the app subscribed on `ntfy.internal`. iPhones need one extra setting for this (see the note below).

!!! note "iPhones and the ntfy server on your NVR"
    iOS doesn't let apps keep a background connection open, so an iPhone subscribed to `ntfy.internal` needs a wake-up signal through Apple's push service. Add this line to ntfy's `server.yml` on the NVR host (`sudo nano /opt/lanfoundry/config/ntfy/server.yml`) and restart the ntfy container:

    ```yaml
    upstream-base-url: "https://ntfy.sh"
    ```

    With it, ntfy sends ntfy.sh only a message ID, never the alert text or snapshot. The iPhone then downloads the alert from your NVR, so it must be on your home network or connected over the VPN. Android doesn't need this setting.

With [WireGuard on your router](../network/vpn-wireguard.md), point the WireGuard client's DNS at your router and the app can keep using `https://ntfy.internal`. Alerts arrive as long as the tunnel is active on your phone.

Tailscale isn't included on Argus systems; if you choose to install it, [read the risks](../privacy/remote-access.md#the-risks-in-plain-english) first. See [Remote access with Tailscale](../privacy/remote-access.md) for setup. The simplest way to make this work is to set up [subnet routing and Split DNS](../privacy/remote-access.md#optional-access-services-by-hostname) there, so `https://ntfy.internal` resolves over Tailscale and the ntfy app can keep using that address. Pointing the app at the NVR's raw Tailscale IP instead can get you the notification text without the snapshot, because ntfy builds snapshot links from its `base-url` (`https://ntfy.internal`). Alerts arrive as long as Tailscale is connected on your phone.

---

## Set the time zone for alert times

The detection time in each alert comes from the frigate-notify container's clock. That clock runs on UTC unless the container's time zone is set, so a 7:15 PM detection in Chicago shows up as 00:15 or 01:15 the next day. [Quiet hours](schedules.md#option-2-quiet-hours-in-frigate-notify) use the same clock.

Check whether a time zone is set on the container:

```bash
sudo docker inspect frigate-notify --format '{{range .Config.Env}}{{println .}}{{end}}' | grep TZ
```

The frigate-notify image is minimal and has no shell or standard tools, so commands like `sudo docker exec frigate-notify date` fail with `executable file not found`. `docker inspect` reads the setting from the host instead.

If nothing prints, or it shows `TZ=Etc/UTC`, open your stack in Arcane and add `TZ` to the frigate-notify service's `environment`:

```yaml
  frigate-notify:
    container_name: frigate-notify
    image: ghcr.io/0x2142/frigate-notify:latest
    restart: unless-stopped
    environment:
      - TZ=America/Chicago
```

Use the name of your zone from the [tz database list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), not an abbreviation like `CST`. `America/Chicago` is Central Time and switches between CST and CDT for daylight saving automatically. Other common US zones are `America/New_York`, `America/Denver`, `America/Phoenix`, and `America/Los_Angeles`.

Redeploy the stack after saving. `docker restart` isn't enough, because environment changes only apply when the container is recreated. Run the `docker inspect` command again to confirm it shows `TZ=America/Chicago` (or your zone). Then walk in front of a camera and check that the time in the alert matches your local time. That alert is the real test.

!!! tip "Changing how the time looks"
    To change the format of the time in alerts, set `timeformat` under `alerts: general:` in frigate-notify's `config.yml`, then restart frigate-notify. For example, `timeformat: "Mon Jan 2, 3:04 PM"` shows times like `Fri Oct 31, 7:15 PM`. frigate-notify uses Go's reference date (Mon Jan 2 2006, 3:04:05 PM), so you write the format using that exact date and time. The default is `2006-01-02 15:04:05 -0700 MST`.

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
    environment:
      - TZ=America/Chicago
    volumes:
      - /opt/lanfoundry/config/frigate-notify/config.yml:/app/config.yml:ro
    networks:
      - nvr-network
```

frigate-notify needs to be on the same Docker network as Frigate and ntfy to reach them by container name. If your network is named differently, adjust the `networks` entry. Set `TZ` to your own time zone so alert times show local time (see [Set the time zone for alert times](#set-the-time-zone-for-alert-times)).

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
  public_url: https://frigate.internal
  ignoressl: false
  webapi:
    enabled: true
    interval: 30
  startup_check:
    attempts: 5
    interval: 30

alerts:
  general:
    timeformat: "Mon Jan 2, 3:04 PM"
  ntfy:
    enabled: true
    server: http://ntfy.nvr-network:80
    topic: your-unique-topic
    ignoressl: false
```

Pick a topic name that isn't easily guessable — anyone who knows it can subscribe to your notifications. Something like `nvr-a7f3k` works well.

`timeformat` sets how the detection time appears in each alert. This one shows times like `Fri Oct 31, 7:15 PM`. frigate-notify uses Go's reference date (Mon Jan 2 2006, 3:04:05 PM), so you write the format using that exact date and time. Remove the line to use the default, `2006-01-02 15:04:05 -0700 MST`.

Set `public_url` to whatever address you use to open Frigate in a browser, such as `https://frigate.internal` or `http://YOUR_NVR_IP:5000`. frigate-notify uses it for the clip links in each notification. Leave `server` on the Docker network address, because that's how frigate-notify reaches Frigate's API.

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
sudo docker compose up -d frigate-notify
sudo docker restart ntfy
sudo docker logs frigate-notify --tail 30
```

Watch the logs for successful event processing. Walk in front of a camera and confirm a notification appears in the ntfy web UI within 30 seconds. If you see `failed to send request, got status code 400`, check that `base-url` is set in ntfy's `server.yml` and that ntfy was restarted after the change.

---

## Where to go from here

- [Receiving ntfy alerts on your phone](ntfy-mobile.md) — install the ntfy app and subscribe to your topic
- [Filtering which events trigger notifications](filtering.md) — narrow down which cameras, objects, and zones send alerts
- [Setting up notification quiet hours](schedules.md) — silence notifications at night or on a schedule
