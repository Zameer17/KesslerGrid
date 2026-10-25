import json
import re

# Parse the 50 satellites from noradSatellites.ts
ts_content = open('src/data/noradSatellites.ts', encoding='utf-8').read()

pattern = r"name:\s*[\'\"]([^\'\"]+)[\'\"],\s*intlDes:[^,]+,\s*category:[^,]+,\s*categoryId:[^,]+,\s*country:[^,]+,\s*operator:[^,]+,\s*semiMajorAxis:\s*([\d\.]+),\s*eccentricity:\s*([\d\.]+),\s*inclination:\s*([\d\.]+),\s*raan:\s*([\d\.]+),\s*argOfPeriapsis:\s*([\d\.]+),\s*meanAnomaly:\s*([\d\.]+),\s*periodSeconds:\s*([\d\.]+)"
matches = re.findall(r"noradId:\s*(\d+),\s*name:\s*[\'\"]([^\'\"]+)[\'\"][^}]+?semiMajorAxis:\s*([\d\.]+),\s*eccentricity:\s*([\d\.]+),\s*inclination:\s*([\d\.]+),\s*raan:\s*([\d\.]+),\s*argOfPeriapsis:\s*([\d\.]+),\s*meanAnomaly:\s*([\d\.]+),\s*periodSeconds:\s*([\d\.]+)", ts_content, re.DOTALL)

print(f"Extracted {len(matches)} satellite matches from noradSatellites.ts")

# Category code mapping
cat_code_map = {
    'space_station': 0,
    'constellation': 1,
    'navigation': 2,
    'earth_obs': 3,
    'weather': 4,
    'communication': 5,
    'science': 6,
    'defense_other': 7
}

# Parse categories for each sat
sat_blocks = re.findall(r"\{\s*id:\s*[\'\"]norad_(\d+)[\'\"][^\}]+?categoryId:\s*[\'\"]([^\'\"]+)[\'\"]", ts_content, re.DOTALL)
cat_map = {m[0]: m[1] for m in sat_blocks}

satellites_json = []
category_counts = {k: 0 for k in cat_code_map.keys()}

for m in matches:
    norad_id = int(m[0])
    name = m[1]
    sma = float(m[2])
    ecc = float(m[3])
    inc = float(m[4])
    raan = float(m[5])
    argp = float(m[6])
    ma = float(m[7])
    period = float(m[8])

    cat_id = cat_map.get(str(norad_id), 'constellation')
    cat_code = cat_code_map.get(cat_id, 1)
    category_counts[cat_id] = category_counts.get(cat_id, 0) + 1

    satellites_json.append([
        name, norad_id, round(sma, 4), round(ecc, 6), round(inc, 2),
        round(raan, 2), round(argp, 2), round(ma, 2), round(period, 2), cat_code
    ])

celestrak_data = {
    "categories": [
        {"id": "space_station", "name": "Space Stations", "color": "#00e5ff", "count": category_counts["space_station"]},
        {"id": "constellation", "name": "Constellations", "color": "#38bdf8", "count": category_counts["constellation"]},
        {"id": "navigation", "name": "Navigation", "color": "#22c55e", "count": category_counts["navigation"]},
        {"id": "earth_obs", "name": "Earth Observation", "color": "#eab308", "count": category_counts["earth_obs"]},
        {"id": "weather", "name": "Weather", "color": "#f97316", "count": category_counts["weather"]},
        {"id": "communication", "name": "Communications", "color": "#a855f7", "count": category_counts["communication"]},
        {"id": "science", "name": "Science & Research", "color": "#ec4899", "count": category_counts["science"]},
        {"id": "defense_other", "name": "Defense & Other", "color": "#ef4444", "count": category_counts["defense_other"]}
    ],
    "count": len(satellites_json),
    "satellites": satellites_json
}

with open('public/data/celestrak_active.json', 'w', encoding='utf-8') as f:
    json.dump(celestrak_data, f, indent=2)

print("Synced public/data/celestrak_active.json with all 50 3D satellites!")
