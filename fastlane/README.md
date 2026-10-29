fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## Android

### android build

```sh
[bundle exec] fastlane android build
```

Build Android release bundle

### android internal

```sh
[bundle exec] fastlane android internal
```

Deploy a new version to Google Play Internal track

### android beta

```sh
[bundle exec] fastlane android beta
```

Deploy a new version to Google Play Closed Beta (alpha track)

### android promote_to_beta

```sh
[bundle exec] fastlane android promote_to_beta
```

Promote internal release to Closed Beta (alpha track)

### android release

```sh
[bundle exec] fastlane android release
```

Deploy to Google Play Production track

### android deploy

```sh
[bundle exec] fastlane android deploy
```

Deploy to Google Play (default: internal testing)

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
