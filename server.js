import { EventEmitter } from "node:events";
import { readFileSync, watch } from "node:fs";
import fs from "node:fs/promises";
import http from "node:https";
import path from "node:path";
import repl from "node:repl";
import { fileURLToPath } from "node:url";

import { missionScore, overallScore } from "./computeScores.js";

import ExcelJS from "exceljs";
import WebSocket, { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, "data.json");

const opts = {
  cert: readFileSync(path.join(__dirname, "server.crt")),
  key: readFileSync(path.join(__dirname, "server.key")),
};
const server = http.createServer(opts);
const ws = new WebSocketServer({ server });

const ev = new EventEmitter();
watch(DATA_PATH, (evtype) => {
  if (evtype === "change") {
    ev.emit("fileChange");
  }
});

server.on("request", async (req, res) => {
  if (req.method === "GET" && req.url === "/data") {
    try {
      const data = await fs.readFile(DATA_PATH, "utf8");
      res.writeHead(200, { "content-type": "application/json" });
      res.write(data);
      return res.end();
    } catch (error) {
      console.error(error);
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(
        JSON.stringify({
          error: true,
          content: error,
        }),
      );
    }
  } else if (req.method === "GET") {
    if (req.url === "/") {
      try {
        const data = await fs.readFile(
          path.join(__dirname, "public", "index.html"),
          "utf8",
        );
        res.writeHead(200, { "content-type": "text/html" });
        res.write(data);
        return res.end();
      } catch (error) {
        console.error(error);
        res.writeHead(404, { "content-type": "text/html" });
        return res.end("404 unknown");
      }
    } else if (req.url === "/schedule") {
      try {
        const data = await fs.readFile(
          path.join(__dirname, "public", "schedule.html"),
          "utf8",
        );
        res.writeHead(200, { "content-type": "text/html" });
        res.write(data);
        return res.end();
      } catch (error) {
        console.error(error);
        res.writeHead(404, { "content-type": "text/html" });
        return res.end("404 unknown");
      }
    }
  }
  res.writeHead(404, { "content-type": "text/plain" });
  return res.end("404 Path Does Not Exist");
});

ws.on("connection", async (client) => {
  console.log("accessed");

  const onFileChange = async () => {
    try {
      const data = await fs.readFile(DATA_PATH, "utf8");
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ data, code: 1 }));
      }
    } catch (error) {
      console.error(error);
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ data: error, code: 2 }));
      }
    }
  };

  await onFileChange();

  ev.on("fileChange", onFileChange);
  client.on("close", () => {
    console.log("client off");
    ev.off("fileChange", onFileChange);
  });
});

server.listen(3000, "0.0.0.0", () => console.log("Server is running!"));

const EVENT_KEYS = [
  "obstacle_course",
  "mission",
  "notebook",
  "interview",
  "overall",
];

function normalizeEventKey(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

function coerceValue(raw) {
  const value = raw.trim();

  if (/^null$/i.test(value)) return null;
  if (/^true$/i.test(value)) return true;
  if (/^false$/i.test(value)) return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function toTimeInSeconds(minutes, seconds) {
  if (minutes == null || seconds == null) return null;
  return minutes * 60 + seconds;
}

function assignCompetitionRanks(items, getComparableValue, rankField = "rank") {
  let rank = 1;
  let previousValue = Symbol("none");

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const currentValue = getComparableValue(item);

    if (index === 0) {
      item[rankField] = rank;
      previousValue = currentValue;
      continue;
    }

    if (Object.is(currentValue, previousValue)) {
      item[rankField] = rank;
    } else {
      rank = index + 1;
      item[rankField] = rank;
      previousValue = currentValue;
    }
  }
}

function rankObstacleCourse(entries) {
  const ranked = entries.filter(
    (entry) => entry.minutes != null && entry.seconds != null,
  );
  const unranked = entries.filter(
    (entry) => entry.minutes == null || entry.seconds == null,
  );

  ranked.sort((a, b) => {
    const timeDiff =
      toTimeInSeconds(a.minutes, a.seconds) -
      toTimeInSeconds(b.minutes, b.seconds);
    if (timeDiff !== 0) return timeDiff;
    return a.teamId.localeCompare(b.teamId);
  });

  assignCompetitionRanks(
    ranked,
    (entry) => toTimeInSeconds(entry.minutes, entry.seconds),
    "rank",
  );

  unranked.forEach((entry) => {
    entry.rank = null;
  });
}

function rankMission(entries) {
  entries.forEach((entry) => {
    entry.score_final = missionScore(
      entry.minutes,
      entry.seconds,
      entry.objectives_complete,
    );
  });

  const ranked = entries.filter((entry) => entry.score_final != null);
  const unranked = entries.filter((entry) => entry.score_final == null);

  ranked.sort((a, b) => {
    const scoreDiff = b.score_final - a.score_final;
    if (scoreDiff !== 0) return scoreDiff;
    return a.teamId.localeCompare(b.teamId);
  });

  assignCompetitionRanks(ranked, (entry) => entry.score_final, "rank");

  unranked.forEach((entry) => {
    entry.rank = null;
  });
}

function rankScoreEvent(entries) {
  const ranked = entries.filter((entry) => entry.score != null);
  const unranked = entries.filter((entry) => entry.score == null);

  ranked.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.teamId.localeCompare(b.teamId);
  });

  assignCompetitionRanks(ranked, (entry) => entry.score, "rank");

  unranked.forEach((entry) => {
    entry.rank = null;
  });
}

function groupByDivision(entries) {
  return entries.reduce((groups, entry) => {
    const division = entry.division ?? "Unassigned";
    if (!groups.has(division)) groups.set(division, []);
    groups.get(division).push(entry);
    return groups;
  }, new Map());
}

function recalculateOverall(data) {
  const sourceEvents = [
    data.obstacle_course,
    data.mission,
    data.notebook,
    data.interview,
  ]
    .flat()
    .filter(Boolean);

  const teams = new Map();

  for (const entry of sourceEvents) {
    if (!teams.has(entry.teamId)) {
      teams.set(entry.teamId, {
        name: entry.name,
        division: entry.division,
        teamId: entry.teamId,
        overallScore: null,
        overallRank: null,
      });
    }
  }

  for (const entry of data.overall ?? []) {
    teams.set(entry.teamId, {
      name: entry.name,
      division: entry.division,
      teamId: entry.teamId,
      overallScore: entry.overallScore ?? null,
      overallRank: entry.overallRank ?? null,
    });
  }

  const obstacleByTeam = new Map(
    (data.obstacle_course ?? []).map((entry) => [entry.teamId, entry]),
  );
  const missionByTeam = new Map(
    (data.mission ?? []).map((entry) => [entry.teamId, entry]),
  );
  const notebookByTeam = new Map(
    (data.notebook ?? []).map((entry) => [entry.teamId, entry]),
  );

  data.overall = Array.from(teams.values()).map((entry) => {
    const obstacle = obstacleByTeam.get(entry.teamId);
    const mission = missionByTeam.get(entry.teamId);
    const notebook = notebookByTeam.get(entry.teamId);

    return {
      ...entry,
      overallScore: overallScore(
        obstacle?.rank ?? null,
        mission?.rank ?? null,
        notebook?.rank ?? null,
      ),
      overallRank: null,
    };
  });

  for (const divisionEntries of groupByDivision(data.overall).values()) {
    const ranked = divisionEntries.filter(
      (entry) => entry.overallScore != null,
    );
    const unranked = divisionEntries.filter(
      (entry) => entry.overallScore == null,
    );

    ranked.sort((a, b) => {
      const scoreDiff = a.overallScore - b.overallScore;
      if (scoreDiff !== 0) return scoreDiff;
      return a.teamId.localeCompare(b.teamId);
    });

    assignCompetitionRanks(
      ranked,
      (entry) => entry.overallScore,
      "overallRank",
    );

    unranked.forEach((entry) => {
      entry.overallRank = null;
    });
  }
}

function recalculateData(data) {
  for (const divisionEntries of groupByDivision(
    data.obstacle_course ?? [],
  ).values()) {
    rankObstacleCourse(divisionEntries);
  }

  for (const divisionEntries of groupByDivision(data.mission ?? []).values()) {
    rankMission(divisionEntries);
  }

  for (const divisionEntries of groupByDivision(data.notebook ?? []).values()) {
    rankScoreEvent(divisionEntries);
  }

  for (const divisionEntries of groupByDivision(
    data.interview ?? [],
  ).values()) {
    rankScoreEvent(divisionEntries);
  }

  recalculateOverall(data);
  return data;
}

async function loadData() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw);
}

async function saveData(data) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data));
  ev.emit("fileChange");
}

function getTeamSummary(data, teamId) {
  const obstacle =
    (data.obstacle_course ?? []).find((entry) => entry.teamId === teamId) ??
    null;
  const mission =
    (data.mission ?? []).find((entry) => entry.teamId === teamId) ?? null;
  const notebook =
    (data.notebook ?? []).find((entry) => entry.teamId === teamId) ?? null;
  const interview =
    (data.interview ?? []).find((entry) => entry.teamId === teamId) ?? null;
  const overall =
    (data.overall ?? []).find((entry) => entry.teamId === teamId) ?? null;

  if (!obstacle && !mission && !notebook && !interview && !overall) {
    return null;
  }

  return {
    teamId,
    name:
      overall?.name ??
      obstacle?.name ??
      mission?.name ??
      notebook?.name ??
      interview?.name ??
      null,
    division:
      overall?.division ??
      obstacle?.division ??
      mission?.division ??
      notebook?.division ??
      interview?.division ??
      null,
    obstacle_course: obstacle
      ? {
          minutes: obstacle.minutes,
          seconds: obstacle.seconds,
          rank: obstacle.rank,
        }
      : null,
    mission: mission
      ? {
          minutes: mission.minutes,
          seconds: mission.seconds,
          objectives_complete: mission.objectives_complete,
          score_final: mission.score_final,
          rank: mission.rank,
        }
      : null,
    notebook: notebook
      ? {
          score: notebook.score,
          rank: notebook.rank,
        }
      : null,
    interview: interview
      ? {
          score: interview.score,
          rank: interview.rank,
        }
      : null,
    overall: overall
      ? {
          overallScore: overall.overallScore,
          overallRank: overall.overallRank,
        }
      : null,
  };
}

function parseUpdateTokens(tokens) {
  return tokens.reduce((changes, token) => {
    const equalIndex = token.indexOf("=");
    if (equalIndex === -1) {
      throw new Error(`Invalid token "${token}". Expected key=value.`);
    }

    const key = token.slice(0, equalIndex).trim();
    const rawValue = token.slice(equalIndex + 1);

    if (!key) {
      throw new Error(`Invalid token "${token}". Missing field name.`);
    }

    changes[key] = coerceValue(rawValue);
    return changes;
  }, {});
}

function helpText() {
  return [
    "Commands:",
    "  set <event> <teamId> <field=value> [field=value ...]",
    "  rank <teamId>",
    "  show <event>",
    "  show team <teamId>",
    "  recalc",
    "  help",
    "  export",
    "",
    "Examples:",
    "  set mission HS01 minutes=3 seconds=24 objectives_complete=true",
    "  set notebook HS01 score=97",
    "  set interview HS01 score=88",
    "  set obstacle_course HS01 minutes=1 seconds=42",
    "  rank HS01",
    "  show mission",
    "  show team HS01",
  ].join("\n");
}

async function handleSetCommand(eventKey, teamId, changeTokens) {
  const normalizedEvent = normalizeEventKey(eventKey);

  if (!EVENT_KEYS.includes(normalizedEvent) || normalizedEvent === "overall") {
    throw new Error(`Unknown event "${eventKey}".`);
  }

  const data = await loadData();
  const collection = data[normalizedEvent] ?? [];
  const entry = collection.find((item) => item.teamId === teamId);

  if (!entry) {
    throw new Error(`Team "${teamId}" was not found in ${normalizedEvent}.`);
  }

  const changes = parseUpdateTokens(changeTokens);
  Object.assign(entry, changes);

  recalculateData(data);
  await saveData(data);

  return getTeamSummary(data, teamId);
}

async function handleShowCommand(args) {
  const data = await loadData();

  if (args[0] === "team") {
    const teamId = args[1];
    if (!teamId) throw new Error("Missing team id.");
    return getTeamSummary(recalculateData(data), teamId);
  }

  const eventKey = normalizeEventKey(args[0] ?? "");
  if (!EVENT_KEYS.includes(eventKey)) {
    throw new Error(`Unknown event "${args[0] ?? ""}".`);
  }

  return recalculateData(data)[eventKey];
}

async function handleRankCommand(teamId) {
  if (!teamId) throw new Error("Missing team id.");
  const data = recalculateData(await loadData());
  return getTeamSummary(data, teamId);
}

async function handleRecalcCommand() {
  const data = recalculateData(await loadData());
  await saveData(data);
  return { ok: true, message: "Scores and rankings recalculated." };
}

async function exportXlsx() {
  const data = recalculateData(await loadData());

  const workbook = new ExcelJS.Workbook();

  function addSheet(name, rows, columns) {
    const sheet = workbook.addWorksheet(name);

    sheet.columns = columns.map((c) => ({
      header: c,
      key: c,
      width: 18,
    }));

    rows.forEach((row) => sheet.addRow(row));
  }

  addSheet(
    "Obstacle Course",
    (data.obstacle_course ?? []).map((t) => ({
      Team: t.teamId,
      Name: t.name,
      Division: t.division,
      Minutes: t.minutes,
      Seconds: t.seconds,
      Rank: t.rank,
    })),
    ["Team", "Name", "Division", "Minutes", "Seconds", "Rank"],
  );

  addSheet(
    "Mission",
    (data.mission ?? []).map((t) => ({
      Team: t.teamId,
      Name: t.name,
      Division: t.division,
      Minutes: t.minutes,
      Seconds: t.seconds,
      Objectives: t.objectives_complete,
      Score: t.score_final,
      Rank: t.rank,
    })),
    [
      "Team",
      "Name",
      "Division",
      "Minutes",
      "Seconds",
      "Objectives",
      "Score",
      "Rank",
    ],
  );

  addSheet(
    "Notebook",
    (data.notebook ?? []).map((t) => ({
      Team: t.teamId,
      Name: t.name,
      Division: t.division,
      Score: t.score,
      Rank: t.rank,
    })),
    ["Team", "Name", "Division", "Score", "Rank"],
  );

  addSheet(
    "Interview",
    (data.interview ?? []).map((t) => ({
      Team: t.teamId,
      Name: t.name,
      Division: t.division,
      Score: t.score,
      Rank: t.rank,
    })),
    ["Team", "Name", "Division", "Score", "Rank"],
  );

  addSheet(
    "Overall",
    (data.overall ?? []).map((t) => ({
      Team: t.teamId,
      Name: t.name,
      Division: t.division,
      Score: t.overallScore,
      Rank: t.overallRank,
    })),
    ["Team", "Name", "Division", "Score", "Rank"],
  );

  const filename = `results_${Date.now()}.xlsx`;

  await workbook.xlsx.writeFile(filename);

  return { ok: true, file: filename };
}

const term = repl.start({
  prompt: "> ",
  eval: async (command, ctx, filename, callback) => {
    const input = command.trim();

    try {
      if (!input) return callback(null);

      const tokens = input.split(/\s+/);
      const action = tokens[0]?.toLowerCase();

      let result;

      if (action === "help") {
        result = helpText();
      } else if (action === "set") {
        const [, eventKey, teamId, ...changeTokens] = tokens;

        if (!eventKey || !teamId || changeTokens.length === 0) {
          throw new Error(
            "Usage: set <event> <teamId> <field=value> [field=value ...]",
          );
        }

        result = await handleSetCommand(eventKey, teamId, changeTokens);
      } else if (action === "rank") {
        result = await handleRankCommand(tokens[1]);
      } else if (action === "show") {
        if (tokens.length < 2) {
          throw new Error("Usage: show <event> | show team <teamId>");
        }

        result = await handleShowCommand(tokens.slice(1));
      } else if (action === "recalc") {
        result = await handleRecalcCommand();
      } else if (action === "export") {
        result = await exportXlsx();
      } else {
        throw new Error(`Unknown command "${action}". Type help for commands.`);
      }

      callback(null, result);
    } catch (error) {
      callback(error);
    }
  },
});

process.on("SIGINT", () => {
  try {
    term.close();
  } catch (error) {
    console.error(error);
  }

  try {
    server.close();
  } catch (error) {
    console.error(error);
  }

  process.exit(0);
});
