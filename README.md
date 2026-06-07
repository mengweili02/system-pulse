# SystemPulse

A GNOME Shell extension that displays real-time system metrics: GPU temperature/VRAM, CPU/RAM usage, and temperatures in the top bar.

## Features

- **CPU Usage**: Real-time CPU percentage
- **Memory (RAM)**: Memory usage percentage
- **GPU VRAM**: AMD GPU video memory usage (via rocm-smi)
- **GPU Temperature**: AMD GPU temperature (via rocm-smi)
- **CPU Temperature**: CPU thermal sensors

## Installation

### Via GNOME Extensions (Recommended)

1. Install via [GNOME Extensions Website](https://extensions.gnome.org/extension/XXXXX/system-pulse/)
2. Toggle the extension on

### Manual Installation

```bash
cd /tmp
git clone <repository-url>
cd system-pulse
chmod +x install.sh
./install.sh
```

Then restart GNOME Shell:
- **X11**: Press `Alt+F2`, type `r`, press `Enter`
- **Wayland**: Log out and back in

## Requirements

- GNOME Shell 45+
- AMD GPU with ROCm drivers (for GPU stats)
- `lm-sensors` or thermal zone support (for CPU temperature)

## Configuration

Access preferences via:
- Extensions app → SystemPulse → Preferences
- Or run: `gnome-extensions prefs system-pulse@mengweili02.github.com`

You can toggle individual metrics and adjust decimal precision.

## Based On

- [rocm-gpu-monitor](https://github.com/VexroFR/rocm-gpu-monitor) by VexroFR
- [gnome-system-monitor-indicator](https://github.com/michaelknap/gnome-system-monitor-indicator) by michaelknap
- [gnome-shell-extension-freon](https://github.com/UshakovVasilii/gnome-shell-extension-freon) by UshakovVasilii

## License

MIT
