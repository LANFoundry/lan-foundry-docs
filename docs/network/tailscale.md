# Remote access with Tailscale

By default, your Argus NVR is only reachable from inside your home network. Tailscale extends that reach to any device you own (phone, laptop, work computer) without opening ports on your router or setting up a traditional VPN server.

It works by creating an encrypted peer-to-peer connection directly between your devices. Once your NVR and your phone are both on the same Tailscale network, you can reach the Frigate interface, Cockpit, ntfy, and anything else running on the NVR as if you were home.

---

## Before you start

This guide assumes:

- Your Argus NVR is running and you can SSH into it
- You have a Tailscale account. The free tier supports up to 100 devices and covers personal use. Sign up at [tailscale.com](https://tailscale.com)

**A note on privacy:** Tailscale's control plane (the system that authenticates devices and distributes keys) is hosted by Tailscale. They can see which devices are in your network, but not the traffic between them. That traffic travels peer-to-peer and is encrypted end-to-end. If fully self-hosted control plane matters to you, [Headscale](https://headscale.net) is an open-source alternative that runs on your own hardware.

---

## Step 1 — Install Tailscale on the NVR

!!! note "Argus systems"
    Tailscale is pre-installed and pre-configured on all Argus systems before shipping. Skip ahead to Step 2 to connect your phone or laptop.

If you're running your own hardware, install Tailscale first:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

Once installed, bring the device online and authenticate it:

```bash
sudo tailscale up
```

Tailscale will print a URL. Open it in a browser, sign in to your Tailscale account, and authorize the device. The terminal will confirm when authentication is complete.

Verify Tailscale is running and the NVR has an IP:

```bash
tailscale ip
```

This prints the NVR's Tailscale IP address, which is in the `100.x.x.x` range. Note it down.

---

## Step 2 — Connect your phone or laptop

Install the Tailscale app on any device you want to use for remote access:

- **iOS / Android:** Tailscale is available in the App Store and Google Play
- **macOS / Windows / Linux:** Download from [tailscale.com/download](https://tailscale.com/download)

Sign in with the same Tailscale account you used in Step 1. The device will appear in your Tailscale admin console alongside the NVR.

---

## Step 3 — Access NVR services remotely

With both devices connected, use the NVR's Tailscale IP to reach its services from anywhere. The port numbers are the same as on your local network.

| Service | URL |
|---|---|
| Frigate | `http://100.x.x.x:5000` |
| Cockpit | `https://100.x.x.x:9090` |
| ntfy | `http://100.x.x.x:2586` |
| Home Assistant (if installed) | `http://100.x.x.x:8123` |

Replace `100.x.x.x` with the IP shown by `tailscale ip` on the NVR.

The Tailscale IP is permanently assigned to your NVR and stays the same across reboots and reconnects. Accessing services by IP is always available as long as both devices are on Tailscale, and requires no additional configuration beyond this step.

To find the NVR's Tailscale IP at any time without SSH, open the Tailscale admin console at [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines). The NVR will be listed with its assigned IP.

---

## Optional: Access your home network through the NVR

By default, Tailscale only gives you direct access to the NVR itself. To reach other devices on your home network while away (including your router, which is needed for hostname access in the next section), enable **subnet routing** on the NVR.

This tells Tailscale to route traffic for your home subnet through the NVR:

```bash
sudo tailscale up --advertise-routes=192.168.1.0/24
```

Replace `192.168.1.0/24` with your actual LAN subnet.

Then approve the route in the Tailscale admin console:

1. Go to [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines)
2. Click the NVR's entry (named `argus` on Argus systems)
3. Open the **Route settings** menu
4. Enable the advertised subnet

Once approved, any device on your tailnet can reach your home network through the NVR.

---

## Optional: Access services by hostname

If your network uses hostnames like `frigate.internal`, `cockpit.internal`, and `ntfy.internal` via Caddy, those names can work over Tailscale as well. This requires subnet routing (above) to be enabled and approved first, since the NVR needs to forward DNS queries to your router.

Tailscale supports **Split DNS**: you specify which DNS server handles a particular domain, and Tailscale routes queries for that domain accordingly while leaving everything else (Google, YouTube, etc.) unchanged.

### Configure Split DNS

In the Tailscale admin console, go to the **DNS** section:

1. Under **Nameservers**, click **Add nameserver** then **Custom**
2. Enter your router's LAN IP address (the same IP you use to access the router's web UI, typically something like `192.168.1.1`)
3. Enable **Restrict to domain** and enter `internal`
4. Save

This tells Tailscale clients: for any `*.internal` query, ask your router's DNS server. Everything else uses normal DNS.

### Pick up the DNS change on your device

After saving, toggle Tailscale off and back on your phone or laptop. Then verify:

```
nslookup frigate.internal
```

The server shown should be your router's IP, and it should return the NVR's local address. Once that resolves, `https://frigate.internal` loads through Caddy the same as it does at home.

---

## What normal looks like

When everything is working:

- `tailscale status` on the NVR shows `tailscaled: running` and lists your connected devices
- You can open Frigate at `http://100.x.x.x:5000` from a phone that is not on your home Wi-Fi
- The Tailscale admin console shows both the NVR and your phone as connected
- If subnet routing is enabled, the route shows as approved in the NVR's machine settings
- If Split DNS is configured, `nslookup frigate.internal` returns your router's IP as the server and the NVR's local address as the result

If a connection isn't going through, confirm both devices are online in the admin console. Tailscale direct connections can fall back to a relay (DERP) if peer-to-peer routing is blocked; this is slower but still works. A persistent relay connection usually means a firewall on one side is blocking direct UDP traffic.

---

## Where to go from here

- [Hardware potential](../further/hardware-potential.md), for other services worth running on the NVR that become more accessible with Tailscale in place
- [Tailscale documentation](https://tailscale.com/kb/), for access controls, team sharing, and exit nodes
