# NEEV — CONTINUE, IMPLEMENT, VERIFY, COMMIT

Read `NEEV_FINAL_FORCE_EXECUTION_PROMPT_V3.md` and `NEEV_FINAL_SCREEN_CONTAINER_DOCK_QUERY_GESTURE_BLUEPRINT_V3.md` completely, plus every named supporting prompt, architecture document, `AGENTS.md`, tracker, route file and relevant source file in the actual workspace. Read the supplied phone/location guide before changing maps or device finding.

Inspect the real Neev and BlinkQuest repositories, existing uncommitted changes, installed dependency versions and project rules. Then implement the fixes directly in the existing app—do not return another plan, generate mockups, or stop after one screen.

Fix every screen and shared component, especially `ScreenContainer`, `AppHeader`, `CollapsingHeader`, `ScreenScrollContext`, `CustomTabBar`, list adapters, `AppText`, squircle surfaces, keyboard/gesture handling and bottom sheets. Make collapsing headers and bottom dock animations elegant, smooth and Reanimated-driven; keep left/right header actions balanced with the centered title; use the correct single root scroller for each screen. Use FlatList, SectionList, compatible FlashList/masonry and Animated scroll components only where appropriate. Fix overflow, safe areas, fonts, navigation, crash/JS issues, map fullscreen behavior and every real feature.

Use TanStack React Query as the canonical asynchronous read/write cache across the app, with one source of truth per domain, typed query keys, consistent mutations/invalidation, offline handling and cache isolation on sign-out/family switching. Keep gestures, animation frames and high-frequency sensors out of the query cache. Use canonical squircle surfaces without creating a performance regression.

Profile the actual causes of lag, heat, jank, excessive rerenders and memory cost before/after changes on the same release-build device/journeys. Implement real location and phone finding only within supported Android APIs and authorized device capabilities; never fake exact indoor positions, Wi-Fi precision, altitude, map results or remote ring acknowledgements. Respect map-provider terms, family privacy, child protections and all repository rules.

Work through the full route inventory, run real type/lint/test/Expo/Android checks, fix new failures and rerun checks after the final edits. Keep a leftmost screen/feature-and-test ledger with evidence. Commit coherent verified changes incrementally when repository rules permit; inspect each diff, never discard existing work and never push. If interrupted, persist the exact files/status/failures/next action and continue from the checkpoint. Do not claim anything passed unless the command or device test proves it.

**Finish the actual implementation, integration, tests, profiling and release verification. Do not finish with documentation alone.**
