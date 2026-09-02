// scripts/update-readme.js
// Fetches your most recently pushed repos, counts commits in the
// last 30 days for each, and writes a table into README.md between
// <!--START_SECTION:recent-repos--> and <!--END_SECTION:recent-repos-->

const fs = require("fs");

const USERNAME = "AkaTriggered";
const TOKEN = process.env.GITHUB_TOKEN;
const README_PATH = "README.md";
const REPO_LIMIT = 6;
const SINCE_DAYS = 30;

const headers = {
  Authorization: `token ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "User-Agent": USERNAME,
};

async function ghFetch(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function getTopRepos() {
  const repos = await ghFetch(
    `https://api.github.com/users/${USERNAME}/repos?sort=pushed&direction=desc&per_page=${REPO_LIMIT}&type=owner`
  );
  return repos.filter((r) => !r.fork);
}

async function getCommitCount(repoName) {
  const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  try {
    const commits = await ghFetch(
      `https://api.github.com/repos/${USERNAME}/${repoName}/commits?author=${USERNAME}&since=${since}&per_page=100`
    );
    return Array.isArray(commits) ? commits.length : 0;
  } catch {
    return 0;
  }
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

async function buildTable() {
  const repos = await getTopRepos();
  const rows = [];

  for (const repo of repos) {
    const commitCount = await getCommitCount(repo.name);
    rows.push(
      `| [${repo.name}](${repo.html_url}) | ${repo.language || "—"} | ${commitCount} | ${timeAgo(repo.pushed_at)} |`
    );
  }

  const header = "| Repo | Language | Commits (30d) | Last Push |\n|---|---|---|---|";
  return [header, ...rows].join("\n");
}

function replaceSection(content, marker, replacement) {
  const start = `<!--START_SECTION:${marker}-->`;
  const end = `<!--END_SECTION:${marker}-->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  return content.replace(pattern, `${start}\n${replacement}\n${end}`);
}

async function main() {
  let readme = fs.readFileSync(README_PATH, "utf8");
  const table = await buildTable();
  readme = replaceSection(readme, "recent-repos", table);

  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  readme = replaceSection(readme, "last-updated", timestamp);

  fs.writeFileSync(README_PATH, readme);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
