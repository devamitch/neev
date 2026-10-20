# Neev — Screen Container, Dock and Virtualized List Code Blueprint (V3)

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

---

# V3 ADDENDUM — Header geometry, current implementation traps, keyboard, queries and release ledger

This addendum is mandatory alongside the preceding code blueprint. Verify every observation against the active repository before editing; the pasted code may differ from the current working tree.

## A. Fix the semantic trap between `sticky` and header presentation

In one supplied `ScreenContainer` version, the following inference appears:

```ts
const isCompactHeader =
  headerMode === "compact" || (headerProps?.sticky && headerMode !== "collapsing")
```

At the same time, existing screens use `<AppHeader sticky ... />` with comments describing a sticky collapsing title. This can convert nearly every such screen into a compact-only header and silently disable the intended collapse transition. Verify the live file and all call sites. The fix must make the presentation explicit instead of changing how an old prop is interpreted.

Recommended contract (adapt to installed source/types, do not blindly paste over real callers):

```ts
type HeaderMode = "compact" | "collapsing" | "custom" | "none"
type ScrollMode = "shell-scroll-view" | "external" | "none"
type DockBehavior = "always" | "auto-hide" | "hidden"
```

Rules:

- `headerMode` selects the visual presentation.
- `stickyHeader`/legacy `sticky` controls whether the header stays pinned or collapses; it must not secretly force `compact`.
- `scrollMode="shell-scroll-view"` is for short static content. `scrollMode="external"` provides a bounded `flex: 1; minHeight: 0` body and context for exactly one external root scroller. `scrollMode="none"` is for fixed/full-screen surfaces.
- Migrate call sites explicitly only after comparing intended behavior. A map, camera/game screen or fullscreen media viewer can opt out; it must not accidentally inherit an invisible header or leave the dock hidden for the next route.

## B. Balanced header layout and animation contract

The compact `AppHeader` and the compact phase of `CollapsingHeader` must use the same geometry, type sizes, action hit targets, title baseline and background surface. Do not let a dynamic right-action width change the center title's x-coordinate.

### Layout contract

- Reserve an equal left and right slot width equal to the larger measured action-group width. Measure only on layout, not during scroll.
- Back, logo/menu, title and action groups must all be vertically centered in the same 52 dp toolbar row (or use the documented shared height token). Respect Android status-bar inset outside the row; don't add it twice.
- Keep a minimum accessible tap target for the actual pressable, not only its icon. Header action icons use a consistent 20–22 dp visual size unless the icon family specifies otherwise.
- Cap the right-side actions. If the available title width becomes unusable, move lower-priority actions into a menu instead of shrinking buttons or letting title and actions collide.
- The title's center should remain on the visual centerline when possible, and title content must be constrained to the safe region between action groups. Test both `titleStyle` and long `subtitle` behavior.
- Do not use a `View` with a hardcoded tiny placeholder width as the opposite action slot; use a real balanced slot component.
- Confirm the actual supported `transformOrigin` syntax in the installed RN version. Avoid relying on a style prop if the active runtime does not support it.

### Scroll-driven animation contract

```tsx
// Shape of the pattern only. Adapt imports/types and handler composition
// to the exact Reanimated version installed in the project.
const scrollY = useSharedValue(0)
const lastY = useSharedValue(0)
const progress = useDerivedValue(() => {
  const collapseDistance = Math.max(titleHeight.value, 40) * 0.75
  return interpolate(scrollY.value, [collapseDistance * 0.4, collapseDistance], [0, 1], Extrapolation.CLAMP)
})

const largeTitleStyle = useAnimatedStyle(() => ({
  opacity: 1 - progress.value,
  transform: [
    { translateY: -6 * progress.value },
    { scale: 1 - 0.015 * progress.value },
  ],
}))

const compactTitleStyle = useAnimatedStyle(() => ({
  opacity: progress.value,
  transform: [{ translateY: 5 * (1 - progress.value) }],
}))
```

This is an illustrative choreography, not a demand to use these exact values. Keep the visible transition tied to the current scroll position: avoid stacking a separate spring on every scroll frame. No `setState`, logging, network work or `runOnJS` calls per scroll event. Use `withTiming`/`withSpring` for discrete dock show/hide and press feedback only. Respect reduced motion and cancel/resume decorative loops based on focus/app state.

The supplied `CollapsingHeaderBar` calculates `titleInset` but appears not to use it. Audit unused/duplicated geometry and make the chosen geometry source of truth obvious. If right action width is measured, ensure the measurement is stable, bounded and doesn't create render loops. A real action must remain interactive while compact title layers cross-fade; title layers should have `pointerEvents="none"`.

## C. One canonical scroll handler, with adapter-specific types

The most common failed refactor is adding a `FlatList` under the original shell scroll view or allowing the shell and adapter to independently hide/show the dock. That is not acceptable.

The shell owns shared values and publishes a context contract with:

- `scrollY`: root vertical scroll offset;
- one canonical UI-thread/worklet handler or an adapter-friendly function factory;
- computed top/header inset and the **single** bottom clearance owner;
- active header mode and dock behavior;
- screen focus/active state.

The root adapter owns the **native scroller**, forwards native list props/ref, and consumes the shared context. It must not wrap the list in another vertical `ScrollView`.

### Per-root implementation matrix

| Content shape | Root scroller | Requirements |
|---|---|---|
| Short policy/about/form | `Animated.ScrollView` via `ScreenScrollView` | One scroll root; keyboard behavior; content bottom clearance once. |
| Flat records | Reanimated-wrapped `FlatList` | Stable keys; memoized row only where useful; root `onScroll`; empty/loading/error states. |
| Grouped records | Reanimated-wrapped `SectionList` | Stable section keys; section headers; correct viewability and scroll restoration. |
| High-volume recycling | Installed compatible FlashList | Verify version/New Architecture and animated wrapper support before using. Never add a second vertical owner. |
| Uneven media cards | Supported virtualized masonry | Use only when masonry is appropriate; account for item-size changes and accessibility. |
| Full-screen map | Native/provider map or purpose-built non-list screen | Map owns pan/pinch gestures; no vertical dock handler on map gestures. |

When callers provide a custom `onScroll`, compose compatible handler logic deliberately. Do not create two handlers both writing to `scrollY` or dock globals. Reanimated handler objects and standard JS callbacks aren't interchangeable types for every list library; use version-correct typed adapters, not a broad `any` cast. For FlashList, verify the installed version supports the chosen animated wrapper. If the compatibility is not valid, choose the installed React Native/Reanimated list path rather than bridging per-frame shared-value updates through JavaScript.

### Dock policy and edge cases

- One global/shared dock state and one root scroll policy only.
- Reset `lastY` when a route becomes active and when a list is replaced so a stale delta doesn't immediately hide the dock.
- Show at the top, show on screen focus, use a threshold with hysteresis, and don't react to small elastic overscroll noise.
- Horizontal `ScrollView` rails must never hide the dock.
- A nested *horizontal* carousel can coexist; nested vertical lists should be avoided unless there is a clear bounded interaction design and no virtualization failure.
- `auto-hide` should be disabled for reduced-motion settings only according to a coherent policy—do not leave a prior screen's hidden state behind.
- When a sheet/modal takes over the task, coordinate dock visibility explicitly and restore it on dismissal.
- Bottom padding belongs to exactly one owner. `ScreenContainer` must not add dock padding and then have every adapter add it again. A fixed footer has its own safe area; scroll content should reserve only the clearance not already handled by that footer.

## D. Bottom sheet refactor checklist for the supplied component

The supplied `AppBottomSheetModal` has useful beginnings (backdrop, safe area, drag animation) but must be checked for several risk points: module-time `Dimensions.get("window")`, a pan gesture wrapped around the entire sheet including its content, a plain `View` body that doesn't inherently scroll, keyboard avoidance that may not coordinate with long content, and competing Modal/Reanimated animation layers.

Requirements:

1. Use `useWindowDimensions()` and live insets to compute height after rotation/resizing. Do not keep module-level screen height.
2. Inspect whether a tested bottom-sheet package is already installed. Reuse it if compatible; do not add or upgrade it casually. If retaining the custom sheet, keep it small and test gesture composition carefully.
3. Put the pan-to-dismiss gesture on the handle/header or require the inner scroll to be at offset zero before sheet dismissal. A drag inside a long text form or list must scroll the content first.
4. Use the installed keyboard-controller stack in one place. Keyboard opening must reduce the usable sheet height and make the last input/CTA reachable. Don't nest two independent keyboard-avoidance systems.
5. Give the sheet a scrollable content slot (or a clearly defined API supporting a single supplied scroll root). Do not let both the sheet and caller create separate vertical scroll owners.
6. Keep the handle/title/close/actions aligned; title can shrink/wrap without covering the actions. Apply squircle/top-edge tokens consistently. Ensure shadow/clip treatment does not cost unnecessary compositing on Android.
7. Ensure backdrop and close button don't intercept the sheet's controls; hardware Back closes once; double-tap/back during animation cannot invoke `onClose` multiple times; `onClose` runs only once after a completed close; reopen resets values without a flash.
8. Respect `Reduce Motion`, screen-reader semantics, focus movement/return and minimum hit target. Avoid marking every sheet as `alert` if it is a regular modal dialog.
9. Preserve typed form input on network failure and don't close until save succeeds. Destructive operations require confirmation; cancellation must not execute `onConfirm`.
10. Test compact portrait, landscape/split-screen where supported, tall form, keyboard open, validation errors, simultaneous horizontal control interaction, downward drag at body top/mid-scroll, backdrop tap and Android hardware Back.

## E. Query/data state audit: explicit split-brain check

The supplied newer Dashboard imports React Query hooks (schedule, knowledge, routines, intentions, family locations, space tasks/meetings/AI briefings) while it also reads Zustand stores like `useScheduleStore`/`useKnowledgeStore` and uses query values with fallbacks (`scheduleData ?? rawFunctions`, `knowledgeData ?? rawEntries`). Settings and Family also show stores and Query hooks together. This may be an intentional migration bridge, but it can cause screens to read one source while mutations write another and stale data to survive cache invalidation.

For each persisted domain, record:

- canonical repository/API that reads/writes it;
- canonical query-key factory;
- query hook(s) and mutation hook(s);
- local/offline persistence relationship;
- real-time or polling behavior;
- all consumers and all mutations;
- invalidation/optimistic rollback behavior;
- sign-out/account/family switch cleanup.

Choose one authoritative state path per domain. If React Query is the UI read cache, mutations update or invalidate that same cache and any Zustand store is only a clearly defined offline repository/UI adapter. If Zustand/local SQLite remains canonical for an offline-first local feature, React Query may wrap its asynchronous repository reads where useful, but it must not become a contradictory second copy. Don't force high-frequency gestures, animation progress, draft keystrokes or GPS samples through React Query.

Test a write in every screen that reads the domain: create, edit, delete, toggle, filter, switch family realm, sign out/in and recover offline changes. The result must be consistent without restarting the app.

## F. Actual high-priority bug candidates visible in pasted code

Verify each of these before modifying it:

- The `sticky`/`headerMode` inference above may cause compact-only headers throughout screens that expect a collapsing title.
- `headerContentTop`, toolbar heights and status insets include multiple literal offsets (46, 52, `statusInset + 4`, etc.). Replace with shared geometry constants and test top spacing.
- `CollapsingHeaderBar` calculates `titleInset` but appears to use `sideWidth` instead. Remove dead values or make the correct value the shared alignment source.
- `AppText` applies `normalize()` to a flattened font size even though `SetuTypography` already normalizes its tokens. Confirm; fix double scaling centrally.
- `ScreenFlashList` appears to use a JS event callback and manually writes `rootProps.scrollY.value`, `hideTabBar()` and `showTabBar()` rather than consuming the root worklet exactly like other adapters. This can add JS work per frame and duplicate dock logic. Confirm and unify.
- Some pasted adapters spread props and accept `onScroll` as `any`; ensure custom props do not override the canonical handler and preserve public React Native typings.
- `FamilySanctuaryMap` uses fixed Kolkata coordinates for its map center, manual tile placement and fixed 3×3 tile matrix in the excerpt. A `zoomScale` transform alone is not a real map pan/zoom data source. Replace with a proper map viewport/provider and actual coordinate-driven markers.
- A map excerpt uses a fallback `familyLocationService.getAllFamilyLocations()`, hard-coded dining suggestions and fabricated exact phone proximity. No demo/fallback coordinates or ratings may masquerade as a real query result.
- A current map tile download path appears to bulk-download a tile pack; this must be checked against the actual provider's licensing and usage policy. Do not bulk download from standard community OSM tile endpoints.
- Settings switches initialized with local `useState(true)` may not persist or match OS notification permission. `handleClearCache()` in the supplied excerpt only shows success feedback; `handleSyncNow()` may claim success without a typed result. Make the action real or disable it honestly.
- Family invitations/realm creation/bridge creation must wait for server or persistent local repository results; don't display confirmed remote success after unawaited calls.
- Fake/default data is present in the excerpts: fixed Add Event date/time/location, hard-coded assignee IDs, specific default knowledge author, and cluster assignment to the first member. Replace only after confirming live production paths.

## G. Release/performance/test matrix — keep tests in the left-side ledger

Use a table whose first columns are `Screen/Feature` and `Test/Invariant` so the test target stays on the left side for fast review; then `Device/Viewport`, `Command/Action`, `Result`, `Evidence`, `Commit`, `Remaining issue`. Keep the ledger in the task tracker or engineering documentation, not production app navigation.

At minimum, test:

| Screen/Feature | Test/Invariant |
|---|---|
| All screens | 320–360 dp width, large text, long title/subtitle, safe area/cutout, no horizontal overflow. |
| Collapsing header | Slow scroll, fast fling, reverse, pull-down, dynamic right actions, tab switch, reduced motion, no title jump. |
| Bottom dock | At top/scroll down/scroll up, horizontal-only scroll, sheet open/close, screen focus after prior screen hidden dock. |
| FlatList/SectionList/FlashList | Large data set, stable key identity, row toggle, item expansion, filtered data, pull-to-refresh, pagination, scroll restoration. |
| Keyboard/forms | Input focus, keyboard open, validation, submit CTA reachability, duplicate submit, cancel/back, rotate. |
| Bottom sheets | Body scroll vs dismiss drag, inner list top/middle offset, keyboard open, hardware Back, close race, reopen, dirty form and mutation failure. |
| React Query | Stale response race, offline mutation, cache rollback, invalidation, realm switch, sign-out, account switch, no data flash from prior family. |
| Squircle | Release-native registration/fallback, hundreds of rows, layout stability, no touch interception, correct clipping and shadow. |
| Map | Fullscreen, pinch/pan/zoom/recenter, visible attribution, current-location permission, stale accuracy, offline provider, marker selection. |
| Device finder | Target enrolled/authorized, stale location, target offline, no permission, ring ack/failure, actual accuracy and honest Wi-Fi RTT unsupported fallback. |
| Performance | Cold start, tab swaps, fast scroll, repeated mount/unmount, map, sheet/keyboard, app background/resume and thermal/battery trend. |

After each logical change run the narrowest relevant test, then re-run the complete repository checks after integration. Capture before/after data using the same device, release build type, dataset and user journey. Keep the tests and evidence attached to the screen/feature row that they verify.

---
