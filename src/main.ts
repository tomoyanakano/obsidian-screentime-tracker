import { Notice, Plugin } from "obsidian";
import { queryScreenTime } from "./screentime-db";
import { resolveAppName } from "./app-resolver";
import { insertScreenTimeSection } from "./daily-note";
import { ScreenTimeSettingTab } from "./settings";
import { ScreenTimeView, VIEW_TYPE_SCREENTIME } from "./timeline-view";
import {
	ScreenTimeSettings,
	DEFAULT_SETTINGS,
	ScreenTimeEntry,
	HourlySummary,
	DailySummary,
} from "./types";

function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function groupByHour(
	entries: ReadonlyArray<ScreenTimeEntry>,
	minimumDurationSeconds: number
): ReadonlyArray<HourlySummary> {
	const hourAppMap = new Map<string, Map<string, number>>();

	for (const entry of entries) {
		if (entry.durationSeconds < minimumDurationSeconds) continue;

		const hour = entry.startTime.slice(0, 2) + ":00";
		if (!hourAppMap.has(hour)) {
			hourAppMap.set(hour, new Map<string, number>());
		}
		const appMap = hourAppMap.get(hour)!;
		const current = appMap.get(entry.bundleId) ?? 0;
		appMap.set(entry.bundleId, current + entry.durationSeconds);
	}

	const hours = Array.from(hourAppMap.keys()).sort();
	return hours.map((hour) => {
		const appMap = hourAppMap.get(hour)!;
		const apps = Array.from(appMap.entries())
			.map(([bundleId, seconds]) => ({
				name: resolveAppName(bundleId),
				minutes: Math.round(seconds / 60),
			}))
			.filter((a) => a.minutes > 0)
			.sort((a, b) => b.minutes - a.minutes);
		return { hour, apps };
	});
}

function buildDailySummary(
	date: string,
	hourlyData: ReadonlyArray<HourlySummary>
): DailySummary {
	const totalMinutes = hourlyData.reduce(
		(sum, h) => sum + h.apps.reduce((s, a) => s + a.minutes, 0),
		0
	);
	return { date, hourly: hourlyData, totalMinutes };
}

export default class ScreenTimeTrackerPlugin extends Plugin {
	settings: ScreenTimeSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_SCREENTIME,
			(leaf) => new ScreenTimeView(leaf, this.settings)
		);

		this.addCommand({
			id: "open-screentime-view",
			name: "Open screen time timeline",
			callback: () => this.activateView(),
		});

		this.addCommand({
			id: "insert-screen-time-today",
			name: "Insert screen time (today)",
			callback: () => this.insertForDate(new Date()),
		});

		this.addCommand({
			id: "insert-screen-time-yesterday",
			name: "Insert screen time (yesterday)",
			callback: () => {
				const yesterday = new Date();
				yesterday.setDate(yesterday.getDate() - 1);
				void this.insertForDate(yesterday);
			},
		});

		this.addSettingTab(new ScreenTimeSettingTab(this.app, this));
	}

	onunload() {
		// Do not detach leaves — Obsidian restores leaf positions on reload
	}

	private async activateView() {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SCREENTIME);
		if (existing.length > 0) {
			await this.app.workspace.revealLeaf(existing[0]!);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_SCREENTIME,
				active: true,
			});
			await this.app.workspace.revealLeaf(leaf);
		}
	}

	private async insertForDate(date: Date) {
		const dateStr = formatDate(date);
		try {
			new Notice(`Fetching Screen Time for ${dateStr}...`);

			const entries = queryScreenTime(
				dateStr,
				this.settings.dbPath || undefined
			);

			if (entries.length === 0) {
				new Notice(`No Screen Time data found for ${dateStr}`);
				return;
			}

			const hourly = groupByHour(entries, this.settings.minimumDurationSeconds);
			const summary = buildDailySummary(dateStr, hourly);

			await insertScreenTimeSection(this.app, summary, this.settings);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(`Screen Time error: ${message}`);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData() as Partial<ScreenTimeSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
