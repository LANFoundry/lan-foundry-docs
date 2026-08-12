# LAN Foundry Docs

LAN Foundry is a **systems integrator for locally hosted networking and storage** — infrastructure you own and control, not capacity you rent from someone else's cloud. **Argus**, our local NVR for security cameras, is the first product we are shipping; it is a focused starting point, not the limit of what we build.

This site documents that stack: network segmentation, Frigate, ZFS storage, maintenance, and troubleshooting. Everything here is **free to read and use**, whether you bought Argus from us or run your own hardware.

!!! tip "Not sure what an acronym means?"
    Terms like NVR, VLAN, and ONVIF are underlined with dots throughout these guides. Tap or hover on one for a quick definition, no need to leave the page to look it up.

---

## Why we publish

Cloud camera vendors ship glossy apps. Self-hosting communities answer questions in threads that assume you already run Linux for fun. Neither explains how VLANs, local storage, or container recovery actually work in a home or small-business network.

These guides try to fill that gap in plain language.

- **Your data stays yours.** Network isolation, local recording, and telemetry blocking should be normal steps, not expert-only hardening.
- **Honest beats hype.** Local systems have real tradeoffs (setup time, remote access, drive maintenance). We say so upfront. See [Why a local security camera system?](privacy/why-local-nvr.md) for the surveillance-specific case.
- **Help should not be gated.** You should not need a support contract to learn how a VLAN rule works. Argus customers get direct support when they need it; everyone else gets the same guides and paths to community resources.
- **Plain language matters.** When CLI is the right tool (ZFS pool health, for example), we show the commands and explain what they mean.

This library is designed to stand on its own as well as support our product line. Many readers will never buy from us, and that's ok. These guides are still worth publishing.

---

## How the library grows

| Phase | What you will find |
|---|---|
| **Now** | General guides for any local Frigate setup: privacy, network, cameras, storage, maintenance, troubleshooting. No LAN Foundry hardware required. Some pages are **living documents** (for example the [tested camera list](cameras/tested-cameras.md)). |
| **At Argus launch** | Product **Getting started** guides: unboxing, first boot, Cockpit and Portainer orientation, Tailscale on the Argus workflow. Until then, Argus owners can follow the general guides; they match how we configure systems before they leave the shop. |
| **After launch** | Updates as the stack changes, troubleshooting expanded from real support patterns, and new sections when we ship additional locally hosted products beyond our Argus line of NVRs. |

Guides still being written show a **Coming soon** notice. Search and each section **Overview** reflect what is published today.

---

## What is in the library

Use the tabs above to browse by topic. Each section opens with a short **Overview** that lists every guide and what it is for.

| Section | What it covers |
|---|---|
| [The software stack](about-the-stack.md) | What runs on Argus, why each piece was chosen, and alternatives |
| [Privacy & Security](privacy/index.md) | Why local recording matters, ONVIF basics, VLAN concepts |
| [Network Setup](network/index.md) | Camera VLANs, DNS, Caddy hostnames, static IPs, Tailscale |
| [Camera Setup](cameras/index.md) | Adding cameras to Frigate, zones, detection tuning |
| [Notifications](notifications/index.md) | ntfy push alerts from Frigate |
| [Storage](storage/index.md) | How recordings are stored, retention, drive health, expansion |
| [Maintenance](maintenance/index.md) | Config backup, updates, restore |
| [Troubleshooting](troubleshooting/index.md) | Symptom-based fixes when something breaks |
| [Going Further](further/index.md) | Home Assistant, hardware potential, community links |

---

## Where to start

Pick the path that matches where you are:

**New to local NVR and want the "why" first**

Start with [Why a local security camera system?](privacy/why-local-nvr.md), then [Understanding network segmentation and VLANs](privacy/blocking-telemetry.md).

**Starting with an existing home router**

You don't need to replace your router to get started. Read [How much does your router matter?](privacy/privacy-levels.md) to understand what you gain right away and what full camera isolation requires.

**Setting up a network for cameras**

Open the [Network Setup overview](network/index.md). Typical order: camera VLAN on the router, VLAN on the switch, static IP for the NVR, DNS entries, then Caddy for hostnames like `frigate.internal`.

**Adding cameras to Frigate**

[Adding your first camera to Frigate](cameras/first-camera.md) walks through RTSP URLs and `config.yml` on your network.

**Running an Argus NVR from LAN Foundry**

Follow the network and camera guides above; they reflect how Argus is configured. Product-specific getting started guides will appear at launch. Hardware details: [Argus product line](https://lanfoundry.com/products).

**Something broke**

Open the [Troubleshooting overview](troubleshooting/index.md) and choose the guide that matches your symptom.

**Building beyond cameras**

See [Going Further](further/index.md) for Home Assistant integration and community resources.

---

## DIY hardware vs Argus

| | **DIY / own hardware** | **Argus from LAN Foundry** |
|---|---|---|
| **These guides** | Fully applicable; you handle initial camera and OS setup | Applicable for day-two config, network changes, and troubleshooting |
| **Support** | Community forums and project docs (linked from troubleshooting guides) | [lanfoundry.com/support](https://lanfoundry.com/support) when guides are not enough |
| **Defaults** | You choose cameras, drives, and network gear | Cameras, ZFS pool, and stack are pre-configured; welcome materials cover passwords and stream URLs |

Same documentation, different starting point.

---

## Getting help

**Technical problem** (drive errors, camera offline, container crash): start with the [Troubleshooting](troubleshooting/index.md) guides. Argus customers can then reach [LAN Foundry support](https://lanfoundry.com/support) with logs and config context. The guides are the first line of help but if you are still stuck, LAN Foundry support is ready to help our customers.

**Documentation problem** (wrong step, outdated info, broken link): use the **Was this page helpful?** block at the bottom of any page.

- **Form on the page** — No account needed. Sends email through Formspree with the page title and URL included.
- **[GitHub issue](https://github.com/lanfoundry/lan-foundry-docs/issues/new)** — Linked in the same block if you prefer a public issue on the docs repo.


---
