# Assigning a static IP to the NVR

By default your NVR gets its IP address from your router via DHCP, which means that address can change. If your router assigns a different IP after a reboot or lease renewal, your firewall rules break, your Caddy configuration breaks, and your cameras lose their connection to the NVR. A static IP prevents that entirely.

This guide covers setting a static IP directly on the NVR using Netplan on Ubuntu Server 26.04. The same approach applies to any Linux system using Netplan as its network manager.

---

## Before you start

You'll need:

- SSH access to your NVR or a keyboard and monitor connected to it
- Your router's gateway IP address, usually something like `192.168.1.1` or `10.0.0.1`
- The static IP address you want to assign, which should be outside your router's DHCP range to avoid conflicts
- Your preferred DNS server addresses

If you're not sure what IP range your router uses, log into your router's admin interface and look at the DHCP settings. It will show you the range of addresses it hands out automatically. Choose a static IP outside that range on the same subnet.

---

## Step 1 — Find your network interface name

Network interface names vary by hardware. Run this command to see yours:

```bash
ip link show
```

Look for the interface that shows `state UP`. It will have a name like `ens18`, `enp3s0`, or similar. Note it down — you'll need it in the next step.

---

## Step 2 — Check your current Netplan configuration

List the files in your Netplan directory:

```bash
ls /etc/netplan/
```

On a standard Ubuntu Server 26.04 installation you'll typically see one file named `00-installer-config.yaml`. View its current contents:

```bash
cat /etc/netplan/00-installer-config.yaml
```

You'll see something like this, showing DHCP is currently enabled:

```yaml
network:
  ethernets:
    ens18:
      dhcp4: true
  version: 2
```

---

## Step 3 — Edit the configuration file

Open the file for editing:

```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

Replace the contents with the following, substituting your own values for the interface name, IP address, gateway, and DNS servers:

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    ens18:
      dhcp4: false
      addresses:
        - 192.168.1.100/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 1.1.1.1
          - 8.8.8.8
```

A few things to note:

- Replace `ens18` with your actual interface name from Step 1
- Replace `192.168.1.100/24` with the static IP you want to assign. The `/24` is the subnet prefix — use `/24` for a standard home or small office network
- Replace `192.168.1.1` with your router's gateway IP
- The DNS servers shown are Cloudflare (`1.1.1.1`) and Google (`8.8.8.8`). You can use your router's IP here instead if you prefer local DNS resolution

**YAML indentation is critical.** Use exactly two spaces for each level of indentation. Do not use tabs. A single indentation error will prevent the configuration from applying.

Save the file with `Ctrl+O`, then `Enter`, then exit with `Ctrl+X`.

---

## Step 4 — Set correct file permissions

Netplan 1.2 on Ubuntu 26.04 requires strict file permissions. If the configuration file is world-readable, Netplan will warn you and may refuse to apply it:

```bash
sudo chmod 600 /etc/netplan/00-installer-config.yaml
```

---

## Step 5 — Test the configuration with netplan try

Before applying the change permanently, use `netplan try`. This applies the configuration and automatically rolls it back after 120 seconds if you don't confirm it. This protects you from locking yourself out over SSH if something goes wrong:

```bash
sudo netplan try
```

If the configuration is valid, you'll see a message asking you to press Enter to confirm. If you're connected over SSH and lose your connection, wait 120 seconds and the original configuration will be restored automatically.

Once you can confirm your network connection is still working, press Enter to accept the changes.

---

## Step 6 — Verify the static IP is applied

Check that the new address is assigned to your interface:

```bash
ip addr show ens18
```

You should see your static IP address listed. Also verify your routing table shows the correct gateway:

```bash
ip route show
```

Look for a line starting with `default via` followed by your gateway IP.

Test connectivity:

```bash
ping -c 3 1.1.1.1
```

If that succeeds, your static IP is configured correctly and the NVR can reach the internet. If ping is not found on your installation, install it first with `sudo apt install iputils-ping`.

---

## A note on other Linux distributions using Netplan

The steps above apply to any Linux distribution that uses Netplan as its network manager, not just Ubuntu Server. The file location (`/etc/netplan/`), syntax, and commands are identical. The only thing that varies is the filename of the configuration file, which may differ from `00-installer-config.yaml` depending on how the system was installed.

If your distribution uses a different network manager such as NetworkManager or systemd-networkd directly, the configuration approach will differ. Check your distribution's documentation for the appropriate method.

---

## Where to go from here

With a static IP assigned, your NVR has a stable address that your firewall rules, Caddy configuration, and camera streams can all rely on. The next step is [configuring Caddy as a reverse proxy](caddy-reverse-proxy.md) so you can reach Frigate, Cockpit, and Portainer by hostname from anywhere on your network.
