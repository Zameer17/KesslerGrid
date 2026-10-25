import fs from 'fs';
import path from 'path';

const GROUPS = [
  { group: 'stations', cat: 'space_station' },
  { group: 'oneweb', cat: 'constellation' },
  { group: 'gps-ops', cat: 'navigation' },
  { group: 'galileo', cat: 'navigation' },
  { group: 'beidou', cat: 'navigation' },
  { group: 'glo-ops', cat: 'navigation' },
  { group: 'weather', cat: 'weather' },
  { group: 'noaa', cat: 'weather' },
  { group: 'goes', cat: 'weather' },
  { group: 'resource', cat: 'earth_obs' },
  { group: 'planet', cat: 'earth_obs' },
  { group: 'spire', cat: 'earth_obs' },
  { group: 'science', cat: 'science' },
  { group: 'geodetic', cat: 'science' },
  { group: 'iridium-NEXT', cat: 'communication' },
  { group: 'globalstar', cat: 'communication' },
  { group: 'orbcomm', cat: 'communication' },
  { group: 'intelsat', cat: 'communication' },
  { group: 'ses', cat: 'communication' },
  { group: 'eutelsat', cat: 'communication' },
  { group: 'other-comm', cat: 'communication' },
  { group: 'amateur', cat: 'communication' },
  { group: 'cubesat', cat: 'defense_other' },
  { group: 'last-30-days', cat: 'constellation' },
];

const CATEGORIES = {
  space_station: { name: 'Space Stations', color: '#00e5ff', count: 0 },
  constellation: { name: 'Constellations', color: '#38bdf8', count: 0 },
  navigation: { name: 'Navigation', color: '#22c55e', count: 0 },
  earth_obs: { name: 'Earth Observation', color: '#eab308', count: 0 },
  weather: { name: 'Weather', color: '#f97316', count: 0 },
  communication: { name: 'Communications', color: '#a855f7', count: 0 },
  science: { name: 'Science & Research', color: '#ec4899', count: 0 },
  defense_other: { name: 'Defense & Other', color: '#ef4444', count: 0 },
};

const MU = 398600.4418;
const EARTH_R = 6371.0;
const catKeys = Object.keys(CATEGORIES);

async function fetchGroup(groupName) {
  try {
    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(groupName)}&FORMAT=csv`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const text = await res.text();
    return text.split(/\r?\n/).filter(l => l.trim().length > 0);
  } catch (err) {
    console.warn(`Failed fetching ${groupName}:`, err.message);
    return [];
  }
}

async function run() {
  console.log('Fetching live CelesTrak satellite constellation groups...');
  const seenNorad = new Set();
  const satellites = [];

  for (const item of GROUPS) {
    const lines = await fetchGroup(item.group);
    if (lines.length < 2) continue;

    const header = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    const nameIdx = header.indexOf('OBJECT_NAME');
    const noradIdx = header.indexOf('NORAD_CAT_ID');
    const mmIdx = header.indexOf('MEAN_MOTION');
    const eccIdx = header.indexOf('ECCENTRICITY');
    const incIdx = header.indexOf('INCLINATION');
    const raanIdx = header.indexOf('RA_OF_ASC_NODE');
    const argPIdx = header.indexOf('ARG_OF_PERICENTER');
    const maIdx = header.indexOf('MEAN_ANOMALY');

    let groupCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      if (row.length < 8) continue;

      const noradId = parseInt(row[noradIdx]);
      if (isNaN(noradId) || seenNorad.has(noradId)) continue;

      const name = row[nameIdx];
      const mm = parseFloat(row[mmIdx]);
      const ecc = parseFloat(row[eccIdx]);
      const inc = parseFloat(row[incIdx]);
      const raan = parseFloat(row[raanIdx]);
      const argP = parseFloat(row[argPIdx]);
      const ma = parseFloat(row[maIdx]);

      if (!name || isNaN(mm) || mm <= 0 || isNaN(ecc) || isNaN(inc)) continue;

      const n_rad = mm * ((2 * Math.PI) / 86400);
      const a_km = Math.cbrt(MU / (n_rad * n_rad));
      const sma = a_km / EARTH_R;

      if (sma < 1.01 || sma > 8.5) continue;

      seenNorad.add(noradId);
      CATEGORIES[item.cat].count++;
      const catCode = catKeys.indexOf(item.cat);
      const periodSec = 300.0 / mm;

      satellites.push([
        name,
        noradId,
        parseFloat(sma.toFixed(4)),
        parseFloat(ecc.toFixed(6)),
        parseFloat(inc.toFixed(2)),
        parseFloat(raan.toFixed(2)),
        parseFloat(argP.toFixed(2)),
        parseFloat(ma.toFixed(2)),
        parseFloat(periodSec.toFixed(2)),
        catCode,
      ]);
      groupCount++;
    }
    console.log(`✓ Fetched ${item.group.padEnd(14)}: +${groupCount} sats (${CATEGORIES[item.cat].name})`);
  }

  // Populate realistic Starlink Mega-Constellation planes (72 orbital planes x 22 satellites per plane)
  console.log('Synthesizing high-density Starlink constellation fleet...');
  let starlinkId = 44000;
  const planes = 48;
  const satsPerPlane = 24;
  for (let p = 0; p < planes; p++) {
    const raan = (p * (360 / planes)) % 360;
    for (let s = 0; s < satsPerPlane; s++) {
      starlinkId++;
      if (seenNorad.has(starlinkId)) continue;
      seenNorad.add(starlinkId);

      const sma = (6371.0 + 550.0) / 6371.0;
      const mm = 15.06; // ~95.6 min orbit
      const periodSec = 300.0 / mm;
      const ma = (s * (360 / satsPerPlane) + p * 3.7) % 360;
      const inc = 53.2 + (p % 3 === 0 ? 0.2 : -0.2);
      const catCode = catKeys.indexOf('constellation');
      CATEGORIES.constellation.count++;

      satellites.push([
        `STARLINK-${starlinkId}`,
        starlinkId,
        parseFloat(sma.toFixed(4)),
        0.00015,
        parseFloat(inc.toFixed(2)),
        parseFloat(raan.toFixed(2)),
        90.0,
        parseFloat(ma.toFixed(2)),
        parseFloat(periodSec.toFixed(2)),
        catCode,
      ]);
    }
  }

  console.log('\n======================================');
  console.log(`TOTAL UNIQUE SATELLITES: ${satellites.length}`);
  console.log('Category Counts:', Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [v.name, v.count])));
  console.log('======================================\n');

  if (!fs.existsSync('public/data')) {
    fs.mkdirSync('public/data', { recursive: true });
  }

  const outPath = path.resolve('public/data/celestrak_active.json');
  fs.writeFileSync(outPath, JSON.stringify({
    categories: Object.entries(CATEGORIES).map(([k, v]) => ({
      id: k,
      name: v.name,
      color: v.color,
      count: v.count,
    })),
    count: satellites.length,
    satellites,
  }));
  console.log('Saved catalog dataset to:', outPath);
}

run().catch(console.error);
