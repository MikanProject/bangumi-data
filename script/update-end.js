const fs = require('fs-extra');
const path = require('path');

const API_BASE = 'https://api.bgm.tv';
const USER_AGENT = 'bangumi-data-updater/1.0';
const DELAY_MS = 500;
const SEASON_OVERFLOW_THRESHOLD = 7; // days

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSeasonEnd(year, month) {
  if (month >= 1 && month <= 3) return new Date(Date.UTC(year, 2, 31)); // March 31
  if (month >= 4 && month <= 6) return new Date(Date.UTC(year, 5, 30)); // June 30
  if (month >= 7 && month <= 9) return new Date(Date.UTC(year, 8, 30)); // September 30
  return new Date(Date.UTC(year, 11, 31)); // December 31
}

/**
 * If the end date crosses the season boundary by a few days (≤ threshold),
 * clamp it back into the season.
 * Example: begin in Q1, end = April 2 → clamped to March 30
 * Formula: seasonEnd - (overflowDays - 1)
 */
function clampToSeason(endDate, beginDate) {
  const beginMonth = beginDate.getUTCMonth() + 1;
  const beginYear = beginDate.getUTCFullYear();
  const seasonEnd = getSeasonEnd(beginYear, beginMonth);

  const diffMs = endDate.getTime() - seasonEnd.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0 && diffDays <= SEASON_OVERFLOW_THRESHOLD) {
    const clamped = new Date(seasonEnd);
    clamped.setUTCDate(clamped.getUTCDate() - (diffDays - 1));
    // Preserve time of day from original endDate
    clamped.setUTCHours(
      endDate.getUTCHours(),
      endDate.getUTCMinutes(),
      endDate.getUTCSeconds(),
      endDate.getUTCMilliseconds()
    );
    return clamped;
  }

  return endDate;
}

async function fetchEpisodes(subjectId) {
  const allEpisodes = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const url = `${API_BASE}/v0/episodes?subject_id=${encodeURIComponent(subjectId)}&type=0&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) {
      console.error(
        `  API error for subject ${subjectId}: ${res.status} ${res.statusText}`
      );
      return null;
    }

    const data = await res.json();
    allEpisodes.push(...data.data);

    if (offset + limit >= data.total) break;
    offset += limit;
    await sleep(DELAY_MS);
  }

  return allEpisodes;
}

function getLastEpisodeAirdate(episodes) {
  const withAirdate = episodes
    .filter(
      (ep) => ep.airdate && ep.airdate !== '' && ep.airdate !== '0000-00-00'
    )
    .sort((a, b) => a.sort - b.sort);

  if (withAirdate.length === 0) return null;
  return withAirdate[withAirdate.length - 1].airdate;
}

function buildEndDatetime(airdate, beginDatetime) {
  const beginDate = new Date(beginDatetime);
  const [year, month, day] = airdate.split('-').map(Number);
  const endDate = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      beginDate.getUTCHours(),
      beginDate.getUTCMinutes(),
      beginDate.getUTCSeconds(),
      beginDate.getUTCMilliseconds()
    )
  );
  return endDate;
}

function formatDatetime(date) {
  return date.toISOString();
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node script/update-end.js <path-to-json-file>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const items = await fs.readJson(resolvedPath);
  let updated = 0;

  for (const item of items) {
    if (item.end) continue;

    const bangumiSite = item.sites?.find((s) => s.site === 'bangumi');
    if (!bangumiSite) {
      console.log(`  [SKIP] "${item.title}" - no bangumi site`);
      continue;
    }

    if (!item.begin) {
      console.log(`  [SKIP] "${item.title}" - no begin date`);
      continue;
    }

    const subjectId = bangumiSite.id;
    console.log(`  Processing "${item.title}" (bangumi: ${subjectId})...`);

    const episodes = await fetchEpisodes(subjectId);
    if (!episodes || episodes.length === 0) {
      console.log(`    No episodes found`);
      await sleep(DELAY_MS);
      continue;
    }

    const lastAirdate = getLastEpisodeAirdate(episodes);
    if (!lastAirdate) {
      console.log(`    No valid airdate found`);
      await sleep(DELAY_MS);
      continue;
    }

    let endDate = buildEndDatetime(lastAirdate, item.begin);
    if (isNaN(endDate.getTime())) {
      console.log(`    Invalid end date from airdate "${lastAirdate}"`);
      await sleep(DELAY_MS);
      continue;
    }
    const beginDate = new Date(item.begin);

    const originalEnd = new Date(endDate);
    endDate = clampToSeason(endDate, beginDate);

    if (endDate.getTime() !== originalEnd.getTime()) {
      console.log(
        `    Clamped: ${originalEnd.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)}`
      );
    }

    item.end = formatDatetime(endDate);
    console.log(`    End: ${item.end}`);
    updated++;

    await sleep(DELAY_MS);
  }

  if (updated > 0) {
    const content = JSON.stringify(items, null, 2) + '\n';
    await fs.writeFile(resolvedPath, content);
    console.log(`\nUpdated ${updated} items in ${filePath}`);
  } else {
    console.log(`\nNo items were updated in ${filePath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
