import { writeFile } from "node:fs/promises";

const teams = [
  {
    name: "Test",
    division: "Open",
    teamId: "HS01",
  },
  {
    name: "Test",
    division: "Open",
    teamId: "HS02",
  },
  {
    name: "Test",
    division: "Open",
    teamId: "HS03",
  },
  {
    name: "Test",
    division: "Open",
    teamId: "HS04",
  },
  {
    name: "Test",
    division: "Open",
    teamId: "HS05",
  },
  {
    name: "Test",
    division: "Open",
    teamId: "HS06",
  },
  {
    name: "Test",
    division: "Open",
    teamId: "HS07",
  },
  {
    name: "Test",
    division: "Open",
    teamId: "HS08",
  },
  {
    name: "Test",
    division: "Open",
    teamId: "HS09",
  },
];

const data = {
  obstacle_course: [],
  mission: [],
  notebook: [],
  interview: [],
  overall: [],
};

for (const team of teams) {
  data.obstacle_course.push({
    name: team.name,
    division: team.division,
    teamId: team.teamId,
    minutes: null,
    seconds: null,
    rank: null,
  });
  data.mission.push({
    name: team.name,
    division: team.division,
    teamId: team.teamId,
    minutes: null,
    seconds: null,
    objectives_complete: null,
    score_objective: null,
    bonus: null,
    score_final: null,
    rank: null,
  });
  data.notebook.push({
    name: team.name,
    division: team.division,
    teamId: team.teamId,
    score: null,
    rank: null,
  });
  data.interview.push({
    name: team.name,
    division: team.division,
    teamId: team.teamId,
    score: null,
    rank: null,
  });
  data.overall.push({
    name: team.name,
    division: team.division,
    teamId: team.teamId,
    overallScore: null,
    overallRank: null,
  });
}

await writeFile("data.json", JSON.stringify(data), "utf8");
