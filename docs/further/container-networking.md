# Running your own containers safely

If you've added a service from [Hardware potential](hardware-potential.md), or you're running something entirely your own, there's a step worth taking before you deploy it: deciding whether it actually needs to be reachable from your LAN at all.

---

## The problem with the default

Docker's `ports:` line publishes a container to every device that can reach the NVR host, not just the other containers running on it. For a DNS server like AdGuard Home, that's the point. Every device on your LAN needs to reach port 53. But plenty of containers only ever need to talk to one other container on the same host. A backend API that only your own frontend calls doesn't need to answer to anything on your LAN, let alone the wider internet.

Publishing a port you don't need is a small, easy-to-miss way to widen your attack surface. It's also easy to fix.

---

## The pattern: a private network with its own DNS

Docker's answer to this predates every tool in this stack: a user-defined bridge network gives each container on it a DNS name equal to its `container_name`. Any container on that same network can reach another one by name, on whatever port it listens on internally, without either container publishing anything to the host.

Argus already uses this. Dozzle, the log viewer in your stack, has no published ports at all:

```yaml
services:
  dozzle:
    container_name: dozzle
    image: amir20/dozzle:latest
    restart: unless-stopped
    networks:
      - nvr-network
    environment:
      DOZZLE_NO_ANALYTICS: "true"
      DOZZLE_USERNAME: admin
      DOZZLE_PASSWORD: "change-me"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

No `ports:` key. Dozzle is reachable at `http://dozzle:8080` from Caddy, because both containers share the `nvr-network`, and from nothing else. Not your LAN, not the camera VLAN, nothing outside the Docker network. `https://dozzle.internal` works because Caddy is doing the reaching, not because Dozzle is exposed.

---

## Two variants

### Caddy-fronted, internal only

For anything a person needs to open in a browser, follow Dozzle's pattern:

1. Join the existing `nvr-network` (it's external and already running on every Argus install).
2. Don't add a `ports:` line.
3. Add a hostname entry to the Caddyfile, the same way the [Caddy reverse proxy guide](../network/caddy-reverse-proxy.md) sets one up for the built-in services:

```caddyfile
myapp.internal {
  tls internal
  reverse_proxy myapp:8080
}
```

Restart Caddy and the new hostname is live, with the container itself still invisible to everything except Caddy.

### Fully internal, no browser access

For containers that only talk to each other, not to Caddy, not to Frigate, not to anyone with a browser, a dedicated network is a better fit than `nvr-network`. Here's a real example: two backend APIs for a 3D printer slicer, where only each other's traffic matters.

```yaml
services:
  orca-slicer-api:
    image: ghcr.io/maziggy/orca-slicer-api:latest
    container_name: orca-slicer-api
    restart: on-failure:5
    networks:
      - myapp_internal
    volumes:
      - /path/to/data:/app/data:rw

  bambu-studio-api:
    image: ghcr.io/maziggy/bambu-studio-api:latest
    container_name: bambu-studio-api
    restart: on-failure:5
    networks:
      - myapp_internal
    volumes:
      - /path/to/data:/app/data:rw

networks:
  myapp_internal:
    name: myapp_internal
```

Neither service publishes a port. Neither joins `nvr-network`. They can reach each other by container name because they share `myapp_internal`, and nothing else on the host, or the LAN, can reach either one.

---

## Step-by-step: adding a new container

1. Add the service block to your compose file, either directly in Portainer's stack editor or on disk under `/opt/lanfoundry/stacks/`.
2. Decide which variant it needs. Join `nvr-network` only if it genuinely needs to reach Frigate, Caddy, or another service already on it. Otherwise, give it its own dedicated network.
3. Skip `ports:` entirely unless something outside the Docker host, another device on your LAN, or a remote client over Tailscale, genuinely needs to reach it directly.
4. If it needs a browser hostname, add the Caddy entry and restart the `caddy` container.
5. Redeploy the stack from Portainer.

---

## A note on trust, not just exposure

Keeping a container off your LAN isn't the same as trusting it. Any container joined to `nvr-network` can still attempt to reach Frigate, Caddy, or anything else on that network, whether or not those services expect that traffic. Only join `nvr-network` if a container actually needs to talk to what's already on it. For everything else, a separate dedicated network like the example above keeps it isolated from Frigate and your recordings entirely, not just from the outside world.

This is a second layer, not a replacement for the camera VLAN segmentation covered in [Blocking cloud telemetry](../privacy/blocking-telemetry.md). VLANs isolate devices on your physical network from each other. Docker's internal networking isolates containers on the same host from each other. Both matter, and neither substitutes for the other.

---

## Where to go from here

- [Hardware potential](hardware-potential.md), for what else the NVR hardware has room to run
- [Caddy reverse proxy](../network/caddy-reverse-proxy.md), for how hostname routing works in more depth
- [Blocking cloud telemetry](../privacy/blocking-telemetry.md), for the VLAN-level segmentation this pattern complements
