# Neev — Pasted Source Audit and Concrete Code-Fix Blueprint

This companion document is based on the React Native / Expo / TypeScript excerpts pasted into the conversation. It identifies specific code smells and gives concrete repair patterns for the implementation agent. The excerpts may be partial, stale or different from the current checkout: confirm each finding against the real file before changing code. This is not a claim that changes have been made to the user's repository.

## 1. Highest-priority verified-from-excerpts audit queue

| Priority | Area | Concrete issue visible in the pasted excerpts | Required repair |
|---|---|---|---|
| P0 | Family map / phone finder | Hard-coded dine-out names, ratings, distances and AI rationale; hard-coded `0.4m` proximity and "on the sofa" assertion; statement that the app bypasses silent mode | Remove fabricated live claims. Build provider-backed venue search and an honest remote-device command protocol; show source, timestamp, permission, online state and uncertainty. |
| P0 | Event creation | Fixed default date, time and location; automatically assigned task IDs `m-3` and `m-4` | Use real date/time input, sensible local-date default, optional venue and explicit participant/assignee selection from current IDs. No invented members. |
| P0 | Sync / Settings | `handleSyncNow` shows a success toast after `syncAll()` without checking a result in the excerpt | Define a typed sync result and display success only for success; expose partial failure, offline state and authentication failure. |
| P0 | Cache action | `handleClearCache` displays success but the shown handler doesn't clear a cache | Implement real scoped cache clear and verify it, or remove/disable the action. Never make a toast stand in for work. |
| P0 | Privacy language | About/Privacy claim local-only or P2P/offline behavior while Settings describes Supabase cloud sync | Reconcile statements with actual storage, telemetry, crash reporting, backup, AI-provider and sync code. No unverified security claims. |
| P1 | Knowledge list | `filteredEntries.map(...)` inside `ScreenContainer`'s page-wide `Animated.ScrollView` | Make the vertical list the scroll owner and use `FlatList` / compatible FlashList; place filters in list header or a properly coordinated pinned area. |
| P1 | Schedule list | `filteredFunctions.map(...)` and nested `event.tasks.map(...)` in page-wide ScrollView | Use one virtualized parent list, stable keys and row components; keep details bounded and avoid same-axis nested lists. |
| P1 | Typography | `SetuTypography` already applies `normalize()` while building tokens; `AppText` applies `normalize()` to the flattened font size again | Use one scaling source of truth. Remove the second scale pass; test small screens, rotation and accessibility font scale. |
| P1 | Navigation | Root `AuthNavigationGuard`, `RootIndex`, `AppLayout`, `AuthLayout` and onboarding all appear to participate in route replacement | Audit installed Expo Router version; select one coherent guard/redirect owner and test deep links/back stack. Eliminate redirect loops and unnecessary replacements. |
| P1 | Family map lifecycle | Every 15 seconds the map loads locations; radar animation starts looping on mount | Prefer a real subscription with bounded refresh fallback; pause/cancel all animations and polling when screen/modal inactive or app backgrounded. |
| P1 | SSO callback | Callback reads `token` from URL query params and forwards it to auth handler | Inspect protocol. Do not place long-lived tokens in deep-link URLs. Use secure one-time-code/PKCE exchange, validated state and replay protection where supported. |
| P1 | Family game card | Game ideas are hard-coded, while schedules/scorekeeping need end-to-end integration | Bundled rule definitions are fine; sessions, participants, scores, reminders and completion must persist as real user-created data. No fake attendance/points. |
| P2 | Squircle surface | Per-instance layout state and SVG path drawing in `SquircleSurface` / `Squircle` may make large card lists expensive | Profile first. Reserve heavy shape rendering for premium focal surfaces; use a native surface on high-volume rows where visually acceptable. |
| P2 | Animated brand mark | Repeating 9-second animation can keep work active unnecessarily if mounted in hidden screens/repeated rows | Keep the existing Neev emblem, but animate sparingly in the central action and explicit moments. Pause on inactive screens/background and honor reduced motion. |
| P2 | Header buttons | Tiny `HeaderIconButton` includes a `BlurView`; repeated blur/backdrop layers may add native cost without visible benefit | Prefer the existing tokenized solid/translucent surface for small toolbar actions. Keep blur only where its backdrop effect is actually visible and supported. |
| P2 | Icon consistency | Many UI code paths call `Ionicons` directly, while the shared product `Icon` registry also exists | Confirm product icon policy and use one canonical icon layer where appropriate; don't blindly replace brand-specific/vector icons or valid navigation glyphs. |

## 2. Fix typography at its source

The current excerpts show typography tokens are normalized in `src/theme/setuTypography.ts`, then normalized again in `AppText.tsx`. Avoid two scaling passes. A safe immediate correction is to stop re-normalizing the final resolved style inside `AppText` and let React Native's dp layout and user font scaling work normally. Before editing, search all usages of `SetuTypography` to confirm no caller relies on an alternate convention.

### The problematic pattern

```tsx
// SetuTypography tokens already use normalize(baseSize)
const responsiveFontSize =
  typeof flat.fontSize === "number" ? normalize(flat.fontSize) : undefined

resolved = {
  ...flat,
  fontSize: responsiveFontSize ?? flat.fontSize,
  fontFamily: GEIST_BY_WEIGHT[weight] ?? "Geist-Regular",
  fontWeight: undefined,
}
```

### Desired pattern

```tsx
// Treat the resolved token/style fontSize as the final dp value.
// Do not normalize the same number for a second time here.
resolved = {
  ...flat,
  fontFamily: GEIST_BY_WEIGHT[weight] ?? "Geist-Regular",
  fontWeight: undefined,
}
```

Remove the now-unused `normalize` import from `AppText.tsx`. Then inspect the entire typography system and make one deliberate choice: either raw base tokens with one runtime scaling function, or already-normalized tokens with no downstream scaling. Do not mix both models. Don't use viewport scaling to make every font tiny; use responsive wrapping, flex constraints, line limits only where safe, and accessible font scaling.

## 3. Fix Add Event: remove fake defaults and synthetic assignments

The excerpt uses a fixed date, fixed time, fixed home venue and fixed task owners. They make the app feel pre-populated and can create invalid foreign keys. The form should start with only the fields that have a safe default.

### Local date helper for a date-input default

```ts
export function toLocalDateInput(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
```

Use it lazily when initializing a local-date field:

```tsx
const [date, setDate] = useState(() => toLocalDateInput())
const [time, setTime] = useState("")
const [location, setLocation] = useState("")
```

Prefer the date/time picker already installed in the project over free text when appropriate. Validate date and time values before persistence. Display timezone explicitly for multi-region events.

Do not silently create preparation tasks assigned to `m-3` or `m-4`. Instead, allow the user to add a task and choose an existing member from the active family/cluster permission scope. Before save, validate every selected assignee against current authorized membership. When no tasks have been added, save no task records (unless the domain model specifically requires an explicit empty collection).

Disable duplicate save while a save is in flight. Do not emit a success haptic or close the modal until persistence succeeds. On failure, keep the user's form data, display an actionable error and allow retry.

## 4. Fix Add Knowledge: don't invent the author, and make excerpts correct

The excerpt hardcodes a person's name and relationship plus default tags. Derive author identity from the signed-in profile only when the real authenticated profile exists; otherwise leave the author field blank or let the user choose the author. Never imply an elder said something merely because the form opened.

### Correct excerpt helper

```ts
export function makeExcerpt(text: string, maxLength = 80): string {
  const normalized = text.trim()
  if (normalized.length <= maxLength) return normalized
  const limit = Math.max(1, maxLength - 1)
  const boundary = normalized.lastIndexOf(" ", limit)
  const cutAt = boundary >= Math.floor(limit * 0.6) ? boundary : limit
  return `${normalized.slice(0, cutAt).trimEnd()}…`
}
```

Test the helper for empty text, one-character text, exactly the maximum length, above the maximum, multiple spaces, newlines and Unicode content. Preserve the full body unchanged except for deliberately specified normalization. Save the selected family-tree/cluster scope and privacy visibility with the record; never default a new record to whole-family visibility silently.

## 5. Make ScreenContainer and virtualized lists cooperate

The current `ScreenContainer` uses `Animated.ScrollView` whenever `scrollable` is true. That is fine for short static forms and About/Privacy text, but it cannot be the parent of a large virtualized list and also be expected to deliver proper virtualization. Don't simply swap `entries.map()` to `<FlatList>` while leaving it nested inside that vertical ScrollView.

### Required shared design

Build or extend a shared screen shell that owns common safe-area/background/header/footer rules but lets each screen select exactly one vertical scroll owner:

- Static/form/text screen: existing `Animated.ScrollView` is acceptable.
- Flat records: one `Animated.FlatList` root.
- Grouped records: one `Animated.SectionList` root.
- High-volume/recycled records: compatible FlashList only after confirming the installed version and architecture requirements.
- Masonry media: a supported virtualized masonry implementation only when actual uneven-height content needs it.

The screen shell must expose the same `scrollY` shared value and route active scroll events through the collapsing header/dock logic. Use `ListHeaderComponent` for the large title and horizontal category chips when that produces the most reliable gesture behavior. Alternatively pin the category bar only when the product experience requires it. Do not render a vertical list inside a parent same-axis ScrollView. `nestedScrollEnabled` is not a substitute for virtualization ownership.

### Knowledge list acceptance

- Stable `keyExtractor` based on durable entry IDs.
- Memoized row component only where profiling proves it helps.
- Stable event handlers and selectors; pinning one item should not cause every row to repaint needlessly.
- Empty/loading/error/offline states.
- Expanded body text is clamped only in the collapsed state; expansion preserves scroll position and remains accessible.
- Tags wrap without widening the screen.
- Horizontal categories have independent horizontal gestures and never prevent vertical scroll.

### Schedule list acceptance

- Use a virtualized event list, or `SectionList` grouped by calendar date if that better matches the feature.
- Each row uses a stable event ID; task rows use stable task IDs.
- Event expansion is bounded and doesn't create nested vertical scrolling traps.
- Date/time display uses locale-safe formatting; countdown uses a normalized local event date and timezone-aware policy, not string subtraction.
- Task toggle persists and updates the relevant item only; event/task errors are visible and retryable.
- Use real pagination for server histories and dedupe repeated pages.

## 6. Fix the map and phone finder without faking sensor capabilities

The pasted component has hard-coded dine-out suggestions, ratings, distance estimates, accessibility claims, AI rationale, selected member ID `m-4`, and a fabricated exact proximity/room message. The interface must stop saying a phone is 0.4 m away or under sofa cushions unless the device/hardware has actually provided a trustworthy supported measurement. GPS alone is outdoor/area location; it cannot locate a phone inside a room or sofa.

Use separate, honest states:

```ts
export type DeviceFinderStatus =
  | "not_configured"
  | "permission_required"
  | "device_offline"
  | "location_unavailable"
  | "last_location_available"
  | "ring_request_sent"
  | "ring_request_acknowledged"
  | "ring_request_failed"
```

The final application should use the actual existing type conventions if already present, but the UI must distinguish last-known location, current location, command requested and command acknowledged. Show `capturedAt`, accuracy radius, device online/offline, permission state and stale-data warning. If no real device capability exists, say so and offer ordinary safe actions rather than fake radar.

A remote ring command must be authenticated, authorized for the selected device, rate-limited and acknowledged by the target device. It cannot guarantee bypassing Android silent/DND state across all OEMs or devices. Provide an OS-supported notification/sound behavior and document the limitation. Never repeatedly trigger loud audio or strobe effects without explicit user action; make stop/cancel immediate and available from the notification/session where supported.

For venues, use a genuine provider adapter. Store provider name, provider ID, query location, retrieval time and known completeness/limitations. Don't ship arbitrary ratings/distances. Google Places requires its configured credentials and may have billing/quota constraints; an OpenStreetMap-based source has its own attribution and usage policy. Do not present a manual venue or fallback result as a Google/AI suggestion. If online lookup is unavailable, enable manual venue creation.

Pause location subscriptions and animations when the map/screen is inactive. Avoid unconditional 15-second polling where a realtime subscription or a slower lifecycle-aware fallback is sufficient. Do not expose a family member's coordinates just because they belong to a tree: enforce the actual location-sharing permission at query time.

## 7. Fix Settings operations so they do real work

### Sync button

The current excerpt can display a success message after `await syncAll()` without examining outcome. First define the actual return type of `syncAll()` in the source. Then render success only for complete success. If it is a `Promise<void>`, change the service contract to return a useful typed result or expose state that distinguishes completed/partial/failed. Catch errors, preserve unsynced local edits, and prevent duplicate sync actions.

### Notification switches

The three `useState(true)` values are transient component state unless deliberately persisted elsewhere. Bind each preference to the canonical persistent settings store or backend. Distinguish:

- user's choice to enable a type of reminder;
- system-level notification permission;
- scheduled notification state;
- last successful delivery/registration state where the platform exposes it.

Changing a switch must call a real service, persist the new setting, reschedule/cancel only the relevant notifications and roll back or explain if that action fails. Use optimistic UI only with rollback. Avoid showing health, location or family secrets in lock-screen notification text by default.

### Clear cache

Either implement a scoped and safe cache clear that actually deletes the intended cache and preserves the family database, or remove the action. After a destructive operation, verify the postcondition before reporting success. Do not say “cache refreshed” when no cache function ran.

### Sign out

The shown `catch` redirects to sign-in even if `signOut()` throws. That can leave a valid session while the UI pretends it signed out. On failure, keep the user in a stable recoverable state, show a generic error and log only redacted diagnostics. On success, clear session-scoped in-memory caches and private subscriptions, preserve data according to the documented local/offline ownership contract, then let the single route guard navigate to sign-in.

## 8. Fix routing with one source of truth

The excerpts indicate the root `AuthNavigationGuard`, root index redirects, authenticated layout redirects, auth layout redirects and onboarding imperative navigation all make overlapping routing decisions. Audit the actual Expo Router version before editing. Choose one source of truth for session bootstrap and route protection; leave child screens focused on their own job. Preserve intended deep-link destinations through sign-in if supported. Don't call `replace()` on every focus or on every render.

Acceptance tests:

- cold start while signed out;
- onboarding incomplete;
- onboarding complete and signed out;
- authenticated direct link to a protected screen;
- sign-out success/failure;
- session expiration;
- cancelled/failed/successful Setu SSO;
- app resumed from background;
- Android back from modal and auth stack.

The Setu SSO callback must validate state and must not leak long-lived tokens in a URL, logs or navigation history.

## 9. Replace fake family suggestions with an honest, real planning flow

A working family-dining workflow should let the user define the goal, date/time window, attendee list, meeting-area preference, transport assumptions, mobility/accessibility needs, dietary needs, pet policy and budget. It can then:

1. Fetch live venue data from a configured provider, or clearly say lookup is unavailable.
2. Calculate travel/meeting suitability from actual locations that each person has consented to share; don't reveal precise member positions to every invitee.
3. Keep provider rating, travel estimate and AI explanation separate from one another.
4. Let a user review the candidate and override the AI.
5. Confirm the date/time, participants, venue, budget, reminders and responsibilities.
6. Persist the confirmed event to the correct family tree or cluster scope and use the existing notification/calendar service.
7. Show invitations and RSVP status from actual records.
8. Support cancellation, reschedule, offline draft and retry without duplicate events.

Without a model key, deterministic filters and manual planning must remain usable. With BYOK, validate the key securely and never present AI text as verified venue facts.

## 10. Family games should strengthen real-world interactions

Bundled definitions such as carrom, singing, charades and family storytelling are not fake data by themselves; they are content. Their live sessions must be real records. Creating a game session must select a real family/cluster scope, time, participant(s), optional team, accessibility options and reminder choice. Scores are explicit user inputs with undo/correction. Ending a session records the actual completion state and optionally lets users add a story to the Knowledge Vault after confirming its sharing scope. The mobile app may assist with a timer, scorekeeper, prompts or RSVP, but default recommendations should encourage in-person play, not endless screen use.

## 11. Design/component details from the excerpts

- `AppHeader`: compact single title, concise subtitle, balanced left/right controls and no duplicated static/collapsing header. The title must not overlap controls on small screens or with long translations.
- `HeaderIconButton`: don't allocate an expensive blur layer for each 40dp control without visible value. Use the theme surface and canonical touch feedback; keep 48dp accessible hit targets even if visible glyphs are smaller.
- `ScreenContainer`: reserve the dock inset once, not multiple times. The content bottom, footer safe area and dock should not each independently add the same clearance. Validate the last button can be reached above the dock.
- `CollapsingHeader`: use one measured title height and one scroll source. Avoid JS state updates on each scroll frame. Confirm the large title scrolls away while the compact header remains readable and the pinned bar never blocks touches unexpectedly.
- `CustomTabBar`: preserve Neev's center action and existing logo. Confirm route names match the actual Expo Router tree. Animate only needed properties with stable worklets; keep label alignment correct on gesture-nav and three-button Android navigation and at tablet widths.
- `AnimatedNeevLogoIcon`: the vector mark geometry stays canonical. The loop must stop while inactive/backgrounded and obey reduced motion. Do not use this as a default animation inside each list row.
- `SquircleSurface` / `Card`: inspect surface stacking, clipping, shadow placement and child layout. The current component paints SVG after layout and can be expensive at scale; prefer simple native surfaces for repeated list cells when practical.
- `GlassOrbButton`: use on a camera/media surface where it is designed for. Do not transplant expensive camera-control styling into ordinary list/settings rows.
- `Toast`, `CustomAlert`, `MindfulNotificationBanner`: validate touch-through, tap to dismiss, swipe dismissal, accessibility, theme behavior and animation cleanup. A transparent overlay must not intercept interactions when hidden.
- Product icon policy: use one coherent system for action icons. No emoji, starburst/sparkle decoration or random icons. The launcher icon is only the launcher/OS icon; in-app vector mark and action iconography are separate.

## 12. Release proof required for these issues

Before marking a fix complete, capture or record:

- Before/after behavior and root cause.
- Files changed, including shared component call sites.
- Typecheck/lint/test results from the project's actual package manager and scripts.
- Android build result after native/config plugin changes.
- Real-device checks for map permission, background/foreground location lifecycle, phone-ring command/acknowledgment, notifications, sign-in/out and scrolling where a device is available.
- Test evidence that two unrelated family trees cannot query each other's member locations, schedules, Knowledge Vault items, AI retrieval context or media.
- Honest limitations for any provider/API or device capability that could not be tested.

Do not mark a finding fixed from source inspection alone when the failure requires a runtime/device test.

## References to official API documentation

Check these references against the project's installed versions before implementation:

- React Native `FlatList`: https://reactnative.dev/docs/flatlist
- React Native `VirtualizedList`: https://reactnative.dev/docs/virtualizedlist
- React Native list performance: https://reactnative.dev/docs/optimizing-flatlist-configuration
- Shopify FlashList v2 and New Architecture requirement: https://shopify.github.io/flash-list/docs/v2-migration/
- Expo Router authentication: https://docs.expo.dev/router/advanced/authentication/
- Expo Router protected routes: https://docs.expo.dev/router/advanced/protected/

Never assume the current project's installed version matches the latest documentation. The lockfile and `package.json` remain the source of truth for installed dependencies.
