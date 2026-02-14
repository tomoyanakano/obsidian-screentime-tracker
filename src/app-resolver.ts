import { execSync } from "child_process";

const KNOWN_APPS: Readonly<Record<string, string>> = {
	"com.apple.Safari": "Safari",
	"com.apple.finder": "Finder",
	"com.apple.mail": "Mail",
	"com.apple.MobileSMS": "Messages",
	"com.apple.iCal": "Calendar",
	"com.apple.reminders": "Reminders",
	"com.apple.Notes": "Notes",
	"com.apple.Preview": "Preview",
	"com.apple.Terminal": "Terminal",
	"com.apple.dt.Xcode": "Xcode",
	"com.apple.Music": "Music",
	"com.apple.Passwords": "Passwords",
	"com.apple.systempreferences": "System Settings",
	"com.apple.ActivityMonitor": "Activity Monitor",
	"com.microsoft.VSCode": "VS Code",
	"com.github.wez.wezterm": "WezTerm",
	"company.thebrowser.Browser": "Arc",
	"com.tinyspeck.slackmacgap": "Slack",
	"com.hnc.Discord": "Discord",
	"md.obsidian": "Obsidian",
	"com.ableton.live": "Ableton Live",
	"com.toggl.daneel": "Toggl Track",
	"com.spotify.client": "Spotify",
	"com.google.Chrome": "Chrome",
	"org.mozilla.firefox": "Firefox",
	"com.figma.Desktop": "Figma",
	"notion.id": "Notion",
	"com.linear": "Linear",
	"us.zoom.xos": "Zoom",
	"com.readdle.smartemail-macos": "Spark",
	"com.culturedcode.ThingsMac": "Things",
	"com.flexibits.fantastical2.mac": "Fantastical",
	"com.1password.1password": "1Password",
	"com.openai.chat": "ChatGPT",
	"dev.zed.Zed": "Zed",
};

const resolvedCache = new Map<string, string>();

function resolveBundleIdViaMdls(bundleId: string): string | null {
	try {
		const appPath = execSync(
			`mdfind "kMDItemCFBundleIdentifier == '${bundleId.replace(/'/g, "'\\''")}'"|head -1`,
			{ encoding: "utf-8", timeout: 5000 }
		).trim();

		if (!appPath) return null;

		const name = execSync(
			`mdls -name kMDItemDisplayName -raw "${appPath.replace(/"/g, '\\"')}"`,
			{ encoding: "utf-8", timeout: 5000 }
		).trim();

		if (name && name !== "(null)") {
			return name.replace(/\.app$/, "");
		}
		return null;
	} catch {
		return null;
	}
}

function extractFallbackName(bundleId: string): string {
	const parts = bundleId.split(".");
	const last = parts[parts.length - 1] ?? bundleId;
	return last.charAt(0).toUpperCase() + last.slice(1);
}

export function resolveAppName(bundleId: string): string {
	const cached = resolvedCache.get(bundleId);
	if (cached) return cached;

	const known = KNOWN_APPS[bundleId];
	if (known) {
		resolvedCache.set(bundleId, known);
		return known;
	}

	const mdlsName = resolveBundleIdViaMdls(bundleId);
	if (mdlsName) {
		resolvedCache.set(bundleId, mdlsName);
		return mdlsName;
	}

	const fallback = extractFallbackName(bundleId);
	resolvedCache.set(bundleId, fallback);
	return fallback;
}

export function clearCache(): void {
	resolvedCache.clear();
}
