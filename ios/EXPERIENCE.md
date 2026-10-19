# Marbles for iPhone: Experience Spec

Owner: Senior iOS engineer. Requirements: [PRODUCT.md](./PRODUCT.md) §4 (fun layer). Tech: [ARCHITECTURE.md](./ARCHITECTURE.md). Plan: [ROADMAP.md](./ROADMAP.md). Pushback: [ENGINEERING_FEEDBACK.md](./ENGINEERING_FEEDBACK.md).
Priorities: **Must** (ships in I1–I2), **Should** (I3), **Could** (only if the budget allows). Nothing here adds data, streaks, goals, or scores.

Fixed vocabulary (same as the web):
- Categories `g/b/r` = Wanted / Wasted / Unwanted.
- Sleep indigo `#4f46e5`.
- Precedence: DST n/a > logged > future (empty) > sleep > unlogged.
- 24 marbles with half-marble rendering (left = :00–:30, right = :30–:60).
- Hour labels 0–23.
- VoiceOver labels like `"13:00–14:00 Wanted"`.

## 1. Physics engine evaluation

Needs:
- 24–48 stable circles in a concave jar.
- A deterministic off-screen pre-settle.
- Impact speed per contact (for haptics and sound).
- Fast flicks without tunnelling.
- Rotation (swirls that roll).
- Sleep with zero CPU.
- A few hundred bodies for the stats pour and onboarding.

| Option | License | Stacking 24–48 | Pre-settle / determinism | Impact events | Many bodies (≤ 744) | Fit / risk |
|---|---|---|---|---|---|---|
| **Box2D v3.2** (C17, official SPM [Package.swift](https://github.com/erincatto/box2d/blob/main/Package.swift), iOS 13+) | MIT | Soft Step solver, built for piles | `b2World_Step` on demand; "cross platform determinism" ([README](https://github.com/erincatto/box2d)) | Hit events with `approachSpeed`, threshold per world | Yes ("optimized for large piles") | **Chosen.** Risk: C interop under Swift 6, unit scaling. |
| SpriteKit physics ([Apple](https://developer.apple.com/documentation/spritekit/skphysicsbody)) | Apple | Good | Stepped by the `SKView` render loop. No public fixed-step API (**unverified, check in spike I0**), so no synchronous pre-settle or unit tests. | `SKPhysicsContact.collisionImpulse` | OK | Ties physics to the SpriteKit renderer and accessibility; hard to test. Rejected. |
| Swift port of web solver ([`world.ts`](../src/lib/physics/world.ts), ~450 lines) | ours | OK with substeps | Deterministic, pure, golden-traceable against the web | Contact `vn` is available | O(n²): 24 bodies = 276 pairs is fine; 744 is not | **Fallback** for the day jar. No rotation, no CCD (speed clamp instead). |
| RealityKit physics ([Apple](https://developer.apple.com/documentation/realitykit/physicsbodycomponent)) | Apple | Good (3D) | Not deterministic for our needs | Collision events | Yes | A 3D glass jar costs GPU and battery and is hard for accessibility. Rejected. |
| SceneKit | Apple | — | — | — | — | Deprecated in iOS 26 ([Apple](https://developer.apple.com/documentation/scenekit)). Rejected. |
| Chipmunk2D 7.0.3 | MIT | Good | Deterministic | Yes | Yes | Last tagged release 7.0.3. Box2D is more active. Rejected. |

**Recommendation:** Box2D v3.2 in `MarblesPhysics`, behind `protocol JarWorld { add, remove, step(dt), presettle(maxSteps), setGravity, impulse, grab/release, positions, isAsleep, hits }`.
- **Units:** 1 Box2D meter = 40 jar units (one web grid cell). Marble radius 0.4 m. Gravity 35 m/s² (= the web's 1400 units/s²).
- **Material:** restitution 0.2, friction 0.1 (web values), rolling resistance 0.02, linear damping 0.4.
- **Stepping:** fixed 1/120 s substeps, max 4 per frame.

**Spike gate I0.6** (on the user's iPhone 16, the only target device). Fail any item, switch to the fallback, and downgrade §7 and §8.2 to scripted animations.

| Gate | Pass |
|---|---|
| Builds via SPM with Xcode 27, Swift 6 | Yes, with no warnings in our wrapper |
| 48 marbles settle in the jar polyline | Penetration < 0.5 units; asleep ≤ 3 s |
| Pre-settle 240 substeps | ≤ 10 ms |
| Determinism | Same seed → bit-identical positions in 2 runs |
| Flick at 1500 units/s | No escape through glass in 100 random flicks |
| 744-body pour | ≥ 60 fps on iPhone 16 |
| Binary size delta | ≤ 1 MB |

## 2. Jar rendering (Must)

**Geometry:** port `jarLayout.ts` 1:1 (188×314 jar units, neck, shoulders, base corners, `JAR_COLLIDERS`).
- The jar is scaled to fit about 62% of the screen width. On a 390 pt phone the scale is about 1.3, so the marble diameter is about 42 pt.
- Taps hit-test a 22 pt radius (44 pt target).

**Layers, back to front:**
1. Back glass (gradient `--glass-bottom` → `--glass-top`).
2. Marbles (`Canvas`).
3. `layerEffect` refraction near the walls (sample offset ≤ 3 pt).
4. Front glass with specular streaks (`colorEffect`). The highlight band shifts with tilt (parallax, Should).
5. Rim/lid.
6. Hour labels.

**Marble shading:** a Metal stitchable fill per marble: base color, an interior pattern per category, a fixed gloss toward the light, and a rim. The **pattern rotates with the body**. The half split, hour label, and gloss stay upright, so "left = :00–:30" keeps its meaning.

| Color | Base (light / dark) | Pattern (readable without color) |
|---|---|---|
| Wanted `g` | `#16a34a` / `#22c55e` | **Cat's eye**: 3 twisted light vanes `#bbf7d0` |
| Wasted `b` | `#1f2937` / `#0b0b0c` | **Smoke**: grey wisps `#9ca3af`. Light ring + glow in dark mode (web rule) |
| Unwanted `r` | `#dc2626` / `#ef4444` | **Crackle**: Voronoi crack lines `#fecaca` |
| Sleep | `#4f46e5` | **Night sky**: star speckles `#c7d2fe` |
| Unlogged | `#a8a29e` / `#7c756b` | **Frosted stone**: matte, fine noise, no gloss |
| Empty (future) | clear | Glass outline only |
| n/a (DST) | `#e7e5e4` / `#3a352e` | Diagonal hatch + "n/a" |

- **Hour labels:** 0–23, SF Rounded semibold. They scale with the jar, not Dynamic Type, and are hidden from VoiceOver (as on the web). Contrast ≥ 4.5:1: white on g/b/r/sleep, dark on unlogged/empty.
- **Mini jars** (week/month/share) use flat gradients, no shaders, no labels. They are rendered once and cached as images.
- **Fallback:** if shader cost exceeds the budget (§14), use the web gradients (`--marble-*-hi/lo`) and draw patterns as cached sprites.

## 3. Day jar (Must)

| Mode | Behavior |
|---|---|
| **Loose** (default, Q1) | Every **started** hour has a body, gray included (web decision 5). Future hours are absent. The in-progress half shows as clear glass. On a cold open the world is pre-settled from a date-seeded hex pack (port of `seedLayout`), so the first frame is already settled. When a new hour starts, its marble spawns at the neck and falls live. |
| **Grid** | `marblePosition(hour)`: 4 columns × 6 rows, hour 0 at bottom-left. New marbles get a drop bounce. Always used when Reduce Motion is on. |
| **Tidy** (Loose only) | A button in the jar corner. Each body animates to its grid cell (spring, staggered by hour); then the bodies freeze. A tilt over 10°, a grab, a new marble, or "Loosen" releases them back into physics. |
| **Tilt** (default on, Core Motion `deviceMotion.gravity` [Apple](https://developer.apple.com/documentation/coremotion/cmmotionmanager)) | 30 Hz, only while the Day jar is visible and the app is active. Gravity = the projected device gravity. Changes under 3° are ignored (the world stays asleep). An invisible lid at the rim keeps marbles in. Off under Reduce Motion. No shake (web decision 7). |
| **Data changes** | Log, edit, or Undo **recolors the body in place** and gives it a small hop (impulse). A drop **replaces** the target hour's body at the release point (§4). Changing day rebuilds the world. |

## 4. Tray: flick to log (Must)

Same semantics as web [PLAN 4.1](../PLAN.md): `lastHourWindow(now at release)` → `planDrop` → one batch → Undo with `undoDrop`.
- **Layout:** today only. Tray of 3 marbles (56 pt, labelled) → live hint "Flick into the jar to log 13:30–14:30" → jar → summary chips → Log time button → Entries.
- **Gesture:** `DragGesture(minimumDistance: 0)`, immediate lift (×1.12 scale, shadow).
  - **Valid** once the marble is ≥ 2r (56 pt) from home. Release anywhere while valid logs.
  - Back over home, a gesture cancel, or going to the background → spring back, no write.
  - **Tap** (< 6 pt, < 250 ms) only pulses the hint (web decision 3).
- **Velocity carry-over:** `DragGesture.Value.velocity` (pt/s) → jar units/s, clamped to 1500.
  - Released inside the glass: spawn the body there with that velocity.
  - Released outside: a ballistic fly to the neck (≤ 260 ms), entering with the flick's direction.
  - In Grid mode the marble flies to its cell and bounces.
- **Yesterday-only window (00:00–00:14):** the marble flies off the left edge (toward yesterday's page) and the toast names yesterday.
- **Repeats:** a repeat drop with a different category changes the same window (pop + recolor). The same category does nothing and toasts "13:30–14:30 is already Wanted".
- **Gate:** while syncing, the tray is dimmed, the hint reads "Syncing…", and a release springs back.
- **Undo toast:** "Logged 13:30–14:30 as Wanted · Undo". 8 s (15 s with VoiceOver), keyed so only one drop toast exists. Undo recolors in place.
- **Could:** within the Undo window, dragging the just-dropped marble back out of the neck = Undo.

## 5. Pick up, inspect, edit (Must)

- **Tap a marble** (or a half in Grid): it lifts out of the jar to 3× in an inspector card, with its swirl slowly rotating. The card shows the time range, category, and note, plus **Edit** and **Delete** (the log sheet, prefilled through `logicalEntryAt`, so midnight-joined entries edit as one).
- Tapping an unlogged or sleep past slot opens the log sheet at that slot (web `selectSlot`). Future slots and n/a are inert.
- **Grab (Should):** dragging a marble inside the jar (beyond 6 pt) grabs it with a mouse joint, so you can toss it around. No data changes.
- **Log sheet (F2 fallback):** a 2-tap bottom sheet with 3 big category buttons, start (30-min step, default the previous full hour), duration (default 1 h, clamped so it doesn't run into the future), note ≤ 200. It keeps the **overwrite confirm** inside the sheet.

## 6. Day paging, week shelf, month cabinet

| Feature | Spec | Priority |
|---|---|---|
| Day paging | Horizontal paging between days. Only the current page runs physics; neighbors show a static presettled snapshot. Swiping past today rubber-bands with a soft "thud" haptic. A date picker and a Today button are in the header. | Must |
| Week shelf | 7 mini jars on a drawn wooden shelf, day labels, today highlighted, the week-start setting respected. Swipe for the previous or next week. Tap a jar → zoom transition into that day. Past days with nothing logged show an empty jar (web b7d74c5). | Must (static), Should (shelf art, zoom) |
| Month cabinet | 5–6 shelves × 7, one ≤ 31-read listener, static thumbnails cached per (date, slots, sleep, theme) | Must (static), Should (cabinet art) |
| Sealed lids | Days with a reflection show a lid on their mini jar (derived from `reflection`, no new data) | Should |

## 7. Stats "pour out" (Should; numbers are Must)

- Scope: Day / Week / Month. The jar tips, and marbles pour into 5 tubes (Wanted, Wasted, Unwanted, Sleep, Unlogged). One marble = one hour (half = half). Tube heights end equal to the hours.
- Then the numbers fade in, identical to the web `computeStats`: hours, % of awake time (G/B/R/Unlogged), % of 24 h, with a toggle.
- At most 2.0 s. Tap to skip. Plays once per scope change per session.
- Month: up to 744 bodies with Box2D. If below 60 fps, 1 marble = 4 h, labelled.
- Reduce Motion: bars appear at once.

## 8. Rituals

### 8.1 Seal the jar (Should; reflection itself is Must)
- A "Seal" button under the day jar (any past day, or today after 20:00) opens the reflection editor (≤ 1000, trimmed).
- On save, the lid lowers and screws on: 2 turns, 6 ratchet clicks, and a final thunk (haptic and sound).
- A sealed jar = the day has a `reflection`. Clearing the reflection removes the lid ("Unseal").

### 8.2 Onboarding pour (Should)
- First launch (device flag), demo data only, before sign-in.
- A pour: 24 marbles fall into an empty jar, then pause on 5 cards (Wanted / Wasted / Unwanted / Sleep / Unlogged).
- Prompts: Sound (default off, Q3), Reminders (opt-in), Tilt (on).
- Then sign-in. Skippable at any point. ≤ 3 s of motion per step.

### 8.3 Celebrate, don't nag (Should)
- When the last unlogged half of a day's started hours is logged and the day has no gray: a 900 ms glass shimmer sweep, a soft chime (if sound is on), and a gentle haptic swell.
- At most once per day per device (UserDefaults `lastCelebratedDate`). No counters and no text beyond "Clean jar."

## 9. Settings, notification actions, share card

- **Settings:**
  - Account: email, sign out.
  - Synced: sleep window (30-min steps), week start, theme.
  - This iPhone: jar style (Loose/Grid), tilt, sound, haptics, reminders (local notifications; no `.ics` on iOS).
  - Data: export, delete all data (type DELETE).
  - About: version and "**Re-sign by** Sat Oct 24, 21:10" from the provisioning profile.
  - Reduce Motion explains why Loose is unavailable.
- **Notification actions (Must):** "How was 13:00–14:00?" → long-press shows Wanted / Wasted / Unwanted (requires unlock). Success is silent; the fallback is "Saved on this iPhone. It syncs when you open Marbles." ([ARCHITECTURE §9](./ARCHITECTURE.md#9-notifications-p7)).
- **Share card (Must):** Grid layout, light card, the day or week title, and the jar plus stat lines, matching the web PNG. "Share as you see it" (the current Loose layout) is a **Could**.

## 10. Haptics and audio

**Haptics (Core Haptics, [Apple](https://developer.apple.com/documentation/corehaptics/chhapticengine)).** Follows the in-app toggle (default on). System-switch behavior is **unverified, check in spike I0**. Box2D hit events give `approachSpeed` (v), converted to jar units/s.

| v (units/s) | Pattern | Intensity | Sharpness |
|---|---|---|---|
| < 30 | none | — | — |
| 30–120 | tick (transient) | 0.20–0.45 (linear in v) | marble–marble 0.75, marble–glass 0.45 |
| 120–400 | clack | 0.45–0.80 | same |
| > 400 | clonk + 30 ms continuous tail at 0.3 | 0.80–1.00 | same |

- **Limits:** ≤ 1 event per 25 ms globally (merge by max), ≤ 3 per body per 200 ms. None during pre-settle, while inactive, or under Reduce Motion pours.
- **UI ticks:** `sensoryFeedback(.selection)` for armed, paging detents, and segmented controls.

**Audio** (Should; default **off**). An `AVAudioEngine` with the `.ambient` session ([Apple](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/ambient)), so the silent switch mutes it and it mixes with music. The engine starts on first use and stops after 5 s idle.

| Sound | Synthesis (no assets; CC0 samples only if synthesis fails the ear test) |
|---|---|
| Marble–marble clack | Modal: partials ~2.8 / 4.6 / 7.1 kHz, decay 40–90 ms, ±5% pitch jitter |
| Marble–glass tink | Partials ~1.2 / 3.3 / 5.9 kHz, decay ~250 ms |
| Category timbre | Wanted +3 semitones (bright); Wasted low-passed at 3 kHz (dull); Unwanted slight detune |
| Lid ratchet | 8 ms filtered-noise bursts |
| Pour rattle | A granular sum of clacks, capped at 8 voices |
| Chime | A 3-note sine arpeggio, soft attack |

- Volume ∝ v², peak −12 dBFS, 8-voice cap.
- **Rolling hum (Could):** low noise scaled by angular speed.

## 11. Motion and timing

| Moment | Duration | Curve | Haptic | Sound |
|---|---|---|---|---|
| Tray lift | 120 ms | spring(response 0.25, damping 0.7) | selection | — |
| Armed (jar glow) | 150 ms | easeOut | soft tick 0.3 | — |
| Cancel spring-back | ~150 ms | spring(0.3, 0.8) | — | — |
| Fly to neck | ≤ 260 ms | ballistic | — | — |
| Physics impact | live | physics | §10 table | §10 |
| Grid drop bounce | 420 ms | spring(0.35, 0.6) | clack on land | tink |
| Category pop | 220 ms | scale 1 → 1.15 → 1 | rigid 0.5 | clack |
| Tidy | ≤ 750 ms total (450 ms each, 12 ms stagger) | spring(0.45, 0.85) | 300 ms continuous ramp at 0.3 | rattle sweep |
| Settle after any disturbance | ≤ 3 s, then sleep | physics | hits | hits |
| Pick-up to inspector | 280 ms | spring(0.3, 0.75) | light | tink |
| Day page | interactive, ~350 ms | system paging | detent tick | — |
| Shelf → day zoom | ~400 ms | system zoom | — | — |
| Seal lid | 800 ms, 2 turns | easeInOut | 6 × (0.4/0.9) + thunk (1.0/0.3) | ratchet |
| Stats pour | ≤ 2.0 s | physics | throttled ticks | rattle |
| Onboarding pour | ≤ 3.0 s | physics | throttled | rattle |
| Celebrate | 900 ms | linear sweep | swell 400 ms | chime |
| Undo toast | 8 s (15 s with VoiceOver) | fade 200 ms | — | — |

## 12. More fun ideas

| Idea | Why it's OK | Priority |
|---|---|---|
| Swirls roll with the body | Visual only | Must |
| Grab and toss marbles (§5) | No data change | Should |
| Category timbres (§10) | Sound only | Should |
| "Now" marble glow: the in-progress hour's glass half has a static warm rim (no animation) | Zero CPU | Should |
| Drag the dropped marble back out = Undo | Same `undoDrop` | Could |
| Alternate app icons (Wanted / Wasted / Unwanted / Night marble), drawn in code | Free API, no entitlement | Could |
| Rolling hum | Sound only | Could |
| Shelf clink when swiping weeks | Feedback only | Could |
| Share "as you see it" | Same data | Could |
| Not planned: shake, streak or count badges, goals | Web decision 7; SPEC §5 backlog | — |

## 13. Accessibility

| Setting | Behavior |
|---|---|
| **VoiceOver** | Marbles exposed through `accessibilityChildren` in **hour order**, with each half its own element (web 2.0d). Labels from `computeMarbles`/`halfLabel` (`"13:00–13:30 Wanted"`). Frames update only when the world sleeps. Activate = inspect/edit or log at that slot. Tray buttons: "Log 13:30–14:30 as Wanted"; activation logs at once and announces the toast; Undo stays focusable for 15 s. The Entries list remains the full text fallback. |
| **Reduce Motion** | Grid jar, no tilt, no pours (instant), crossfades instead of zoom and lid spin, a static celebrate. Direct manipulation (dragging a tray marble) still follows the finger. |
| **Dynamic Type** | All UI text scales up to AX5. Jar hour labels are decorative. Chips wrap. Sheets scroll. |
| **Increase Contrast** | Stronger glass outline; a Wasted ring in both themes; tokens at ≥ 4.5:1 text contrast |
| **Differentiate Without Color** | Patterns at full strength (§2). Chips keep the letters "G/B/R". |
| **Haptics / Sound off** | Every effect has a visual equivalent |
| Light / dark | Tokens ported from [`tokens.css`](../src/styles/tokens.css). Theme = settings `theme` (system/light/dark). |

## 14. Performance and battery budgets

| Metric | Budget |
|---|---|
| Cold launch → interactive jar (cached data, iPhone 16) | < 1.0 s; warm < 300 ms |
| Frame rate while moving | ≥ 60 fps (the user's iPhone 16 has a 60 Hz display; 120 fps only matters on ProMotion models) |
| Physics step, 48 bodies | ≤ 0.5 ms per frame |
| Render, CPU / GPU | ≤ 4 ms / ≤ 6 ms per frame |
| Pre-settle | ≤ 10 ms |
| Settle to sleep | ≤ 3 s |
| CPU at rest (backgrounded, jar off screen, or tilt off) | **0%**: paused timeline, no timers except the quarter-hour clock |
| CPU with tilt on, phone still | ≤ 2% (30 Hz motion, render paused) |
| Memory, steady | ≤ 150 MB resident; sprites/thumbnails ≤ 8 MB |
| Installed size | ≤ 40 MB |
| Background work | None, except notification-action launches |
| Audio engine | Stopped after 5 s idle |
