# Remote access with Tailscale

By default, your Argus NVR is only reachable from inside your home network. Argus systems don't include Tailscale, and we don't install it for you. It's here as an option if you want to reach the NVR from outside your home and your router can't run its own VPN server.

If your router does have a built-in WireGuard server, start with [Remote access with WireGuard](../network/vpn-wireguard.md) instead. It keeps everything on your own hardware with no outside company involved.

Tailscale connects your devices (NVR, phone, laptop) into a private encrypted network without opening ports on your router. Once your NVR and your phone are both on it, you can reach the Frigate interface, Cockpit, ntfy, and anything else on the NVR as if you were home. That convenience comes with trade-offs, so read the next section before you install anything.

!!! note "Not applicable to Enclave"
    This guide assumes your network reaches the internet. [Enclave](../network/enclave-tier.md) pairs with an air-gapped network with no WAN connectivity by design; kiosk mode on an attached monitor is the interface for that tier.

---

## The risks, in plain English

Installing Tailscale means letting an outside company's software and servers help decide who can get into your home network. That can be a reasonable choice, but you should know what you're agreeing to.

- **Your Tailscale login becomes a key to your home.** You sign in to Tailscale with a Google, Microsoft, GitHub, or Apple account. Anyone who gets into that account can add their own device to your network and reach your NVR. Treat that login like your house key: strong password, two-factor authentication turned on.
- **You're trusting someone else's software and servers.** The Tailscale app runs with full network access on your NVR, and Tailscale's servers decide which devices are allowed in. If there's a bug in their app or a problem on their servers, your network can be affected through no fault of your own. Tailscale has published [security bulletins](https://tailscale.com/security-bulletins) for exactly this kind of issue. If you use it, keep it updated.
- **It goes around your router's firewall.** The NVR reaches out to Tailscale on its own, so the firewall rules and blocked ports you've set up on your router don't apply to traffic coming in over Tailscale.
- **Subnet routing opens up more than the NVR.** The optional subnet routing step below lets every device on your Tailscale network reach every device on your home network. Never include your camera VLAN in it. That would undo the camera isolation you set up.
- **Every device you add can reach every other device.** Out of the box, Tailscale doesn't restrict which of your devices can talk to which. A lost phone or a shared laptop that's still signed in has the same access you do.
- **Tailscale can see which devices you have and when they connect.** It can't see what you're doing or what you're watching (that traffic is encrypted between your own devices), but the list of devices and connection times passes through their servers.

### If you go ahead

- Turn on two-factor authentication for the account you sign in to Tailscale with
- Leave **key expiry** on, so devices have to re-authenticate periodically
- Remove devices from the Tailscale admin console as soon as you stop using them
- Use [access controls](https://tailscale.com/kb/1018/acls) to limit which devices can reach the NVR
- Consider [Tailnet Lock](https://tailscale.com/kb/1226/tailnet-lock), which stops new devices joining unless one of your own devices approves them
- If you'd rather not depend on Tailscale's servers at all, [Headscale](https://headscale.net) is an open-source replacement you run yourself

---

## Before you start

This guide assumes:

- Your Argus NVR is running and you can SSH into it
- You have a Tailscale account. The free tier supports up to 100 devices and covers personal use. Sign up at [tailscale.com](https://tailscale.com)

---

## Step 1 — Install Tailscale on the NVR

Install Tailscale:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

Once installed, bring the device online and authenticate it:

```bash
sudo tailscale up
```

Tailscale will print a URL. Open it in a browser, sign in to your Tailscale account, and authorize the device. The terminal will confirm when authentication is complete.

Get the NVR's Tailscale IP:

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

!!! warning "Only advertise your main LAN"
    Subnet routing gives every device on your tailnet access to the whole subnet you advertise. Advertise your main home LAN only. Never advertise the camera VLAN: that would let anything on your tailnet reach the cameras directly and undo the isolation that keeps them contained. See [the risks](#the-risks-in-plain-english) above.

First, allow the NVR to forward traffic. Tailscale requires this on any Linux machine acting as a subnet router:

```bash
echo 'net.ipv4.ip_forward = 1' | sudo tee /etc/sysctl.d/99-tailscale.conf
sudo sysctl -p /etc/sysctl.d/99-tailscale.conf
```

Then tell Tailscale to route traffic for your home subnet through the NVR:

```bash
sudo tailscale up --advertise-routes=192.168.1.0/24
```

Replace `192.168.1.0/24` with your actual LAN subnet.

Then approve the route in the Tailscale admin console:

1. Go to [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines)
2. Click the NVR's entry
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

- `tailscale status` on the NVR lists the NVR and your other devices, without a `Logged out` message
- You can open Frigate at `http://100.x.x.x:5000` from a phone that is not on your home Wi-Fi
- The Tailscale admin console shows both the NVR and your phone as connected
- If subnet routing is enabled, the route shows as approved in the NVR's machine settings
- If Split DNS is configured, `nslookup frigate.internal` returns your router's IP as the server and the NVR's local address as the result

If a connection isn't going through, confirm both devices are online in the admin console. Tailscale direct connections can fall back to a relay (DERP) if peer-to-peer routing is blocked; this is slower but still works. A persistent relay connection usually means a firewall on one side is blocking direct UDP traffic.

---

## Where to go from here

- [Remote access with WireGuard](../network/vpn-wireguard.md), if you later get a router that can host WireGuard and want to drop the third-party dependency
- [Hardware potential](../further/hardware-potential.md), for other services worth running on the NVR
- [Tailscale documentation](https://tailscale.com/kb/), for access controls, team sharing, and exit nodes
