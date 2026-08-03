# Additional notification integrations

frigate-notify supports multiple notification providers and can send to more than one simultaneously. Argus systems come configured for ntfy out of the box, but if you already use Telegram, Discord, Slack, or email for other alerts, you can add those providers alongside ntfy or replace it entirely.

All provider config goes in the `alerts` block of `~/nvr/frigate-notify/app.yml`. Restart the frigate-notify container after any change.

```bash
docker restart frigate-notify
docker logs frigate-notify --tail 20
```

---

## Supported providers

| Provider | Best for |
|---|---|
| [ntfy](#ntfy) | Self-hosted, no account, works on iOS and Android |
| [Gotify](#gotify) | Self-hosted alternative to ntfy, Android-only without relay |
| [Telegram](#telegram) | Already use Telegram, want rich formatting |
| [Discord](#discord) | Team or household already on Discord |
| [Slack](#slack) | Small business already running Slack |
| [Email](#email) | Universal fallback, works with any email client |
| [Webhook](#webhook) | Custom integrations, Home Assistant automations |

---

## Running multiple providers

All enabled providers receive every alert. To send to both ntfy and Telegram, enable both in the same config file:

```yaml
alerts:
  ntfy:
    enabled: true
    server: http://ntfy
    topic: argus-d61b61

  telegram:
    enabled: true
    token: YOUR_BOT_TOKEN
    chatid: "YOUR_CHAT_ID"
```

There is no limit on how many providers you enable simultaneously.

---

## ntfy

Already configured on Argus systems. Covered in detail in [Setting up push notifications](../notifications/ntfy-setup.md).

```yaml
alerts:
  ntfy:
    enabled: true
    server: http://ntfy
    topic: argus-d61b61
    ignoressl: false
```

---

## Gotify

Gotify is a self-hosted push notification server similar to ntfy. It has an Android app but no native iOS app; iOS users need a relay or should use ntfy instead.

**Before you start:** Gotify needs to be running as a container on your NVR. Add it to your Docker stack and create an application token in the Gotify web interface. The token is what authorizes frigate-notify to send messages.

```yaml
alerts:
  gotify:
    enabled: true
    server: http://gotify
    token: YOUR_APP_TOKEN
    ignoressl: false
```

Replace `http://gotify` with your Gotify server address if it's not on the same Docker network. The token is found in the Gotify web UI under **Apps** after creating an application.

---

## Telegram

Telegram requires a bot token and a chat ID. The bot sends messages to a specific chat, either a private conversation with yourself or a group chat.

**Before you start:**

1. Open Telegram and message **@BotFather**.
2. Send `/newbot` and follow the prompts to create a bot. BotFather returns a token in the format `123456:ABCdef...`.
3. Start a conversation with your new bot (search for it by username and send `/start`).
4. Get your chat ID by messaging **@userinfobot**, which returns your numeric user ID.

For a group chat, add the bot to the group, then get the group's chat ID from the bot's recent messages via the Telegram API.

```yaml
alerts:
  telegram:
    enabled: true
    token: "YOUR_BOT_TOKEN"
    chatid: "YOUR_CHAT_ID"
```

Chat IDs for group chats are negative numbers (e.g., `-1001234567890`). Private chat IDs are positive. Wrap both in quotes.

---

## Discord

Discord notifications are sent via a webhook URL tied to a specific channel. No bot account is required.

**Before you start:**

1. In Discord, open the channel you want notifications in.
2. Go to **Edit Channel** (gear icon), then **Integrations**, then **Webhooks**.
3. Click **New Webhook**, give it a name, and copy the webhook URL.

```yaml
alerts:
  discord:
    enabled: true
    webhook: "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"
```

Each webhook is tied to one channel. To send to multiple channels, add additional Discord entries or set up a Discord forum channel and use one webhook for all camera topics.

---

## Slack

Slack notifications use an incoming webhook URL. This requires a Slack app with incoming webhooks enabled.

**Before you start:**

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app for your workspace.
2. Under **Features**, enable **Incoming Webhooks**.
3. Add a new webhook and select the channel to post to. Copy the webhook URL.

```yaml
alerts:
  slack:
    enabled: true
    webhook: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

---

## Email

Email notifications work with any SMTP server, including Gmail, iCloud Mail, and self-hosted mail servers. This is the most universal option and requires no app installation on the receiving end.

**Gmail:** Use an [App Password](https://myaccount.google.com/apppasswords) rather than your account password. App Passwords require two-factor authentication to be enabled on your Google account.

**iCloud Mail:** Use an [app-specific password](https://support.apple.com/en-us/102654) generated from your Apple ID settings.

```yaml
alerts:
  smtp:
    enabled: true
    server: smtp.gmail.com
    port: 587
    tls: true
    user: your@gmail.com
    password: YOUR_APP_PASSWORD
    recipient:
      - recipient@example.com
    from: "Argus NVR <your@gmail.com>"
```

For iCloud Mail, use `smtp.mail.me.com` on port 587. For a self-hosted mail server, use its SMTP address and credentials.

Multiple recipients are supported. Add one address per line under `recipient`.

---

## Webhook

The webhook provider sends an HTTP POST to any URL when an event fires. This is useful for custom integrations, triggering Home Assistant automations, or sending to a service that isn't natively supported by frigate-notify.

```yaml
alerts:
  webhook:
    enabled: true
    server: http://homeassistant:8123/api/webhook/your-webhook-id
```

The request body is a JSON object containing event details including camera name, label, confidence, zone, and the snapshot URL. What the receiving endpoint does with it is up to you.

For Home Assistant, create a webhook automation trigger in HA and use the generated webhook URL here. This lets you build HA automations that fire on Frigate events without running the full Home Assistant Frigate integration.

---

## Where to go from here

- [Setting up push notifications](../notifications/ntfy-setup.md) — the default Argus notification setup
- [Filtering which events trigger notifications](../notifications/filtering.md) — control which cameras and object types send alerts
- [Frigate + Home Assistant](frigate-home-assistant.md) — deeper integration between Frigate events and HA
