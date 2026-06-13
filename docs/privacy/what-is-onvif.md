# What is ONVIF?

If you've been researching local security cameras, you've probably seen the word ONVIF on product listings and compatibility charts without a clear explanation of what it actually means. This guide fixes that.

---

## The problem ONVIF solves

Before ONVIF existed, security cameras and recording systems were largely proprietary. A camera from one manufacturer would only work reliably with that same manufacturer's recorder. If you wanted to mix brands, you were often out of luck, or stuck writing custom integrations that broke every time someone pushed a firmware update.

This was good for manufacturers and bad for everyone else. It locked customers into ecosystems, made upgrades painful, and gave you no flexibility if a product line was discontinued or a company was acquired.

ONVIF was created to solve that problem.

---

## What ONVIF actually is

ONVIF stands for Open Network Video Interface Forum. It's an industry standards organization founded in 2008 by Axis, Bosch, and Sony, and it defines a common language that security cameras and recording systems use to talk to each other.

Think of it like a universal power adapter. Different countries have different outlet shapes, but a universal adapter lets you plug anything into anything. ONVIF does the same thing for security cameras — it defines a standard set of commands so that a camera from one manufacturer can connect to a recorder from a completely different manufacturer, and they can communicate reliably.

When a camera is ONVIF compliant, it means it speaks that standard language. When a recorder is ONVIF compliant, it means it can understand any camera that speaks that same language.

---

## What it means for you practically

If your camera supports ONVIF and your NVR supports ONVIF, they will work together. Full stop.

This has real consequences for how you build and maintain your system:

**You are not locked into a camera brand.** You can start with Amcrest cameras today and add Reolink or Hikvision cameras later. As long as they're ONVIF compliant, your NVR doesn't care who made them.

**You can replace cameras without replacing your whole system.** If a camera model gets discontinued, a better option comes out, or you just want to upgrade one camera, you can do that without touching the rest of your setup.

**You're not paying per-camera licensing fees.** Proprietary systems often charge you to add each new camera to their software. ONVIF-based systems don't have that concept. A camera is a camera.

---

## The honest caveat

ONVIF compliance is not all or nothing. The standard has multiple profiles covering different feature sets, and manufacturers implement them with varying levels of quality.

Profile S is the most common and covers basic video streaming, which is what most people need. Profile T adds support for H.265 video and some advanced features. Profile G covers storage on the camera itself.

In practice this means that while two ONVIF cameras will both connect to your NVR, one might expose more configuration options than the other. A camera with solid ONVIF implementation will let you control PTZ movement, adjust stream settings, and configure motion detection directly from your NVR interface. A camera with a minimal implementation might only stream video and nothing else.

This is why a tested compatibility list matters more than just checking the ONVIF logo on a box. We maintain a list of cameras we have personally verified with our software stack in the [tested camera list](tested-cameras.md).

---

## What to look for when buying a camera

When evaluating a camera for use with a local NVR, look for:

- ONVIF Profile S support at minimum
- An accessible RTSP stream URL — this is how your NVR actually pulls the video feed
- The ability to disable cloud features and phone-home behavior in the camera's settings
- A reputable manufacturer with a track record of firmware updates

Cameras that push you toward a proprietary app and make it difficult to access the RTSP stream are worth avoiding, even if they technically claim ONVIF support.

---

## Where to go from here

If you're ready to start adding cameras to your system, the [adding your first camera](../cameras/first-camera.md) guide walks through the full process of connecting an ONVIF camera to Frigate.

If you want to see which specific cameras we've tested and recommend, the [tested camera list](tested-cameras.md) is the place to start.
