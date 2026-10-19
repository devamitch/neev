# Neev — Screen Container, Dock and Virtualized List Code Blueprint

This is the companion engineering blueprint for `NEEV_SCREEN_CONTAINER_DOCK_LIST_VIRTUALIZATION_MASTER_PROMPT.md`. It gives the coding agent concrete implementation patterns and migration details. These are reference patterns, not blind drop-in replacements: first check Neev's exact Expo SDK, RN, Reanimated, FlashList and bottom-sheet versions, adapt types to the installed versions, compile, and test on Android.

## 1. The central bug to remove

Today, the supplied `ScreenContainer` branches on `scrollable` and wraps the screen children in `Animated.ScrollView`. This is reasonable for short static content, but it is the wrong owner for pages containing large arrays, `FlatList`, `SectionList`, FlashList or masonry content. Adding a second list underneath it only creates nested vertical scrolling and does not fix first-render cost.

Target tree for a virtualized screen:

```text
SafeAreaProvider
└── ScreenContainer (flex: 1; pinned compact header; optional footer)
    └── bounded body (flex: 1; minHeight: 0)
        └── exactly one root vertical list
            ├── ListHeaderComponent (filters / summary / map teaser)
            ├── virtualized rows
            └── ListFooterComponent (pagination / end state)
```

Target tree for a static page:

```text
ScreenContainer
├── pinned header
├── Animated.ScrollView (single owner of this page's scroll)
│   └── modest static content / form controls
└── optional pinned footer
```

The shell must never silently insert another vertical scroller around an external list.

## 2. Proposed API shape

Adapt names to the existing conventions, but keep this ownership distinction explicit:

```tsx
<ScreenContainer
  header={<AppHeader title="Knowledge Vault" rightAction={addAction} />}
  scrollMode="external"
  headerMode="compact"
  dockBehavior="auto-hide"
>
  <ScreenSectionList
    sections={sections}
    keyExtractor={(item) => item.id}
    renderItem={renderItem}
    renderSectionHeader={renderSectionHeader}
    ListHeaderComponent={<KnowledgeFilters />}
    ListEmptyComponent={<KnowledgeEmptyState />}
  />
</ScreenContainer>
```

Static form example:

```tsx
<ScreenContainer
  header={<AppHeader title="Record Knowledge" showBack />}
  scrollMode="shell-scroll-view"
  headerMode="compact"
  dockBehavior="always"
  footer={<AppButton title="Save record" loading={saving} onPress={save} />}
>
  <KnowledgeForm />
</ScreenContainer>
```

Full-screen map example:

```tsx
<ScreenContainer
  header={null}
  scrollMode="none"
  headerMode="none"
  dockBehavior="hidden"
>
  <FamilyMapViewport style={{ flex: 1 }} />
  <MapTopControls />
  <MapBottomPanel />
</ScreenContainer>
```

`MapTopControls` / `MapBottomPanel` are overlay siblings of the map, with safe-area-aware positioning and explicit pointer-event behavior. Use an installed, real map provider; `FamilyMapViewport` is a structural name, not a fake SVG map.

## 3. Screen scroll context and canonical handler

Create or adapt a single context so `ScreenContainer` owns the hook and exactly one root scroll adapter consumes it. This lets the compact header read a shared offset, and lets the dock use a single event path. Do not define one unrelated handler inside every list adapter.

```tsx
// Reference shape; adapt exported types to the installed Reanimated version.
import React, { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useAnimatedScrollHandler } from "react-native-reanimated";

type ScreenScrollHandler = ReturnType<typeof useAnimatedScrollHandler>;

type ScreenScrollContextValue = {
  scrollY: SharedValue<number>;
  onRootScroll: ScreenScrollHandler;
};

const ScreenScrollContext = createContext<ScreenScrollContextValue | null>(null);

export function useScreenRootScrollProps() {
  const context = useContext(ScreenScrollContext);
  if (!context) {
    throw new Error(
      "A root screen scroller must be rendered inside ScreenContainer with scrollMode=external."
    );
  }
  return {
    onScroll: context.onRootScroll,
    scrollEventThrottle: 16 as const,
  };
}
```

The exact return type of `useAnimatedScrollHandler` differs across Reanimated major versions. If `ReturnType` does not compile in the installed version, infer the type from the actual component props or use the documented exported type for that version; don't change it to `any` just to silence the compiler.

### Hook behavior owned by the shell

The shell creates `scrollY`, `lastY`, and a shared screen-focused flag. The hook should:

- set `scrollY.value` in a worklet;
- ignore dock decisions when this route is not focused;
- reset `lastY` on begin drag and route focus;
- respect reduced motion and the route's dock behavior;
- use one hysteresis threshold, one minimum scroll depth and one shared show/hide implementation;
- never perform a React `setState` on every scroll event;
- expose the same event handler to one root scroller, not every nested horizontal rail and sheet scrollable.

A version-adapted worklet shape:

```tsx
const scrollY = useSharedValue(0);
const lastY = useSharedValue(0);
const screenFocused = useSharedValue(false);
const shouldAutoHideDock = dockBehavior === "auto-hide" && !reduceMotion;

const onRootScroll = useAnimatedScrollHandler({
  onBeginDrag: (event) => {
    lastY.value = Math.max(0, event.contentOffset.y);
  },
  onScroll: (event) => {
    const y = Math.max(0, event.contentOffset.y);
    scrollY.value = y;

    if (!screenFocused.value || !shouldAutoHideDock) {
      lastY.value = y;
      return;
    }

    const delta = y - lastY.value;
    if (y <= 24) {
      showTabBar();
    } else if (y > 72 && delta > 12) {
      hideTabBar();
    } else if (delta < -12) {
      showTabBar();
    }

    lastY.value = y;
  },
});
```

The numeric thresholds are starting values, not universal truths. Test and tune them against the device and dock dimensions. `showTabBar`/`hideTabBar` must themselves be valid worklets if called directly from the scroll worklet. Use the existing single authoritative progress `SharedValue` in `useScrollAwareDock.ts`; do not create a duplicate one for the new hook.

Use the installed React Navigation focus hook or navigator events to set `screenFocused.value` on focus/blur. Wrap any `useFocusEffect` callback in `useCallback`. On focus, show the dock and set `lastY.value = scrollY.value`; on blur, mark the screen inactive. Confirm the focus lifecycle and cleanup on real retained tabs.

**Important:** If the root list is FlashList, verify the actual installed FlashList/Reanimated combination. If Reanimated needs an animated FlashList wrapper for the handler, implement and test that once in the shared adapter. Do not assume a handler attached to an unanimated native component runs as a UI-thread worklet.

## 4. Root scroll adapters

### Static content: `ScreenScrollView`

- Use `Animated.ScrollView` from installed Reanimated when the scroll offset is used for UI-thread header/dock behavior.
- `style` must fill a bounded body (`flex: 1`).
- Use `contentContainerStyle` for content padding; do not pad both the list parent and content with the same gutter.
- Set `keyboardShouldPersistTaps="handled"` and platform-appropriate keyboard-dismiss behavior on forms.
- Keep `nestedScrollEnabled` only where it is needed for intentional Android nested scrolling; it doesn't fix every nested scroll architecture problem.
- The static-scroll wrapper should never be used for an unbounded collection.

### FlatList / Animated.FlatList

- Export a shared typed adapter such as `ScreenFlatList<T>` that attaches `useScreenRootScrollProps()` and app-level content inset rules.
- Use `keyExtractor={(item) => item.id}` for stable domain identity.
- Use a memoized row, `renderItem`, separators and list header/footer.
- Add `extraData` only for external dependencies not represented by stable `data` props.
- Use `getItemLayout` only when row height is truly fixed at all supported font sizes and widths.
- Don't pass a new object/function into every prop every render without a reason; memoize stable props.

Example at screen usage:

```tsx
const renderItem = useCallback(
  ({ item }: ListRenderItemInfo<KnowledgeEntry>) => <KnowledgeEntryRow entry={item} />,
  []
);

<ScreenFlatList
  data={visibleEntries}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  ListHeaderComponent={header}
  ListEmptyComponent={emptyState}
  contentContainerStyle={styles.listContent}
/>
```

`renderItem` dependencies must be included when it uses state/props. Do not use an empty dependency array to hide stale closures.

### SectionList / Animated.SectionList

Use sections when order/grouping is meaningful: schedule by day/month, directory by relationship group, knowledge by category, etc. Put non-row page modules into `ListHeaderComponent`. Keep `renderSectionHeader` compact. Give sections stable keys. Don't construct dozens of independent `.map()` views around one SectionList.

```tsx
<ScreenSectionList
  sections={sections}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
  renderSectionHeader={renderSectionHeader}
  ListHeaderComponent={pageSummaryAndFilters}
  stickySectionHeadersEnabled={false} // enable only when it improves this screen
/>
```

Check the exact supported prop names/types in the installed React Native/Reanimated version.

### FlashList

- Use only after verifying the installed version and New Architecture constraints. FlashList v2 requires RN New Architecture; do not force it into an incompatible Expo config.
- Use stable `keyExtractor`, memoized props/renderers, the supported recycling-aware state helpers when appropriate, and `getItemType` for genuinely different row types.
- Do not keep per-row expanded state unless it resets when the recycled item identity changes.
- Do not add `getItemLayout`, `windowSize`, `initialNumToRender` or other FlatList-only tuning props that the installed FlashList version does not support.
- Do not evaluate its performance in JS dev mode only; profile the release build.

### Masonry

- Use masonry only for unequal-height visual media cards, not every screen.
- For FlashList v2 use the installed version's documented masonry API (currently `masonry` and `numColumns` in the v2 usage docs). Do not copy v1 `MasonryFlashList` examples into v2 or vice versa.
- Ensure photos declare valid aspect ratios or measured heights, keys remain stable, and item reordering is not applied to semantically ordered content.
- Keep actual media loading/caching efficient; a virtualized list cannot compensate for heavyweight SVG overlays or decoding huge images in every cell.

## 5. Nested scrolling rules

Valid common pattern:

```text
Vertical root SectionList/FlashList
├── ListHeaderComponent
│   ├── concise summary
│   └── horizontal category rail
└── rows
```

Avoid:

```text
ScreenContainer's vertical ScrollView
└── vertical FlatList
    └── vertical nested FlashList
        └── another ScrollView
```

Only a true bounded inner pane (e.g. an independently scrollable message panel in a split layout) may own an additional vertical gesture. It must have a defined height, an obvious UI affordance, Android/iOS gesture handoff tests and no competing root auto-hide hook. For a small list inside a single card, map it to a short set of child rows instead of introducing another virtualizer.

Horizontal lists/rails are fine inside a vertical root when intentional. They must not consume the root screen's scroll handler. If FlashList is used horizontally within vertically scrolling content, verify the installed FlashList version's recommended parent/child pairing.

## 6. Bottom clearance must have one owner

Currently, `useTabBarInset()` is imported by multiple screens while `ScreenContainer` also computes a clearance. Audit the actual call sites and prevent additive double-insets.

Define one helper/constant set for:

- dock visible total height;
- bottom system inset;
- tablet floating gap;
- footer safe-area padding;
- content bottom clearance for tabs vs pushed screens vs full-screen routes.

Choose one of these per screen:

1. No pinned footer: root list content includes dock clearance exactly once.
2. Pinned footer with dock visible: explicitly layout footer above the dock, or hide the dock by route/navigation state if that is the intended design. Never put the footer behind the dock.
3. Full-screen modal/map: dock hidden; map/route manages its system bottom controls and safe area.

Remove per-screen `bottomInset` variables that are not consumed and stale `useTabBarInset()` imports after migration. Never add a global `paddingBottom` and then add the same dock inset inside each row/list.

## 7. Compact header geometry

Use one source of truth for toolbar height, button size, safe top inset and content gutter. The supplied code has `HEADER_BAR_HEIGHT = 52`, while `headerContentTop` uses 46 for screens with controls; investigate and remove any overlap.

Suggested policy:

- default: compact pinned header, title about 18–20 sp (semantic theme token), concise subtitle optional and ellipsized only when a clear full name remains available elsewhere;
- action button target: at least 44–48 dp with meaningful accessibility label;
- title row: correct `flexShrink`, `minWidth: 0`, no collision with back/right actions;
- optional large-title section: only where explicitly useful and included inside the single scroll root's list header/ScrollView content;
- top spacing must be applied once. Either the root handles the top safe inset or the header does, never both.

Do not use `pointerEvents="none"` on any area that contains interactive title actions. Ensure the pinned header receives touches while the large-title content fades out.

## 8. Typography: remove double scaling

The supplied theme appears to normalize `SetuTypography` sizes at creation, then `AppText` normalizes the resolved `flat.fontSize` again. Verify this. Choose one of these approaches:

**Option A — semantic fixed tokens:** Store unscaled base sizes in typography tokens and apply any intentionally chosen width scaling once in a hook/component using `useWindowDimensions()`.

**Option B — runtime typography hook:** Use a hook that resolves token sizes from current window/font scale, and don't normalize again in `AppText`.

Do not mix A and B. Avoid module-scoped `Dimensions.get("window")` for responsive decisions. Support `fontScale`, system text sizes and wrapping. Use `numberOfLines={1}` only for elements with a designed truncation behavior. Use wrapping for explanatory text, family names and labels. Avoid fixed-height text cells. Don't shrink critical text down just to preserve a screenshot.

## 9. Squircle component performance

`SquircleSurface` currently measures its bounds and renders SVG path geometry when dimensions are known, unless a registered native squircle view is available. Every use should be evaluated as a cost, especially in list cells.

- Use the current surface abstraction to keep one design language.
- Prefer a supported native squircle path in production when the module is actually present and tested.
- If SVG fallback is the real production path, benchmark a list with 50/100+ cards and compare layout/render timings.
- Simplify repeated row surfaces where they add no meaningful visual hierarchy; keep the same radius token/shape rather than mixing unrelated border radii.
- Avoid SVG surface nesting, Surface→Card→Surface nesting, live BlurView inside each row, expensive shadows and clipping together.
- Don't replace the squircle identity with inconsistent default rounded rectangles just to improve a synthetic benchmark.
- Ensure size state only changes on real size differences and layout doesn't loop.

## 10. Dock: one visibility source and one gesture policy

Inspect `CustomTabBar.tsx` and `useScrollAwareDock.ts` together. The code currently provides a Reanimated worklet path and a JS hook path. Migrate all vertical root scrollers to a single canonical path. Delete or deprecate duplicate paths once call sites are migrated.

- Scroll changes `tabBarScrollProgress` in a UI-thread worklet only.
- Keep dock geometry (wave width/height, center slot/orb, lower inset) centralized.
- On focus/tab switch always show the dock, reset old direction values and cancel stale transitions if appropriate.
- On top-of-list and upward scrolling show it. On sustained downscroll beyond a depth threshold, hide it only if the screen opted into auto-hide.
- Keep dock always visible on forms, settings and compact content by default.
- Do not respond to horizontal scroll rails, map pan/pinch or sheet content movement.
- Avoid changing the SVG path on every scroll frame; derive it from layout width and memoize it.
- Pause the central Neev logo loop while inactive/backgrounded and honor reduced-motion settings.
- Ensure focus/blur cleanup and root component unmount don't leave `tabBarScrollProgress` stuck at 1.

## 11. Bottom sheet abstraction

Audit whether `@gorhom/bottom-sheet` (or a compatible equivalent) is already installed and verify its exact version. If present, build one `AppBottomSheet` wrapper using that version's API. If absent, make a compatibility decision before adding it.

The wrapper owns backdrop, handle, safe-area, keyboard behavior, backdrop/Android-back dismissal and consistent surface styling. Long content must use the library's own integrated scrollables (e.g. BottomSheetScrollView/BottomSheetFlatList); forms use the library's keyboard-aware input integration where required. Avoid another vertical ScrollView around those components.

Select presentation based on actual content:

- quick action choice: compact sheet;
- a few fields: medium or dynamic sheet;
- long family creation, multistep permissions or complex editing: full-screen route;
- map: full-screen route, not a small sheet.

A long sheet at compact viewport/large text must scroll instead of clipping. Ensure the keyboard doesn't cover Save/Continue. Only one component can own the user's pan/scroll gesture at a time.

## 12. Full-screen map route contract

- Use a genuine map SDK/provider already installed or deliberately compatible with the current Expo/RN release.
- The map fills the usable viewport; controls are safe-area-aware overlays.
- Use `useWindowDimensions()` and layout measurement; do not use `Dimensions.get()` constants captured at module load.
- Keep pan/pinch/zoom gestures with the map provider. Controls intercept only their own hit target.
- Add current-location/recenter, permission, accuracy/timestamp, stale/offline, selected-marker details and supported search/filter controls.
- Family member location sharing must remain explicitly scoped and revocable. Do not share everyone with everyone by default.
- Never report indoor sofa/cushion pinpoint location or synthetic radar distance from GPS. Use real paired-device actions for device finding and state limits honestly.
- Update UI at a human-useful frequency and avoid remounting the whole map or all marker cards on every GPS sample.

## 13. Concrete migration map

| Screen | Target strategy |
|---|---|
| Knowledge Vault | Horizontal category rail in `ListHeaderComponent`; root FlatList/FlashList depending actual volume and dependency compatibility; stable pin/expand state. |
| Family Functions/Schedule | Root SectionList grouped by date/category when useful; bounded task preview; real member selection; no fake defaults. |
| Family Directory/Networks | Root SectionList or FlashList with summary/filter header and separate Member/Bridge sections; split modals into reusable sheets/routes. |
| Dashboard | Small meaningful module stack may use ScrollView; large growing datasets become sections/root list. Narrow store selectors so location/sync changes don't rerender everything. |
| Settings | Short grouped static page, compact fixed header; scroll view is appropriate if finite; each operation reports true result. |
| About/Privacy | Static ScrollView with responsive type and truthful claims; virtualization unnecessary. |
| Add Event / Add Knowledge | Static scroll form only as needed; no hardcoded future date/member ID; keyboard-aware and validated. |
| Quick Actions | Compact menu/sheet if short; avoid full-screen scrolling list for four choices. |
| Full-screen map | `scrollMode="none"`; map provider owns gestures; no parent vertical scroll root. |
| Long media/gallery views | FlashList masonry only if installed version is compatible and variable height is the actual content need. |

## 14. Diagnose performance after migration

Use a release build and repeat these routes on the same Android device and dataset: cold start, dashboard scroll, Family list, Knowledge filter/expand/pin, Schedule task toggle, open/close sheets, map pan/zoom, switch tabs, background/foreground.

Collect frame/jank stats from available Android tooling, JS/Hermes profile if configured, React render counts, memory trend, native layout/measure cost, map/location update frequency, crash logs and startup/navigation timings. Compare before/after with the same setup.

Potential bottlenecks to test:

- non-virtualized `.map()` inside `Animated.ScrollView`;
- global/narrow Zustand selector misuse;
- SVG SquircleSurface fallback per cell;
- continuous animated logo;
- many BlurViews / overdraw / clipping/shadow layers;
- simultaneous dock event handlers;
- redundant query + local-store updates;
- background timers/location subscriptions that don't pause;
- expensive work during navigation transitions;
- route redirects that mount then immediately redirect;
- unstable props, onLayout loops and rebuilding filters/sorts;
- unbounded map marker state updates.

Fix the observed cause, then repeat the same journey. Don't declare success from a passing typecheck alone.

## 15. Acceptance checklist

- [ ] Each route has an inventory entry and chosen scroll owner.
- [ ] No virtualized root list is nested inside a shell-owned vertical ScrollView.
- [ ] Each virtualized list has stable domain keys and a truthful empty/loading/error state.
- [ ] FlashList row local state is recycling-safe.
- [ ] Screen scroll handler is attached once to the root vertical scroller.
- [ ] Horizontal rails/sheet scrolls do not control root dock visibility.
- [ ] Pinned header always clears status area and does not collide with right actions.
- [ ] Font scaling is applied once; narrow screens and larger text wrap safely.
- [ ] Bottom inset is applied exactly once.
- [ ] Squircle surfaces are consistent, and fallback cost has been profiled.
- [ ] No permanent offscreen logo animation or orphan timer.
- [ ] Bottom sheets handle content height, keyboard, back and gestures.
- [ ] Full-screen map is real, responsive, zoomable and honest about permissions/accuracy.
- [ ] Typecheck/lint/tests/config/build pass where present and are reported truthfully.
- [ ] The same release-device flows have been profiled before and after.
- [ ] The existing tracker is updated and unverified work is explicitly labelled.

## 16. Official docs to use while implementing

- ScrollView vs FlatList and bounded viewport: <https://reactnative.dev/docs/scrollview>
- FlatList behavior and stable keys: <https://reactnative.dev/docs/flatlist>
- VirtualizedList rendering/state caveats: <https://reactnative.dev/docs/virtualizedlist>
- Reanimated scroll handler (4.x): <https://docs.swmansion.com/react-native-reanimated/docs/scroll/useAnimatedScrollHandler/>
- FlashList v2 usage/recycling props: <https://shopify.github.io/flash-list/docs/usage/>
- FlashList v2 masonry: <https://shopify.github.io/flash-list/docs/guides/masonry/>
- Expo Router presentations/modals: <https://docs.expo.dev/router/advanced/modals/>
- React Navigation focus lifecycle: <https://reactnavigation.org/docs/use-focus-effect/>
- Bottom-sheet keyboard behavior: <https://gorhom.dev/react-native-bottom-sheet/keyboard-handling>
- Bottom-sheet scrollables: <https://gorhom.dev/react-native-bottom-sheet/scrollables>

**Final instruction:** implement these patterns in the current repository, adapt to installed versions, migrate the actual screens, build and test on a device, measure the residual lag, update the existing tracker, and report verified outcomes. This blueprint does not itself mean the app has been modified.
