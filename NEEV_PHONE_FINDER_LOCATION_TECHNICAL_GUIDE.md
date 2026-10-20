# Neev — Real Location, Altitude and Lost-Phone Finder: Implementation Guide

This document is a supporting engineering specification for the Neev production repair prompt. It defines what a React Native/Expo Android app can implement honestly, which native capabilities require hardware or OS support, and what must never be simulated as a real location result.

## 1. First distinguish the target

There are two different problems:

1. **Where is this phone right now?** The code running on a phone asks that phone's own location provider for a location fix, then (only with explicit consent) reports a minimal snapshot to the backend.
2. **Where is another enrolled family phone?** The requesting phone retrieves the target phone's most recent permitted snapshot from a secured backend, including when it was collected, its uncertainty, and whether the target has recently checked in. The requester's own GPS does not locate the other device.

A family relationship by itself is not sufficient authorization. Enrollment, authentication, per-device consent, per-viewer access, revocation and retention rules must be enforced on the server, not just hidden in UI. Do not build hidden tracking, rely on a phone's Wi-Fi MAC address, or promise exact location from an IP address.

## 2. Latitude and longitude on Android

Prefer the location stack already installed in the project. In an Expo app, inspect `expo-location` and the current Expo SDK before adding a new native package. If the application already contains a Kotlin location module, inspect and reuse it rather than creating a second location authority.

The implementation must:

1. Explain why location is needed immediately before asking for it.
2. Request only the permissions the active feature needs. Approximate permission must remain supported; precise sharing should require a clear product reason and separate user consent where appropriate.
3. Request a current fix using the supported fused location/location API. A last-known fix can be returned quickly but may be stale; show its timestamp and age. Do not label a last-known fix “Live”.
4. Store and display the reported horizontal accuracy/uncertainty radius, capture timestamp and source status. The marker should visually represent uncertainty instead of pretending a coordinate is exact.
5. Respect location-service-off, denied, restricted, approximate-only, timeout, unavailable-provider, offline and stale-data states. Include a retry/settings route.
6. Throttle remote upload and UI updates. Avoid sending every sensor sample to Supabase or rerendering an entire family screen for each new fix. Stop watchers when not needed and manage battery policy intentionally.
7. For background sharing, make it an explicit opt-in with a clear ongoing explanation, correct permissions and Android foreground-service/notification behavior for the SDK version. Do not use a hidden background worker to evade platform restrictions.

Official references:

- [Android: retrieve current/last-known location](https://developer.android.com/develop/sensors-and-location/location/retrieve-current)
- [Android: request location updates](https://developer.android.com/develop/sensors-and-location/location/request-updates)
- [Android: location permissions and approximate vs precise](https://developer.android.com/develop/sensors-and-location/location/permissions)

## 3. Altitude and “exact height”

Altitude is an optional measurement with its own accuracy. Android's `Location.getAltitude()` reports meters above the WGS84 reference ellipsoid; not every location has altitude or a vertical-accuracy estimate. Some newer APIs can provide mean-sea-level altitude, but availability varies by Android version/provider. Do not convert unavailable/unknown values into zero or invent a floor number.

Display altitude only when the measurement is present, together with datum/source and the available vertical-accuracy estimate. Otherwise display “Altitude unavailable” or omit it. A barometer measures pressure and can estimate relative height changes only with calibration and environmental caveats; it does not magically determine a reliable absolute floor. GPS altitude indoors is often less useful than horizontal location and is not a room-level positioning solution.

Official reference: [Android `Location` API: altitude and vertical accuracy](https://developer.android.com/reference/android/location/Location)

## 4. Wi-Fi is not a universal exact-position system

**Being connected to ordinary Wi-Fi does not reveal the phone's exact point inside a house.** Wi-Fi SSID/BSSID/MAC/IP values are not a substitute for a location fix. Android restricts Wi-Fi scanning, permissions and scan frequency, and scan results can be stale. Do not build a product claim around extracting a device MAC or scanning a router and pretending it gives couch-level coordinates.

Android has a specific capability called Wi-Fi RTT (Round-Trip Time), but it is conditional:

- The ranging phone must support the required Wi-Fi RTT/FTM capability.
- The access points or peer devices measured must also support it.
- Location services/Wi-Fi scan conditions and runtime permissions must be satisfied.
- The feature is intended to run when the app is visible or in a supported foreground service; it is not an unrestricted background locator.
- Multiple suitable anchors with known/obtained positions are needed to estimate a position by multilateration. Documentation describes typical 1–2 m distance-derived position accuracy in favorable supported setups, not guaranteed results on every device, and not exact identification of a phone beneath a specific cushion.

Implement an explicit capability detector and permissions/status UI. If the hardware or access points do not support RTT, show “Indoor ranging unavailable on this device/network” and use the best legitimate coarse location signal; never display fabricated radar distance.

Official references:

- [Android: Wi-Fi RTT ranging](https://developer.android.com/develop/connectivity/wifi/wifi-rtt)
- [Android: Wi-Fi scan process and restrictions](https://developer.android.com/develop/connectivity/wifi/wifi-scan)

For truly fine-grained indoor positioning, investigate a deployed and tested compatible system such as UWB, BLE beacons or mapped Wi-Fi RTT anchors. It requires supported hardware, calibrated reference positions and a real on-device ranging algorithm. A phone's GPS alone cannot tell whether it is under a particular pillow, sofa cushion or table.

## 5. Production lost-phone flow

Implement clear separate states, for example:

- `not_enrolled`
- `permission_required`
- `current_location_available`
- `last_location_available`
- `stale_location`
- `target_offline`
- `ring_request_pending`
- `ring_request_acknowledged`
- `ring_request_failed`
- `location_unavailable`
- `indoor_ranging_unsupported`

Only use the project's canonical types if they already exist, but preserve the meaning. Do not convert a click into an “acknowledged” status.

A realistic application-managed ring flow needs an enrolled target device, a secured authenticated command request, push delivery or another supported path, a handler on the target, OS-permitted audio/notification behavior, a response/acknowledgement, rate limiting, cancellation/stop support and auditable authorization. If the phone is offline, powered off, has force-stopped the app, revoked permissions or lacks background execution, Neev may not be able to deliver the command. Never claim to bypass silent mode or Do Not Disturb on all OEMs. Respect Android behavior and user control.

For system-level offline phone finding, provide an honest handoff/instructions for the device's existing Google Find Hub rather than claiming Neev can access Google's private crowdsourced finding network. Find Hub can use OS-enabled offline-finding capabilities and encrypted stored locations that an ordinary third-party app cannot freely reproduce through Wi-Fi scans.

Official references:

- [Google: prepare an Android device for Find Hub](https://support.google.com/android/answer/3265955)
- [Google: how Find Hub protects location data](https://support.google.com/android/answer/14796936)

## 6. Family live location and child privacy

- The person/device that shares location must enroll and explicitly consent. Explain whether the data is precise/approximate, who can see it, how often it updates and when retention ends.
- Make sharing scope explicit: self, selected people, a selected household/cluster, or another explicitly authorized audience. Being present in two family trees does not merge location access.
- Provide a conspicuous pause/revoke action and stop native location updates when the share is disabled. Honour account sign-out, membership revocation and guardian/child-specific rules.
- Don't reveal location histories, timestamps or “home” status in notifications, search, AI retrieval or map tiles outside that access scope.
- Store the smallest useful data set; set an explicit retention limit for raw snapshots and avoid a forever history by default.
- Separate family location sharing from a lost-device recovery command. A parent/guardian's authority must be implemented through the app's declared age/guardian policy, not assumed from a relationship label.

## 7. Maps, free providers and offline behavior

A free data source does not mean that its hosted tile server is an unlimited free production service. If OpenStreetMap Foundation tile servers are used, the implementation must display attribution, identify the app correctly, respect caching rules and avoid bulk-prefetch/offline-pack downloads from the standard public tile endpoint. Select a provider whose published terms and free tier really permit the production use and offline packs needed, or remove the bulk-download control. Never ship an “offline map pack” success toast unless tiles were legally and completely cached through a suitable provider.

Official policies:

- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- [Nominatim geocoding usage policy](https://operations.osmfoundation.org/policies/nominatim/)

## 8. Minimum verification tests

- Current phone location: approximate grant, precise grant, deny, revoke, location off, timeout, stale result, no network, rotation, background/resume and power saver.
- Remote family phone: enrolled vs unregistered, unauthorized viewer, cross-tree attempt, selected-person scope, revoked consent, offline target, stale target, target missing permission, request sent but no acknowledgement, acknowledgement, cancellation and retry.
- Altitude: available and unavailable readings, vertical accuracy present and absent, no assumption that `0` is meaningful, correct datum label.
- Wi-Fi RTT: supported phone/AP, unsupported phone, unsupported APs, missing permissions, Location/Wi-Fi disabled, stale scan, insufficient anchors and foreground/background transition.
- Map: attribution visible, pan/zoom/recenter, full-screen and compact view, tiles fail/offline, provider quota, selected marker, stale location badge and no hard-coded production coordinates.
- Security: guessed device/realm IDs, token expiration, member removal, sign-out, user/account switch, deleted share permissions, and attempts to query a different tree's location.

**Definition of done:** no real-time, exact, altitude, indoor-radar or offline-finding claim can appear unless the system has the underlying supported data/capability and the result is verified. When unavailable, the app still offers truthful location status, last-known location if authorized, ordinary ring/notification capability when supported, and the OS Find Hub handoff.
