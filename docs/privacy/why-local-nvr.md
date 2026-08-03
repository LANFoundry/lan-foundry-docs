# Why a local security camera system?
 
If you've landed here, you're probably asking some version of the same question: *is there a way to have security cameras without handing my footage to a company I don't fully trust?*
 
The short answer is yes. The longer answer is what this guide is about.
 
---
 
## What's wrong with the current market
 
Most home security cameras on the market today, including Ring, Nest, Arlo, and Wyze, share a common business model. You buy the hardware at a relatively low price, and in exchange, your footage is routed through the company's servers, stored in their cloud, and accessed through their app. To actually review recordings older than a day or two, you typically need a monthly subscription.
 
This isn't an accident. The subscription and the data are the product.
 
The consequences of this model have shown up in real ways. In 2023, Amazon's Ring paid a $5.8 million FTC settlement after employees and contractors were found to have accessed private customer videos without authorization. In early 2024, Wyze exposed footage from customers' cameras to other users, the second time that had happened in six months, affecting roughly 13,000 people. These aren't isolated incidents. They're the predictable result of a system where your footage lives on someone else's infrastructure.
 
---
 
## What a local security camera system actually is
 
A local security camera system works differently. Instead of sending your footage to a company's servers, everything stays on a device in your home or business, a small computer called a Network Video Recorder, or NVR for short.
 
Think of the NVR as the brain of your camera system. Your cameras connect to your home network and stream video directly to it. The NVR handles recording, storage, motion detection, and alerts, all without touching the internet. Your footage is written to hard drives that you own and physically control.
 
That's the core idea. No footage leaves your network unless you explicitly make it happen. No company has access to your recordings. No subscription required to watch last Tuesday's footage.
 
---
 
## Why it matters
 
**Your footage is yours** - Not stored on a server you don't control, not subject to a company's privacy policy changes, not accessible to employees or contractors you've never heard of. If you want to review footage from six months ago, you can, because it's sitting on your own drives.
 
**No subscription** - You pay for the hardware once. There's no monthly fee to access your own recordings, no tier that unlocks features you already paid for, and no price increase next year.
 
**No single point of failure in the cloud** - Cloud services go down. Companies get acquired, change their policies, or shut down entirely. A local system keeps working regardless of what happens to any external company.
 
**You control what leaves your network** - A well-configured local NVR can be set up so that camera traffic never reaches the internet at all, not even to phone home to the manufacturer. That's a level of privacy that no cloud-based system can offer by design.
 
---
 
## The honest tradeoffs
 
Local NVR isn't the right fit for everyone, and we'd rather tell you that upfront than have you buy something that doesn't match your needs.
 
**Setup takes more effort than a plug-and-play camera** - Even with a pre-configured system like a LAN Foundry appliance, you'll need to connect hardware, assign your cameras to the right network, and spend some time with initial configuration. It's not difficult, but it's not instant either.
 
**The app experience is different** - You won't have a slick consumer app built by a team of hundreds. You'll have a capable, open-source interface that does everything you need, but it looks like software built by engineers rather than a consumer product team. Most people get comfortable with it quickly, but it's worth knowing going in.
 
**Remote access requires a little more thought** - Accessing your footage from outside your home is absolutely possible, but it requires setting up a secure remote access method rather than just logging into an app. We have guides for this, and it's straightforward once you've done it, but it's an extra step.
 
**You're responsible for your own hardware** - If a drive fails, you replace it. A good local NVR uses RAID storage so a single drive failure doesn't mean lost footage, but you're the one managing the system, not a support team at a camera company.
 
---
 
## Is it right for you?
 
Local NVR tends to be a great fit if you:
 
- Care about who has access to your footage
- Are tired of subscription fees for something you already paid for
- Want a system you actually own and control
- Are comfortable spending an afternoon on initial setup
- Have a standard home router or are willing to eventually upgrade to one with VLAN support. A consumer router is a fine starting point. See [How much does your router matter?](privacy-levels.md) for what the options look like.
It's probably not the right fit if you want something that works completely out of the box with zero configuration, or if you're comfortable with a cloud subscription and don't have strong feelings about where your footage lives.
 
If you're in the first camp, you're in the right place.
 
---
 
## Where to go from here
 
If you want to understand the technology a little better before diving in, the [What is ONVIF?](what-is-onvif.md) guide explains how cameras talk to recorders and why compatibility matters.
 
If you're ready to see what a complete local NVR system looks like out of the box, the [Argus product line](https://lanfoundry.com/products) is where we started, pre-configured, tested, and built around everything described on this page.
 
And if you want to build your own, everything in this documentation library is free and available to anyone. That's not a marketing line. It's the whole point.

