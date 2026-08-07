# Understanding network segmentation and VLANs

When you connect a device to your home or business network, it joins everything else on that network. Your laptop, your phone, your security cameras, your smart thermostat, and your printer can all see and potentially talk to each other. For most devices that's fine. For some devices it's a problem.

This guide explains what network segmentation is, why it matters for privacy and security, and how VLANs let you control which devices can talk to each other without running new cables or buying additional networking hardware.

---

## The problem with a flat network

A flat network is one where every device is on the same network segment. This is how most home and small business networks are set up by default. Your router hands out IP addresses to everything that connects, and all those devices can reach each other freely.

This works well for devices you trust. It becomes a problem when you mix devices with different levels of trust or different purposes on the same network.

Consider a few examples:

**Security cameras** are designed to record continuously and in many cases are built to send data back to manufacturer servers. Even on a locally configured system, a camera with cloud features enabled will attempt to reach out to external servers in the background. On a flat network nothing stops it from doing that.

**Smart home devices** like thermostats, doorbells, bulbs, and plugs are frequently built with minimal security in mind. Many have known vulnerabilities and receive infrequent firmware updates. A compromised smart bulb on a flat network has a path to everything else on that network including your computers and NAS.

**Guest devices** are phones and laptops belonging to visitors. You want them to have internet access but you probably don't want them to be able to browse your NAS, access your cameras, or reach other devices on your network.

In all three cases the problem is the same. Devices that should have limited, controlled access are instead on the same network as everything else with no restrictions on what they can reach.

---

## What a VLAN is

VLAN stands for Virtual Local Area Network. It's a way of logically dividing a single physical network into multiple separate networks without running additional cables or buying additional routers.

Think of your network as a building. A flat network is an open floor plan where everyone can walk anywhere freely. A VLAN is like adding walls and doors to that building. Devices in one room can't reach devices in another room unless there's a door connecting them, and you control where the doors are and who can use them.

Devices on different VLANs are isolated from each other by default. A camera on the camera VLAN can't reach your laptop on the main network VLAN. Traffic between VLANs only flows if your router has an explicit rule allowing it, and you define exactly what that rule permits.

This isolation happens in software, on your existing hardware. You don't need a second router or a second switch. You need a router that supports VLAN configuration and a managed switch that can tag traffic by VLAN.

---

## How VLANs solve the problem

With VLANs you can put different types of devices into different network segments and control exactly what each segment can do.

A well-segmented home or small business network might look like this:

**Main network** — your computers, phones, tablets, and NAS. These devices can reach the internet and each other freely.

**Camera network** — your security cameras. These devices can only reach your NVR. They cannot reach the internet, they cannot reach your main network, and nothing on your main network can reach them directly except the NVR. Footage flows from camera to NVR and nowhere else.

**IoT network** — your smart home devices. These devices can reach the internet for updates and cloud features if you choose to allow that, but they cannot reach your main network or your camera network. A compromised smart device is contained.

**Guest network** — visitor devices. Internet access only. No access to any other network segment.

Each of these segments is a VLAN. They share the same physical cables and the same switch, but they're logically separated and can only communicate where you explicitly allow it.

---

## Controlling traffic between VLANs

The router is where inter-VLAN traffic rules live. When a device on one VLAN tries to reach a device on another VLAN, that traffic has to pass through the router. The router checks its rules and either allows or blocks the traffic based on what you've configured.

This gives you precise control. For the camera network you might create rules like:

- Allow cameras to reach the NVR on specific ports
- Allow the NVR to reach cameras on specific ports
- Block everything else from the camera network outbound
- Block everything on the main network from reaching camera IPs directly

The result is that your cameras can stream to your NVR, your NVR can reach your cameras for configuration, and nothing else can cross that boundary in either direction. The cameras are effectively invisible to the rest of your network and to the internet.

OPNsense is a capable open source router platform that handles VLAN configuration and inter-VLAN firewall rules well. It's what LAN Foundry recommends and what our router-specific guides are written around. The same concepts apply to pfSense, UniFi, Mikrotik, and any other router platform that supports VLAN-aware firewall rules.

---

## What hardware you need

Not all networking hardware supports VLANs. To implement network segmentation you need two things:

**A VLAN-capable router** - 
Your router needs to support creating multiple VLANs and configuring firewall rules between them. Most consumer routers either don't support this at all or support it in a limited way. A dedicated router running OPNsense, pfSense, or a business-grade router from Ubiquiti, Mikrotik, or similar gives you full control. Some ISP-provided routers have basic VLAN support but often lack the firewall rule granularity you need for proper segmentation.

**A managed switch** - 
A standard unmanaged switch treats all traffic the same and has no concept of VLANs. A managed switch can tag traffic by VLAN, which means devices plugged into different ports can be assigned to different network segments even though they share the same physical switch. If all your devices plug directly into your router and you have no separate switch, you may not need a managed switch to get started. But most setups with more than a handful of devices benefit from one.

If you're working with a LAN Foundry Argus system, the included TP-Link switch is a managed switch pre-selected for compatibility with this setup. The guides linked below walk through the configuration for that specific hardware.

---

## Where to go from here

Now that you understand what VLANs are and how they solve the problem of untrusted devices on your network, the next step is actually setting one up. The guides below walk through the configuration for specific hardware:

**Router configuration**
- [Setting up a camera VLAN in OPNsense](../network/vlan-opnsense.md)
- [Setting up a camera VLAN on other routers](../network/vlan-other-routers.md)

**Switch configuration**
- [Setting up a camera VLAN on TP-Link TL-SG switches](../network/vlan-tplink.md)
- [Setting up a camera VLAN on other managed switches](../network/vlan-other-routers.md#part-2-switch-configuration)

If you're setting up a camera network specifically, start with the router guide for your platform first. The switch configuration follows once your router has the VLAN defined.

VLANs isolate devices on your physical network from each other. If you're adding your own containers to the NVR, [Running your own containers safely](../further/container-networking.md) covers the equivalent isolation at the Docker level.
