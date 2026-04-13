# Canva Desktop App
Canva Desktop App for Linux (electron wrapper)

This fork keeps the app as a minimal Canva wrapper and hardens the Electron runtime by disabling Node.js integration, enabling sandboxing and context isolation, denying runtime permission requests, blocking embedded webviews, and sending new windows to the default browser.

The Flatpak manifest now builds the checked out fork directly and only keeps download folder access instead of broad picture library access.

It also targets the current 25.08 Freedesktop runtime and prefers Wayland instead of X11.

### Installation
```bash
flatpak install flathub org.freedesktop.Sdk//25.08 org.electronjs.Electron2.BaseApp//25.08 org.freedesktop.Sdk.Extension.node22//25.08
flatpak-builder build manifest.yaml --install --user
```
