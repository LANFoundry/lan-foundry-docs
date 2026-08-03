# Can't reach a service by hostname

You set up DNS, configured Caddy, and typed `https://frigate.internal` into your browser, and nothing loads. Or it works on your phone but not your Windows PC. Or the page hangs for ten seconds and then fails.

This guide walks through figuring out where the breakdown is. Reaching your NVR services by hostname involves two separate steps: your device has to resolve the hostname to an IP address, and Caddy on the NVR has to receive the request and route it to the right service. This guide helps you identify which of those is failing and what to do about it.

The hostnames used throughout match the [Caddy reverse proxy guide](../network/caddy-reverse-proxy.md) and the [OPNsense DNS guide](../network/dns-opnsense.md): `frigate.internal`, `portainer.internal`, and `cockpit.internal`.

---

## Before you start

This guide assumes:

- Your NVR has a static IP address on your main LAN, for example `192.168.1.100`
- You've completed the [DNS entries in OPNsense](../network/dns-opnsense.md) and [Caddy reverse proxy](../network/caddy-reverse-proxy.md) guides, or equivalent configuration on your hardware
- You're testing from a device on your **main LAN**, not from the camera VLAN or a guest network

If you haven't set up DNS or Caddy yet, start there first. This guide is for when something should be working and isn't.

---

## How the pieces connect

When you browse to `https://frigate.internal`, here's what should happen:

```
Your device  →  resolves frigate.internal to 192.168.1.100  (DNS)
             →  connects to 192.168.1.100 on port 443     (network)
             →  Caddy reads the Host header               (reverse proxy)
             →  Caddy forwards to the Frigate container   (Docker)
```

A failure at any step produces a similar symptom (the page won't load), but the fix depends on which step broke. The sections below walk through them in order.

---

## Figure out where it's failing

Work through these checks in order. Stop when you find the problem.

| What you see | Likely layer | Jump to |
|---|---|---|
| Browser says hostname can't be found, or DNS error | DNS | [DNS isn't resolving](#dns-isnt-resolving) |
| Hostname resolves but connection times out | Network or firewall | [The NVR isn't reachable](#the-nvr-isnt-reachable) |
| Connection refused, or wrong service loads | Caddy | [Caddy isn't routing correctly](#caddy-isnt-routing-correctly) |
| Page loads but shows a certificate warning | TLS (expected) | [Certificate warnings](#certificate-warnings) |
| Works on one device but not another | Device-specific DNS | [Windows DNS troubleshooting](#windows-dns-troubleshooting) or [Device DNS settings](#device-dns-settings) |

---

## DNS isn't resolving

If your browser reports that the hostname can't be found, or `nslookup` returns no answer, the problem is DNS. Your device doesn't know which IP address belongs to the hostname.

### Confirm OPNsense has the right entries

In the OPNsense web interface, navigate to **Services**, then **Unbound DNS**, then **Overrides**, then **Host Overrides**. You should see three entries:

| Host | Domain | IP |
|---|---|---|
| `frigate` | `internal` | your NVR static IP |
| `portainer` | `internal` | your NVR static IP |
| `cockpit` | `internal` | your NVR static IP |
| `ntfy` | `internal` | your NVR static IP |
| `dozzle` | `internal` | your NVR static IP |

If any are missing or pointing to the wrong IP, fix them and click **Apply changes**. See the [DNS guide](../network/dns-opnsense.md) for the full setup walkthrough.

### Confirm OPNsense itself resolves the name

Navigate to **Services**, then **Unbound DNS**, then **Diagnostics**. Query `frigate.internal`. It should return your NVR's static IP.

If this fails, the host overrides are wrong or Unbound isn't enabled. Check **Services**, then **Unbound DNS**, then **General** and confirm the DNS resolver is enabled.

### Confirm your device is asking OPNsense

On the device that's failing, run:

```bash
nslookup frigate.internal
```

The **Server** line in the response should be your OPNsense LAN IP, typically `192.168.1.1`. The **Address** line should be your NVR's static IP.

If the server is something else (`8.8.8.8`, `1.1.1.1`, or a Pi-hole on a different IP), your device isn't using OPNsense for DNS and won't see your host overrides. See [Device DNS settings](#device-dns-settings) below.

### Clear stale DNS cache

If you recently fixed the DNS entries but the device still returns a wrong or empty answer, flush the local cache:

**Windows (PowerShell as Administrator):**

```powershell
Clear-DnsClientCache
```

**Mac:**

```bash
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

**Linux:**

```bash
sudo systemd-resolve --flush-caches
```

Then disconnect and reconnect to your network, or reboot the device, and test again.

---

## Windows DNS troubleshooting

If DNS looks correct in OPNsense but a **Windows PC** still won't resolve `frigate.internal`, work through these checks.

### Test with PowerShell instead of nslookup

`nslookup` bypasses part of the Windows resolver and can return a correct answer even when the browser can't. For a more accurate test:

```powershell
Resolve-DnsName frigate.internal
```

This uses the same resolution path the browser does. If `Resolve-DnsName` fails while `nslookup` succeeds, the issue is in Windows DNS Client or browser settings, not in OPNsense.

### Confirm Windows is using OPNsense for DNS

Open **Settings → Network & Internet → Properties** for your active connection. The DNS server should be your OPNsense LAN IP, not a public address like `8.8.8.8`.

Also check whether your browser is overriding system DNS:

- **Chrome and Edge:** Settings → Privacy and security → Security → turn off "Use secure DNS" while troubleshooting.
- **Firefox:** Settings → General → Network Settings → uncheck "Enable DNS over HTTPS" temporarily.

### Use the hosts file as a last resort

If a specific Windows machine still won't resolve after the above checks, add the entries directly to the hosts file. This bypasses DNS entirely for those names.

Open Notepad as Administrator, then open:

```
C:\Windows\System32\drivers\etc\hosts
```

Add these lines, replacing the IP with your NVR's static address:

```
192.168.1.100  frigate.internal
192.168.1.100  portainer.internal
192.168.1.100  cockpit.internal
192.168.1.100  ntfy.internal
192.168.1.100  dozzle.internal
```

Save and test in your browser.

---

## Device DNS settings

These settings cause hostname resolution to fail even when OPNsense is configured correctly.

**Android Private DNS**

On Android, **Settings → Network & Internet → Private DNS** set to "Automatic" or "Off" allows the phone to use your router's DNS. If it's set to a provider like Cloudflare or Google, your OPNsense host overrides are bypassed entirely.

**Manually configured DNS on any device**

If a device has a static IP or custom DNS setting pointing to `8.8.8.8`, `1.1.1.1`, or a Pi-hole that doesn't have the same host overrides, it won't resolve `frigate.internal`. Point the device's DNS to your OPNsense LAN IP, or add the overrides to whatever DNS server the device is actually using.

**Pi-hole or other local DNS**

If your network uses Pi-hole instead of OPNsense for DNS, the host overrides need to exist in Pi-hole's Local DNS settings, not just in OPNsense. OPNsense overrides only apply to devices that query OPNsense directly.

---

## The NVR isn't reachable

If the hostname resolves to the correct IP but the connection times out, the problem is between your device and the NVR, not DNS.

### Confirm the NVR is online

From a device on your main LAN, ping the NVR's static IP directly:

```bash
ping 192.168.1.100
```

If this fails, the NVR may be powered off, disconnected from the network, or assigned a different IP than you expect. Verify the IP on the NVR itself or check your router's DHCP lease table.

### Confirm the service is running

SSH into the NVR or connect a keyboard and monitor, then check that the containers are up:

```bash
docker ps
```

You should see `caddy`, `frigate`, and `portainer` in the list with a status of **Up**. If Caddy isn't running, nothing will respond on port 443 regardless of DNS.

### Test a service directly by port

Bypass Caddy temporarily to confirm the underlying service is reachable. From a device on your main LAN:

- Frigate: `http://192.168.1.100:5000`
- Portainer: `http://192.168.1.100:9000`
- Cockpit: `https://192.168.1.100:9090`

If direct port access works but the hostname doesn't, the problem is DNS or Caddy, not the service itself. If direct port access also fails, the service isn't running or a firewall is blocking the connection.

### Check OPNsense firewall rules

On a default OPNsense LAN setup, devices on the same network segment can reach each other freely. If you've added custom firewall rules, confirm nothing is blocking traffic from your LAN to the NVR on ports 80 and 443.

---

## Caddy isn't routing correctly

If the hostname resolves, the NVR responds to ping, but browsing to `https://frigate.internal` gives a connection refused error or Caddy's default error page, the problem is Caddy or the Docker network.

### Check Caddy logs

On the NVR:

```bash
docker logs caddy --tail 50
```

Common log messages and what they mean:

**`dial tcp: lookup frigate: no such host`**

The Frigate container isn't on the `nvr-network` Docker network. Connect it and restart Caddy:

```bash
docker network connect nvr-network frigate
docker restart caddy
```

Do the same for Portainer if you see a similar error for `portainer`.

**`connection refused` for Cockpit**

Caddy can't reach Cockpit on the host. The container was likely started without the `--add-host host.docker.internal:host-gateway` flag. Remove and recreate the Caddy container using the full command from the [Caddy guide](../network/caddy-reverse-proxy.md).

**No errors, but the wrong service loads**

The hostname in your browser doesn't match the Caddyfile. Confirm the Caddyfile on the NVR contains `frigate.internal`, `portainer.internal`, and `cockpit.internal` exactly. Typos here mean Caddy won't route the request correctly.

### Confirm containers share a network

On the NVR:

```bash
docker network inspect nvr-network
```

The output should list `caddy`, `frigate`, and `portainer` as connected containers. If any are missing:

```bash
docker network connect nvr-network <container-name>
docker restart caddy
```

### Confirm Caddy is listening on ports 80 and 443

```bash
sudo ss -tlnp | grep -E ':80|:443'
```

You should see Caddy bound to both ports. If another process is using them, Caddy may have failed to start properly. Check `docker logs caddy` for bind errors.

---

## Certificate warnings

If the page loads but your browser shows a security warning before displaying Frigate, Portainer, or Cockpit, that's expected, not a failure.

Caddy uses its own internal certificate authority for `.internal` hostnames. Your browser doesn't trust it by default. Click through the warning once per hostname per browser:

- **Chrome/Edge:** Advanced → Proceed to [hostname]
- **Firefox:** Advanced → Accept the Risk and Continue
- **Safari:** Show Details → visit this website

If you want to eliminate the warning entirely, you can install Caddy's root certificate on your device. See Step 4 in the [Caddy guide](../network/caddy-reverse-proxy.md) for details.

A certificate warning means DNS and Caddy are both working. You're done troubleshooting.

---

## Quick reference

| Symptom | Check | Fix |
|---|---|---|
| Hostname not found | `nslookup frigate.internal` | DNS entries in OPNsense, device DNS settings |
| Works in nslookup, not in browser (Windows) | `Resolve-DnsName frigate.internal` | Hosts file, disable DoH in browser, see [Windows section](#windows-dns-troubleshooting) |
| Resolves but times out | `ping 192.168.1.100` | NVR offline, wrong IP, firewall rule |
| Resolves but connection refused | `docker ps`, `docker logs caddy` | Start Caddy, fix Docker network |
| One service works, another doesn't | `docker logs caddy` | Connect missing container to `nvr-network` |
| Certificate warning, then page loads | n/a | Expected. Click through or install Caddy root cert |
| Works on phone, not Windows PC | Device DNS settings | Hosts file or Windows resolver fixes above |

---

## Where to go from here

If you've worked through this guide and your services are loading, you're in good shape.

**Continue building out the stack**

- [Adding your first camera to Frigate](../cameras/first-camera.md)
- [Understanding network segmentation and VLANs](../privacy/blocking-telemetry.md)
- [Setting up a camera VLAN in OPNsense](../network/vlan-opnsense.md)

**Related setup guides**

- [Adding DNS entries in OPNsense](../network/dns-opnsense.md)
- [Configuring Caddy as a reverse proxy](../network/caddy-reverse-proxy.md)

**Other troubleshooting**

- [What to do when a container won't start](container.md)
- [Camera feed not showing in Frigate](camera-feed.md)
- [NVR running slow or dropping frames](performance.md)

---

## LAN Foundry customer support

The guides on this site are free for everyone, whether you bought hardware from us or not. If you've worked through this guide and still can't reach a service by hostname, there are a few more places to go depending on your situation.

**If you're running your own hardware**

Community forums for Frigate, Caddy, and Docker are your best bet for issues specific to a custom setup we didn't ship. Bring the output from your DNS checks (`nslookup`, `Resolve-DnsName` on Windows) and note whether direct access by IP and port works when you ask for help.

**If you purchased an Argus system from LAN Foundry**

Visit [lanfoundry.com/support](https://lanfoundry.com/support) for support options and how to submit a ticket.

When you open a support request, include:

- Which hostname isn't working (`frigate.internal`, `portainer.internal`, or `cockpit.internal`)
- The device you're testing from and its operating system
- The output of `nslookup` for the failing hostname, and `Resolve-DnsName` if you're on Windows
- Whether the issue affects all devices on your network or just one
- Whether you can reach the service directly by IP and port (for example, `http://192.168.1.100:5000` for Frigate)
- The last thirty to fifty lines from `docker logs caddy` if the hostname resolves but the page won't load

The more context you provide, the faster we can pinpoint the issue. If your system is still within its warranty period, check your purchase documentation for what coverage applies.
