# Not receiving notifications

You set up ntfy and Frigate is running, but alerts aren't arriving on your phone. This guide walks through each layer of the notification path and how to confirm where it's breaking.

Notifications involve three separate hops: Frigate detects an event and sends a message to the ntfy container, ntfy delivers it to your phone (either directly over the network or through a relay), and the ntfy app on your phone receives and displays it. A problem at any hop stops alerts from arriving.

---

## Before you start

This guide assumes:

- ntfy is running on your NVR. See [Setting up ntfy for push notifications](../notifications/ntfy-setup.md) if you haven't done this yet
- Frigate is running with at least one camera configured
- You have SSH access to the NVR

---

## Quick check: where is it failing?

| Symptom | Likely cause | Jump to |
|---|---|---|
| Never received any notifications at all | Frigate not configured for ntfy, or ntfy not running | [Check Frigate's notification config](#check-frigates-notification-config) |
| Notifications worked, then stopped | ntfy container stopped, or config.yml changed | [Check the ntfy container](#check-the-ntfy-container) |
| Notifications arrive at home but not away | Remote delivery not configured | [Remote delivery not working](#remote-delivery-not-working) |
| Only some events trigger notifications | Filters or score thresholds excluding events | [Events are filtered out](#events-are-filtered-out) |
| Notifications arrive in ntfy web UI but not on phone | Phone subscription or app permissions | [Phone not receiving notifications](#phone-not-receiving-notifications) |
| Wrong device is getting notifications | Multiple devices subscribed to the topic | [Phone not receiving notifications](#phone-not-receiving-notifications) |

---

## Check Frigate's notification config

Open `config.yml` on the NVR and confirm a `notifications` block exists with the correct ntfy address and topic:

```yaml
notifications:
  ntfy:
    base_url: http://192.168.1.10:2586
    topic: YOUR_TOPIC
```

Replace `192.168.1.10` with your NVR's actual IP and `YOUR_TOPIC` with the topic name you set up. The `base_url` must use `http`, not `https`, unless you've configured TLS on ntfy.

If the block is missing or has a typo, add or correct it and restart Frigate:

```bash
docker restart frigate
```

After restarting, trigger an event by walking in front of a camera and check the Frigate logs:

```bash
docker logs frigate --tail 100
```

Look for lines mentioning `ntfy` or `notifications`. A successful send shows a line confirming the notification was posted. An error points to either a wrong URL or a network problem reaching the ntfy container.

---

## Check the ntfy container

Frigate sends notifications to the ntfy container over the local network on your NVR. If ntfy is stopped or crashed, Frigate's notification attempts will fail silently.

Confirm ntfy is running:

```bash
docker ps | grep ntfy
```

The container should appear with a status of `Up`. If it's absent or shows `Exited`, restart it:

```bash
docker restart ntfy
```

Then trigger a test event and check Frigate logs again for a successful send.

If ntfy keeps stopping, check its logs for errors:

```bash
docker logs ntfy --tail 50
```

See [What to do when a container won't start](container.md) if ntfy won't stay running.

---

## Confirm ntfy is reachable

From the NVR, verify the ntfy container is listening on the expected port:

```bash
curl -s http://localhost:2586/v1/health
```

A healthy ntfy instance returns `{"healthy":true}`. If the curl fails, ntfy isn't listening on that port. Confirm the port mapping in your Docker Compose stack matches `2586:80` (or whichever port you configured).

You can also open `http://YOUR_NVR_IP:2586` in a browser from another device on your network. The ntfy web interface should load.

---

## Remote delivery not working

By default, ntfy delivers notifications only while the ntfy app is on the same network as your NVR. If you want alerts when you're away, one of two options must be configured.

**Option 1: ntfy upstream relay**

The ntfy container can forward notifications to ntfy.sh, which delivers them to your phone via FCM (Android) or APNs (iOS). To check if this is configured, look for a `server.yml` file in the ntfy config volume.

In Portainer, open **Volumes**, find `ntfy-config`, and click **Browse**. If `server.yml` exists, open it and confirm it contains:

```yaml
upstream-base-url: "https://ntfy.sh"
```

If the file is missing, create it with that content and restart ntfy. See [Setting up ntfy for push notifications](../notifications/ntfy-setup.md#step-4-enable-remote-notifications) for the full setup steps.

**Option 2: Tailscale**

If you're using Tailscale for remote access, the ntfy app on your phone connects to the NVR's Tailscale address. Notifications arrive only when Tailscale is active on your phone. If alerts stopped after a Tailscale change, confirm Tailscale is connected and that the ntfy `base_url` in `config.yml` uses the NVR's Tailscale IP, not the local LAN IP.

---

## Events are filtered out

Frigate can be configured to send notifications only for specific object types, zones, or detection confidence levels. If notifications arrive for some events but not others, a filter is likely excluding the ones you're not seeing.

Check `config.yml` for any notification filtering under the camera or object settings. Relevant options include:

- **Object filters:** limiting notifications to specific labels like `person` or `car`
- **Zone requirements:** only sending alerts for events that occur within a named zone
- **Score thresholds:** requiring a minimum detection confidence before an alert fires

See [Filtering which events trigger notifications](../notifications/filtering.md) for a full breakdown of the available filters and how to adjust them.

Also check whether a notification schedule is active. Quiet hours suppress notifications during a time window you configure. See [Setting up ntfy notification schedules](../notifications/schedules.md) if you're unsure whether a schedule is running.

---

## Phone not receiving notifications

If Frigate is sending notifications successfully (confirmed in the logs) and the ntfy web UI at `http://YOUR_NVR_IP:2586` shows messages arriving, but your phone isn't getting them, the issue is between ntfy and the app.

Work through these checks:

1. **Confirm the topic subscription.** Open the ntfy app and verify you're subscribed to the exact topic name used in `config.yml`. Topic names are case-sensitive. `Argus-Alerts` and `argus-alerts` are different topics.

2. **Check notification permissions on your phone.** On iOS: **Settings**, then **Notifications**, then **ntfy**, and confirm notifications are allowed. On Android: open **App Info** for ntfy and confirm notifications are enabled.

3. **Check battery optimization (Android).** Android can kill background processes to save battery, which stops the ntfy app from receiving messages. In your phone's battery settings, find ntfy and set it to **Unrestricted** or exempt it from battery optimization.

4. **Verify the app is connected to the right server.** The ntfy app may be pointed at `ntfy.sh` instead of your self-hosted instance. In the app settings, confirm the server URL matches your NVR's address and port.

5. **Test from the ntfy web UI.** Open `http://YOUR_NVR_IP:2586` in a browser, subscribe to your topic, and publish a test message manually. If the web UI shows the message but the phone doesn't, the problem is delivery to the phone, not the ntfy server or Frigate.

---

## What normal looks like

When notifications are working correctly:

- `docker logs frigate` shows a successful notification post within a few seconds of an event
- The ntfy web UI at `http://YOUR_NVR_IP:2586` shows the notification under your topic
- Your phone receives the alert within a few seconds of the event (longer if going through a relay)
- The ntfy app shows the camera name and event type in the notification

---

## Where to go from here

- [Filtering which events trigger notifications](../notifications/filtering.md), to limit alerts to the cameras, zones, and object types you care about
- [Setting up ntfy notification schedules](../notifications/schedules.md), to configure quiet hours or active windows
- [Receiving ntfy alerts on your phone](../notifications/ntfy-mobile.md), to review the phone-side setup

---

## LAN Foundry customer support

The guides on this site are free for everyone, whether you bought hardware from us or not. If you've worked through this guide and notifications still aren't arriving, there are a few more places to go depending on your situation.

**If you're running your own hardware**

The ntfy GitHub discussions and the Frigate community forums are good resources for notification delivery issues beyond what this guide covers. Bring the output of `docker logs frigate --tail 100` and `docker logs ntfy --tail 50`, and note which step in this guide is failing.

**If you purchased an Argus system from LAN Foundry**

Visit [lanfoundry.com/support](https://lanfoundry.com/support) for support options and how to submit a ticket.

When you open a support request, include:

- Which symptom from the quick-check table matches what you're seeing
- The output of `docker logs frigate --tail 100` filtered for notification-related lines
- The output of `docker logs ntfy --tail 50`
- Your phone OS and version (iOS or Android)
- Whether notifications arrive in the ntfy web UI but not on the phone, or don't appear in the web UI at all
- Any recent changes to `config.yml`, ntfy config, or network setup

The more context you provide, the faster we can pinpoint the issue. If your system is still within its warranty period, check your purchase documentation for what coverage applies.
