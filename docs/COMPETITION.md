# Competition reference: Meta VR Start Developer Competition 2026

What the organisers' pages say, read on 5 Oct 2026 from the [Devpost site](https://start-developer-competition-26.devpost.com/). The official [Rules](https://start-developer-competition-26.devpost.com/rules) win if anything here differs. Items marked **unconfirmed** were not stated clearly; ask in the forum or in an office hour.

## Dates

| What | When |
|---|---|
| Submission deadline | 18 Nov 2026, 12:00 PM Pacific = **19 Nov 2026, 4:00 AM Singapore** |
| Winners announced | around 11 Dec 2026 |
| After the deadline | The page must stay up until the winners are announced, and entries are judged as they stood at the deadline: no changes. (Our plan to turn the deploy workflow off after submitting matches this.) |

## Who can enter

- Everyone on the team is 18 or older and not resident in Brazil, Quebec or a sanctioned region. Singapore is fine.
- A Meta account with **Developer Access** (the team needs at least one administrator).
- The person who submits must be a member of the **Meta VR Start Program** by the time of submission.
- One entry per team, one prize per entry. Studios and teams are allowed; the prize goes to one representative.
- Not eligible: apps funded by Meta (RFPs), and anything using unreleased Meta tools.

## What to submit (on Devpost)

1. **A link to the game.** For IWSDK (WebXR) that is the GitHub Pages link; other hosts are allowed.
2. **A demo video under 3 minutes**, public on YouTube or Vimeo. Footage from a Meta Quest, the XR Simulator or an equivalent emulator is accepted. Show real gameplay and lead with what makes it distinct; do not lean on AI-generated video.
3. **A text description:** inspiration, how it was built, future plans, a target launch date.
4. **Division** (New Experience) and **track** (Gaming).

## How it is judged

Four criteria, 25 % each, after a first check of the baseline requirements.

| Criterion | What scores well |
|---|---|
| Innovation and creativity | Originality, and using Meta device capabilities (spatial depth, hands-first, passthrough, scene understanding, persistent anchors) in a way that drives repeat play |
| Experience design | Intuitive from the moment of entry, clear onboarding, a rewarding habit-forming purpose. Passthrough must be **purposeful**: the real room should change the experience (a table becomes the play surface), not play identically with passthrough off |
| Technical implementation | Performant on Meta Quest hardware (**at least 60 fps**), solid and bug-free; correct use of scene understanding, anchoring content to detected planes and surfaces, and **holding up in rooms the developer never tested** |
| Polish and presentation | UI/UX, art direction, sound, and good submission materials |

## Our entry and these criteria

From 5 Oct our entry is a virtual room (see [ADR 0005](adr/0005-virtual-room.md)): it does not use passthrough, scene understanding or anchors, which the judging text names for entries that use them. We lean on hands-first design, the first five minutes, accessibility and polish, and we should ask the organisers how a VR-only entry is scored under Technical implementation.

## Requirements that shape the game

- **Hands-first:** "fully usable with hands, end-to-end"; a controller is optional. The test is whether someone can finish the whole experience without pairing a controller.
- **Seated and stationary (a guideline, not a rule):** Meta's [announcement](https://developers.meta.com/blog/meta-connect-2026-vr-start-developer-competition/) (read 10 Oct 2026) suggests the experience be "seated-optimized" and "designed for seated, stationary use; limit roomscale and avoid large physical movement". Breaking it does not disqualify an entry, but judges will expect it: keep play in front of the player, within an easy head turn, and never ask them to stand, walk or turn around. Some news articles call this a requirement; Meta's own wording says "suggested". **Unconfirmed** whether the Devpost Rules make it binding.
- **Short sessions (a guideline):** the same announcement suggests a "fast cold start, clean pause/resume and something satisfying in 10 minutes or less". Our 5–8 minute chapter fits.
- Do not require a third-party device (the judges all use Meta VR devices).
- **Original:** the entry must be the entrant's own, or public domain, or provided by Meta. Third-party tools, code and assets are allowed only if you are authorised by their licence. **Unconfirmed** how strictly "original" is read for licensed free art: use CC0 where possible, record every asset in `CREDITS.md`, and ask before relying on anything else.
- Follow Meta's developer policies, Community Standards and content guidelines (age rating 10+, 13+ or 18+).
- A thin wrapper around an existing service is discouraged; the core must be built by us.

## Special awards

Open to all tracks: Best Social and Multiplayer Experience, Best Agentic Interaction, **Best Reason to Come Back**, **Best First Five Minutes** (explains itself quickly, teaches controller-free interaction without a wall of text, pays off before the headset comes off), **Best Accessibility Forward Experience** (for example voice alternatives, high contrast, inclusive by default), **Boldest Original Concept** (could not exist on another platform; depends on presence, depth, real-world scale, or eyes and hands), Judge's Choice. The ones we aim for are in bold. There is no Immersive Web SDK award and no narrative award.

## Live sessions

Times are Pacific; Singapore is 15 hours ahead until the US clocks change on 1 Nov.

| When (Pacific) | Singapore | Session |
|---|---|---|
| 7 Oct, 10:00 AM | 8 Oct, 1:00 AM | How to Win: rules, divisions and judging criteria |
| 8 Oct, 3:00 PM | 9 Oct, 6:00 AM | Hands Tutorials Best Practices (our first five minutes) |
| 13 Oct, 10:00 AM | 14 Oct, 1:00 AM | Live Build: 0 to VR with Immersive Web SDK |
| 20 Oct, 10:00 AM | 21 Oct, 1:00 AM | Agentic Workflows for new and existing apps |

The [webinars page](https://start-developer-competition-26.devpost.com/details/webinars-office-hours) has the registration links and later dates. Help: the [Discord](https://discord.com/invite/HP4BhW3hnp), the Meta developer forum, and mentors in the office hours.

## Links worth keeping

| Topic | Link |
|---|---|
| Competition | [Rules](https://start-developer-competition-26.devpost.com/rules), [FAQs](https://start-developer-competition-26.devpost.com/details/faqs), [Judging](https://start-developer-competition-26.devpost.com/details/judging), [Special awards](https://start-developer-competition-26.devpost.com/details/special-awards), [Resources](https://start-developer-competition-26.devpost.com/resources) |
| Deploy | [Deploy to GitHub Pages](https://developers.meta.com/horizon/documentation/web/iwsdk-guide-build-deploy#deploying-to-github-pages) |
| Test on a headset | [Testing your experience](https://developers.meta.com/horizon/documentation/iwsdk/guides/02-testing-experience/) (Wi-Fi, or USB with ADB port forwarding), [MQDH for Browser](https://developers.meta.com/horizon/documentation/web/browser-mqdh) (cast, screenshots, send a URL), [Web Launch](https://developers.meta.com/horizon/documentation/web/web-launch) (open a link in Quest Browser from a phone or computer), [Immersive Web Emulator](https://chromewebstore.google.com/detail/immersive-web-emulator/cgffilbpcibhmcfbgggfhfolhkfbhmik?hl=en) |
| Performance | [WebXR performance](https://developers.meta.com/horizon/documentation/web/webxr-perf) (measuring, foveation, frame rate control) |
| Hands | [WebXR Hands](https://developers.meta.com/horizon/documentation/web/webxr-hands), [Hands limitations and mitigations](https://developers.meta.com/horizon/design/hands-limitations-mitigations/), [Hands best practices](https://developers.meta.com/horizon/design/hands-best-practices), [Getting started with hands and eyes](https://developers.meta.com/vr/essentials/getting-started-with-hands-and-eyes/) |
| IWSDK | [Repo](https://github.com/facebook/immersive-web-sdk), [external assets](https://iwsdk.dev/guides/04-external-assets.html), [scene understanding](https://iwsdk.dev/guides/11-scene-understanding.html), [depth occlusion](https://iwsdk.dev/guides/15-depth-occlusion.html), [web samples](https://developers.meta.com/horizon/code-samples/web) |
| Tooling | [Meta VR agentic tools](https://github.com/meta-quest/agentic-tools) (optional) |

Notes: the IWSDK docs are for v1.0.1 and we pin 1.0.0, so check an API against our version before copying from a guide. IWSDK's [Camera Access](https://iwsdk.dev/guides/13-camera-access.html) guide is about browser cameras (`navigator.mediaDevices`) and is unrelated to hand tracking; we do not use it. The Web Launch link for our build is `https://www.oculus.com/open_url/?url=https%3A%2F%2Factuallyanson.github.io%2Fwhere-shadows-wander%2F` (built from Meta's format, not yet tried on a headset).
