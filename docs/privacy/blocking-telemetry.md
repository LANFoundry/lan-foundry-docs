# Blocking camera cloud telemetry at the firewall

Most security cameras, even ones marketed as working locally, will attempt to reach out to manufacturer servers when connected to a network. This happens in the background without any notification. Depending on the manufacturer, this traffic can include device registration, firmware check-ins, usage telemetry, or in some cases video thumbnails.

The good news is that blocking this behavior is straightforward if your cameras are on their own dedicated VLAN. Instead of trying to track down every domain a manufacturer uses and blocking them individually, you block all outbound internet traffic from the camera VLAN and only allow the specific communication your cameras actually need, which is talking to your NVR. You also lock down inbound access to the camera VLAN so that only the NVR can reach your cameras directly. No other device on your network needs that access.

This guide walks through how to set that up in OPNsense, with a general explanation of the approach that applies to any firewall that supports VLANs.

---

## Before you start

This guide assumes:

- Your cameras are already on a dedicated VLAN, separate from your main network
- Your NVR has a static IP address on that same VLAN
- You have access to your firewall's admin interface

If you haven't set up a camera VLAN yet, start with the [camera VLAN in OPNsense](../network/vlan-opnsense.md) guide first.

---

## The concept

A VLAN is a logically separate network. Devices on your camera VLAN can communicate with each other, but by default they can't reach devices on other VLANs or the internet unless you explicitly create rules that allow it.

We're creating four rules across two interfaces:

On the camera VLAN interface:
1. **Allow** traffic from cameras to the NVR's static IP on required ports
2. **Block** everything else outbound from the camera VLAN

On the main LAN interface:
3. **Allow** traffic from the NVR's static IP to the camera VLAN
4. **Block** everything else inbound to the camera VLAN from the LAN

The order matters within each interface. Firewall rules are evaluated top to bottom and the first matching rule wins. Allow rules always need to come before block rules, otherwise all traffic gets blocked before the allow rule is ever checked.

---

## A note about accessing your NVR

Locking down the camera VLAN does not affect your ability to access Frigate, Cockpit, or Portainer. Those services run on the NVR and are accessed through Caddy on your main LAN, not through the camera VLAN directly. From your devices on the main network, everything works exactly as it did before. The camera VLAN lockdown only affects direct connections to camera IPs, which no device other than the NVR needs.

---

## What ports to allow

Your cameras need to reach the NVR, and the NVR needs to reach your cameras, on a small number of ports:

| Protocol | Port | Purpose |
|---|---|---|
| TCP | 554 | RTSP video stream |
| TCP/UDP | 8554 | RTSP alternate port (if configured) |
| TCP | 80 | Camera web interface access from NVR |
| TCP | 443 | Camera HTTPS access from NVR |
| UDP | 3702 | ONVIF device discovery |

If you're not sure which ports your specific cameras use, start with RTSP on 554 and ONVIF discovery on 3702. Those two cover the core communication your NVR needs to pull video and detect cameras.

---

## Setting up the rules in OPNsense

### Camera VLAN interface rules

These rules control what your cameras can send out.

**Step 1 — Navigate to the firewall rules for your camera VLAN**

In OPNsense go to Firewall, then Rules, then select your camera VLAN interface from the tabs at the top.

**Step 2 — Create the outbound allow rule**

Click Add to create a new rule and set it up as follows:

- Action: Pass
- Interface: your camera VLAN interface
- Direction: out
- Protocol: TCP/UDP
- Source: camera VLAN network
- Destination: your NVR's static IP address
- Destination port range: the ports from the table above
- Description: Allow cameras to NVR

Save the rule.

**Step 3 — Create the outbound block rule**

Click Add to create a second rule below the first and set it up as follows:

- Action: Block
- Interface: your camera VLAN interface
- Direction: out
- Protocol: any
- Source: camera VLAN network
- Destination: any
- Description: Block all other outbound camera traffic

Save the rule.

**Step 4 — Apply the changes**

Click Apply changes at the top of the rules page.

---

### Main LAN interface rules

These rules control what can reach your cameras from the rest of your network.

**Step 5 — Navigate to the firewall rules for your main LAN**

In OPNsense go to Firewall, then Rules, then select your LAN interface from the tabs at the top.

**Step 6 — Create the NVR inbound allow rule**

Click Add to create a new rule and set it up as follows:

- Action: Pass
- Interface: LAN
- Direction: in
- Protocol: TCP/UDP
- Source: your NVR's static IP address
- Destination: camera VLAN network
- Destination port range: the ports from the table above
- Description: Allow NVR to cameras

Save the rule.

**Step 7 — Create the inbound block rule**

Click Add to create a second rule below the first and set it up as follows:

- Action: Block
- Interface: LAN
- Direction: in
- Protocol: any
- Source: any
- Destination: camera VLAN network
- Description: Block all other LAN access to camera VLAN

Save the rule.

**Step 8 — Apply the changes**

Click Apply changes at the top of the rules page.

---

## The general approach for other firewalls

If you're using pfSense, UniFi, or another firewall that supports VLANs, the logic is identical even if the interface looks different:

- On the camera VLAN interface: allow cameras to reach the NVR on required ports, block everything else outbound
- On the LAN interface: allow the NVR to reach cameras on required ports, block everything else inbound to the camera VLAN
- Make sure allow rules are above block rules within each interface
- Apply or save the changes

The specific steps vary by platform but the four-rule pattern is universal.

---

## Verifying it's working

Once your rules are applied, OPNsense's live log viewer lets you watch traffic in real time and confirm that the blocking is actually happening.

**Step 1 — Open the live log**

In OPNsense go to Firewall, then Log Files, then Live View.

**Step 2 — Filter for your camera VLAN**

In the interface filter, select your camera VLAN interface. This narrows the log to only traffic involving your cameras.

**Step 3 — Watch for blocked traffic**

Leave the live view running for a few minutes. You should see two types of entries:

- Green entries showing traffic between your camera IPs and your NVR's static IP — these are the allowed streams working correctly
- Red entries showing blocked traffic from your camera IPs to external destinations — these are phone-home attempts being stopped

If you see red blocked entries to external IP addresses or domains, the rules are working exactly as intended.

**Step 4 — Test the inbound lockdown**

From a device on your main LAN that is not the NVR, try to open a browser and navigate directly to one of your camera's IP addresses. The connection should time out or be refused. If it does, the inbound block rule is working.

**Step 5 — Confirm your cameras are still streaming**

Open Frigate and verify all your camera feeds are still showing video. If a camera has gone offline, check that your allow rules cover the ports that camera is using and adjust if needed.

---

## Where to go from here

With these four rules in place your camera network is fully isolated. Your cameras can only talk to your NVR, your NVR can talk to your cameras, and nothing else on your network can reach the cameras directly. Footage stays local, telemetry is blocked, and your camera network is invisible to everything except the system that needs it.

If you want to go deeper on network architecture, the [network architecture diagrams](#) guide shows how all the pieces fit together visually. If you're ready to start configuring your cameras in Frigate, head to the [adding your first camera](../cameras/first-camera.md) guide.
