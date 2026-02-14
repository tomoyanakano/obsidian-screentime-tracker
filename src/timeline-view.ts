import { ItemView, WorkspaceLeaf } from "obsidian";
import { queryScreenTime } from "./screentime-db";
import { resolveAppName } from "./app-resolver";
import { ScreenTimeEntry, ScreenTimeSettings } from "./types";

export const VIEW_TYPE_SCREENTIME = "screentime-timeline-view";

const HOUR_START = 6;
const HOUR_END = 24;
const ZOOM_MIN = 40;
const ZOOM_MAX = 240;
const ZOOM_STEP = 20;
const ZOOM_DEFAULT = 80;

// Deterministic color from app name
function appColor(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	const hue = ((hash % 360) + 360) % 360;
	return `hsl(${hue}, 55%, 55%)`;
}

function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function formatDateLabel(date: Date): string {
	const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const m = date.getMonth() + 1;
	const d = date.getDate();
	return `${m}/${d} (${weekdays[date.getDay()]})`;
}

interface ResolvedEntry {
	readonly appName: string;
	readonly startMinutes: number;
	readonly endMinutes: number;
	readonly durationSeconds: number;
}

function timeToMinutes(time: string): number {
	const parts = time.split(":");
	return parseInt(parts[0] ?? "0", 10) * 60 + parseInt(parts[1] ?? "0", 10);
}

function resolveEntries(
	entries: ReadonlyArray<ScreenTimeEntry>,
	minDuration: number
): ReadonlyArray<ResolvedEntry> {
	return entries
		.filter((e) => e.durationSeconds >= minDuration)
		.map((e) => ({
			appName: resolveAppName(e.bundleId),
			startMinutes: timeToMinutes(e.startTime),
			endMinutes: timeToMinutes(e.endTime),
			durationSeconds: e.durationSeconds,
		}));
}

function formatMinutes(mins: number): string {
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	if (h === 0) return `${m}m`;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export class ScreenTimeView extends ItemView {
	private currentDate: Date = new Date();
	private settings: ScreenTimeSettings;
	private containerEl_: HTMLElement | null = null;
	private hourHeight: number = ZOOM_DEFAULT;

	constructor(leaf: WorkspaceLeaf, settings: ScreenTimeSettings) {
		super(leaf);
		this.settings = settings;
	}

	getViewType(): string {
		return VIEW_TYPE_SCREENTIME;
	}

	getDisplayText(): string {
		return "Screen Time";
	}

	getIcon(): string {
		return "clock";
	}

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.addClass("screentime-view");
		this.containerEl_ = container;
		this.render();
	}

	async onClose() {
		this.containerEl_ = null;
	}

	updateSettings(settings: ScreenTimeSettings) {
		this.settings = settings;
	}

	private zoom(delta: number, scrollEl?: HTMLElement) {
		const prev = this.hourHeight;
		this.hourHeight = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.hourHeight + delta));
		if (this.hourHeight === prev) return;

		// Preserve scroll position proportionally
		let scrollRatio = 0;
		if (scrollEl) {
			const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
			scrollRatio = maxScroll > 0 ? scrollEl.scrollTop / maxScroll : 0;
		}

		this.render();

		if (scrollEl) {
			const contentEl = this.containerEl_?.querySelector(".screentime-view__content") as HTMLElement | null;
			if (contentEl) {
				const newMax = contentEl.scrollHeight - contentEl.clientHeight;
				contentEl.scrollTop = scrollRatio * newMax;
			}
		}
	}

	private render() {
		const container = this.containerEl_;
		if (!container) return;
		container.empty();

		// Header
		const header = container.createDiv({ cls: "screentime-view__header" });
		this.renderHeader(header);

		// Content wrapper
		const content = container.createDiv({ cls: "screentime-view__content" });

		// Ctrl+Scroll zoom on content area
		content.addEventListener("wheel", (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
				const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
				this.zoom(delta, content);
			}
		}, { passive: false });

		try {
			const dateStr = formatDate(this.currentDate);
			const entries = queryScreenTime(dateStr, this.settings.dbPath || undefined);
			const resolved = resolveEntries(entries, this.settings.minimumDurationSeconds);

			if (resolved.length === 0) {
				content.createDiv({
					cls: "screentime-view__empty",
					text: "No Screen Time data for this day.",
				});
				return;
			}

			// Summary bar
			this.renderSummary(content, resolved);

			// Timeline
			this.renderTimeline(content, resolved);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			content.createDiv({
				cls: "screentime-view__error",
				text: `Error: ${message}`,
			});
		}
	}

	private renderHeader(header: HTMLElement) {
		const nav = header.createDiv({ cls: "screentime-view__nav" });

		const prevBtn = nav.createEl("button", {
			cls: "screentime-view__nav-btn",
			text: "\u25C0",
		});
		prevBtn.addEventListener("click", () => {
			this.currentDate = new Date(this.currentDate);
			this.currentDate.setDate(this.currentDate.getDate() - 1);
			this.render();
		});

		nav.createDiv({
			cls: "screentime-view__date-label",
			text: formatDateLabel(this.currentDate),
		});

		const isToday =
			formatDate(this.currentDate) === formatDate(new Date());
		if (!isToday) {
			const todayBtn = nav.createEl("button", {
				cls: "screentime-view__nav-btn screentime-view__today-btn",
				text: "Today",
			});
			todayBtn.addEventListener("click", () => {
				this.currentDate = new Date();
				this.render();
			});
		}

		const nextBtn = nav.createEl("button", {
			cls: "screentime-view__nav-btn",
			text: "\u25B6",
		});
		nextBtn.addEventListener("click", () => {
			this.currentDate = new Date(this.currentDate);
			this.currentDate.setDate(this.currentDate.getDate() + 1);
			this.render();
		});

		// Zoom controls
		const zoomGroup = header.createDiv({ cls: "screentime-view__zoom" });

		const zoomOut = zoomGroup.createEl("button", {
			cls: "screentime-view__nav-btn",
			text: "\u2212",
		});
		zoomOut.addEventListener("click", () => this.zoom(-ZOOM_STEP));

		zoomGroup.createSpan({
			cls: "screentime-view__zoom-label",
			text: `${Math.round((this.hourHeight / ZOOM_DEFAULT) * 100)}%`,
		});

		const zoomIn = zoomGroup.createEl("button", {
			cls: "screentime-view__nav-btn",
			text: "+",
		});
		zoomIn.addEventListener("click", () => this.zoom(ZOOM_STEP));

		const zoomReset = zoomGroup.createEl("button", {
			cls: "screentime-view__nav-btn screentime-view__today-btn",
			text: "Reset",
		});
		zoomReset.addEventListener("click", () => {
			this.hourHeight = ZOOM_DEFAULT;
			this.render();
		});
	}

	private renderSummary(
		parent: HTMLElement,
		entries: ReadonlyArray<ResolvedEntry>
	) {
		const appTotals = new Map<string, number>();
		for (const e of entries) {
			const cur = appTotals.get(e.appName) ?? 0;
			appTotals.set(e.appName, cur + e.durationSeconds);
		}

		const sorted = Array.from(appTotals.entries())
			.map(([name, seconds]) => ({ name, minutes: Math.round(seconds / 60) }))
			.filter((a) => a.minutes > 0)
			.sort((a, b) => b.minutes - a.minutes);

		const totalMinutes = sorted.reduce((s, a) => s + a.minutes, 0);

		const summary = parent.createDiv({ cls: "screentime-view__summary" });
		summary.createDiv({
			cls: "screentime-view__total",
			text: `Total: ${formatMinutes(totalMinutes)}`,
		});

		const appList = summary.createDiv({ cls: "screentime-view__app-list" });
		for (const app of sorted) {
			const item = appList.createDiv({ cls: "screentime-view__app-item" });
			const dot = item.createSpan({ cls: "screentime-view__app-dot" });
			dot.style.backgroundColor = appColor(app.name);
			item.createSpan({
				cls: "screentime-view__app-name",
				text: app.name,
			});
			item.createSpan({
				cls: "screentime-view__app-time",
				text: formatMinutes(app.minutes),
			});
		}
	}

	private renderTimeline(
		parent: HTMLElement,
		entries: ReadonlyArray<ResolvedEntry>
	) {
		const timeline = parent.createDiv({ cls: "screentime-view__timeline" });
		const totalHeight = (HOUR_END - HOUR_START) * this.hourHeight;

		const grid = timeline.createDiv({ cls: "screentime-view__grid" });
		grid.style.height = `${totalHeight}px`;

		for (let h = HOUR_START; h <= HOUR_END; h++) {
			const topPx = (h - HOUR_START) * this.hourHeight;

			const line = grid.createDiv({ cls: "screentime-view__hour-line" });
			line.style.top = `${topPx}px`;

			const label = grid.createDiv({ cls: "screentime-view__hour-label" });
			label.style.top = `${topPx}px`;
			label.textContent = `${String(h).padStart(2, "0")}:00`;
		}

		const blocksContainer = grid.createDiv({ cls: "screentime-view__blocks" });

		const visibleEntries = entries.filter(
			(e) => e.endMinutes > HOUR_START * 60 && e.startMinutes < HOUR_END * 60
		);

		for (const entry of visibleEntries) {
			const startClamped = Math.max(entry.startMinutes, HOUR_START * 60);
			const endClamped = Math.min(entry.endMinutes, HOUR_END * 60);
			const durationMin = endClamped - startClamped;

			if (durationMin < 1) continue;

			const topPx =
				((startClamped - HOUR_START * 60) / 60) * this.hourHeight;
			const heightPx = (durationMin / 60) * this.hourHeight;

			const block = blocksContainer.createDiv({
				cls: "screentime-view__block",
			});
			block.style.top = `${topPx}px`;
			block.style.height = `${Math.max(heightPx, 2)}px`;
			block.style.backgroundColor = appColor(entry.appName);

			if (heightPx >= 16) {
				block.createSpan({
					cls: "screentime-view__block-label",
					text: entry.appName,
				});
			}

			const startH = String(Math.floor(entry.startMinutes / 60)).padStart(2, "0");
			const startM = String(entry.startMinutes % 60).padStart(2, "0");
			const endH = String(Math.floor(entry.endMinutes / 60)).padStart(2, "0");
			const endM = String(entry.endMinutes % 60).padStart(2, "0");
			block.setAttribute(
				"aria-label",
				`${entry.appName}\n${startH}:${startM} - ${endH}:${endM}\n${formatMinutes(Math.round(entry.durationSeconds / 60))}`
			);
		}
	}
}
