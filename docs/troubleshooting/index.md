---
hide_feedback: true
---

# Troubleshooting

Symptom-based guides when something stops working on the NVR, the network, or a camera feed.

Pick the guide that matches what you see. Each page opens with context and steps; use **General Linux resources** when the problem is broader than one symptom.

!!! note "On Enclave?"
    [Enclave](../network/enclave-tier.md) has no network-based way to reach the NVR, so **Can't reach service by hostname** and **Not receiving notifications** don't apply to that tier. The other guides do, with one change: run their commands from a terminal on the attached monitor (`Ctrl+Alt+T` over the kiosk view, or `Ctrl+Alt+F2` for a separate console) instead of over SSH.

- **[Camera feed not showing](camera-feed.md)** — Blank tiles, RTSP errors, credentials, and network path to the camera.
- **[Can't reach service by hostname](hostname.md)** — `frigate.internal` or other hostnames that will not load.
- **[Not receiving notifications](notifications.md)** — Alerts that never arrive on your phone or in ntfy.
- **[NVR slow or dropping frames](performance.md)** — Stuttering live view, laggy detection, or overload at tier limits.
- **[Drive and pool errors](drive-errors.md)** — Full pool, ZFS faults, S.M.A.R.T. warnings, and recording gaps.
- **[Container issues](container.md)** — Frigate, Caddy, Arcane, or other containers that crash or refuse to start.
- **[General Linux resources](linux-resources.md)** — CLI tools, logs, and where to look when no single guide fits.
