---
name: LAN Foundry Docs
description: A plain-spoken technical reference for local NVR and network self-hosting, styled like a site documentation binder with one copper accent.
colors:
  ink: "#14191F"
  paper: "#F7F9FB"
  slate: "#313942"
  line: "#E2E5E8"
  copper: "#AF5916"
  copper-bright: "#EA7D2E"
  error: "#D64545"
typography:
  body:
    fontFamily: "IBM Plex Sans, sans-serif"
  small:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "0.85rem"
  label:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.75rem"
    letterSpacing: "0.03em"
    textTransform: "uppercase"
  tooltip:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "0.72rem"
  icon:
    fontSize: "1.2rem"
    fontWeight: 700
rounded:
  sm: "6px"
components:
  button-primary:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1.25rem"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.4rem"
  toast:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.9rem 1.25rem"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.tooltip}"
    padding: "0.5rem 0.7rem"
---

# Design System: LAN Foundry Docs

## Overview

**Creative North Star: "The Site Documentation Binder"**

This is a technician's on-site reference, not a marketing surface: a binder of installer manuals, wiring diagrams, and CLI command sheets, built to be scanned under real work conditions rather than admired. The palette is almost entirely achromatic — Ink, Slate, Line, and Paper carry every layout — with exactly one accent, Molten Copper, playing the part of a live-wire marker: the one thing in the binder that's meant to grab your eye because it's actually current or actionable (a link, an active tab, the one button that submits). Everything else stays quiet on purpose. IBM Plex Sans reads like the manual's body text; IBM Plex Mono, tracked out, reads like the label-maker tape on its tabs and headers.

The system does not distinguish "chrome" from "content" the way a product UI does — the header, tabs, nav, and footer wear the page's own colors in both schemes (Paper chrome on a Paper page in light, Ink on Ink in dark), with the logo swapping to its matching variant per scheme. The one deliberately inverted surface is the glossary tooltip, which flips to the opposite pair so it reads as a note held over the page. Nothing here asks to look designed; it asks to be trusted and gotten out of the way of.

**Key Characteristics:**
- One accent color, used sparingly, everywhere else achromatic.
- Flat by default — shadows only on the two surfaces that float over the page (the toast, and Material's glossary tooltip).
- Plex Mono, uppercase and tracked out, marks UI chrome and labels; Plex Sans carries everything meant to be read at length.
- Light and dark schemes are exact inversions of each other, never independently designed.

## Colors

Four neutrals plus one accent; nothing else. The neutrals are shared across both color schemes, just swapped in role.

### Primary
- **Molten Copper** (`#AF5916` light scheme / `#EA7D2E` dark scheme): The only accent in the system. Used for links, the active nav/tab indicator, mark/highlight, and the one primary action (feedback submit button). Deeper and more saturated on Paper, brighter on Ink, so it reads as equally "live" in both schemes rather than washing out on dark.

### Neutral
- **Ink** (`#14191F`): Primary dark neutral. Page and chrome text in light scheme; page and chrome background in dark scheme; tooltip background in light scheme.
- **Paper** (`#F7F9FB`): Primary light neutral. Page and chrome background in light scheme; page and chrome text in dark scheme; tooltip background in dark scheme.
- **Slate** (`#313942`): Secondary neutral. Secondary text in light scheme (`--md-default-fg-color--light`), including the footer meta and its "Made with" line; code-block background and border/divider color in dark scheme.
- **Line** (`#E2E5E8`): Divider/border neutral. Borders, the footer meta strip, and code-block background in light scheme; secondary text in dark scheme, where it sits on Ink.

### Named Rules
**The One Accent Rule.** Copper is the only chromatic color anywhere in the system. Do not introduce a second accent hue; if something needs to stand out further, use copper more assertively (weight, size, position), not a new color.

**The Scheme-Swap Rule.** Ink and Paper swap together between schemes. Light scheme is Ink on Paper for both the page and the chrome; dark scheme is Paper on Ink for both. An intentionally inverted surface (today, only the tooltip) cross-wires the same pair rather than introducing a new color. Any new element follows the swap; never pick one scheme's pairing and hold it fixed.

**The Line-Is-Not-Text Rule.** On Paper, Line (`#E2E5E8`) reaches only about 1.2:1, so in the light scheme it's for borders, strips, and fills, never for text. Secondary text in light scheme is Slate. (Open issue: Material's `--md-default-fg-color--lighter` is still Line in the light scheme, and a few stock Material elements use it for text.)

**The AA Floor Rule.** Light-scheme copper (`#AF5916`) is deliberately darker than the Brand Guidelines' base swatch (`#DC701C`, 3.12:1 against Paper — fails WCAG AA's 4.5:1 text floor). `#AF5916` keeps the same hue and saturation, just less light (HSL lightness 38.6% vs. 48.6%), and clears AA at 4.67:1. Don't brighten it back toward the base swatch without pairing the change with a genuinely darker Paper or a non-text-only use — text contrast is the constraint, not brand-guide literalism.

## Typography

**Body Font:** IBM Plex Sans (with system sans-serif fallback)
**Label/Mono Font:** IBM Plex Mono (with system monospace fallback)

**Character:** A working manual, not an editorial voice — Plex Sans is legible and unadorned for long troubleshooting prose; Plex Mono, always uppercase and tracked out (`letter-spacing: 0.03em`) when used for chrome, reads as stamped labels rather than running text.

### Hierarchy
- **Body** (Plex Sans): All page prose, admonitions, tables — the vast majority of the system's typography.
- **Small** (Plex Sans, `--lf-text-sm`, 0.85rem): Secondary/supporting body text below the default reading size — the feedback form's intro copy, its field labels and input text, and the toast body. A single shared token (`docs/stylesheets/brand.css`) rather than a repeated literal.
- **Label** (Plex Mono, uppercase in chrome, 0.03em tracking): Header topic, nav title, tab links, and footer meta. The feedback panel's heading uses the same face at 0.75rem, uppercase, with wider 0.08em tracking. Never used for body prose.
- **Code** (Plex Mono, untracked): Inline code and code blocks, set at normal case and spacing since it's showing literal commands, not acting as UI chrome.
- **Tooltip** (Plex Sans, 0.72rem, `0.5rem 0.7rem` padding): Abbreviation and footnote tooltips only. Deliberately smaller than Small so a definition reads as a margin note over the text rather than competing with it. Sans, not Mono: it's a sentence, not a label.
- **Icon** (`--lf-icon-size`, 1.2rem, 700 weight): Glyph-sized UI symbols — currently just the tab-scroll chevrons (`‹`/`›`). Not a text-reading size; reserved for single-character directional/status glyphs, not prose.

### Named Rules
**The Label vs. Body Rule.** Plex Mono only appears tracked-out and uppercase when it's acting as UI chrome (nav, tabs, labels). The same face untracked and mixed-case is a code sample, not a label — don't blur the two.

## Layout

Single-column reading layout inherited from Material's content template, widened by the tabs-based top navigation (`navigation.tabs`, sticky) rather than a persistent side rail for top-level sections — the binder's "tab dividers" metaphor. Section-level pages still use a left nav rail once inside a tab. Material shows the tabs bar only on wide viewports (from 76.25em, about 1220px); below that, top-level sections move into Material's drawer. Where the tabs bar does show, it's treated as content that can genuinely overflow: it has no visible native scrollbar, so custom fade/chevron cues (Molten Copper chevrons over a gradient matching the current chrome color) appear on whichever side still has more to scroll, driven by real scroll position rather than a static hint.

Component spacing stays loose and unscaled beyond a handful of repeated values (`0.75rem`–`1.5rem` margins/padding on the feedback form, `24px` toast offset from the viewport edge); there's no formal spacing token scale yet — new components should stay within that same loose 0.25rem–1.5rem range rather than inventing a denser or airier rhythm.

## Elevation & Depth

Flat by default. Borders (1px, Line-colored) and background-color contrast do all the separating work — the feedback form panel and inputs are bordered boxes on a flat plane, not lifted cards. The glossary tooltip floats too: it inverts the color pair and keeps Material's own light shadow. The single exception is the toast notification, which floats over the page with a real shadow (`box-shadow: 0 12px 32px rgba(0,0,0,0.3)`) because it's the one element meant to read as temporarily suspended above the document rather than part of it.

### Shadow Vocabulary
- **Toast float** (`box-shadow: 0 12px 32px rgba(0,0,0,0.3)`): The toast notification, the system's most prominent floating/transient surface.
- **Tooltip lift** (Material's `--md-shadow-z2`, inherited, not set in `brand.css`): The glossary tooltip, which hovers over the text it explains.

### Named Rules
**The Flat-By-Default Rule.** Nothing gets a shadow just for being a container. A shadow means "this is temporarily floating above the page," which today means two components: the toast and the glossary tooltip.

## Shapes

Soft, understated corners: **6px radius** on every custom component — feedback panel, form inputs, submit button, toast. (Material's stock glossary tooltip keeps its own smaller 0.1rem corner.) No sharp/square components and no heavily rounded (pill-shaped) ones; 6px reads as "gently eased" rather than a deliberate design statement. Borders are always 1px and Line-colored (or Ink/Paper depending on scheme) — never a thicker or colored border outside of the toast's 3px Copper accent border, which marks it as the one component allowed to call attention to itself structurally as well as chromatically.

## Components

Every custom component here is restrained and utilitarian by design — a tool a technician uses without thinking about, not a marketing surface. None of them reach for decoration; each one earns its one distinguishing detail (the toast's shadow, the button's copper fill) and stays quiet everywhere else.

### Buttons
- **Shape:** 6px radius, no border.
- **Primary** (feedback submit, the only button in the system): Copper background, Paper text (Ink text in dark scheme, following the Scheme-Swap Rule — text follows the page's own background polarity, not the header chrome's inverted one), `0.5rem 1.25rem` padding, 600 weight, 0.85rem.
- **Hover / Focus:** Opacity drops to 0.85 on hover (`transition: opacity 0.15s ease`) — no color shift, no lift, no shadow. This is the system's only interactive state effect on a button; keep any future button hover this restrained rather than adding movement or elevation.

### Cards / Containers
- **Corner Style:** 6px radius.
- **Background:** Matches the page background (Paper/Ink per scheme) — containers don't get their own surface tone.
- **Shadow Strategy:** None (see Elevation & Depth's Flat-By-Default Rule).
- **Border:** 1px, Line-colored (or scheme-appropriate lightest neutral).
- **Internal Padding:** 1.5rem (the feedback panel is the reference instance).

### Inputs / Fields
- **Style:** 1px Line border, 6px radius, Paper/Ink background matching the page, 0.4rem padding, Plex Sans at 0.85rem.
- **Focus:** Inherits the browser/theme default focus ring; no custom focus treatment has been built yet — don't invent one without a reason tied to an actual usability gap.
- **Labels:** Plex Sans at Small (0.85rem), above the field. The panel's own heading is the mono label: Plex Mono, uppercase, 0.75rem, 0.08em tracking, secondary-neutral colored.

### Navigation
- **Style:** Plex Mono labels (tracked out, uppercase) for header topic, nav titles, and tab links; Copper marks the active tab/nav link (`color` swap, no underline or background change). Tabs are sticky and horizontally scrollable with the fade/chevron affordance described in Layout.
- **Mobile treatment:** Falls back to Material's native drawer/hamburger nav; no custom mobile nav has been built.

### Glossary Tooltip
Material's tap- and hover-friendly tooltip (`content.tooltips`), used for the sitewide abbreviation glossary and footnotes. Inverted from the page (Ink background with Paper text in light scheme, the reverse in dark) by re-pointing Material's own color variables inside the tooltip, Plex Sans at 0.72rem with `0.5rem 0.7rem` padding. Keeps Material's own small corner (0.1rem) and light shadow (`--md-shadow-z2`), since it genuinely floats over the text.

### Tab Scroll Cue (signature component)
Fade-and-chevron cues at either end of the tabs bar, visible only on the side that still has more tabs to scroll. A gradient in the current chrome color (solid near the edge, fading toward the middle, 64px wide) with a Copper `‹`/`›` at Icon size. Clickable and keyboard-focusable only while visible; focus shows a 2px Copper outline, hover brightens the chevron. Fades in and out over 0.15s.

### Toast (signature component)
The system's one deliberately "floating" element (see Elevation & Depth). Fixed to the bottom-center of the viewport, Paper/Ink background matching the page, 1px Line border with a 3px Copper left-border accent (Copper is swapped to `#D64545` red only in the error state), 6px radius, real drop shadow, fades and slides up 16px on entry/exit. Used exclusively for feedback-form submission results (success/error), auto-dismissing after 5 seconds.

## Do's and Don'ts

### Do:
- **Do** keep Copper as the only chromatic color in the system — reach for weight, size, or position before reaching for a second hue.
- **Do** swap Ink and Paper together as a pair when adding new chrome (Scheme-Swap Rule) — never fix one scheme's pairing while the other still flips.
- **Do** use Plex Mono, uppercase and tracked out, for anything that's acting as UI chrome (labels, nav, tabs); keep it untracked and mixed-case wherever it's showing a literal code sample instead.
- **Do** keep new components flat (border + background contrast) unless they are genuinely temporary/floating like the toast.

### Don't:
- **Don't** add a shadow to a container just to give it visual weight — that's what the 1px Line border is for.
- **Don't** introduce a second accent color, even a "cooler" or "calmer" one alongside Copper — the system's restraint depends on there being exactly one.
- **Don't** give a button a hover treatment beyond the existing opacity dip (no lift, no color shift, no shadow) without a specific, confirmed reason.
- **Don't** treat this as a marketing surface — no gradients, no decorative illustration, no hero imagery; the binder metaphor holds because nothing here is trying to sell anything on sight.
