import { App, PluginSettingTab, Setting } from "obsidian";
import type ScreenTimeTrackerPlugin from "./main";
import { DEFAULT_SETTINGS } from "./types";

export class ScreenTimeSettingTab extends PluginSettingTab {
	plugin: ScreenTimeTrackerPlugin;

	constructor(app: App, plugin: ScreenTimeTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Daily note folder")
			.setDesc("Path to the daily notes folder (e.g., life/daily)")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.dailyNoteFolder)
					.setValue(this.plugin.settings.dailyNoteFolder)
					.onChange(async (value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							dailyNoteFolder: value,
						};
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Minimum duration (seconds)")
			.setDesc("Ignore app usage entries shorter than this duration.")
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.minimumDurationSeconds))
					.setValue(String(this.plugin.settings.minimumDurationSeconds))
					.onChange(async (value) => {
						const parsed = parseInt(value, 10);
						if (!isNaN(parsed) && parsed >= 0) {
							this.plugin.settings = {
								...this.plugin.settings,
								minimumDurationSeconds: parsed,
							};
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("knowledgeC.db path")
			.setDesc("Leave empty for default macOS path (~/Library/Application Support/Knowledge/knowledgeC.db).")
			.addText((text) =>
				text
					.setPlaceholder("(default)")
					.setValue(this.plugin.settings.dbPath)
					.onChange(async (value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							dbPath: value,
						};
						await this.plugin.saveSettings();
					})
			);
	}
}
