/*
 * SystemPulse - Preferences
 */

'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const METRIC_SETTINGS = [
    {
        key: 'show-cpu',
        title: 'CPU Usage',
        subtitle: 'Show CPU usage percentage.',
    },
    {
        key: 'show-memory',
        title: 'Memory (RAM)',
        subtitle: 'Show memory usage percentage.',
    },
    {
        key: 'show-gpu',
        title: 'GPU VRAM',
        subtitle: 'Show AMD GPU VRAM usage.',
    },
    {
        key: 'show-gpu-temp',
        title: 'GPU Temperature',
        subtitle: 'Show AMD GPU temperature.',
    },
    {
        key: 'show-cpu-temp',
        title: 'CPU Temperature',
        subtitle: 'Show CPU temperature.',
    },
];

export default class SystemPulsePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.system-pulse');

        const page = new Adw.PreferencesPage({
            title: 'SystemPulse',
            icon_name: 'utilities-system-monitor-symbolic',
        });

        const metricsGroup = new Adw.PreferencesGroup({
            title: 'Metrics',
            description: 'Choose which system metrics to display.',
        });

        const metricRows = new Map();
        for (const metric of METRIC_SETTINGS) {
            const row = new Adw.SwitchRow({
                title: metric.title,
                subtitle: metric.subtitle,
            });

            row.connect('notify::active', () => {
                if (settings.get_boolean(metric.key) !== row.active)
                    settings.set_boolean(metric.key, row.active);
            });

            metricRows.set(metric.key, row);
            metricsGroup.add(row);
        }

        const displayGroup = new Adw.PreferencesGroup({
            title: 'Display',
            description: 'Control how values are shown.',
        });

        const decimalModel = new Gtk.StringList();
        decimalModel.append('No decimals');
        decimalModel.append('1 decimal');
        decimalModel.append('2 decimals');

        const decimalsRow = new Adw.ComboRow({
            title: 'Decimal places',
            subtitle: 'Applies to all displayed values.',
            model: decimalModel,
        });

        const clamp = (v) => Math.max(0, Math.min(2, v));

        const syncFromSettings = () => {
            const v = clamp(settings.get_int('decimal-places'));
            if (decimalsRow.selected !== v)
                decimalsRow.selected = v;

            let enabledCount = 0;
            for (const metric of METRIC_SETTINGS) {
                const active = settings.get_boolean(metric.key);
                const row = metricRows.get(metric.key);

                if (row.active !== active)
                    row.active = active;

                if (active)
                    enabledCount++;
            }

            for (const metric of METRIC_SETTINGS) {
                const active = settings.get_boolean(metric.key);
                const row = metricRows.get(metric.key);
                row.sensitive = enabledCount !== 1 || !active;
            }
        };

        syncFromSettings();

        let changedId = settings.connect('changed', syncFromSettings);

        decimalsRow.connect('notify::selected', () => {
            const v = clamp(decimalsRow.selected);
            if (settings.get_int('decimal-places') !== v)
                settings.set_int('decimal-places', v);
        });

        window.connect('close-request', () => {
            if (changedId) {
                settings.disconnect(changedId);
                changedId = 0;
            }
            return false;
        });

        page.add(metricsGroup);
        displayGroup.add(decimalsRow);
        page.add(displayGroup);

        window.add(page);
    }
}
