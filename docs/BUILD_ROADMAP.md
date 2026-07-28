# Mushroom Blitz Racers — Phased Build Roadmap

Build **one part at a time**. Do not start the next part until every checkbox in **Manual verification** passes.

| Part | Focus | Est. time |
|------|--------|-----------|
| **1** | Project setup, navigation, stubs | 1–2 days |
| **2** | Single-player core (run, jump, physics, Skia canvas) | 1–2 weeks |
| **3** | Characters & powers (cooldowns, activation) | 3–5 days |
| **4** | Levels (procedural + 3 themed worlds) | 1 week |
| **5** | Multiplayer sync (Firebase RTDB, lobby) | 1–2 weeks |
| **6** | Finish line, rankings, results flow | 3–5 days |
| **7** | Audio, particles, polish, monetization hooks | 1 week |
| **8** | Auth, leaderboards, EAS production builds | 3–5 days |

---

## Part 1 — Foundation (CURRENT)

**Delivered:** Expo app, folder structure, all screen routes, Zustand stores, Firebase stub, Skia health check.

### Manual verification (you do this)

```bash
cd mushroom-blitz-racers
npm install             # also runs setup-skia-web (canvaskit.wasm)
npm run verify:part1    # TypeScript must pass with 0 errors
npm run start:clear     # Scan QR with Expo Go on phone (LAN)
```

**Phone won't load?** See [DEV_CONNECTION.md](./DEV_CONNECTION.md).  
**Web CanvasKit errors?** Use `npm run start:clear` and hard-refresh browser.  
**Automated check (run before manual test):** `npm run verify:part1` — typecheck + Android bundle (no `fs` / CanvasKit errors).

| # | Test | Expected |
|---|------|----------|
| 1 | Splash (~1.2s) | Red screen, mushroom emoji, title, then Login |
| 2 | Login → Play as Guest | Home screen with coin count |
| 3 | Skia box on Home | Gradient bar + 3 colored circles (not blank) |
| 4 | Single Player Race | Game screen, HUD shows mode + character |
| 5 | Finish (demo) | Results shows rank #1 |
| 6 | Multiplayer → Create Room → Start Race | Game mode = multiplayer |
| 7 | Character Select | Tap unlocked chars; locked are dimmed |
| 8 | Settings toggles | Switches flip; persist while on screen |
| 9 | Home has no Shop / Leaderboards / Settings | Removed from app |
| 10 | `npm run typecheck` | Exit code 0 |

**Pass criteria:** All 10 rows pass. Skia must render on a **physical device** (Expo Go); web preview may differ.

**If Skia is blank on device:** Run `npx expo install @shopify/react-native-skia` again and restart with `npx expo start -c`.

---

## Part 2 — Single-player core ✅

**Scope:** Landscape mode, **◀ / ▶ move** (smooth accel/decel, no auto-run), jump/double-jump, fixed 60Hz physics, platforms/gaps, coins, parallax, finish at 120m.

**Automated verify (run before manual test):**
```bash
npm run verify:part2
```
Must pass: TypeScript + engine smoke tests + Android bundle (no `canvaskit` / `fs` errors).

### Manual verification (Part 2)

| # | Test | Expected |
|---|------|----------|
| 1 | Start Single Player | Phone rotates to **landscape**; game fills screen |
| 2 | Hold **▶** | Character accelerates smoothly right (not instant teleport) |
| 3 | Hold **◀** | Character accelerates smoothly left |
| 4 | Tap **JUMP** | Jump; tap again in air = double jump |
| 5 | Fall in gap | Respawn at last safe ground position |
| 6 | Land on platform | Stands on top; no falling through |
| 7 | Touch coin | 🪙 count in HUD increases |
| 8 | Reach **120m** | Auto-finish → Results with distance + coins |
| 9 | Parallax | Hills scroll slower than ground when moving |
| 10 | Quit ✕ | Returns to portrait-friendly home menu |

---

## Part 3 — Characters & powers

**Scope:** Per-character power on swipe/button, cooldown UI, power effects.

### Manual verification

| # | Test | Expected |
|---|------|----------|
| 1 | Mario fireball | Projectile spawns, cooldown bar drains |
| 2 | Luigi ghost dash | Brief invuln / pass-through once per cooldown |
| 3 | Switch character before race | Selected power matches character select |
| 4 | Power during cooldown | No effect; UI shows remaining time |

---

## Part 4 — Levels

**Scope:** Endless procedural segments + Grassland, Underground, Sky hand-crafted themes.

### Manual verification

| # | Test | Expected |
|---|------|----------|
| 1 | Endless mode | New platforms generate ahead; no dead end |
| 2 | Themed level pick | Visual theme changes (colors/tiles) |
| 3 | Enemies (Goomba) | Contact knocks back or eliminates |
| 4 | Checkpoint | Respawn after fail retains progress |

---

## Part 5 — Multiplayer

**Scope:** Quick match, room codes, 2–8 players, position sync ~20 Hz, interpolation.

### Manual verification

| # | Test | Expected |
|---|------|----------|
| 1 | Two devices, same room code | Both see each other in lobby |
| 2 | Host starts race | Countdown sync within ~1s |
| 3 | Move on device A | Device B sees avatar move (slight delay OK) |
| 4 | One player leaves | Slot clears; race continues or ends gracefully |
| 5 | Firebase emulator (optional) | `firebase emulators:start` + app points to emulator |

---

## Part 6 — Win condition & results

**Scope:** Finish line, rankings, rematch, replay stub.

### Manual verification

| # | Test | Expected |
|---|------|----------|
| 1 | Cross finish first | Results rank #1, others #2–#8 |
| 2 | Multiplayer finish order | Correct order on all clients |
| 3 | Rematch | Returns to lobby or countdown |
| 4 | Quit to home | Clean unmount, no ghost listeners |

---

## Part 7 — Polish & monetization hooks

**Scope:** SFX/music, particles, screen shake, daily reward UI, IAP placeholders.

### Manual verification

| # | Test | Expected |
|---|------|----------|
| 1 | Jump sound | Plays when sound on; silent when off |
| 2 | Power particles | Visible burst on activation |
| 3 | Screen shake on hit | Brief camera offset |
| 4 | Daily reward button | Shows timer or claim once per day (local OK) |

---

## Part 8 — Auth, leaderboards, production

**Scope:** Anonymous + Google/Apple, Firestore leaderboards, EAS build.

### Manual verification

| # | Test | Expected |
|---|------|----------|
| 1 | Guest → sign in Google | Same account restores coins (if synced) |
| 2 | Finish race | Score appears on leaderboard screen |
| 3 | `eas build -p android --profile preview` | APK installs and runs |
| 4 | `.env` filled | Login shows "Firebase: configured ✓" |

---

## Cursor / Replit workflow

- **Cursor:** Open `mushroom-blitz-racers/`, reference `docs/BUILD_ROADMAP.md`, say: *"Implement Part 2 only per BUILD_ROADMAP.md"*.
- **Replit:** Prototype isolated snippets (Firebase rules, level JSON); copy winning code into `src/`.
- **Git:** Commit after each verified part: `git commit -m "Part N: description"`.

---

## Screen map (all TSX routes)

```
app/index.tsx                 → Splash
app/(auth)/login.tsx          → Auth
app/(menu)/home.tsx           → Main menu
app/(menu)/character-select.tsx
app/(lobby)/matchmaking.tsx
app/(lobby)/room.tsx
app/game/index.tsx            → Race canvas + HUD
app/game/results.tsx
```

When Part 1 verification passes, ask to start **Part 2**.
