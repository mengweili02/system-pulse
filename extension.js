/*
 * SystemPulse
 *
 * Real-time system monitoring: GPU temp/VRAM, CPU/RAM usage, and temperatures.
 * Based on: rocm-gpu-monitor, system-monitor-indicator, freon
 */

'use strict';

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const UPDATE_INTERVAL = 2;

const SystemPulse = GObject.registerClass(
class SystemPulse extends PanelMenu.Button {
    _init(settings) {
        super._init(0.0, 'SystemPulse', false);

        this._settings = settings;
        this._cpuPrevUsed = 0;
        this._cpuPrevTotal = 0;
        this._timeoutId = 0;
        this._decimalPlaces = 1;
        this._showCpu = true;
        this._showMemory = true;
        this._showGpu = true;
        this._showGpuTemp = true;
        this._showCpuTemp = true;

        this._box = new St.BoxLayout();

        this._cpuLabel = new St.Label({ text: 'CPU: --%', y_align: Clutter.ActorAlign.CENTER, style: 'margin-right: 8px;' });
        this._memLabel = new St.Label({ text: 'Mem: --%', y_align: Clutter.ActorAlign.CENTER, style: 'margin-right: 8px;' });
        this._gpuTempLabel = new St.Label({ text: 'GPU: --°C', y_align: Clutter.ActorAlign.CENTER, style: 'margin-right: 8px;' });
        this._gpuVramLabel = new St.Label({ text: 'VRAM: --/--Go', y_align: Clutter.ActorAlign.CENTER, style: 'margin-right: 8px;' });
        this._cpuTempLabel = new St.Label({ text: 'CPU Temp: --°C', y_align: Clutter.ActorAlign.CENTER });

        this._box.add_child(this._cpuLabel);
        this._box.add_child(this._memLabel);
        this._box.add_child(this._gpuTempLabel);
        this._box.add_child(this._gpuVramLabel);
        this._box.add_child(this._cpuTempLabel);

        this.add_child(this._box);

        this._syncSettings(true);
        this._settings.connect('changed', () => {
            this._syncSettings();
        });

        this._update();
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, UPDATE_INTERVAL, () => {
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _syncSettings(initial = false) {
        this._decimalPlaces = this._clampDecimal(this._settings.get_int('decimal-places'));
        this._showCpu = this._settings.get_boolean('show-cpu');
        this._showMemory = this._settings.get_boolean('show-memory');
        this._showGpu = this._settings.get_boolean('show-gpu');
        this._showGpuTemp = this._settings.get_boolean('show-gpu-temp');
        this._showCpuTemp = this._settings.get_boolean('show-cpu-temp');

        this._syncLabelVisibility();

        if (!initial) {
            this._update();
        }
    }

    _syncLabelVisibility() {
        this._cpuLabel.visible = this._showCpu;
        this._memLabel.visible = this._showMemory;
        this._gpuTempLabel.visible = this._showGpuTemp;
        this._gpuVramLabel.visible = this._showGpu;
        this._cpuTempLabel.visible = this._showCpuTemp;
    }

    _clampDecimal(value) {
        if (typeof value !== 'number' || Number.isNaN(value))
            return 2;
        return Math.max(0, Math.min(2, Math.trunc(value)));
    }

    _formatPercent(value) {
        return value.toFixed(this._decimalPlaces);
    }

    _update() {
        this._updateCPUAndMemory();
        this._updateGPUStats();
        this._updateTemperatures();
    }

    _updateCPUAndMemory() {
        if (!this._showCpu && !this._showMemory)
            return;

        try {
            let memContent = '';
            let statContent = '';

            if (this._showMemory) {
                let memFile = Gio.File.new_for_path('/proc/meminfo');
                let syncResult = memFile.load_contents_sync(null);
                if (syncResult[0]) {
                    memContent = new TextDecoder('utf-8').decode(syncResult[1]);
                }
            }

            if (this._showCpu) {
                let statFile = Gio.File.new_for_path('/proc/stat');
                let syncResult = statFile.load_contents_sync(null);
                if (syncResult[0]) {
                    statContent = new TextDecoder('utf-8').decode(syncResult[1]);
                }
            }

            if (this._showCpu && statContent) {
                this._updateCPUUsage(statContent);
            }

            if (this._showMemory && memContent) {
                this._updateMemoryUsage(memContent);
            }
        } catch (e) {
               console.error('System Monitor - CPU/Memory Error:', e);
        }
    }

    _updateCPUUsage(text) {
        try {
            let lines = text.split('\n');
            let currentCpuUsed = 0;
            let currentCpuTotal = 0;

            for (let line of lines) {
                let fields = line.trim().split(/\s+/);
                if (fields[0] !== 'cpu')
                    continue;

                let nums = fields.slice(1).map(Number);
                if (!nums.length)
                    break;

                let idle = nums[3];
                let iowait = nums[4] || 0;

                currentCpuTotal = nums.slice(0, 4).reduce((a, b) => a + b, 0) + iowait;
                currentCpuUsed = currentCpuTotal - idle - iowait;

                if (this._cpuPrevTotal === 0) {
                    this._cpuPrevTotal = currentCpuTotal;
                    this._cpuPrevUsed = currentCpuUsed;
                    this._cpuLabel.text = 'CPU: --%';
                    break;
                }

                let totalDiff = currentCpuTotal - this._cpuPrevTotal;
                let usedDiff = currentCpuUsed - this._cpuPrevUsed;

                if (totalDiff > 0) {
                    let usage = (usedDiff / totalDiff) * 100;
                    this._cpuLabel.text = `CPU: ${this._formatPercent(usage)}%`;
                }

                this._cpuPrevTotal = currentCpuTotal;
                this._cpuPrevUsed = currentCpuUsed;
                break;
            }
        } catch (e) {
            console.error('CPU Update Error:', e);
        }
    }

    _updateMemoryUsage(text) {
        try {
            let lines = text.split('\n');
            let memTotal = null;
            let memAvailable = null;

            for (let line of lines) {
                if (!line.includes(':'))
                    continue;

                let [key, value] = line.split(':');
                if (!value)
                    continue;

                value = parseInt(value.trim(), 10);
                if (Number.isNaN(value))
                    continue;

                if (key === 'MemTotal')
                    memTotal = value;
                if (key === 'MemAvailable')
                    memAvailable = value;
            }

            if (memTotal != null && memAvailable != null) {
                let memUsed = memTotal - memAvailable;
                let memUsage = (memUsed / memTotal) * 100;
                this._memLabel.text = `Mem: ${this._formatPercent(memUsage)}%`;
            } else if (memTotal != null) {
                this._memLabel.text = 'Mem: --%';
            }
        } catch (e) {
            console.error('Memory Update Error:', e);
        }
    }

    _updateGPUStats() {
        if (!this._showGpu)
            return;

        try {
            let proc = new Gio.Subprocess({
                argv: ['rocm-smi', '--showuse', '--showmeminfo', 'vram', '--json'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            });

            proc.init(null);
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (ok && stdout) {
                        let data = JSON.parse(stdout);
                        let cardKey = Object.keys(data).find(k => k.startsWith('card'));

                        if (cardKey) {
                            let info = data[cardKey];
                            let gpuUsage = info['GPU use (%)'] || '0';

                            let vramTotalB = parseInt(info['VRAM Total Memory (B)']) || 0;
                            let vramUsedB = parseInt(info['VRAM Total Used Memory (B)']) || 0;

                            let vramTotalGB = (vramTotalB / 1073741824).toFixed(1);
                            let vramUsedGB = (vramUsedB / 1073741824).toFixed(1);

                            this._gpuVramLabel.text = `VRAM: ${vramUsedGB}/${vramTotalGB}Go`;
                        }
                    }
                } catch (e) {
                    this._gpuVramLabel.text = 'VRAM: Err';
                }
            });
        } catch (e) {
            this._gpuVramLabel.text = 'VRAM: Err';
        }
    }

    _updateTemperatures() {
        if (!this._showGpuTemp && !this._showCpuTemp)
            return;

        try {
            let proc = new Gio.Subprocess({
                argv: ['rocm-smi', '--showtemp', '--json'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            });

            proc.init(null);
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (ok && stdout) {
                        let data = JSON.parse(stdout);
                        let cardKey = Object.keys(data).find(k => k.startsWith('card'));

                        if (cardKey) {
                            let temp = data[cardKey]['Temperature (Sensor edge) (C)'] || data[cardKey]['Temperature (Sensor junction) (C)'];
                            if (temp !== undefined) {
                                this._gpuTempLabel.text = `GPU: ${temp.toFixed(1)}°C`;
                            }
                        }
                    }
                } catch (e) {
                    this._gpuTempLabel.text = 'GPU: --°C';
                }
            });

            let tempFile = Gio.File.new_for_path('/sys/class/thermal/thermal_zone*/temp');
            let thermalDir = Gio.File.new_for_path('/sys/class/thermal');
            
            let cpuTemp = null;
            try {
                thermalDir.enumerate_start('temp_*', Gio.FileEnumerateOptions.SYMLINKS, null, (err, enumResult) => {
                    if (err) return;
                    
                    let file;
                    while ((file = enumResult.next_file(null)) != null) {
                        let filePath = `/sys/class/thermal/${file.get_name()}/temp`;
                        let tFile = Gio.File.new_for_path(filePath);
                        let syncResult = tFile.load_contents_sync(null);
                        if (syncResult[0]) {
                            let tempValue = parseInt(new TextDecoder('utf-8').decode(syncResult[1]));
                            if (tempValue !== undefined && !Number.isNaN(tempValue)) {
                                cpuTemp = tempValue / 1000;
                            }
                        }
                    }
                });
            } catch (e) {
                // Silently ignore
            }

            if (cpuTemp !== null) {
                this._cpuTempLabel.text = `CPU Temp: ${cpuTemp.toFixed(1)}°C`;
            } else {
                this._cpuTempLabel.text = 'CPU Temp: --°C';
            }
        } catch (e) {
            this._gpuTempLabel.text = 'GPU: --°C';
            this._cpuTempLabel.text = 'CPU Temp: --°C';
        }
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        super.destroy();
    }
});

export default class SystemPulseExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.system-pulse');
        this._indicator = new SystemPulse(this._settings);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
