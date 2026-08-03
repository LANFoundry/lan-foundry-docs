# Setting up a camera VLAN on other routers and switches

This guide covers the concepts and general steps for configuring a camera VLAN on router and switch hardware other than OPNsense and TP-Link TL-SG series switches. The underlying concepts are identical to the platform-specific guides, only the interface and terminology differ between manufacturers.

If you're using OPNsense and a TP-Link TL-SG switch, the dedicated guides for those platforms will be more useful:

- [Setting up a camera VLAN in OPNsense](vlan-opnsense.md)
- [Setting up a camera VLAN on TP-Link TL-SG switches](vlan-tplink.md)

---

## Before you start

Regardless of what hardware you're using, you'll need:

- A router or firewall that supports VLAN creation and inter-VLAN firewall rules
- A managed switch that supports 802.1Q VLAN tagging
- Administrative access to both devices
- The VLAN ID you want to use for the camera network. This guide uses VLAN 10 as the example
- Your NVR's static IP address on the main LAN

If your router doesn't support inter-VLAN firewall rules, you won't be able to control which devices can communicate between network segments. Basic consumer routers from ISPs often fall into this category. In that case, upgrading to a capable router platform is the right path before proceeding.

---

## Part 1 — Router configuration

### What you're trying to accomplish

On the router side you need to:

1. Create a new VLAN with your chosen VLAN ID
2. Assign that VLAN a subnet and gateway IP address
3. Enable DHCP on the VLAN so cameras get IP addresses automatically
4. Create firewall rules controlling what the camera VLAN can reach and what can reach it

### Common router platforms

The steps vary by platform but the concepts are consistent across all of them. Here's where to look in some common platforms:

**pfSense** - 
VLAN creation lives under Interfaces, then Assignments, then VLANs. After creating the VLAN you assign it as an interface under Interfaces, then Assignments, configure it with a static IP, enable DHCP under Services, then DHCP Server, and write firewall rules under Firewall, then Rules. The process is nearly identical to OPNsense since pfSense and OPNsense share common roots.

**UniFi (Ubiquiti)** - 
VLAN configuration in UniFi is handled through Networks under the Settings menu. Create a new network, set the type to VLAN Only or Corporate depending on your controller version, assign a VLAN ID and subnet, and enable DHCP. Firewall rules live under Firewall and Security, then Firewall Rules. UniFi abstracts some of the complexity compared to OPNsense but gives you less granular control.

**Mikrotik** - 
VLAN configuration on Mikrotik uses the bridge VLAN filtering approach on newer RouterOS versions. Add VLAN interfaces under Interfaces, assign them to the bridge, configure IP addresses under IP then Addresses, set up DHCP under IP then DHCP Server, and write firewall rules under IP then Firewall. Mikrotik's interface is more technical than most but extremely capable.

**Firewalla** - 
Firewalla handles VLANs through the app under Network, then add a new network segment. DHCP is configured as part of the network setup. Firewall rules are managed through the Rules section of the app. Firewalla is the most consumer-friendly option on this list and trades some granularity for ease of use.

**Other platforms** - 
If your router isn't listed here, look for VLAN configuration under network settings, interfaces, or LAN configuration. DHCP configuration is usually nearby. Firewall rules are sometimes called access rules, security policies, or traffic rules depending on the vendor.

### What to configure

Regardless of platform, you're configuring the same things:

**Create the VLAN** - 
Give it your chosen ID, in this guide VLAN 10, and a name like Cameras for easy identification.

**Assign a subnet and gateway** - 
Use a subnet that doesn't conflict with your main LAN. If your main LAN is `192.168.1.0/24`, a good choice for the camera VLAN is `192.168.10.0/24`. The gateway address is typically the first usable address in the subnet, `192.168.10.1`.

**Enable DHCP** - 
Configure a DHCP pool within the camera subnet. A range like `192.168.10.100` to `192.168.10.200` leaves lower addresses available for static assignments if needed. Set the gateway to `192.168.10.1`.

**Create firewall rules** - 
You need five rules in total. Within each interface, allow rules must appear above block rules since rules are evaluated top to bottom and the first match wins.

On the camera VLAN interface:

- Allow UDP from camera VLAN to the camera VLAN gateway IP on port 67. This permits cameras to reach the DHCP server and receive an IP address. Without this rule, the block-all rule below drops DHCP requests and cameras won't come online
- Allow traffic from camera VLAN to your NVR's IP address on ports 554, 8554, 80, 443, and 3702
- Block all other outbound traffic from the camera VLAN

On the main LAN interface:

- Allow traffic from your NVR's IP address to the camera VLAN on the same ports
- Block all other traffic from the main LAN to the camera VLAN

---

## Part 2 — Switch configuration

### What you're trying to accomplish

On the switch side you need to:

1. Enable 802.1Q VLAN mode
2. Create VLAN 10 and assign ports to it
3. Configure the uplink port as a trunk carrying both VLAN 1 and VLAN 10
4. Set the correct PVID on each port so devices end up on the right VLAN

### Common switch platforms

**Netgear Smart switches** - 
VLAN configuration on Netgear smart switches lives under Switching, then VLAN, then Advanced, then VLAN Configuration. Enable 802.1Q, create your VLAN, assign ports as tagged or untagged, then set PVIDs under VLAN, then Port PVID Configuration.

**Ubiquiti UniFi switches** - 
If you're using a UniFi switch alongside a UniFi router, VLAN assignment is handled through port profiles in the UniFi controller. Create a port profile for the camera VLAN and apply it to the relevant switch ports. The trunk port to the router is handled automatically if both devices are managed by the same controller.

**Cisco SG series** - 
Cisco small business switches use a similar 802.1Q approach. Navigate to VLAN Management, then Port to VLAN, to assign ports. Set the uplink port as trunk and camera ports as access ports assigned to VLAN 10. PVID equivalents are set under VLAN Management, then Port VLAN Membership.

**Other managed switches** - 
Most managed switches from any manufacturer support 802.1Q VLAN in some form. Look for VLAN configuration under switching, LAN, or network settings. The terminology varies but the concepts are the same across all platforms.

### What to configure

**Enable 802.1Q VLAN mode** - 
Most switches default to a simpler port-based VLAN mode or no VLAN mode at all. 802.1Q needs to be explicitly enabled before you can create tagged VLANs.

**Create VLAN 10** - 
Give it an appropriate name. Add your camera ports as untagged members and your uplink port as a tagged member. Cameras don't understand VLAN tags and need untagged traffic. The router needs tagged traffic to distinguish between VLANs on the same uplink cable.

**Verify VLAN 1 includes the uplink port as tagged** - 
VLAN 1 carries your main LAN traffic. The uplink port needs to be a tagged member of both VLAN 1 and VLAN 10 so both types of traffic travel correctly over the single cable connecting the switch to the router.

**Set PVIDs** - 
The PVID tells the switch which VLAN to assign incoming untagged traffic to on each port:

- Camera ports: PVID 10
- Main LAN ports: PVID 1
- Uplink port: PVID 1

**Save the configuration** - 
Most managed switches apply changes immediately but don't save them to persistent storage automatically. Look for an explicit save or write configuration option to make sure your settings survive a reboot.

---

## Verifying the setup

Once both the router and switch are configured, verify the following:

**Camera receives an IP address from the camera subnet** - 
Connect a camera to a port assigned to VLAN 10. Check your router's DHCP lease table and confirm the camera received an address in the `192.168.10.x` range. If it received a main LAN address instead, the PVID on that switch port is likely still set to 1.

**Camera is reachable from the NVR** - 
From the NVR, ping the camera's IP address:

```bash
ping -c 3 192.168.10.x
```

Success means traffic is flowing correctly between the main LAN and camera VLAN through your router's firewall rules.

**Camera is not reachable from other devices** - 
From any device on the main LAN other than the NVR, try to browse to the camera's IP address. The connection should time out.

**Camera cannot reach the internet** - 
Check your router's firewall logs and look for blocked outbound attempts from camera IP addresses to external destinations. These are phone-home attempts being stopped by your block rule.

---

## Where to go from here

With your router and switch configured, your camera VLAN is operational. Cameras on the designated switch ports will receive IP addresses from the camera subnet, connect to your NVR, and be isolated from everything else on your network.

If you're ready to start adding cameras to Frigate, head to the [adding your first camera](../cameras/first-camera.md) guide.
