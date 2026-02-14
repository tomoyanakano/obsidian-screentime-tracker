export interface ScreenTimeEntry {
	readonly bundleId: string;
	readonly startTime: string; // "HH:mm:ss"
	readonly endTime: string;   // "HH:mm:ss"
	readonly durationSeconds: number;
}

export interface HourlySummary {
	readonly hour: string; // "HH:00"
	readonly apps: ReadonlyArray<{ readonly name: string; readonly minutes: number }>;
}

export interface DailySummary {
	readonly date: string; // "YYYY-MM-DD"
	readonly hourly: ReadonlyArray<HourlySummary>;
	readonly totalMinutes: number;
}

export interface ScreenTimeSettings {
	dailyNoteFolder: string;
	minimumDurationSeconds: number;
	dbPath: string;
}

export const DEFAULT_SETTINGS: ScreenTimeSettings = {
	dailyNoteFolder: "life/daily",
	minimumDurationSeconds: 60,
	dbPath: "",
};
