# Not receiving notifications

You set up push notifications and Frigate is running, but alerts aren't arriving on your phone. This guide walks through each link in the notification chain and how to confirm where it's breaking.

Notifications pass through three containers and then your phone:

```
Frigate → frigate-notify → ntfy → your phone
```

Frigate detects an event. **frigate-notify** checks Frigate for new events every 30 seconds, formats each one, and sends it to the **ntfy** container. ntfy delivers it to your phone, either directly over your network or through a relay, and the ntfy app displays it. Frigate itself never talks to ntfy, so a problem at any link in that chain stops alerts from arriving. See [Setting up push notifications](../notifications/ntfy-setup.md#how-it-works) for how the chain is built.

!!! note "Not applicable to Enclave"
    Push notifications need a network path from the NVR to your phone. [Enclave](../network/enclave-tier.md) has no such path by design; the Frigate view on the attached monitor is where events show up for that tier.

---

## Before you start

This guide assumes:

- frigate-notify and ntfy are running on your NVR. See [Setting up push notifications](../notifications/ntfy-setup.md) if you haven't done this yet
- Frigate is running with at least one camera configured
- You have SSH access to the NVR

The commands below use the container names and paths from that setup guide: containers named `frigate-notify` and `ntfy`, and frigate-notify's config at `/opt/lanfoundry/config/frigate-notify/config.yml`.

---

## Quick check: where is it failing?

| Symptom | Likely cause | Jump to |
|---|---|---|
| Never received any notifications at all | frigate-notify not running, or its `config.yml` points at the wrong server or topic | [Check frigate-notify](#check-frigate-notify) |
| Notifications worked, then stopped | frigate-notify or ntfy stopped, or frigate-notify's `config.yml` changed | [Check frigate-notify](#check-frigate-notify) |
| frigate-notify logs show `got status code 400` | ntfy is rejecting the snapshot attachment | [ntfy rejects notifications](#ntfy-rejects-notifications) |
| Notifications arrive, but up to 30 seconds late | Normal: frigate-notify checks Frigate every 30 seconds | [What normal looks like](#what-normal-looks-like) |
| Notifications arrive at home but not away | Remote delivery not configured | [Remote delivery not working](#remote-delivery-not-working) |
| Only some events trigger notifications | Label, score, or zone filters excluding events | [Events are filtered out](#events-are-filtered-out) |
| Notifications arrive in ntfy web UI but not on phone | Phone subscription or app permissions | [Phone not receiving notifications](#phone-not-receiving-notifications) |
| Wrong device is getting notifications | Multiple devices subscribed to the topic | [Phone not receiving notifications](#phone-not-receiving-notifications) |

---

## Check frigate-notify

frigate-notify is the link most likely to be missing or misconfigured, and it's the one whose logs tell you the most. Start here.

Confirm it's running:

```bash
sudo docker ps | grep frigate-notify
```

The container should appear with a status of `Up`. If it's absent or shows `Exited`, start it:

```bash
sudo docker restart frigate-notify
```

Then read its logs:

```bash
sudo docker logs frigate-notify --tail 50
```

What to look for:

- **Errors reaching Frigate.** When frigate-notify starts, it tries to reach Frigate up to five times, 30 seconds apart. If Frigate was still starting up or down for longer than that, frigate-notify can't collect events. Once Frigate is running, restart frigate-notify.
- **Errors sending to ntfy.** `failed to send request, got status code 400` means ntfy is reachable but rejecting the notification. See [ntfy rejects notifications](#ntfy-rejects-notifications). A connection error instead means ntfy isn't reachable at all. See [Check the ntfy container](#check-the-ntfy-container).

Next, confirm frigate-notify's `config.yml` points at the right places:

```bash
sudo grep -A4 'ntfy:' /opt/lanfoundry/config/frigate-notify/config.yml
```

You should see ntfy enabled, the server set to the ntfy container, and your topic:

```yaml
  ntfy:
    enabled: true
    server: http://ntfy.nvr-network:80
    topic: argus-XXXXXX
    ignoressl: false
```

`server: http://ntfy.nvr-network:80` reaches ntfy by its container name on the shared Docker network, so it doesn't need your NVR's IP or the `ntfy.internal` hostname. The topic must match, character for character, the one your phone is subscribed to. Topic names are case-sensitive.

If you edit frigate-notify's `config.yml`, restart frigate-notify for the change to take effect:

```bash
sudo docker restart frigate-notify
```

Then walk in front of a camera and watch the logs again. A notification should appear in the ntfy web UI within 30 seconds.

---

## ntfy rejects notifications

frigate-notify attaches a snapshot to each notification. ntfy only accepts attachments if its `base-url` and attachment cache are configured. Without them, it rejects every notification from frigate-notify with a 400 error, and nothing reaches your phone.

Check ntfy's `server.yml` on the NVR host. It's mounted read-only into the container, so read and edit it on the host:

```bash
sudo cat /opt/lanfoundry/config/ntfy/server.yml
```

It should contain:

```yaml
base-url: https://ntfy.internal
attachment-cache-dir: /var/cache/ntfy/attachments
attachment-total-size-limit: 5G
attachment-file-size-limit: 15M
```

If any of these lines are missing, add them with `sudo nano /opt/lanfoundry/config/ntfy/server.yml` and restart ntfy:

```bash
sudo docker restart ntfy
```

See [What's already set up on your Argus system](../notifications/ntfy-setup.md#whats-already-set-up-on-your-argus-system) for what each setting does.

---

## Check the ntfy container

frigate-notify sends notifications to the ntfy container over the Docker network on your NVR. If ntfy is stopped or crashed, those sends fail and frigate-notify logs an error for each one.

Confirm ntfy is running:

```bash
sudo docker ps | grep ntfy
```

Both `frigate-notify` and `ntfy` will match. Look for the `ntfy` container with a status of `Up`. If it's absent or shows `Exited`, restart it:

```bash
sudo docker restart ntfy
```

Then trigger a test event and check `sudo docker logs frigate-notify` again.

If ntfy keeps stopping, check its logs for errors:

```bash
sudo docker logs ntfy --tail 50
```

See [What to do when a container won't start](container.md) if ntfy won't stay running.

---

## Confirm ntfy is reachable

From the NVR, verify ntfy is answering on its published port:

```bash
curl -s http://localhost:2586/v1/health
```

A healthy ntfy instance returns `{"healthy":true}`. If the curl fails, ntfy isn't listening on that port. Confirm the port mapping in your Docker Compose stack matches `2586:80` (or whichever port you configured).

You can also open `https://ntfy.internal` in a browser from another device on your main LAN, or `http://YOUR_NVR_IP:2586` if DNS isn't set up yet. The ntfy web interface should load.

---

## Remote delivery not working

By default, frigate-notify sends alerts to the ntfy server on your NVR, and your phone only gets them while it can reach the NVR. If you want alerts when you're away, one of two options must be configured.

!!! warning "`upstream-base-url` alone won't do it"
    Adding `upstream-base-url: "https://ntfy.sh"` to ntfy's `server.yml` does not deliver alerts away from home. It only sends ntfy.sh a message ID, and your phone still has to download the alert from your NVR. That works on your home network or over a VPN, not on cellular without a VPN.

**Option 1: Publishing through ntfy.sh**

frigate-notify sends alerts straight to ntfy.sh, and your phone subscribes there. If alerts aren't arriving away from home, check:

- `alerts: ntfy: server` in `/opt/lanfoundry/config/frigate-notify/config.yml` is `https://ntfy.sh`, not `http://ntfy.nvr-network:80`, and frigate-notify was restarted after the change
- The ntfy app is subscribed to the same topic on `ntfy.sh`, not on `ntfy.internal`. Topic names are case-sensitive
- The NVR has outbound internet access. `sudo docker logs frigate-notify --tail 30` shows connection errors if it can't reach ntfy.sh

See [Option A in Setting up push notifications](../notifications/ntfy-setup.md#option-a-publish-alerts-through-ntfysh) for the full setup steps.

**Option 2: Tailscale**

If you're using Tailscale for remote access, the ntfy app on your phone reaches the NVR over your tailnet. Notifications arrive only when Tailscale is active on your phone. If alerts stopped after a Tailscale change, check:

- Tailscale is connected on your phone, and the NVR shows as online in the Tailscale admin console
- If the ntfy app uses `https://ntfy.internal`: subnet routing and Split DNS are still approved and configured, so that name resolves over Tailscale. See [Access services by hostname](../privacy/remote-access.md#optional-access-services-by-hostname)
- If the ntfy app uses the NVR's raw Tailscale IP: text-only alerts with missing snapshots are expected, because ntfy builds snapshot links from its `base-url` (`https://ntfy.internal`). Setting up Split DNS and switching the app to `https://ntfy.internal` fixes that

For Tailscale, frigate-notify keeps sending to ntfy over the Docker network on the NVR. On an iPhone, ntfy's `server.yml` also needs `upstream-base-url: "https://ntfy.sh"` so the app gets woken up (see the [iPhone note](../notifications/ntfy-setup.md#option-b-wireguard-or-tailscale)).

---

## Events are filtered out

If notifications arrive for some events but not others, a filter is likely excluding the ones you're not seeing. Filters can live in two places.

**frigate-notify's `config.yml`.** The `alerts` section can drop events before they're sent:

- **`labels`:** `min_score` skips events below a detection confidence (0–100), `allow` limits alerts to listed object types like `person` or `car`, and `block` always ignores listed types
- **`zones`:** limits alerts to events in specific Frigate zones
- **`quiet`:** suppresses all alerts between a `start` and `end` time

Check what's set:

```bash
sudo grep -A12 '^alerts:' /opt/lanfoundry/config/frigate-notify/config.yml
```

Restart frigate-notify after changing any of these.

**Frigate's `config.yml`.** frigate-notify can only send what Frigate detects. If an object type isn't tracked for a camera, or its detection score never clears Frigate's own threshold, no event exists for frigate-notify to pick up.

See [Filtering which events trigger notifications](../notifications/filtering.md) for more on choosing filters, and [Setting up notification quiet hours](../notifications/schedules.md) if you're unsure whether quiet hours are active.

---

## Phone not receiving notifications

If notifications show up in the ntfy web UI but your phone isn't getting them, the issue is between ntfy and the app. Frigate and frigate-notify are working.

Work through these checks:

1. **Confirm the topic subscription.** Open the ntfy app and verify you're subscribed to the exact topic in frigate-notify's `config.yml`. Topic names are case-sensitive. `Argus-Alerts` and `argus-alerts` are different topics.

2. **Check notification permissions on your phone.** On iOS: **Settings**, then **Notifications**, then **ntfy**, and confirm notifications are allowed. On Android: open **App Info** for ntfy and confirm notifications are enabled.

3. **Check battery optimization (Android).** Android can kill background processes to save battery, which stops the ntfy app from receiving messages. In your phone's battery settings, find ntfy and set it to **Unrestricted** or exempt it from battery optimization.

4. **Verify the app is connected to the right server.** The ntfy app may be pointed at `ntfy.sh` instead of your self-hosted instance. In the app settings, confirm the server is `https://ntfy.internal` (or `http://YOUR_NVR_IP:2586`). See [Receiving ntfy alerts on your phone](../notifications/ntfy-mobile.md).

5. **Test from the ntfy web UI.** Open `https://ntfy.internal` in a browser, subscribe to your topic, and publish a test message manually. If the web UI shows the message but the phone doesn't, the problem is delivery to the phone, not ntfy or frigate-notify.

---

## Clip links in notifications don't open

If tapping a notification's clip link opens an address like `http://frigate.nvr-network:5000/...`, or a page that never loads, frigate-notify has no `public_url` set. That `frigate.nvr-network` address only exists inside Docker, so your phone and browser can't reach it.

Open frigate-notify's config on the NVR host:

```bash
sudo nano /opt/lanfoundry/config/frigate-notify/config.yml
```

Under `frigate:`, add `public_url` below `server`, using the address you open Frigate at:

```yaml
frigate:
  server: http://frigate.nvr-network:5000
  public_url: https://frigate.internal
```

If you haven't set up Caddy and DNS, use `http://YOUR_NVR_IP:5000` instead. Leave `server` as it is, because frigate-notify needs it to reach Frigate's API. Then restart frigate-notify:

```bash
sudo docker restart frigate-notify
```

New notifications will link to the new address. Notifications you've already received keep their old links.

---

## What normal looks like

When notifications are working correctly:

- `sudo docker logs frigate-notify` shows no errors around the time of an event
- The ntfy web UI at `https://ntfy.internal` shows the notification under your topic, with a snapshot attached
- Your phone receives the alert within about 30 seconds of the event, because frigate-notify checks Frigate on that interval (longer if going through a relay)
- The ntfy app shows the camera name and event type in the notification

---

## Where to go from here

- [Filtering which events trigger notifications](../notifications/filtering.md), to limit alerts to the cameras, zones, and object types you care about
- [Setting up notification quiet hours](../notifications/schedules.md), to configure quiet hours or active windows
- [Receiving ntfy alerts on your phone](../notifications/ntfy-mobile.md), to review the phone-side setup

---

## LAN Foundry customer support

The guides on this site are free for everyone, whether you bought hardware from us or not. If you've worked through this guide and notifications still aren't arriving, there are a few more places to go depending on your situation.

**If you're running your own hardware**

The frigate-notify and ntfy GitHub projects and the Frigate community forums are good resources for notification delivery issues beyond what this guide covers. Bring the output of `sudo docker logs frigate-notify --tail 100` and `sudo docker logs ntfy --tail 50`, and note which step in this guide is failing.

**If you purchased an Argus system from LAN Foundry**

Visit [lanfoundry.com/support](https://lanfoundry.com/support) for support options and how to submit a ticket.

When you open a support request, include:

- Which symptom from the quick-check table matches what you're seeing
- The output of `sudo docker logs frigate-notify --tail 100`
- The output of `sudo docker logs ntfy --tail 50`
- Your phone OS and version (iOS or Android)
- Whether notifications arrive in the ntfy web UI but not on the phone, or don't appear in the web UI at all
- Any recent changes to frigate-notify's `config.yml`, ntfy's `server.yml`, or your network setup

The more context you provide, the faster we can pinpoint the issue. If your system is still within its warranty period, check your purchase documentation for what coverage applies.
