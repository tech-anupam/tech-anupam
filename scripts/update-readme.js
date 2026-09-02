// scripts/update-readme.js
// Fetches every public, non-fork repo, groups by primary language,
// and writes it into README.md between the marker comments.

const fs = require("fs");

const USERNAME = "tech-anupam"; // GitHub account this profile README lives on
const TOKEN = process.env.GITHUB_TOKEN;
const README_PATH = "README.md";

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

async function getAllRepos() {
  let page = 1;
  let all = [];
  while (true) {
    const batch = await ghFetch(
      `https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}&type=owner&sort=pushed&direction=desc`
    );
    all = all.concat(batch);
    if (batch.length < 100) break;
    page++;
  }
  return all.filter((r) => !r.fork);
}

function groupByLanguage(repos) {
  const groups = {};
  for (const repo of repos) {
    const lang = repo.language || "Other";
    if (!groups[lang]) groups[lang] = [];
    groups[lang].push(repo);
  }
  // Sort languages by repo count, descending
  return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
}

function buildSection(repos) {
  const grouped = groupByLanguage(repos);
  const lines = [`**${repos.length} repositories**`, ""];

  for (const [lang, repoList] of grouped) {
    lines.push(`<details>`);
    lines.push(`<summary><b>${lang}</b> (${repoList.length})</summary>`);
    lines.push("");
    for (const repo of repoList) {
      const stars = repo.stargazers_count > 0 ? ` — ★ ${repo.stargazers_count}` : "";
      const desc = repo.description ? ` — ${repo.description}` : "";
      lines.push(`- [${repo.name}](${repo.html_url})${desc}${stars}`);
    }
    lines.push("");
    lines.push(`</details>`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

function replaceSection(content, marker, replacement) {
  const start = `<!--START_SECTION:${marker}-->`;
  const end = `<!--END_SECTION:${marker}-->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  return content.replace(pattern, `${start}\n${replacement}\n${end}`);
}

async function main() {
  let readme = fs.readFileSync(README_PATH, "utf8");
  const repos = await getAllRepos();

  readme = replaceSection(readme, "all-repos", buildSection(repos));

  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  readme = replaceSection(readme, "last-updated", timestamp);

  fs.writeFileSync(README_PATH, readme);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});