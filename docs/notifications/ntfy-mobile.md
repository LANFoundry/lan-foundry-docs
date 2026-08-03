# Receiving ntfy alerts on your phone

This guide walks through installing the ntfy app and subscribing to your Argus notification topic on iOS or Android. By the end, your phone will receive a push alert whenever Frigate detects an event.

If you haven't set up the ntfy server on your NVR yet, start with [Setting up ntfy for push notifications](ntfy-setup.md).

---

## Before you start

- ntfy is running on your NVR and frigate-notify is configured to send notifications to it. See [Setting up push notifications](ntfy-setup.md).
- You know your notification topic name. On Argus systems it's on your welcome card, or run `grep topic ~/nvr/frigate-notify/app.yml` on the NVR. See [Step 1 in the setup guide](ntfy-setup.md#step-1-find-your-notification-topic).
- Your phone is on the same local network as the NVR, or you've configured remote delivery. If you want alerts when away from home, see [Step 4 in the ntfy setup guide](ntfy-setup.md#step-4-enable-remote-notifications) for options.

**Example values used in this guide**

| Item | Example |
|---|---|
| ntfy server address | `https://ntfy.internal` |
| ntfy server address (IP fallback) | `http://192.168.1.10:2586` |
| Topic name | `argus-a7f3k` |

Replace the topic name and IP address with the values from your own setup.

---

## Step 1 — Install the ntfy app

**iOS**

Download ntfy from the App Store. Search for **ntfy** by Philipp Heckel, or use the direct link at [ntfy.sh](https://ntfy.sh).

**Android**

ntfy is available from two sources:

- **Google Play** — standard install, uses Google's push infrastructure (FCM) for delivery
- **F-Droid** — open-source app store, no Google services required. Required if you want fully local delivery via UnifiedPush (covered in [Step 4](#step-4-android-fully-local-delivery-with-unifiedpush))

If you're not sure which to use, the Play Store version works well for most people. You can switch to F-Droid later if you want to eliminate the Google FCM dependency.

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
2. Enter your notification topic name — for example, `argus-a7f3k`. This is in your Argus welcome card and in `~/nvr/frigate-notify/app.yml` on the NVR.
3. Tap **Subscribe**.

Walk in front of a camera to trigger a detection. A notification should arrive on your phone within a few seconds.

---

## Step 4 — Android: fully local delivery with UnifiedPush

This step is optional and Android-only. If you're on iOS, skip ahead to the note below.

By default, the Android ntfy app (Play Store version) uses Google's FCM service to deliver notifications — your notification text passes through Google's servers before reaching your phone. UnifiedPush is an open standard that routes push through your own ntfy server instead, keeping everything on your local network.

To use UnifiedPush:

1. **Uninstall the Play Store version** of ntfy if you have it installed.
2. Install **ntfy from F-Droid**. If you don't have F-Droid, download it from [f-droid.org](https://f-droid.org).
3. Open the ntfy app, add your server and topic as in Steps 2 and 3.
4. ntfy automatically registers as a UnifiedPush distributor — no additional configuration is needed.

With this setup, notifications are delivered entirely within your network. No Google infrastructure is involved.

---

## iOS and push delivery

iOS does not support UnifiedPush. Apple requires all push notifications to pass through Apple's servers (APNs), and there is no way around this on iOS.

When the ntfy iOS app subscribes to your self-hosted server, it connects through ntfy.sh's relay service to reach APNs. This means the notification text — camera name, event type — passes through ntfy's servers on the way to your iPhone. Your camera footage stays on your NVR; only the metadata in the alert itself transits ntfy's infrastructure.

This is an Apple platform constraint, not something specific to ntfy or LAN Foundry's setup. It applies to every self-hosted push notification solution on iOS.

---

## Where to go from here

- [Filtering which events trigger notifications](filtering.md) — control which cameras, objects, and zones send alerts
- [Setting up notification quiet hours](schedules.md) — silence notifications at night or on a schedule
