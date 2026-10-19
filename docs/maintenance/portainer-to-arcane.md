# Moving from Portainer to Arcane

If you built your own NVR with Portainer as the container manager, this guide moves it over to Arcane, the container manager the LAN Foundry stack uses. Your containers, volumes, recordings, and configuration files stay where they are. What changes is which tool deploys and manages them.

Portainer is discontinuing its free Community Edition, so this is worth doing before you depend on it for updates.

Argus systems ship with Arcane already in place. This guide is for systems you set up yourself.

---

## Before you start

This guide assumes:

- You can SSH into the NVR and run `docker` commands with `sudo` or as a member of the `docker` group
- Your services (Frigate, Caddy, ntfy, and so on) are deployed as Portainer **stacks**, or as individual containers you know the settings for
- You're using Caddy and local DNS as described in the [Caddy reverse proxy guide](../network/caddy-reverse-proxy.md) and the [OPNsense DNS guide](../network/dns-opnsense.md). If you aren't, skip the Caddy and DNS steps.

Plan for a short outage per service while you move it. Recording stops while Frigate is down.

**Back up first.** See [Backing up your Frigate configuration](backup.md).

---

## How the move works

Portainer keeps each stack's compose file inside its own data volume. Arcane works from plain folders on disk instead: every folder under its **projects directory** with a compose file in it is a project. Arcane scans that directory and lists any projects it finds, including ones you created by hand.

So the move is:

1. Copy each Portainer stack's compose file into its own folder under `/opt/lanfoundry/stacks/`.
2. Start Arcane pointed at that folder.
3. Stop each service in Portainer and start it again from Arcane.
4. Point Caddy and DNS at Arcane, then remove Portainer.

Volumes and bind mounts aren't touched at any step, so data carries over.

---

## Step 1 — Copy your stacks out of Portainer

For each stack in Portainer:

1. Go to **Stacks** and click the stack name.
2. Open the **Editor** tab and copy the full compose file.
3. Note any **Environment variables** set on the stack in Portainer. These are stored separately from the compose file.

On the NVR, create a folder per stack and save the compose file there:

```bash
sudo mkdir -p /opt/lanfoundry/stacks/frigate
sudo nano /opt/lanfoundry/stacks/frigate/compose.yaml
```

If the stack had environment variables in Portainer, put them in a `.env` file in the same folder:

```bash
sudo nano /opt/lanfoundry/stacks/frigate/.env
```

Repeat for every stack. Use the stack name as the folder name, since Arcane names each project after its folder.

??? tip "Pulling the files straight from Portainer's volume"
    If you have many stacks, Portainer's copies live on the host inside its data volume, one numbered folder per stack:

    ```bash
    sudo ls /var/lib/docker/volumes/portainer_data/_data/compose/
    ```

    Each numbered folder holds that stack's `docker-compose.yml`. The numbers don't tell you which stack is which, so open each file to check before copying it.

**Check relative paths.** Portainer runs compose from inside its own data folder, so a bind mount like `./config:/config` in a Portainer stack points somewhere inside Portainer's volume. Replace relative paths with the absolute host paths your data actually lives at (for example `/opt/lanfoundry/config/frigate:/config`). If you're unsure where a mount points, check the running container:

```bash
docker inspect frigate --format '{{ range .Mounts }}{{ .Source }} -> {{ .Destination }}{{ "\n" }}{{ end }}'
```

If you ran any containers with `docker run` instead of a stack, write a compose file for each one using the same image, ports, volumes, and network settings. Portainer's container detail page shows the current settings.

---

## Step 2 — Deploy Arcane

Arcane runs alongside Portainer during the move, on its own port (3552), so nothing conflicts.

Generate an encryption key and keep a copy of it with your backups:

```bash
openssl rand -hex 32
```

Create Arcane's own project folder:

```bash
sudo mkdir -p /opt/lanfoundry/stacks/arcane
sudo nano /opt/lanfoundry/stacks/arcane/compose.yaml
```

Paste the compose service from [About the stack](../about-the-stack.md#arcane-container-management), with your key in place of the `ENCRYPTION_KEY` placeholder. If your `nvr-network` doesn't exist yet, create it with `docker network create nvr-network` first. If your Portainer setup used a different network name, use that name instead.

Start it:

```bash
cd /opt/lanfoundry/stacks/arcane
docker compose up -d
```

Browse to `http://<NVR IP>:3552` and sign in with username `arcane` and password `arcane-admin`. Arcane asks you to set a new password right away.

Go to **Projects**. Each folder you created in Step 1 should be listed. If one is missing, check that its compose file is named `compose.yaml` (or `docker-compose.yml`) and sits directly in its folder.

---

## Step 3 — Move each service over

Move one service at a time and confirm it works before going on. Leave Caddy for last so you can keep reaching the other services by hostname while you work.

For each stack:

1. In Portainer, open the stack and click **Stop this stack**.
2. In Arcane, open the matching project under **Projects** and click **Up**.
3. Confirm the containers show as running and the service works in your browser.

If **Up** fails with an error that a container name is already in use, Portainer left the stopped container behind. Remove it and try again:

```bash
docker rm frigate
```

`docker rm` removes the container only. Named volumes and bind-mounted folders stay in place. Don't add `-v` and don't run `docker volume rm`.

After Frigate moves, check that live view, recordings, and the event timeline all look normal before going on.

---

## Step 4 — Point Caddy and DNS at Arcane

In your Caddyfile, replace the Portainer site block with:

```caddy
arcane.internal {
  tls internal
  reverse_proxy arcane.nvr-network:3552
}
```

Arcane serves plain HTTP on its backend, so it doesn't need the `tls_insecure_skip_verify` transport block Portainer used.

Then restart Caddy:

```bash
docker restart caddy
```

In OPNsense, edit the Portainer host override under **Services**, then **Unbound DNS**, then **Overrides**: change **Host** to `arcane` and the description to `Arcane via Caddy`. Save and apply. If you use a different DNS server or a hosts file, make the same change there.

Browse to `https://arcane.internal` to confirm.

---

## Step 5 — Remove Portainer

Once every service is running from Arcane and you've been able to reach them all for a day or so, remove Portainer:

```bash
docker rm -f portainer
```

Its data volume still holds the original stack files. Keep it until you're confident you don't need them, then remove it:

```bash
docker volume rm portainer_data
```

---

## Where to go from here

- [Updating containers](container-updates.md), for pulling new images through Arcane
- [Backing up your Frigate configuration](backup.md), to add `/opt/lanfoundry/stacks/` and Arcane's encryption key to your backups
- [What to do when a container won't start](../troubleshooting/container.md), if a service doesn't come back up under Arcane
- [About the stack](../about-the-stack.md), for why the stack uses Arcane and the other options considered
