# Receiving ntfy alerts on your phone

This guide walks through installing the ntfy app and subscribing to your Argus notification topic on iOS or Android. By the end, your phone will receive a push alert whenever Frigate detects an event.

If you haven't set up the ntfy server on your NVR yet, start with [Setting up push notifications](ntfy-setup.md).

---

## Before you start

- ntfy is running on your NVR and frigate-notify is configured to send notifications to it. See [Setting up push notifications](ntfy-setup.md).
- You know your notification topic name. Run `sudo grep topic /opt/lanfoundry/config/frigate-notify/config.yml` on the NVR to see it. See [Step 1 in the setup guide](ntfy-setup.md#step-1-set-your-notification-topic).
- Your phone is on the same local network as the NVR, or you've configured remote delivery. If you want alerts when away from home, see [Step 4 in the ntfy setup guide](ntfy-setup.md#step-4-enable-remote-notifications) for options.

**Example values used in this guide**

| Item | Example |
|---|---|
| ntfy server address | `https://ntfy.internal` |
| ntfy server address (IP fallback) | `http://192.168.1.100:2586` |
| Topic name | `argus-a7f3k` |

Replace the topic name and IP address with the values from your own setup.

---

## Step 1 — Install the ntfy app

**iOS**

Download ntfy from the App Store. Search for **ntfy** by Philipp Heckel, or use the direct link at [ntfy.sh](https://ntfy.sh).

**Android**

ntfy is available from two sources:

- **Google Play** — standard install. Connects directly to your NVR. For topics on ntfy.sh, it receives alerts through Google's push service (FCM)
- **F-Droid** — open-source app store version with no Google services. It always connects directly to whichever server you subscribe on

The difference only matters if you publish alerts through ntfy.sh. See [Step 4](#step-4-android-play-store-vs-f-droid). If you're not sure, the Play Store version works well for most people.

---

## Step 2 — Add your NVR as a server

The ntfy app connects to ntfy.sh by default. You need to point it at your own NVR instead.

**iOS**

1. Open the ntfy app.
2. Tap the **settings icon** (gear) in the top right.
3. Under **Default server**, tap the current value and change it to `https://ntfy.internal`.
4. Tap **Save**.

**Android**

1. Open the ntfy app.
2. Tap the **menu icon** (three dots) in the top right, then **Settings**.
3. Tap **Default server** and enter `https://ntfy.internal`.
4. Tap **OK**.

!!! note "Using the IP address instead"
    If DNS isn't set up on your network yet, use `http://YOUR_NVR_IP:2586` as the server address instead. See [Adding DNS entries in OPNsense](../network/dns-opnsense.md) to set up the `ntfy.internal` hostname.

---

## Step 3 — Subscribe to your topic

1. In the ntfy app, tap **+** (or **Subscribe to topic**).
2. Enter your notification topic name — for example, `argus-a7f3k`. This is the `topic` value in `/opt/lanfoundry/config/frigate-notify/config.yml` on the NVR.
3. Tap **Subscribe**.

Walk in front of a camera to trigger a detection. A notification should arrive on your phone within about 30 seconds, since frigate-notify checks Frigate for new events on that interval.

---

## Step 4 — Android: Play Store vs F-Droid

This step is Android-only. If you're on iOS, skip ahead to the next section.

Android apps usually receive push notifications through Google's Firebase Cloud Messaging (FCM). An app server hands the alert to Google, and Google delivers it over the one connection your phone keeps open to Google. The alternative is for the app to keep its own direct connection to its server, which costs a little more battery. Which one the ntfy app uses depends on the app version and where you subscribed:

| Subscribed on | Google Play version | F-Droid version |
|---|---|---|
| Your NVR (`ntfy.internal`) | Direct connection to your NVR | Direct connection to your NVR |
| ntfy.sh ([remote option](ntfy-setup.md#option-a-publish-alerts-through-ntfysh)) | Through Google's FCM | Direct connection to ntfy.sh |

If your phone is subscribed on your NVR, either version keeps Google out of the path. If you publish alerts through ntfy.sh and want Google out of the path as well, install ntfy from [F-Droid](https://f-droid.org) instead of the Play Store, then add your server and topic as in Steps 2 and 3.

With a direct connection, Android shows a permanent "ntfy is running" notification. That's normal, and it's what keeps the connection alive.

---

## iOS and push delivery

iOS doesn't let apps keep their own background connection the way Android does. Every push notification has to come through Apple's servers (APNs), and there is no way around this on iOS.

When the ntfy iOS app subscribes to your self-hosted server, it relies on ntfy.sh to wake it up through APNs. Your NVR's ntfy needs `upstream-base-url: "https://ntfy.sh"` in its `server.yml` for this (see the [iPhone note in Setting up push notifications](ntfy-setup.md#option-b-wireguard-or-tailscale)). Only a message ID passes through ntfy.sh. The iPhone then downloads the alert text and snapshot directly from your NVR, so it has to be on your home network or connected over a VPN.

This is an Apple platform constraint, not something specific to ntfy or LAN Foundry's setup. It applies to every self-hosted push notification solution on iOS.

---

## Getting alerts away from home

A subscription on `ntfy.internal` only works while your phone can reach the NVR, at home or over a VPN. To get alerts anywhere without a VPN, have frigate-notify publish to ntfy.sh and subscribe to your topic there instead. See [Option A in Setting up push notifications](ntfy-setup.md#option-a-publish-alerts-through-ntfysh).

---

## Where to go from here

- [Filtering which events trigger notifications](filtering.md) — control which cameras, objects, and zones send alerts
- [Setting up notification quiet hours](schedules.md) — silence notifications at night or on a schedule
