# What to do when a container won't start

One of your NVR services stopped working. Frigate won't load, Portainer shows a container in a restart loop, or Caddy exited after a config change. This guide walks through finding out why a container failed and getting it running again.

Your NVR stack runs most of its services as Docker containers: Frigate, Portainer, and Caddy. Cockpit is the exception since it runs directly on the host. This guide focuses on the containers. If Cockpit is the service that's down, see the [Cockpit isn't running](#cockpit-isnt-running) section at the bottom.

---

## Before you start

This guide assumes:

- You can reach the NVR itself, either by SSH, a connected keyboard and monitor, or Cockpit if it's still running
- Docker is installed and has worked previously on this system
- You know which container is having trouble (`frigate`, `portainer`, or `caddy`)

If you can't reach the NVR at all, that's a different problem. Confirm the machine is powered on and responding to ping at its static IP before troubleshooting containers.

If the service loads in your browser but behaves incorrectly, that may be a configuration issue rather than a container startup failure. This guide is for containers that are stopped, crashing, or stuck in a restart loop.

---

## The containers in your stack

| Name | What it does | Typical failure symptom |
|---|---|---|
| `frigate` | NVR recording and object detection | No camera feeds, Frigate UI won't load |
| `caddy` | Reverse proxy for clean hostnames | All hostname URLs fail; direct port access may still work |
| `portainer` | Web UI for managing containers | Can't open Portainer; use SSH and `docker` commands instead |

All three should be connected to the `nvr-network` Docker network. Caddy depends on being able to reach Frigate and Portainer by container name on that network. If you're also having hostname or browser issues, see [Can't reach a service by hostname](hostname.md) after the container is running again.

---

## Step 1 — Check container status

Start by seeing which containers are actually running.

### From the command line

SSH into the NVR and run:

```bash
docker ps -a
```

The **STATUS** column tells you what each container is doing:

- **Up:** running normally
- **Exited (0):** stopped cleanly
- **Exited (1)** or other non-zero code: crashed or failed to start
- **Restarting:** crashing repeatedly; Docker is trying to bring it back up

Running containers only:

```bash
docker ps
```

If a container you expect to see is missing from the list entirely, it may have been removed. You'll need to recreate it using the setup commands from the [Caddy guide](../network/caddy-reverse-proxy.md) or your Frigate installation steps.

### From Portainer

If Portainer itself is running, browse to `https://portainer.internal` (or the NVR IP on port 9000). Go to **Containers**. Each container shows a status icon:

- Green: running
- Red or orange: stopped or unhealthy

Click the container name to see more detail, including how many times it has restarted.

---

## Step 2 — Read the logs

Logs almost always tell you why a container failed. Check them before restarting anything blindly.

### From the command line

Replace `frigate` with the container name you're troubleshooting:

```bash
docker logs frigate --tail 100
```

For a container stuck in a restart loop, the most recent crash is at the bottom:

```bash
docker logs frigate --tail 50
```

To watch logs live as the container tries to start:

```bash
docker logs frigate -f
```

Press `Ctrl+C` to stop following.

### From Portainer

Click the container name, then open the **Logs** tab. Portainer shows the same output as `docker logs`. Use the tail count or scroll to the bottom to find the most recent error.

---

## Step 3 — Match the error to a fix

Work through the sections below based on what you see in the logs.

### Configuration file errors

**What you'll see:** YAML syntax errors, "invalid config", "failed to parse", or Caddy reporting a Caddyfile error on startup.

**Frigate:** A typo or indentation error in `config.yml` will prevent Frigate from starting. The log usually points to the line number. Fix the file on the NVR, then restart the container:

```bash
docker restart frigate
```

**Caddy:** A syntax error in the Caddyfile prevents Caddy from starting. Check the file at the path you mounted when creating the container (typically `~/nvr/caddy/Caddyfile`). Fix the error, then restart:

```bash
docker restart caddy
```

If you're not sure what changed, compare your Caddyfile against the working example in the [Caddy guide](../network/caddy-reverse-proxy.md).

Before editing configuration files, it's worth saving a copy of the current version. The [backing up your Frigate configuration](../maintenance/backup.md) guide covers this in detail.

### Container not on `nvr-network`

**What you'll see in Caddy logs:** `dial tcp: lookup frigate: no such host` or a similar message for `portainer`.

Caddy reaches Frigate and Portainer by container name on the shared Docker network. If a container isn't connected to `nvr-network`, Caddy can't find it even if both containers are running.

Check which containers are on the network:

```bash
docker network inspect nvr-network
```

Connect a missing container and restart Caddy:

```bash
docker network connect nvr-network frigate
docker restart caddy
```

Replace `frigate` with `portainer` if that's the missing container.

### Port already in use

**What you'll see:** `bind: address already in use` or `port is already allocated`.

Two containers can't listen on the same port. Caddy uses ports 80 and 443. Frigate uses 5000. Portainer uses 9000.

Check what's using a port (example for 443):

```bash
sudo ss -tlnp | grep ':443'
```

If an old or duplicate container is holding the port, stop it:

```bash
docker stop <container-name-or-id>
```

Then start the correct container again.

### Out of disk space

**What you'll see:** `no space left on device` or write errors in the logs.

Recording video fills storage quickly. Check available space:

```bash
df -h
```

If your recording drive is full, Frigate may fail to start or behave unpredictably. Free space by adjusting retention settings or removing old recordings. See [How Frigate stores recordings](../storage/frigate-storage.md) and [Retention policies](../storage/retention.md).

### Permission or volume errors

**What you'll see:** `permission denied`, `cannot create directory`, or mount-related errors.

Frigate needs read/write access to the directories where recordings and configuration are stored. If you recently changed paths in `config.yml` or moved files, confirm the paths exist and are owned by the user Docker runs as.

List mounted volumes for a container:

```bash
docker inspect frigate --format '{{ json .Mounts }}'
```

Fix ownership on the host if needed (adjust the path to match your setup):

```bash
sudo chown -R 1000:1000 /path/to/frigate/storage
```

The correct user ID depends on how your Frigate container is configured. Check the image documentation if `1000` doesn't match your setup.

### Container exits immediately after an update

**What you'll see:** Container was working, you pulled a new image or changed a setting, and now it won't stay up.

Start by checking the logs for the new version. Image updates occasionally change required configuration or environment variables.

If you need to roll back, restart using the previous image tag if you know it:

```bash
docker stop frigate
docker run ... ghcr.io/blakeblackshear/frigate:0.14.1
```

Use the exact `docker run` command or Portainer stack definition you originally deployed with, changing only the image tag. If you're not sure what changed, restoring from a configuration backup is safer than guessing.

---

## Step 4 — Restart the container

Once you've identified and fixed the underlying issue, restart the container.

### From the command line

```bash
docker restart frigate
```

Replace `frigate` with `caddy` or `portainer` as needed.

To stop and start separately:

```bash
docker stop frigate
docker start frigate
```

### From Portainer

Click the container name, then click **Restart**. If the container is stopped, click **Start** instead.

### Verify it stayed up

Wait thirty seconds, then confirm the container is still running:

```bash
docker ps
```

If the status shows **Restarting** or **Exited** again, go back to the logs. The fix didn't hold and there's another error to address.

### Restart order when multiple containers are down

If more than one container failed at the same time, bring them up in this order:

1. **Frigate** and **Portainer** first
2. **Caddy** last

Caddy depends on Frigate and Portainer being reachable on `nvr-network`. Starting Caddy before they're up produces temporary errors in the Caddy logs even if nothing is permanently wrong.

---

## Step 5 — When a restart isn't enough

Sometimes a container needs to be removed and recreated rather than restarted. This applies when:

- You changed the `docker run` command flags (port mappings, volume mounts, network settings)
- The container was created without `--add-host host.docker.internal:host-gateway` and Caddy can't reach Cockpit
- The container definition is corrupted or was partially deleted

**Important:** Removing a container does not delete named volumes by default. Your Caddy certificates (`caddy-data`, `caddy-config`) and Frigate recordings stored in mounted directories are safe as long as you don't delete the volumes themselves.

Remove and recreate (example for Caddy):

```bash
docker stop caddy
docker rm caddy
```

Then run the full `docker run` command from the [Caddy guide](../network/caddy-reverse-proxy.md). Do not run `docker volume rm` unless you intentionally want to wipe stored data.

In Portainer, the equivalent is **Recreate** on a container. Read the confirmation dialog carefully. Portainer usually preserves volumes, but verify the options before confirming.

---

## If Docker itself isn't running

If `docker ps` returns an error like "Cannot connect to the Docker daemon", Docker isn't running on the host.

Check the service status:

```bash
sudo systemctl status docker
```

Start it if it's stopped:

```bash
sudo systemctl start docker
```

If Docker fails to start, check system logs:

```bash
sudo journalctl -u docker --tail 50
```

Disk space issues and corrupted Docker state can prevent the daemon from starting. Address any errors shown in the journal output before trying again.

---

## Cockpit isn't running

Cockpit is not a Docker container. It runs as a system service on the NVR host.

Check its status:

```bash
sudo systemctl status cockpit
```

Start it if it's stopped:

```bash
sudo systemctl start cockpit
```

Enable it to start on boot:

```bash
sudo systemctl enable --now cockpit.socket
```

If Cockpit is running but Caddy can't reach it, the issue is usually on the Caddy side. Confirm the Caddy container was created with `--add-host host.docker.internal:host-gateway`. See [Can't reach a service by hostname](hostname.md#caddy-isnt-routing-correctly).

---

## Quick reference

| Symptom | First check | Likely fix |
|---|---|---|
| Container shows **Exited** | `docker logs <name> --tail 50` | Fix config error, restart |
| Container shows **Restarting** | Logs from the most recent crash | Config syntax, missing volume, out of disk |
| Caddy log: `lookup frigate: no such host` | `docker network inspect nvr-network` | Connect container to network, restart Caddy |
| `bind: address already in use` | `sudo ss -tlnp \| grep :<port>` | Stop duplicate container |
| `no space left on device` | `df -h` | Free disk space, adjust retention |
| `docker ps` fails entirely | `sudo systemctl status docker` | Start Docker service |
| Cockpit unreachable | `sudo systemctl status cockpit` | Start Cockpit service |
| Worked until an update | Logs after the update | Roll back image tag or fix new config requirement |

---

## Where to go from here

Once your containers are running again, confirm your services are reachable:

- [Can't reach a service by hostname](hostname.md), if URLs still won't load after containers are up
- [Configuring Caddy as a reverse proxy](../network/caddy-reverse-proxy.md), if you had to recreate the Caddy container
- [Camera feed not showing in Frigate](camera-feed.md), if Frigate is up but cameras won't connect

**Maintenance guides**

- [Backing up your Frigate configuration](../maintenance/backup.md)
- [Updating via Portainer](../maintenance/portainer-updates.md)
- [General Linux troubleshooting resources](linux-resources.md)

**If you're still stuck**

Copy the last thirty to fifty lines of the container log and search for the specific error message. The Frigate, Caddy, and Portainer project documentation and community forums are good next steps for errors that aren't covered here.

---

## LAN Foundry customer support

The guides on this site are free for everyone, whether you bought hardware from us or not. If you've worked through this guide and your container still won't stay running, there are a few more places to go depending on your situation.

**If you're running your own hardware**

Community forums for Frigate, Caddy, and Docker are your best bet for issues specific to a custom setup we didn't ship. Bring the log output from [Step 2](#step-2-read-the-logs) when you ask for help.

**If you purchased an Argus system from LAN Foundry**

Your system was validated before it shipped, so a container that won't start is usually something we can help you work through quickly. Visit [lanfoundry.com/support](https://lanfoundry.com/support) for support options and how to submit a ticket.

When you open a support request, include:

- The container name (`frigate`, `caddy`, or `portainer`)
- What you were doing when it failed
- The last thirty to fifty lines from the container log
- Any configuration file you changed recently, if applicable

The more context you provide, the faster we can pinpoint the issue. If your system is still within its warranty period, check your purchase documentation for what coverage applies.
