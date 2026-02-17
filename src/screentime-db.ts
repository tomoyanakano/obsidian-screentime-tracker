import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { homedir } from "os";
import { ScreenTimeEntry } from "./types";

const CORE_DATA_EPOCH = 978307200; // 2001-01-01 00:00:00 UTC in Unix timestamp

function getDefaultDbPath(): string {
	return `${homedir()}/Library/Application Support/Knowledge/knowledgeC.db`;
}

export function queryScreenTime(
	date: string,
	dbPath?: string
): ReadonlyArray<ScreenTimeEntry> {
	const db = dbPath || getDefaultDbPath();

	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new Error(`Invalid date format: ${date}`);
	}

	const query = `SELECT ZVALUESTRING, strftime('%H:%M:%S', ZSTARTDATE + ${CORE_DATA_EPOCH}, 'unixepoch', 'localtime'), strftime('%H:%M:%S', ZENDDATE + ${CORE_DATA_EPOCH}, 'unixepoch', 'localtime'), CAST(ROUND(ZENDDATE - ZSTARTDATE) AS INTEGER) FROM ZOBJECT WHERE ZSTREAMNAME = '/app/usage' AND date(ZSTARTDATE + ${CORE_DATA_EPOCH}, 'unixepoch', 'localtime') = '${date}' AND ZENDDATE > ZSTARTDATE ORDER BY ZSTARTDATE;\n`;

	const tmpFile = `/tmp/screentime_${Date.now()}.sql`;

	try {
		writeFileSync(tmpFile, query, "utf-8");

		const result = execSync(
			`sqlite3 -separator '|' "${db}" < "${tmpFile}"`,
			{ encoding: "utf-8", timeout: 10000, shell: "/bin/bash" }
		);

		try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }

		if (!result.trim()) {
			return [];
		}

		return result
			.trim()
			.split("\n")
			.map((line) => {
				const parts = line.split("|");
				return {
					bundleId: parts[0] ?? "",
					startTime: parts[1] ?? "",
					endTime: parts[2] ?? "",
					durationSeconds: parseInt(parts[3] ?? "0", 10),
				};
			})
			.filter((entry) => entry.bundleId !== "" && entry.durationSeconds > 0);
	} catch (err) {
		try { unlinkSync(tmpFile); } catch { /* ignore */ }
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to query knowledgeC.db: ${message}`);
	}
}
