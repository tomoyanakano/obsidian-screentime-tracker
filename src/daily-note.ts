import { App, TFile, Notice } from "obsidian";
import { DailySummary, ScreenTimeSettings } from "./types";

function formatMinutes(totalMinutes: number): string {
	if (totalMinutes < 60) return `${totalMinutes}m`;
	const hours = Math.floor(totalMinutes / 60);
	const mins = totalMinutes % 60;
	return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

function generateMarkdownTable(summary: DailySummary): string {
	const lines: string[] = [];
	lines.push("## Screen Time");
	lines.push("");
	lines.push("| 時間 | アプリ | 使用時間 |");
	lines.push("|------|--------|---------|");

	for (const hourData of summary.hourly) {
		for (const app of hourData.apps) {
			lines.push(`| ${hourData.hour} | ${app.name} | ${formatMinutes(app.minutes)} |`);
		}
	}

	lines.push(`| **合計** | - | **${formatMinutes(summary.totalMinutes)}** |`);
	lines.push("");
	return lines.join("\n");
}

function getDailyNotePath(
	date: string,
	settings: ScreenTimeSettings
): string {
	const [year, month] = date.split("-");
	return `${settings.dailyNoteFolder}/${year}/${month}/${date}.md`;
}

export async function insertScreenTimeSection(
	app: App,
	summary: DailySummary,
	settings: ScreenTimeSettings
): Promise<void> {
	const filePath = getDailyNotePath(summary.date, settings);
	const file = app.vault.getAbstractFileByPath(filePath);

	if (!(file instanceof TFile)) {
		new Notice(`Daily note not found: ${filePath}`);
		return;
	}

	const content = await app.vault.read(file);
	const sectionMarker = "## Screen Time";
	const markdown = generateMarkdownTable(summary);

	let newContent: string;

	if (content.includes(sectionMarker)) {
		const sectionStart = content.indexOf(sectionMarker);
		const afterMarker = content.slice(sectionStart + sectionMarker.length);
		const nextHeadingMatch = afterMarker.match(/\n## /);
		const sectionEnd = nextHeadingMatch?.index != null
			? sectionStart + sectionMarker.length + nextHeadingMatch.index
			: content.length;
		newContent =
			content.slice(0, sectionStart) +
			markdown +
			content.slice(sectionEnd);
	} else {
		// Insert before tag line (#2026-02 ... #daily) or append at end
		const tagLineMatch = content.match(/\n(#\d{4}-\d{2}\s)/);
		if (tagLineMatch?.index != null) {
			const insertPos = tagLineMatch.index;
			newContent =
				content.slice(0, insertPos) +
				"\n" +
				markdown +
				content.slice(insertPos);
		} else {
			newContent = content.trimEnd() + "\n\n" + markdown;
		}
	}

	await app.vault.modify(file, newContent);
	new Notice(`Screen Time inserted into ${filePath}`);
}
