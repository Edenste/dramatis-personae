# 0008. Electron Forge for packaging, installers and auto-update

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The desktop app ([0002](0002-local-server-architecture.md)) needs packaging, installers, publishing and auto-update. Windows comes first, with macOS and Linux to follow. The repository is public on GitHub, and releases will be published there.

## Options considered

- **Electron Forge** — the Electron team's official all-in-one toolchain: development runner, packaging, installers ("makers") and publishing ("publishers"). The default Windows installer is Squirrel.Windows, a one-click, per-user install similar to Discord's. Free auto-update for public GitHub repositories through update.electronjs.org. Little control over the installer itself.
- **electron-builder** — a community tool driven by one config file. Its NSIS installer can be a full wizard with a choice of install location (as FoundryVTT uses). Updates can come from GitHub, S3 or any web server, including differential updates. No development runner.

## Decision

Use **Electron Forge**:

- **Windows:** `@electron-forge/maker-squirrel` — one-click install into the user's local app-data folder, no wizard.
- **macOS:** `@electron-forge/maker-dmg` for the installer and `@electron-forge/maker-zip` for updates.
- **Linux (later):** `.deb` and `.rpm` makers.
- **Publishing:** `@electron-forge/publisher-github` to GitHub Releases.
- **Auto-update:** `update-electron-app` with update.electronjs.org.

Forge was chosen for its simpler setup, its official status, near-zero-config auto-update for a public repository, and an install experience that matches the original goal of an app installed "like Discord".

## Consequences

- **The installer owns its folder.** Squirrel installs the app into `%LOCALAPPDATA%\<app name>`, keeps each version in its own `app-x.y.z` folder, and removes the folder on uninstall. The user-data root must therefore be a different folder ([0007](0007-repository-structure.md)), and the app never stores anything beside its executable.
- The installer cannot offer a choice of install location. If that is ever needed, a community NSIS maker or a move to electron-builder would be required.
- **macOS builds need macOS.** CI builds them on a GitHub Actions macOS runner, for Apple Silicon and Intel.
- **Signing is deferred.** Unsigned Windows installers show a SmartScreen warning but install and update normally. Unsigned macOS apps must be allowed manually in System Settings and cannot auto-update. A paid Apple Developer account and a Windows signing certificate or service are needed for frictionless public releases; until then, the README explains how to open unsigned builds.
- pnpm's hoisted layout (`node-linker=hoisted`) is needed for the desktop app package.
