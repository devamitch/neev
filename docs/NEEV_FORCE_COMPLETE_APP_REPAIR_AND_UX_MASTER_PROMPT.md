# NEEV — FORCE-COMPLETE APP REPAIR, PRODUCT FINISHING, UI/UX, PERFORMANCE, MAPS, FAMILY FEATURES & RELEASE

> **Execution contract for Antigravity and every coding agent working in this workspace**
>
> This is an implementation order, not a request for advice, a plan-only response, a redesign proposal, or another documentation-only deliverable. Continue the existing Neev application. Inspect its real source, make the code changes, run the available checks, fix the failures you uncover, and continue until the acceptance criteria in this document are met or a concrete external blocker has been proven. Do not stop after auditing, after writing a plan, after fixing one screen, or after making the app look better in a screenshot.

---

## 1. Mission and definition of success

The Neev app already exists, but its current experience is not reliable enough to use. Screens look inconsistent and unfinished; headers are too large or poorly coordinated; content overflows; scrolling and nested lists behave badly; performance is laggy; rerenders and animations may be causing glitches; settings, logout and other important actions must work correctly; maps and family features need to be complete; native Android configuration must be correct; and JavaScript/native crashes must be diagnosed rather than hidden.

**Your mission is to repair and finish the actual application end to end.** Do not replace an existing product with a prototype. Do not build a parallel design system while leaving the current screens broken. Do not add impressive-looking components that do not use real application state. Do not declare completion because TypeScript passes or the home screen looks good.

The finished app must be:

- Visually coherent, calm, modern, polished, family-friendly and genuinely usable on real Android phones.
- Compact and responsive, with no clipped, overlapping, off-screen or unreachable content at supported screen sizes and font scales.
- Fast, stable and predictable, with appropriate list virtualization, bounded rendering work, stable state subscriptions and no unnecessary animation work.
- Functionally complete: every visible action has a real, correct outcome, including empty, loading, error, offline, permission-denied and success states.
- Consistent with the existing Neev brand and the actual implementation patterns found in BlinkQuest, while retaining Neev’s own product identity.
- Private by default. Family relationships must not silently grant access to every member’s location, health data, personal notes, private plans or every family tree.
- Supabase-first for backend/auth/data/storage/vector search, consistent with the project’s existing architecture and the supplied Neev specifications.
- Honest about free-service limits, Android permissions, GPS precision, provider availability, and the capabilities that depend on APIs or user-supplied keys.
- Buildable, testable and maintainable with the installed project versions. Do not blindly upgrade the stack or add incompatible packages.

**Do the work in this run.** You may organize internal tasks among agents, but that is not permission to stop at a task list. Keep integrating changes, testing them and correcting regressions until all feasible work is complete. If a real external dependency blocks one capability, finish everything else, implement a useful safe state/fallback, document the exact blocker, and never fabricate success.

## 2. Read the real project and preserve existing work first

Before editing:

1. Find the actual Neev mobile-app workspace, its website/admin workspace, and the BlinkQuest implementation in the available repositories/workspace. Do not guess their paths. If more than one repository is present, map their roles and dependencies.
2. Read each applicable `AGENTS.md` from the repository root down to the relevant subdirectories. Follow repository-specific instructions.
3. Read `package.json`, the active lockfile, Expo app configuration (`app.json`, `app.config.ts/js`), TypeScript configuration, Babel/Metro config, navigation/router setup, theme tokens, lint/test scripts, EAS/build configuration, native Android configuration, and all existing crash/performance logs provided in the workspace.
4. Read the existing Neev documentation and supplied architecture documents in full, especially:
   - `Neev_Complete_Master_Architecture.md`
   - `Neev_Complete_Supabase_First_Master_Implementation.md`
   - `Neev_Family_Network_Privacy_and_Implementation_Master.md`
   - Any existing implementation, product, route, UX, security, family-permissions, deployment, testing or release documentation in the repository.
5. Inspect BlinkQuest source, not merely screenshots or descriptions. Identify the actual reusable patterns for visual hierarchy, compact headers, the bottom-tab animation, icon/illustration treatment, spacing, color usage, motion, safe areas, loading/empty states and interactions. Reuse and adapt the working implementation patterns that fit Neev. Do not copy unrelated product screens or create a fake visual imitation.
6. Run `git status --short`, inspect recent changes and uncommitted work, and understand what is already modified. Preserve valid uncommitted work. Do not reset, overwrite, discard or mass-delete code, generated assets, local configuration, secrets, user data or changes made by other agents.
7. Establish a baseline: run the existing checks and the app/build as far as the environment permits. Record the exact initial failures, warnings, crashes, slow paths and overflow issues. Do not conceal the baseline failures by weakening checks.
8. Build a complete route/screen/component inventory from the codebase and compare it with the app navigation and existing product requirements. Include hidden/detail/modal/settings/onboarding/auth/invitation/error/empty screens, not only bottom-tab screens.

If a referenced file is outside the current checkout or unavailable, search the workspace and report that exact limitation in the final summary. Do not pretend to have read a file you could not access.

## 3. Rules all agents must obey

The lead agent is responsible for orchestration and the final integrated result. Agents are helpers, not independent projects.

- Assign parallel work by clear ownership boundaries: (A) screen and route inventory/UI repairs, (B) performance/rendering/listing/scrolling, (C) maps/location/Android native integration, (D) family/access/security/settings flows, (E) tests/build/release review. Adjust these boundaries to match the real repository.
- Every agent must inspect the existing implementation before changing it, reuse current components where possible, and communicate modified files and public interfaces to the lead agent.
- Avoid two agents editing the same shared component, theme, route layout, navigation file or configuration simultaneously. Have one owner for shared infrastructure and require integration review before merging changes.
- Do not accept isolated agent results without compiling, testing and reviewing their integration in the main app.
- Do not create multiple competing design systems, duplicate headers, duplicate settings flows, alternate auth systems, duplicate API clients, or parallel repositories for the same function.
- Use the project’s installed package manager and scripts. Do not switch package managers. Do not upgrade Expo, React Native, Reanimated, Skia, navigation, TanStack Query or other foundational packages without a demonstrated compatibility/security need, an explicit compatibility review, and a successful rebuild.
- Do not add dependencies simply because a library is popular. Check whether the current stack already provides the capability. For any proposed dependency, confirm React Native/Expo/New Architecture/Android compatibility and maintenance status using official documentation.
- Do not silence TypeScript, lint, runtime errors or failing tests with blanket `any`, `@ts-ignore`, empty catch blocks, disabled lint rules, test deletion, broadened permission grants or weakened assertions. Fix root causes.
- Never use dummy data to make a broken production flow appear functional. Fixtures are allowed only in explicit tests/story previews and must never masquerade as live family, health, location, event or account data.
- No screen is “done” until the screen is responsive, its primary and secondary actions work, loading/empty/error states are designed, and it has been tested at realistic content sizes.
- Do not leave TODO-only buttons, dead-end routes, placeholder cards, fake sync indicators, nonfunctional save buttons or “coming soon” features for functions represented as available.
- No new dashboard, admin site, backend project, vector provider or auth provider unless the architecture review proves it is required. Use the existing Neev website for web/admin controls and Supabase for the backend platform.
- Never claim that build, device, performance, security or UI tests passed unless they were actually run and their results inspected.
- If a requested capability is technically impossible under Android restrictions, free provider quotas or the current device permissions, explain it, ship the best honest fallback, and mark only that specific acceptance item as externally blocked.

## 4. Product boundaries and backend constraint

Neev is a private family operating system, not a social network or advertising platform. Its core purpose includes family relationships, trusted spaces, planning and follow-through, shared events, traditions, reminders, family games, family wellbeing, optional location sharing, approved health summaries and useful family-aware AI.

Use **Supabase as the single backend platform** for authentication, Postgres data, Row Level Security (RLS), private object storage, Edge Functions, scheduled/queued backend work where supported, Realtime where it truly helps, and `pgvector` retrieval. Do not quietly add Firebase, a separate hosted vector database, an additional auth provider, a paid mandatory automation platform or a second source of truth.

External AI or maps providers may exist behind provider adapters when required, but the core app must continue to work without a paid key. BYOK is optional and user-controlled. Supabase Free is a practical starting tier, not a promise of unlimited storage, compute, uptime, AI inference, maps, background jobs or notifications. Implement quotas, graceful limits, monitoring and provider replacement points.

Keep the existing architecture if it is sound. Where code contradicts the architecture, make the smallest safe correction that delivers the product requirement. A schema or API change must include migrations, type updates, app changes, security rules and tests; do not update only the UI.

## 5. Perform a complete screen-by-screen UI/UX rescue

Create or update one canonical screen inventory in the repository. For every route, record its purpose, shared layout, data dependencies, main actions, responsive behavior, loading/empty/error/offline states, and verification method. Then actually inspect, repair and verify every listed screen.

At minimum, inspect every screen and sub-route associated with:

- First launch, onboarding, permissions education, account creation, sign-in, sign-out, account recovery, session expiration and account deletion.
- Home/dashboard, quick actions, personal overview, family overview, household/cluster switchers and activity summaries.
- Personal Space, Nuclear Space, Family Sanctuary, other custom family spaces and privacy controls.
- Family creation, joining, invitation acceptance, invitation expiration/revocation, family member details, family tree, relationship editor and cluster management.
- Plans, goals, tasks, timelines, reminders, schedule/calendar, meetings, family outings, meals/dine-outs, invitations, RSVP and event details.
- Map, live/last-known family location, member/place details, location-sharing settings and device-finding flows.
- Health/fitness integrations, data-type permissions, health summaries and family-sharing controls.
- Traditions, family stories/memories, photo/media content and weekly real-world family games.
- Notifications/inbox, deep-link destinations, search, search results, filters, sheets, confirmation dialogs, profile, preferences, theme, permissions, connected accounts, API keys/BYOK, storage, privacy, security and settings.
- Every modal, drawer, bottom sheet, detail view, sub-tab, section, context menu, empty result, error fallback, offline screen and route reachable by a visible action.

### 5.1 Visual direction

Aim for a polished, understated, contemporary mobile experience: generous breathing room without wasted space; clear hierarchy; restrained card use; carefully aligned baselines; precise typography; meaningful content density; predictable navigation; and purposeful motion. No generic dashboard template, huge empty hero section, oversized page titles, decorative statistics with no user value, excessive rounded cards, random gradients, heavy blur, unnecessary borders, or stacks of nested containers.

Use this green pista/soft sage palette as the starting brand direction and map it to the existing token system rather than scattering literal hex codes throughout the app:

```css
--color-primary: #7d8c7d;
--color-on-primary: #ffffff;
--color-primary-container: #e0ede8;
--color-on-primary-container: #3d5250;
--color-primary-fixed: #d3e5dc;
--color-primary-fixed-dim: #a8c0b8;
--color-primary-dim: #5a6f69;
--color-on-primary-fixed: #0e1e1b;
--color-on-primary-fixed-variant: #3d4946;
--color-inverse-primary: #a8c0b8;
--color-surface-tint: #7d8c7d;
```

Inspect all existing light/dark theme tokens before changing them. Complete missing semantic tokens for background, surface, surface variants, outlines, error, warning, success, disabled, text, secondary text, scrims, focus and navigation. Check text contrast, selected/unselected states and disabled controls. Do not use the primary sage color for every surface or text element. Use neutral surfaces and the palette as an accent. Avoid inventing a second unrelated palette.

### 5.2 Headers, safe areas and navigation

- Fix the current oversized headers. Titles should be compact, responsive and subordinate to their actual content. Use a consistent type scale and shared header primitives.
- Avoid double headers caused by React Navigation headers and custom screen headers rendering together. Decide route-by-route which layer owns the header and document the rule in a reusable layout.
- Implement safe-area insets correctly for status bar, edge-to-edge Android, top app bars, gesture navigation, bottom tabs, bottom sheets, and the keyboard. No content should sit underneath system UI or the tab bar.
- For long screens, use compact/sticky headers where useful; collapsing headers must animate predictably, not jump, clip titles, flicker or steal scroll gestures.
- Ensure automatic header show/hide behavior cannot leave a blank strip, cover content or cause a layout jump. Handle route transitions and focus state consistently.
- Ensure back behavior is correct for Android system back, nested navigators, modal routes, maps, unsaved forms and deep links.
- Keep the bottom tab bar consistent with the actual BlinkQuest implementation patterns. The Neev identity mark may have a playful, alive, expressive vector animation, not an unchanging generic icon. The animation must remain subtle, performant, accessible, non-distracting and not play a costly infinite animation when the screen/app is inactive.

### 5.3 Bottom-tab icon and illustration requirement

Inspect BlinkQuest’s actual icon/illustration and animated tab-bar implementation and adapt the working technique. Use the Neev launcher asset **only as the Android app icon/launcher asset where applicable**; do not repeatedly paste a launcher PNG into cards, empty states, tab graphics or in-content illustrations.

Use one consistent installed icon system for normal actions, with consistent stroke/size/alignment and clear semantics. No emoji as functional icons. Avoid mixing random icon families or using Unicode symbols as substitutes. Use React Native Skia/SVG/vector drawing for meaningful custom illustrations, and use Reanimated for controlled motion where appropriate. The Neev mark in the bottom navigation can have a small personality/expressive state (idle, active, success, reminder, family moment) using vector shapes—not a pile of unrelated PNGs. Respect reduced-motion/accessibility settings and stop or reduce offscreen work.

Create reusable illustration components only where they communicate meaning (empty family tree, no events, location unavailable, syncing, memory, game, success/error). Keep them simple, branded and small. Do not create decorative artwork that pushes actual tasks off-screen.

### 5.4 Forms and action feedback

Every form must have clear labels, proper keyboard types, validation near the field, submit/loading states, disabled states, cancellation/back handling and server-error messaging. Avoid layout jumps when validation errors appear. Prevent double submissions. Keep the primary action reachable above the keyboard when practical. Ask confirmation for destructive actions and show undo where feasible. Every button/action must have a tested outcome.

## 6. Scrolling, list virtualization and large-content behavior

Fix scroll behavior deliberately. Do not just add more `ScrollView` wrappers or nest lists until the screen appears to scroll.

### 6.1 Pick the correct container

- **`ScrollView`:** short, finite screens and forms whose total content is known to be small.
- **`FlatList`:** long homogeneous lists with stable keys, windowing, pagination/load-more where useful, and optimized row rendering.
- **`SectionList`:** grouped items with real section semantics (for example dates, family branches, activity categories or settings groups).
- **FlashList:** only where the installed/current compatible version is appropriate, the project supports its requirements, and profiling demonstrates value. Verify current official docs and the installed version before using version-specific props.
- **Masonry layouts:** use a supported virtualized masonry implementation only where visual content truly requires uneven-height columns (photo/memory galleries). Provide stable keys, image aspect ratios and loading placeholders. Do not simulate masonry with hundreds of separately mounted nested lists.
- **Horizontal carousels:** can be placed within a vertical list when the gesture axes and measurement are designed correctly. Do not put multiple same-axis virtualized lists inside a same-axis `ScrollView` to make virtualization warnings disappear.

### 6.2 Nested scrolling and sheets

- Avoid nested vertical `FlatList`/FlashList instances. Prefer one parent virtualized list with `ListHeaderComponent`, `ListFooterComponent`, a composed data model, or a `SectionList`.
- For a screen with several types of content, compose its sections into one vertical virtualized surface, rather than a `ScrollView` wrapping several independently scrolling lists.
- For tabs that need independent scroll position, keep each tab’s list bounded and properly keyed; do not mount every heavy tab's contents simultaneously.
- Bottom sheets must use the already installed and compatible sheet/gesture implementation where possible. Coordinate pan gestures, inner scrollables, safe areas, keyboard behavior, snap points, nested horizontal carousels, backdrop taps and Android back.
- A bottom sheet’s content must remain scrollable when it exceeds its height. Test short and very long sheet content, text input focus and keyboard open/close cycles.
- Do not disable scrolling globally to resolve one gesture conflict. Fix the ownership/gesture configuration.
- Track scroll offsets on the UI thread when animation needs them. Do not call React state setters on every scroll event unless there is a proven need.
- Use `getItemLayout` only when row height is truly fixed; inaccurate measurements cause scroll jumps. Use stable IDs, never array indexes for mutable rows.
- Implement empty, loading skeleton, retry and end-of-list states without breaking virtualization. Keep pagination deduplicated and race-safe.
- For very large media and family activity histories, test memory, fast flings, image decoding, orientation/size changes and repeated navigation away/back.

### 6.3 Scroll acceptance checks

Test every vertically scrollable screen from top to bottom. Verify the last content item and its action can be reached; the bottom tab bar does not cover the final row; the scroll indicator matches content; refreshing does not trap the gesture; opening/closing a sheet preserves expected scroll; keyboard appearance does not hide the submit button; nested gestures do not freeze; content refresh does not unexpectedly jump to the top; and headers do not flicker or oscillate.

## 7. React Native performance and runtime stability

The app is not a heavy game or video editor. It should feel immediate on mid-range Android hardware. Optimize based on evidence, not by adding `memo()` to every function or making speculative rewrites.

### 7.1 Establish measurements

- Run the existing app on a real Android device or available emulator using a development/release-like build. Measure startup, navigation transitions, time-to-content, scrolling, modal open/close, map interactions, list rendering and memory where tools permit.
- Capture JS and native logs while reproducing slow or crashing screens. Identify whether each issue is JavaScript, React render churn, layout, image decoding, bridge/native, database/network, map rendering or a third-party component.
- Use React Native DevTools/React Profiler or the existing project tooling where supported. Measure before and after critical improvements. Do not make unsupported numerical performance claims.
- Add only lightweight debug instrumentation needed to identify regressions; remove noisy temporary logging from production.

### 7.2 Rerender control

- Inspect Zustand selectors. Subscribe components only to fields/actions they need; avoid selecting an entire large store into every screen. Keep computed selectors stable and avoid creating fresh objects/arrays unnecessarily.
- Review React Query/TanStack Query keys, stale times, cache retention, cancellation, deduplication, optimistic updates and focus/reconnect behavior against the current app needs. Prevent screen focus from triggering needless full reloads.
- Stabilize item callbacks/props where it demonstrably helps virtualized rows. Memoize expensive components, not every primitive. Avoid `useEffect` that writes to state in response to state it just set; break accidental render/effect loops.
- Remove derived state that can be computed cheaply; avoid duplicated data across context, Zustand and React Query. Define one source of truth for each state domain.
- Do not run timers, intervals, repeated location polls or large computations while the screen is inactive. Clean up subscriptions, listeners, animation callbacks, geolocation watchers, app-state handlers and network requests on unmount/background transitions.
- Avoid synchronous large JSON parsing, embedding, sorting or media processing on the JS thread. Paginate/chunk work or move suitable native/heavy processing off-thread only if needed and properly supported.
- Avoid keeping hidden, expensive screens mounted unless state-preservation requires it. Keep tab transition behavior smooth and intentional.

### 7.3 Reanimated and Skia

Use the installed `react-native-reanimated` version and APIs. Use UI-thread worklets for appropriate gesture/scroll/visual animations, and use `react-native-skia` for custom vector artwork or drawing where it brings real value. Do not introduce arbitrary per-frame JS state updates. Avoid allocating large objects in a worklet frame, rebuilding expensive Skia trees unnecessarily, or animating large blur effects on every screen. Respect package compatibility, Babel/plugin setup, New Architecture requirements and the native rebuild process.

Prioritize motion for meaningful interactions: tab selection, a tasteful Neev mark, shared transitions where already safely supported, sheet movement, small press/selection feedback, map panel movement, and game moments. Not every element needs to move. Motion must not delay a user’s action or hide important information.

### 7.4 Images, media and memory

Reuse existing image components/caching approach if sound. Use correctly sized thumbnails, stable aspect ratios, lazy loading, memory-conscious decode sizes and placeholders. Avoid decoding full-resolution photos into tiny cards. Release listeners and native resources correctly. If media galleries use masonry/shared transitions, test them on weaker Android devices and ensure the safe fallback works when an animation cannot be completed.

### 7.5 Network and offline behavior

Deduplicate requests, cancel stale requests, avoid N+1 family/profile fetches, paginate histories, cache read-mostly data securely and show freshness clearly. Avoid spinning loaders forever. Offline and server errors must not erase local unsaved work. Prevent rapid taps from creating duplicate invitations, events, tasks or location-sharing sessions. Never silently use fabricated cached location/health values as current live values.

## 8. Family privacy and permissions: implement actual authorization

Neev supports independent family trees and overlapping clusters: personal, nuclear family, joint family, sibling, cousins, distant relatives, in-laws, marriage/wedding groups, cultural/tradition groups, care circles and user-created clusters. A person can have a contact/profile entry without owning an account or phone. A relationship is not an authorization grant.

**Apply privacy in the database and backend as well as in the UI.** Build and test these invariants:

- A member of Family Tree A cannot query Family Tree B unless a specific, explicit cross-tree relationship/grant provides narrow access.
- Being a parent, spouse, sibling, guardian, admin or cluster organizer does not automatically make every category of another member’s data readable.
- Personal notes and personal plans default to self-only. Sharing requires a clear recipient/scope and is revocable.
- A cluster’s membership permits access only to records explicitly scoped to that cluster and only according to the member’s capability for that record type.
- The server verifies authorization for every row/read/write, Storage object, signed URL, realtime subscription, Edge Function, vector-search result, export and background job.
- Hidden UI is not security. Client-supplied `family_id`, `cluster_id`, `user_id`, role, `isAdmin`, age or permission flags must never be trusted without server verification.
- Cross-family wedding/meal/event planning shares only the specific event details necessary for invitees. It must not merge private family trees or reveal all family-member profiles.
- Every permission/relationship change invalidates or refreshes relevant cached data, and revoked members cannot keep pulling new protected data from existing subscriptions or endpoints.

Use the actual canonical family-tree/network model in the provided Neev docs. Avoid creating one giant `family_members` table whose family ID becomes a global access key if that contradicts the approved schema. Make RLS tests with at least two completely unrelated test families, overlapping clusters, an invited guest, a former member, an accountless relative and users with multiple family memberships.

## 9. Complete family creation, joining, invitations and relationships

Make family setup usable for people who are not technical. Do not require every family member to install Neev or have a phone number before the tree can be useful.

### Family creation

- Create a named family tree with creator/owner designation, a minimal required profile, privacy defaults and the first cluster/space only if needed.
- Add known relatives without an account using minimal fields, relationship to the creator, and optional notes. Do not force collecting phone/email, date of birth, exact location or health data.
- Allow later corrections to name, relationship, dates and spelling, with a clear relationship-edit/approval process where appropriate.
- Explain who can see the tree and what is private before sharing or inviting others.

### Invitation and join

- Support link/code invitations with explicit target tree and optional cluster, scope, expiry, inviter, allowed role and remaining uses. Make invitation URLs unguessable, rate-limited, revocable and safe to share.
- Preview the inviting family name and requested access before accepting. Do not auto-join based solely on knowing a link or a contact match.
- Support existing account sign-in, new account creation, account linking, invitation expiry, revoked/used invite, wrong-account handling and network failure.
- Never silently link a user to a person record because the names or contacts look similar. Provide a verified “claim this relative profile” flow, requiring appropriate proof/approval and avoiding duplicate accounts.
- Joining a tree grants only the approved base role and explicit clusters/scopes. The user must not inherit access to other family trees the inviter belongs to.
- Let users review and leave tree/cluster memberships, view active sessions/shares, revoke invitations and understand the effects of deletion or departure.

### Relationship graph

- Model relationships as typed, validated, auditable edges; do not calculate all kinship from display names or a single free-text field.
- Support biological/adoptive/step/guardian relationships, spouses/partners, in-laws and culturally specific terms without forcing a single family structure. Preserve user-corrected/displayed family terms.
- Support unknown, private, disputed or not-yet-confirmed relationships without publishing them as fact.
- Detect likely duplicate person records but never merge automatically based on name/phone alone. Make merge/unmerge safe and auditable.
- Render the family tree progressively and efficiently. Very large trees need search, branch focus, zoom/pan, accessible list alternative and lazy expansion rather than rendering every node at once.
- Support one profile appearing in multiple trees while each tree stores its own relationship graph and privacy context. Never turn shared identity into shared permissions.

## 10. Settings, profile, sign-out and account controls

Treat settings and logout as critical paths, not low-priority screens.

- Create one coherent settings information architecture using reusable section rows, compact headers, descriptions, current values and clear navigation.
- Ensure each option opens the correct screen and persists its new value. Show errors and retry rather than silently reverting.
- Include profile and account details, active family/tree memberships, privacy/sharing, notifications, connected services, AI/BYOK provider, appearance/accessibility, location permissions and sharing duration, health-data consent, security/session controls, storage and deletion options where supported.
- Sign-out must clear in-memory/private cached state and subscriptions without deleting a family tree or cloud account. A different signed-in user on the same device must not see previous-user private cached information.
- Handle expired sessions, account deletion, deletion confirmation, backend deletion or export states, and failures transparently. Deleting an account must not leave hidden active tracking, notification jobs or share links behind.
- Do not expose secrets, raw API keys or sensitive provider error messages in logs, analytics, screenshots or user-facing messages.

## 11. Full-screen map and family location features

The map should feel like a real full-screen map experience—not a tiny map card trapped inside a dashboard. Implement a map viewport with native zoom/pan/pinch where the installed library supports it; recenter, search, map-type/style choices where available, accessible zoom controls, clear attribution, selected-member details, marker clustering, location age/accuracy, loading/error states and a coordinated bottom sheet/list. Prevent map gestures from being intercepted by nested scroll containers.

### Provider and cost strategy

- Audit the existing map implementation first. If MapLibre is compatible with the installed React Native/Expo/New Architecture configuration, it is a strong candidate for a flexible map renderer. Confirm this against official docs and the exact installed versions before installation, plugin changes or native rebuilds.
- Keep map style/tile/geocoding providers behind configuration/adapters, not hard-coded throughout the app.
- Do not claim public OpenStreetMap tile servers are free unlimited production infrastructure. Respect their usage policy, attribution, caching, identification, rate limits and no-bulk-prefetch requirements. Choose an appropriate provider with a genuinely usable free tier or a self-hostable option once real quotas and deployment constraints are assessed. The core app must offer a graceful provider error state.
- Basic map display and local user location must not require a paid Google Maps key. Google Places/Calendar/other Google capabilities can be optional integrations only with explicit setup and current quota/billing verification. Never secretly create paid dependencies.
- AI-based place or itinerary suggestions must be optional and must show the source/limits of the suggestion. Deterministic nearby-search or manually entered destination fallback must exist.

### Consent-based live location

- A member must explicitly opt in to share location, choose which tree/cluster/person can see it, select a duration or schedule, and be able to pause/stop at any time.
- Foreground location and background location are separate permission/use cases. Explain why each permission is requested immediately before the OS prompt. Request the minimum permission required and only at the point of use.
- Show an obvious active-sharing indicator/status, recipients, last update time and whether the data is fresh, stale, approximate, unavailable or permission-denied. Do not present last-known position as live.
- Provide granular options such as share for a limited duration, only during an outing, check-in sharing, emergency temporary sharing and no location sharing. Defaults should be conservative.
- On permission revocation, sign-out, account removal or share expiration, stop future acquisition and upload, cancel jobs/subscriptions and revoke read access. Implement retention/deletion rules for prior points.
- Throttle updates based on movement, foreground/background mode, battery/network and required use case. Do not upload a GPS point every second for all family members. Provide explicit freshness/accuracy trade-offs.
- If family members appear on the map together, render only those who have an active grant for that viewer. Being in the same household or family tree is not enough.

### Important Android limitations

Background location requires correct native manifest/configuration, user permissions and Android-version-specific behavior. Use an actual development/release build to test it; do not claim Expo Go is sufficient for all background services. Review the current Expo permission/config documentation and store policy when editing `app.json`/`app.config.*` and plugins. Do not request broad location permissions “just in case”.

GPS cannot reliably identify an exact indoor sofa/cushion location. Show accuracy radius, timestamp and last-known location honestly. If the app supports remote ringing, it can only do so through an authorized installed device that is online/reachable and has an appropriate notification/native implementation. Android may restrict sound during silent/DND or when the app/device is offline. Do not promise that Neev can bypass OS locks, sound restrictions, device-off state, revoked permissions or unavailable connectivity.

### “Where is my phone?”

Build a secure, consent-based lost-device workflow: show this device’s status, last permitted location, time and accuracy, offer directions/recenter, and provide an authorized “ring this device” action if supported. Verify device ownership/session and do not let any family member silently locate another member’s phone. Do not build covert tracking, an invisible location service, a hidden microphone/camera, or a bypass around Android security. Clearly distinguish Neev’s supported feature from system-level services such as Google’s official Android device-finding tools.

## 12. Health Connect and personal data integration

Use Android Health Connect as the current Android health-data integration path when compatible with the existing app and actual device. Do not assume the retired/legacy Google Fit APIs are the only route. Confirm current Health Connect library/API details, Android version support, declarations, permissions and Play policy before implementation.

- Request permission per health data type and only when the member explicitly enables that integration.
- Explain which data Neev reads/writes, why, where it is stored, how to disconnect and how to delete it.
- Separate on-device personal data, synced private server data and explicit family-shared summaries. A family tree must not unlock another person’s steps, sleep, heart rate, exercise routes or health records.
- Make each share opt-in and data-type-specific, revocable and time-bound where suitable. Children’s health data receives conservative defaults and stricter sharing controls.
- Avoid collecting or syncing data just because the API allows it. Keep minimum required fields and retention windows. Avoid health content in push notifications or analytics by default.
- Clearly mark data freshness, missing permission, source and synchronization state. Never make up a value when Health Connect is unavailable.
- Keep UI informational rather than diagnosing or presenting unsupported medical conclusions.

## 13. Meetings, family meals, outings and useful suggestions

Make it possible to plan real-world family time in one place.

- Support event creation, date/time/time zone, duration, optional location, host/organizer, participants, cross-tree guest invitations, RSVP, notes, reminder schedule, edit/cancel and completion/feedback.
- Support family meals/dine-outs, meetups, birthdays, cultural/traditional dates, family visits, holidays, walks, health/fitness activities and recurring gatherings.
- Suggestions should consider declared availability, distance, budget, accessibility, age suitability, dietary preferences, family traditions, weather/season only when current data is actually available, travel time, urgency, previous feedback and privacy scope. Ask for any missing decision-critical information in the app rather than silently inventing it.
- Present AI suggestions as suggestions, not bookings. Never make a reservation, contact a business or invite people externally without a deliberate user confirmation.
- Let users mark recommendations useful/not useful and capture practical feedback to improve future results.
- Include free/manual planning fallback when maps, weather, AI or Google integrations are disabled, have no key, or have hit a quota.
- Keep all external-provider API keys server-side when the integration can be mediated safely. Use provider adapters and quotas, and show whether a result comes from an external provider or the local/deterministic engine.

## 14. Family games — prefer real-life connection

Add a weekly family-games/challenges experience that favors real family interaction over compulsory screen time.

Examples include a family story night, cooking a traditional recipe together, a short walk, a photo/memory conversation, a family scavenger hunt, board/card games, cultural/tradition sharing, a small kindness activity, sibling collaboration, a grandparents’ stories session, a family quiz, or a shared meal. Provide digital/phone-based alternatives for members who are distant, disabled, travelling or unable to participate in person—but do not make the app itself the main attraction when a real-world activity is better.

- A host may choose a weekly activity and invite a selected cluster/tree with an explicit audience. Never publish family games publicly by default.
- Support age-appropriate options, low/no-cost choices, flexible scheduling, opt-in participation, simple rules, materials/time estimates, accessibility alternatives, family-specific traditions, reminders and post-activity feedback.
- Do not rank children or family members in humiliating ways, enforce streak pressure, expose a private family activity to unrelated trees or reward unsafe challenges.
- Use an AI provider only when configured and useful. Provide deterministic activity templates without a model key.

## 15. AI, Bring Your Own Key (BYOK), and family-aware planning

AI must improve the app’s usefulness without becoming a hidden dependency. A valid no-key setup must still support family trees, tasks, events, deterministic recommendations, reminders and privacy settings.

### BYOK UX and functionality

- Give users a clear provider setup screen: provider, API key input, model selection, validation/test, usage/limits, active default, key rotation, disconnect/delete, and a readable explanation of potential provider charges and data processing.
- Never render the full saved key again. Mask it, display a safe fingerprint/label and allow replacement/deletion.
- Do not place provider keys in source code, Expo public environment variables, analytics, crash reports, plain-text debug logs, screenshots or normal database rows accessible to clients.
- Prefer passing a key to a secure server-side request path. If the design persists per-user BYOK secrets, implement authenticated, user-scoped, encrypted-at-rest storage with a documented key-management/rotation strategy; decrypt only within the trusted server path, never return plaintext to clients, prevent cross-user access, and never log key material. Do not pretend that Base64 or client-side obscuring is encryption.
- If safe secret storage cannot be configured in the available free infrastructure, provide an honest session-only key option or keep the key in OS secure storage and call the provider from the client only with clear disclosure of the security trade-off. Do not quietly store it insecurely.
- Validate provider response/schema, timeout, quota, invalid key, rate limit, network failure and model unavailability. Keep deterministic fallback paths. Do not retry expensive calls endlessly.
- Implement per-user request limits and visible usage estimates wherever provider metadata allows it. Users own their provider charges. BYOK is not a promise of free inference.

### Family-aware AI privacy

Before retrieving family or personal information, resolve the current authenticated user, active tree, cluster/space, purpose and permitted record scope. Apply authorization **before** results reach the model. Filter every document/snippet/embedding by the same authorization rules as ordinary database access. The model must not receive forbidden records and then be asked to ignore them.

- Never put entire family trees into a global prompt or global vector namespace.
- Keep conversation history, notes, embeddings, summaries, health, location and child information separated by owner/tree/cluster/consent scope.
- Prevent prompt injection in user notes, imported documents, event descriptions, web/place results and family messages from overriding tool/authorization rules.
- Any tool that creates/edits/invites/sends/cancels/changes permissions or shares sensitive data requires appropriate confirmation and a server-side authorization check.
- Record which source records informed a suggestion where practical, respecting privacy. Avoid hallucinated people, relationships, availability or event facts.
- Delete/rebuild embeddings when source data is deleted or its sharing/authorization scope changes. Revoked access must immediately stop future retrieval.

### Model-free and free-tier operation

Provide a deterministic engine for routine scheduling, date arithmetic, reminders, simple activity suggestions and rule-based prioritization. Use free model tiers only where the provider’s current public terms, quota and reliability are verified. Do not route sensitive family/health/location content to a provider automatically. Keep the model provider replaceable behind a small interface and allow the user to disable AI completely.

## 16. Supabase implementation and access-control verification

Audit what is already deployed before modifying the schema. Use migrations and the project’s existing Supabase CLI/environment workflow. Never apply destructive migrations or touch production data blindly.

- Supabase Auth owns account identity. Maintain clear mapping from auth user to profile/person identity without conflating account presence with family-tree membership.
- Postgres is the source of truth for structured family, event, cluster, permission, sharing, task and audit data. Use RLS policies for every private table and ownership-aware Storage access.
- Use `pgvector` inside Supabase Postgres for vectors unless the documented architecture proves another path is essential. Do not add a separate hosted vector database.
- Edge Functions must derive the user identity from a verified token. Validate all request fields and authorization on the server. Never trust a client-sent role or tree ID.
- Use private buckets by default. Use short-lived signed URLs for approved media access and test revocation/expiry behavior.
- Keep service-role keys and secret values out of the client bundle. Use only the intended public/anon key in client config, together with secure RLS. A public anon key is not a substitute for policies.
- Implement tests for unauthorized reads, unauthorized writes, tenant/tree crossing, removed membership, expired invitation, cross-tree sharing, private media, realtime topics, vector retrieval and Edge Functions.
- For family data access, prefer narrow purpose-specific service methods rather than a generic query function that can fetch arbitrary table/tree data.
- Preserve migration rollback/recovery options and include updated types/contracts when schema changes.

## 17. Android, Expo and native configuration

Do not treat `app.json`/`app.config.ts` as a place to paste permissions or plugins until all of them are justified.

- Confirm the actual Expo SDK, React Native, Android Gradle Plugin, Kotlin, target/compile SDK, New Architecture setting, Reanimated, Skia, MapLibre/map package, gesture handler, safe-area, notification and storage versions.
- Use the package manager and Expo-aware install command already required by the repository. Do not upgrade packages blindly or mix package managers.
- Review app config, plugins, Android permissions, notification channels, app label/identifier, icons/splash, deep links, intent filters, edge-to-edge behavior, status/navigation bars and release settings.
- Add only capabilities actually implemented and justified by an in-context feature flow. Request sensitive permissions at runtime with meaningful explanations; keep background location and health permissions out unless the feature requires them and the user consents.
- Ensure any installed native library’s config plugin, manifest requirements, ProGuard/R8, ABI/package requirements and development-build needs are configured correctly. Regenerate native projects only in the documented workflow and preserve hand-written native code.
- After native config changes, rebuild the app. JavaScript reload is not proof that native configuration works.
- Verify real Android navigation/back, keyboard, permissions, offline/revoked grants, status bars, gesture navigation, app background/foreground, notification/deep-link handling and install/update behavior.
- Check icon artwork at launcher sizes and use the requested Neev launcher asset only for the launcher. Do not make unreviewed changes to app identifiers, signing or release channels.

## 18. Crash diagnosis and JavaScript/native error repair

Search for existing logs and current error reports before guessing. Reproduce each known crash where possible, including missing native modules, native library/ABI packaging, runtime import failures, invalid navigation, stale state, unhandled promise rejections, render loops and bad configuration.

- Trace a crash from the visible symptom through the call stack, installed package/autolinking registration, native implementation/configuration and build artifact where applicable.
- Replace swallowed errors with handled, typed failure states and appropriate logging that excludes sensitive information.
- Prevent a single optional feature (AI, map, Health Connect, family location, animation) from crashing unrelated home/family screens. Use error boundaries at sensible feature boundaries and safe fallbacks.
- Verify lazy-loaded routes and native modules are only imported where their native implementation is available. Do not “fix” a missing module by hiding the screen or fabricating module output.
- Test cold start, warm start, navigation across all tabs, sign-in/out, device permission changes, app update/build, offline transitions and denied providers.
- Do not disable crash reporting to conceal a problem. Fix upload/config issues separately from runtime crashes and document any local development limitation.

## 19. Notifications, reminders and scheduling

- Implement a consistent notification preference model with per-category controls, quiet hours, timezone awareness, delivery state and deep-link destination.
- A notification must not reveal private health/location/family information on a lock screen unless the user deliberately configures that behavior. Default to generic private-safe text.
- Prevent duplicate scheduling when users edit events or tasks. Cancel old jobs on reschedule, deletion, revocation, sign-out where relevant and permission removal.
- Handle Android notification permission denial, token changes, notification channels, app reinstall and provider/server failures.
- Show in-app reminders as a fallback when remote push is not configured. Do not claim push delivery without a configured and tested delivery provider.
- Scheduled jobs must be idempotent and retryable without creating duplicate tasks or notifications. Respect Supabase quotas and use backoff, not tight retry loops.

## 20. Accessibility, localization and quality details

- Ensure touch targets are practical, interactive elements have accessible labels/roles, focus order is sane, and important status is not communicated by color alone.
- Check text scaling and long English/Indian names, large family names, long translations, small screens, display cutouts and gesture navigation. Do not hard-code a fixed title width that clips long names.
- Support screen readers and accessible alternatives for Skia-only visual controls. Add reduced-motion handling and make animations non-essential to understanding state.
- Keep dates, times and recurring events timezone-aware. Avoid parsing ISO dates as local dates incorrectly. Respect device locale in display while retaining stable server timestamps.
- Use explicit empty/loading/error/offline states with actionable text. Never show blank white screens with no explanation.
- Remove emoji-only controls, arbitrary symbols, mismatched typefaces and inconsistent icon sizes. Use the project’s existing consistent icon package where suitable.

## 21. Testing requirements — do not skip

Use existing scripts and add missing tests in the project’s current testing framework. Keep tests meaningful and stable.

### Static and build checks

Run the real repository commands for:

- TypeScript/type checking.
- Lint/format checks.
- Unit tests and integration tests.
- Expo/project diagnostics already configured.
- Android debug/release build steps required by the repository.
- Native configuration/autolinking/package checks applicable to installed libraries.

Do not invent commands. Inspect `package.json`, scripts and `AGENTS.md`, then use the repository’s actual instructions. If a command cannot run because a tool/credential/device is unavailable, capture the exact output and mark that verification as blocked.

### UI/functional checks

For **every screen in the inventory**, verify:

1. Initial render with realistic data.
2. Empty state.
3. Loading/skeleton state.
4. API/provider failure and retry.
5. Offline/network restoration where relevant.
6. Long text, long lists, large family names and different screen sizes.
7. Open/back/close behavior, system back and deep links.
8. Main actions, validation, cancellation and destructive confirmation.
9. Keyboard and safe-area behavior for forms and sheets.
10. Scroll reachability, nested gesture behavior and no overflow.
11. Privacy/permission-denied state for location, health, tree data and invitations.
12. Performance while fast scrolling, switching tabs, returning from background and reopening the screen.

### Security checks

Test at least two unrelated family trees plus a member who belongs to multiple trees, an unregistered relative record, a guest/invitee, a former member, a cluster-only member and a child/guardian scenario. Verify data, search, vector results, storage objects, event attendees, realtime and AI context all obey access controls. Try direct API calls, guessed IDs and altered client-sent family IDs. Unauthorized paths must return no protected data.

### Device checks

Where an Android device/emulator is available, install and test the actual build. Do not rely on screenshots of a simulator alone to verify background location or native modules. Test app foreground/background transitions, granted/denied/revoked permissions, notification behavior, device rotation/size variation where supported, map pan/zoom, lost-device fallback, Health Connect unavailability and sign-out cache isolation.

## 22. Required implementation artifacts

Keep documentation accurate and minimal, and update it to reflect the code that actually exists. Do not replace implementation with more documents. Deliver:

- A route/screen/component inventory marked with real completion evidence.
- A concise before/after issue ledger, including root cause and files changed.
- Updated theme/component guidance only where it helps maintain consistency.
- Updated environment/config setup for Supabase, optional map/geocoding/AI providers, Android permissions and build requirements; never include secrets.
- Updated migration/API/security documentation for changed schemas or access rules.
- Tests for the fixed functionality and authorization boundaries.
- A release/verification checklist with exact commands executed and their results.

Do not create a large number of redundant Markdown documents, archive material without need, or scatter setup instructions across several conflicting files. Update the canonical docs already used by the repository.

## 23. Definition of done — every applicable item is required

### UI / UX
- [ ] Every route in the real inventory has been inspected and either fixed or proven already correct through verification.
- [ ] Headers are compact, consistent and not duplicated; safe areas and system bars behave correctly.
- [ ] No clipped, overlapping, off-screen or inaccessible content under supported sizes, font scales and long text.
- [ ] Buttons, icons, sheets, dialogs, tabs and navigation are consistent and functional.
- [ ] The app follows Neev’s sage/pista token system and adapts actual BlinkQuest implementation patterns instead of merely copying a screenshot.
- [ ] The Neev tab mark/illustrations use purposeful vector/Skia/Reanimated behavior; the launcher image is not reused as generic content art.
- [ ] Empty, loading, error, offline, permission-denied and success states are complete.

### Scrolling / performance
- [ ] `ScrollView`, `FlatList`, `SectionList`, FlashList and masonry are used according to actual content and installed-library compatibility.
- [ ] No problematic same-axis nested virtualized list arrangement remains.
- [ ] Bottom sheets, keyboards, headers and gesture navigation cooperate; all long content is reachable.
- [ ] Excessive rerenders, unbounded timers, stale subscriptions, request loops, memory-heavy images and known JS-thread bottlenecks are corrected.
- [ ] Before/after measurements or reproducible observations exist for the highest-impact performance fixes.

### Product features
- [ ] Settings persist correctly; sign-out clears private state; session expiration and account controls are handled.
- [ ] Family creation, accountless relatives, joining, invitations, relationships, clusters and leaving/revocation work end-to-end.
- [ ] Unrelated family trees cannot read one another; cross-tree sharing is explicit and narrow.
- [ ] Map fills its intended screen, supports required gestures/controls and clearly communicates location freshness/accuracy.
- [ ] Location sharing is consensual, visible, time-bounded/revocable and tested; phone-finding limits are honestly communicated.
- [ ] Health Connect integration is opt-in, per-data-type and privacy-scoped, with an unavailable/disconnected fallback.
- [ ] Family meals, meetups, events, RSVPs, reminders and real-world weekly family games work with non-AI fallbacks.
- [ ] BYOK setup, validation, deletion/rotation and failure handling are secure and real; no secrets leak to client bundles/logs.

### Backend / security / release
- [ ] Supabase RLS, Storage, Edge Functions, vector search and Realtime access rules are tested across unrelated trees and revoked members.
- [ ] Schema/API changes have migrations, type updates, tests and rollback/recovery notes.
- [ ] JavaScript/native crashes discovered during verification have root-cause fixes or exact reproducible external blockers.
- [ ] Lint, type checks, tests, diagnostics and Android build checks have actual recorded outcomes.
- [ ] No fake data, dead buttons, abandoned debugging logs, insecure secret handling or false “live/synced” labels remain.
- [ ] Documentation and final status match the actual implementation, not intended functionality.

A checkbox must not be checked merely because code was written. Check it only after the matching behavior was verified.

## 24. Final execution and reporting instructions

Start by inspecting the workspace and producing a private working checklist from the actual route inventory. Then make the code changes. Keep moving from one verified issue to the next and return to integrations as needed. Do not wait for the user to approve ordinary implementation choices, do not stop to ask which screen to fix next, and do not deliver a plan in place of working code.

Before reporting completion:

1. Review the full diff for accidental regressions, duplicated components, dead code, security exposure and unnecessary package changes.
2. Run the relevant checks again after the last code edit.
3. Confirm every navigation route and primary screen action still works.
4. Confirm the root issues—not just symptoms—have been resolved.
5. Report what changed, the key root causes found, exact commands run and test/build outcomes, what was verified on a real device, and the only remaining blockers (if any).
6. Be specific about what is implemented versus what depends on credentials, real-device permissions, provider quotas, external services or Android OS restrictions. Do not say “everything is fixed” if any criteria remain unverified.

**Final command:** Continue the existing Neev implementation and finish the integrated repair. Inspect, edit, test, profile, correct, rebuild and verify. No plan-only result, no screenshot-only redesign, no fake backend, no silent permissions, no unsafe family-data leakage, and no premature handoff. Keep working until the app is demonstrably stable, fast, polished and functionally complete within the actual technical and service constraints.
