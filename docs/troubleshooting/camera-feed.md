# Camera feed not showing in Frigate

Frigate is running and you can open the web interface, but a camera shows a blank tile, an error icon, or a message that the stream failed. This guide walks through finding out why and getting the feed to appear.

Getting a camera feed working involves two separate connections: your NVR has to reach the camera over the network, and Frigate has to connect to the camera's video stream using the correct URL and credentials. This guide helps you figure out which of those is failing.

---

## Before you start

This guide assumes:

- Frigate is running and you can open its web interface, either at `https://frigate.internal` or directly at the NVR's IP on port 5000
- The camera is powered on and connected to your network
- You've added the camera to your Frigate configuration, or you're working through initial setup

Throughout this guide, example IP addresses are used for clarity. Replace them with the addresses from your own network:

- **NVR (main LAN):** `192.168.1.100`
- **Router / OPNsense (main LAN):** `192.168.1.1`
- **Cameras (camera VLAN):** `192.168.10.101`, `192.168.10.102`, and so on
- **Your computer (main LAN):** `192.168.1.50` when adding a temporary firewall rule

Your subnets may differ if you've chosen different ranges during setup.

If Frigate itself won't load, start with [Can't reach a service by hostname](hostname.md) or [What to do when a container won't start](container.md) first.

If you haven't added the camera to Frigate yet, the [adding your first camera to Frigate](../cameras/first-camera.md) guide covers initial setup. This troubleshooting guide is for when a camera is configured but the feed still won't appear.

---

## How the pieces connect

When Frigate displays a camera feed, this is the path the video takes:

```
Camera  →  encodes video as an RTSP stream
        →  sends it over your network to the NVR
        →  Frigate connects to the stream URL in config.yml
        →  go2rtc/ffmpeg decodes the stream
        →  Frigate displays it in the web interface
```

A problem anywhere in that chain produces a missing or broken feed. Network issues prevent Frigate from reaching the camera at all. A wrong stream URL or bad credentials means Frigate reaches the camera but can't pull video from it.

---

## Figure out where it's failing

| What you see in Frigate | Likely layer | Jump to |
|---|---|---|
| Camera tile shows "Unable to connect" or similar | Network or stream URL | [The NVR can't reach the camera](#the-nvr-cant-reach-the-camera) |
| Feed worked before, stopped after a network change | VLAN or firewall | [VLAN and firewall issues](#vlan-and-firewall-issues) |
| Camera was just moved to the camera VLAN | IP change or switch port config | [Camera stopped working after moving to the camera VLAN](#camera-stopped-working-after-moving-to-the-camera-vlan) |
| Error mentioning unauthorized, 401, or authentication | Credentials | [Wrong username or password](#wrong-username-or-password) |
| Error mentioning 404, not found, or invalid path | Stream URL | [Wrong stream URL](#wrong-stream-url) |
| One camera works, another doesn't | Camera-specific config | [Check each camera individually](#check-each-camera-individually) |
| Feed appears but is frozen or heavily delayed | Stream settings | [Stream quality and encoding issues](#stream-quality-and-encoding-issues) |

---

## Check the Frigate logs first

Before changing configuration, see what Frigate is reporting about the camera.

On the NVR:

```bash
docker logs frigate --tail 100
```

To watch logs live while you reload the Frigate page:

```bash
docker logs frigate -f
```

Press `Ctrl+C` to stop following.

Look for lines mentioning your camera name or its IP address. Common messages and what they point to:

| Log message | Likely cause |
|---|---|
| `401 Unauthorized` | Wrong username or password |
| `404 Not Found` or `method DESCRIBE failed` | Wrong RTSP stream path |
| `Connection refused` | Camera not reachable on that IP or port, or RTSP disabled |
| `Connection timed out` | Network or firewall blocking the NVR from the camera |
| `No route to host` | Camera on a subnet the NVR can't reach |

The log message usually narrows the problem to one of the sections below.

---

## The NVR can't reach the camera

If Frigate can't reach the camera at the network level, no stream URL will work until connectivity is fixed.

### Confirm the camera has an IP address

Look in OPNsense under **Services**, then **DHCPv4**, then **Leases** for a recently connected device on your camera VLAN. Select your camera VLAN interface from the tabs and match the lease to the camera's MAC address if you know it.

If you need to verify settings inside the camera itself, see [Accessing cameras from your computer](#accessing-cameras-from-your-computer) for how to reach the camera web interface from another device on your network.

Note the camera's IP address. You'll need it for the steps below.

### Ping the camera from the NVR

SSH into the NVR and ping the camera's IP:

```bash
ping -c 3 192.168.10.101
```

Replace the IP with your camera's actual address. A successful ping means the NVR can reach the camera at the network layer. If ping fails, the problem is networking, not Frigate configuration.

If ping fails:

- Confirm the camera is on the expected VLAN or subnet
- Check that the Ethernet cable is connected and the camera has link lights
- Verify the camera received a DHCP address in the range you configured

### Test the RTSP port

Even if ping works, the RTSP port may be blocked or closed. From the NVR:

```bash
nc -zv 192.168.10.101 554
```

Port 554 is the default RTSP port. If the connection is refused, RTSP may be disabled on the camera or the camera uses a non-standard port. Amcrest cameras ship with RTSP enabled by default, so a refusal more often means a wrong IP or a firewall block than a disabled setting.

If you need to confirm RTSP settings inside the camera's web interface, do that from a computer on your main LAN after adding the temporary firewall rule described in [Accessing cameras from your computer](#accessing-cameras-from-your-computer).

---

## VLAN and firewall issues

If your cameras are on a dedicated camera VLAN, the NVR must be allowed to reach them through OPNsense firewall rules. This is the most common cause of connectivity problems on segmented networks.

Your camera VLAN setup should include a rule allowing the NVR's static IP to reach the camera VLAN on ports **554**, **8554**, **80**, **443**, and **3702**. Rule 4 in the [OPNsense camera VLAN guide](../network/vlan-opnsense.md) covers this.

Common mistakes:

- The NVR's static IP in the firewall rule doesn't match its actual IP
- The allow rule is below a block rule on the same interface (rules are evaluated top to bottom; allow rules must come first)
- The camera is on the main LAN but the Frigate config points to a camera VLAN IP, or the reverse
- The switch port the camera is plugged into isn't assigned to the camera VLAN

To confirm a firewall block, check OPNsense under **Firewall**, then **Log Files**, then **Live View**. Filter for your camera VLAN interface and look for blocked entries between the NVR IP and the camera IP while Frigate is trying to connect.

If you haven't set up a camera VLAN yet, see [Understanding network segmentation and VLANs](../privacy/blocking-telemetry.md) and the [OPNsense VLAN guide](../network/vlan-opnsense.md).

---

## Camera stopped working after moving to the camera VLAN

If a camera feed was working on your main LAN and broke after you moved the camera to the camera VLAN, the cause is almost always one of three things: the camera's IP changed and Frigate still points to the old address, the switch port isn't configured correctly for the camera VLAN, or the firewall rule allowing the NVR to reach the camera VLAN isn't in place.

Work through these in order.

### Check the IP address in config.yml

When a camera moves from the main LAN to the camera VLAN, it gets a new IP address from the VLAN's DHCP range. Frigate will keep trying the old IP until you update `config.yml`.

In OPNsense, open **Services**, then **DHCPv4**, then **Leases**. Select your camera VLAN interface and find the camera's current IP. If it's different from what's in your Frigate config, update `config.yml` with the new address and restart Frigate:

```bash
docker restart frigate
```

To prevent this from happening again, assign a static DHCP reservation for the camera in OPNsense so its IP doesn't change on lease renewal. See [Placing cameras on the camera VLAN](../cameras/vlan-placement.md#step-3-assign-a-static-dhcp-reservation) for how to do that.

### Confirm the camera is getting a VLAN IP

If the camera isn't showing up in the DHCP leases for the camera VLAN interface at all, the switch port may not be configured correctly.

The camera port on your switch should be set as **untagged on the camera VLAN**, with the camera VLAN as the port's PVID. If it's still set as a regular LAN port, the camera will get a main LAN address and VLAN isolation won't apply. See [Setting up a camera VLAN on TP-Link switches](../network/vlan-tplink.md) or [Setting up a camera VLAN on other routers and switches](../network/vlan-other-routers.md) for the switch port configuration.

### Check the firewall rule

Cameras on an isolated VLAN can't be reached by anything unless a firewall rule explicitly allows it. The NVR needs a rule permitting its IP to reach the camera VLAN on RTSP and related ports.

In OPNsense, check **Firewall**, then **Rules**, then your camera VLAN interface. You should have a rule that allows the NVR's IP (`192.168.1.100`) to reach the camera VLAN on ports `554`, `8554`, `80`, `443`, and `3702`. If that rule is missing or the NVR's IP in the rule doesn't match its actual address, the connection will time out.

To confirm a block is happening, check **Firewall**, then **Log Files**, then **Live View**. Filter for your camera VLAN interface and look for blocked entries between the NVR IP and the camera IP.

---

## Accessing cameras from your computer

Argus systems run Ubuntu Server without a desktop browser. You won't open a camera's web interface on the NVR itself. Most troubleshooting happens over SSH using commands like `ping`, `nc`, `ffprobe`, and `docker logs`.

If your network follows our recommended camera VLAN setup, your other devices can't reach cameras either. Rule 5 in the [OPNsense camera VLAN guide](../network/vlan-opnsense.md) blocks everything on the main LAN from accessing the camera VLAN except the NVR. That's intentional. It also means browsing to a camera's IP address from your laptop will time out unless you add a temporary exception.

### What you can do from the NVR without any rule changes

These all run over SSH on the NVR and work with the standard VLAN firewall rules already in place:

- Ping the camera to confirm network connectivity
- Test RTSP port 554 with `nc -zv`
- Test the stream with `ffprobe`
- Read Frigate logs with `docker logs frigate`

For many problems, that's enough. You don't need the camera web interface at all.

### What you can check without reaching the camera directly

You can confirm a camera received an IP address from OPNsense under **Services**, then **DHCPv4**, then **Leases**, without connecting to the camera itself. Select your camera VLAN interface and look for a lease matching the camera's MAC address.

You can also use the camera manufacturer's mobile app during initial setup if the camera supports local configuration over Wi-Fi or before it joins the camera VLAN. Once a camera is on the isolated VLAN, the app on your phone typically won't reach it either unless you're on a network path that can access that VLAN.

### Temporarily allowing your computer to reach the camera VLAN

If you need the camera's web interface, ONVIF discovery tools, or VLC on your laptop, add a **temporary** firewall rule in OPNsense that allows your computer to reach the camera VLAN. Remove it when you're done.

In the OPNsense web interface, navigate to **Firewall**, then **Rules**, then select your **LAN** interface.

Click **Add** and configure a rule **above** the block rule that prevents LAN access to the camera VLAN:

- **Action:** Pass
- **Interface:** LAN
- **Direction:** in
- **Protocol:** TCP/UDP
- **Source:** your computer's static IP on the main LAN, entered as `192.168.1.50/32` (replace with your actual IP)
- **Destination:** camera VLAN net
- **Destination port range:** 80, 443, 554, 8554, 3702
- **Description:** `TEMP - admin PC to camera VLAN`

Click **Save**, then **Apply changes**.

Your computer should now be able to browse to the camera's IP address, open RTSP streams in VLC, and use ONVIF tools. When you finish troubleshooting or initial setup, **delete this rule** and apply changes again. Leaving a permanent exception open defeats the purpose of isolating your cameras.

If your computer uses DHCP and its IP changes, either assign it a static IP on the main LAN first or update the rule each time your IP changes.

---

## Wrong username or password

Cameras require authentication for RTSP streams. If the credentials in your Frigate config don't match the camera, you'll see `401 Unauthorized` in the logs.

Verify the username and password match what the camera expects. On Argus systems, this is typically the default set during initial camera setup. If you're unsure, log into the camera's web interface from a computer on your main LAN. You'll need the temporary firewall rule from [Accessing cameras from your computer](#accessing-cameras-from-your-computer) if your cameras are on an isolated VLAN. Use the same credentials in your Frigate stream URL.

A typical RTSP URL format with credentials:

```
rtsp://admin:yourpassword@192.168.10.101:554/cam/realmonitor?channel=1&subtype=0
```

Special characters in passwords can break RTSP URLs. If your password contains `@`, `#`, `?`, or other symbols, URL-encode them or change the camera password to something simpler for testing.

After updating credentials in `config.yml`, restart Frigate:

```bash
docker restart frigate
```

---

## Wrong stream URL

Each camera brand uses a different RTSP path. A URL that works for one manufacturer won't work for another, and a typo in the path produces a `404` or `DESCRIBE failed` error in the logs.

### Amcrest cameras

LAN Foundry systems ship with Amcrest cameras by default. The typical RTSP paths are:

**Main stream (higher resolution):**

```
rtsp://admin:password@192.168.10.101:554/cam/realmonitor?channel=1&subtype=0
```

**Sub stream (lower resolution, less CPU):**

```
rtsp://admin:password@192.168.10.101:554/cam/realmonitor?channel=1&subtype=1
```

Replace `admin`, `password`, and the IP address with your values. If you have multiple cameras, increment the channel number or use each camera's individual IP with `channel=1`.

### Other camera brands

RTSP paths vary by manufacturer. Check the camera's documentation or the [What is ONVIF and why does it matter](../privacy/what-is-onvif.md) guide for context on how cameras expose streams.

If you're unsure of the correct path, look it up in the camera's web interface under stream or codec settings, or use ONVIF discovery tools from a computer on your main LAN. Both require the temporary firewall rule described in [Accessing cameras from your computer](#accessing-cameras-from-your-computer) when cameras are on an isolated VLAN.

### Confirm RTSP is enabled

Amcrest cameras ship with RTSP enabled. Other brands sometimes disable it by default. If you suspect RTSP is turned off, check the camera's web interface from your computer using the temporary firewall rule above. The setting location varies by brand but is usually under network, stream, or integration settings.

### Test the stream outside Frigate

Before editing Frigate config further, confirm the stream works independently. The most reliable test runs from the NVR over SSH, since the NVR is already allowed to reach the camera VLAN:

```bash
ffprobe -rtsp_transport tcp "rtsp://admin:password@192.168.10.101:554/cam/realmonitor?channel=1&subtype=0"
```

A working stream shows video codec information. Errors here confirm the problem is the URL or camera settings, not Frigate itself.

You can also test the stream in VLC on a computer connected to your main LAN: **Media**, then **Open Network Stream**, then paste the RTSP URL. If your cameras are on an isolated VLAN, add the temporary firewall rule from [Accessing cameras from your computer](#accessing-cameras-from-your-computer) first, or VLC will time out even when Frigate can reach the stream fine. If VLC can't play it from the NVR test either, Frigate won't be able to either.

---

## Check each camera individually

When one camera works and another doesn't, the problem is almost always specific to the failing camera's configuration, not Frigate as a whole.

For the camera that isn't working, verify independently:

- IP address is correct and the camera responds to ping from the NVR
- Username and password are correct
- RTSP URL path matches the camera brand and model
- The camera is on the VLAN and switch port you expect

Compare the working camera's Frigate config entry to the broken one. Small differences in the stream path or IP are easy to miss.

---

## Stream quality and encoding issues

If the feed appears but freezes, stutters, or falls far behind live, the stream itself may be more than Frigate can handle with your current settings.

**Try the sub stream for detection** - The sub stream is lower resolution and uses less CPU. Point the `detect` role at the sub stream URL (`subtype=1` on Amcrest) and keep the main stream for recording:

```yaml
cameras:
  front_door:
    ffmpeg:
      inputs:
        - path: rtsp://admin:password@192.168.10.101:554/cam/realmonitor?channel=1&subtype=1
          roles:
            - detect
        - path: rtsp://admin:password@192.168.10.101:554/cam/realmonitor?channel=1&subtype=0
          roles:
            - record
```

**Force TCP transport** - Some cameras behave more reliably with TCP rather than UDP for RTSP. In Frigate's config:

```yaml
ffmpeg:
  input_args: preset-rtsp-generic
```

Or add `-rtsp_transport tcp` via go2rtc stream configuration depending on your Frigate version.

**Check CPU load** - If the NVR is under heavy load, streams may drop frames. See [NVR running slow or dropping frames](performance.md) for broader performance troubleshooting.

After any config change, restart Frigate and check the logs again:

```bash
docker restart frigate
docker logs frigate --tail 50
```

---

## Quick reference

| Symptom | First check | Likely fix |
|---|---|---|
| "Unable to connect" in Frigate UI | Ping camera from NVR | Fix network, VLAN, or firewall |
| `401` in Frigate logs | Credentials in config vs. camera | Correct username/password in stream URL |
| `404` or DESCRIBE failed in logs | `ffprobe` from NVR over SSH | Fix stream path for camera brand |
| Connection timed out | OPNsense firewall logs | Fix VLAN allow rules for NVR → camera |
| Worked until config edit | `docker logs frigate` | Revert recent config.yml change |
| One of several cameras fails | Compare working vs. broken config | Fix IP, URL, or credentials for that camera |
| Feed frozen or delayed | CPU usage, stream resolution | Use sub stream for detect, reduce resolution |

---

## Where to go from here

Once your camera feeds are showing in Frigate:

- [Adding your first camera to Frigate](../cameras/first-camera.md), if you're still working through initial camera setup
- [Setting up recording zones and motion detection](../cameras/zones-motion.md), once feeds are stable
- [Setting up a camera VLAN in OPNsense](../network/vlan-opnsense.md), if your cameras aren't segmented yet

**Related troubleshooting**

- [Can't reach a service by hostname](hostname.md)
- [What to do when a container won't start](container.md)

**If you're still stuck**

Search the Frigate logs for the specific error message and check the [Frigate documentation](https://docs.frigate.video) for your camera brand's recommended stream settings. The Frigate community forum and GitHub discussions are good resources for camera-specific RTSP path questions.

---

## LAN Foundry customer support

The guides on this site are free for everyone, whether you bought hardware from us or not. If you've worked through this guide and a camera feed still won't appear, there are a few more places to go depending on your situation.

**If you're running your own hardware**

Community forums for Frigate and your camera manufacturer are your best bet for RTSP URL and codec questions we don't cover here. Bring the output from `docker logs frigate --tail 100` and the RTSP URL you're using (redact your password).

**If you purchased an Argus system from LAN Foundry**

Visit [lanfoundry.com/support](https://lanfoundry.com/support) for support options and how to submit a ticket.

When you open a support request, include:

- Which camera isn't working (location/name and model if known)
- The camera's IP address and which VLAN it's on
- Whether the NVR can ping the camera
- The RTSP URL from your Frigate config (redact the password)
- The last fifty to one hundred lines from `docker logs frigate` showing errors for that camera
- Any recent changes to network, VLAN, or Frigate configuration

The more context you provide, the faster we can pinpoint the issue. If your system is still within its warranty period, check your purchase documentation for what coverage applies.
