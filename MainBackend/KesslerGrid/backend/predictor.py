import os
import sqlite3
import csv
import time
import math
from datetime import datetime, timedelta, timezone
import numpy as np
from scipy.spatial import cKDTree

# Database file path
DB_PATH = os.path.join(os.path.dirname(__file__), 'kessler.db')
CSV_PATH = os.path.join(os.path.dirname(__file__), 'active_satellites.csv')

MU = 398600.4418  # Earth gravitational parameter (km^3/s^2)
EARTH_RADIUS_KM = 6378.137
MAX_FLEET_SIZE = 50  # Restrict fleet size strictly to 50 satellites

def init_db():
    print(f"[SQLite] Initializing database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create orbital_data table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orbital_data (
            norad_cat_id TEXT PRIMARY KEY,
            object_name TEXT NOT NULL,
            epoch TEXT,
            mean_motion REAL,
            eccentricity REAL,
            inclination REAL,
            ra_of_asc_node REAL,
            arg_of_pericenter REAL,
            mean_anomaly REAL,
            bstar REAL
        )
    ''')

    # Migration check for conjunction_events table
    cursor.execute("PRAGMA table_info(conjunction_events)")
    columns = [col[1] for col in cursor.fetchall()]
    if columns and 'sat1_id' not in columns:
        print("[SQLite] Recreating conjunction_events table with standardized sat1_id/sat2_id schema...")
        cursor.execute("DROP TABLE conjunction_events")

    # Create conjunction_events table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conjunction_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sat1_id TEXT NOT NULL,
            sat1_name TEXT NOT NULL,
            sat2_id TEXT NOT NULL,
            sat2_name TEXT NOT NULL,
            miss_distance_km REAL NOT NULL,
            collision_prob REAL NOT NULL,
            threat_level TEXT NOT NULL,
            tca_timestamp TEXT NOT NULL,
            slashing_triggered INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()

def ingest_csv():
    if not os.path.exists(CSV_PATH):
        print(f"[ETL Warning] CSV file not found at {CSV_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if table already has exactly 50 satellites
    cursor.execute("SELECT COUNT(*) FROM orbital_data")
    count = cursor.fetchone()[0]
    if count == MAX_FLEET_SIZE:
        print(f"[ETL] orbital_data table already populated with exactly {count} rows. Skipping CSV ingestion.")
        conn.close()
        return

    print(f"[ETL] Resetting orbital_data table to restrict fleet strictly to top {MAX_FLEET_SIZE} satellites...")
    cursor.execute("DELETE FROM orbital_data")
    cursor.execute("DELETE FROM conjunction_events")

    inserted = 0
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if inserted >= MAX_FLEET_SIZE:
                break

            try:
                norad_id = str(row['NORAD_CAT_ID']).strip()
                if not norad_id:
                    continue
                name = str(row.get('OBJECT_NAME', 'UNKNOWN')).strip()
                epoch = str(row.get('EPOCH', '')).strip()
                mean_motion = float(row.get('MEAN_MOTION', 14.5))
                ecc = float(row.get('ECCENTRICITY', 0.001))
                inc = float(row.get('INCLINATION', 51.6))
                raan = float(row.get('RA_OF_ASC_NODE', 0.0))
                argp = float(row.get('ARG_OF_PERICENTER', 0.0))
                ma = float(row.get('MEAN_ANOMALY', 0.0))
                bstar = float(row.get('BSTAR', 0.0)) if row.get('BSTAR') else 0.0

                cursor.execute('''
                    INSERT OR REPLACE INTO orbital_data (
                        norad_cat_id, object_name, epoch, mean_motion, eccentricity,
                        inclination, ra_of_asc_node, arg_of_pericenter, mean_anomaly, bstar
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (norad_id, name, epoch, mean_motion, ecc, inc, raan, argp, ma, bstar))
                inserted += 1
            except Exception:
                continue

    conn.commit()
    conn.close()
    print(f"[ETL] Successfully ingested {inserted} satellite records into orbital_data!")

def compute_eci_position(mean_motion_rev_day, ecc, inc_deg, raan_deg, argp_deg, ma_deg, delta_time_sec):
    n_rad_s = (mean_motion_rev_day * 2.0 * math.pi) / 86400.0
    if n_rad_s <= 0:
        n_rad_s = 0.001

    a_km = (MU / (n_rad_s ** 2)) ** (1.0 / 3.0)
    M_rad = (math.radians(ma_deg) + n_rad_s * delta_time_sec) % (2.0 * math.pi)

    E = M_rad
    for _ in range(10):
        f = E - ecc * math.sin(E) - M_rad
        f_prime = 1.0 - ecc * math.cos(E)
        if abs(f_prime) < 1e-12:
            break
        E -= f / f_prime

    sin_nu = (math.sqrt(max(0.0, 1.0 - ecc**2)) * math.sin(E)) / max(1e-6, (1.0 - ecc * math.cos(E)))
    cos_nu = (math.cos(E) - ecc) / max(1e-6, (1.0 - ecc * math.cos(E)))
    nu = math.atan2(sin_nu, cos_nu)

    r = a_km * (1.0 - ecc**2) / max(1e-6, (1.0 + ecc * math.cos(nu)))

    x_orb = r * math.cos(nu)
    y_orb = r * math.sin(nu)

    inc_rad = math.radians(inc_deg)
    raan_rad = math.radians(raan_deg)
    argp_rad = math.radians(argp_deg)

    cos_raan, sin_raan = math.cos(raan_rad), math.sin(raan_rad)
    cos_inc, sin_inc = math.cos(inc_rad), math.sin(inc_rad)
    cos_argp, sin_argp = math.cos(argp_rad), math.sin(argp_rad)

    px = x_orb * (cos_raan * cos_argp - sin_raan * sin_argp * cos_inc) - y_orb * (cos_raan * sin_argp + sin_raan * cos_argp * cos_inc)
    py = x_orb * (sin_raan * cos_argp + cos_raan * sin_argp * cos_inc) - y_orb * (sin_raan * sin_argp - cos_raan * cos_argp * cos_inc)
    pz = x_orb * (sin_argp * sin_inc) + y_orb * (cos_argp * sin_inc)

    return px, py, pz

def run_conjunction_prediction():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT norad_cat_id, object_name, mean_motion, eccentricity, inclination, ra_of_asc_node, arg_of_pericenter, mean_anomaly FROM orbital_data")
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("[Predictor Warning] No satellite records found in orbital_data for conjunction prediction.")
        return

    delta_t = 900.0
    tca_iso = (datetime.now(timezone.utc) + timedelta(seconds=delta_t)).isoformat()

    sat_meta = []
    positions = []

    for r in rows:
        norad_id, name, mm, ecc, inc, raan, argp, ma = r
        try:
            px, py, pz = compute_eci_position(mm, ecc, inc, raan, argp, ma, delta_t)
            sat_meta.append((norad_id, name))
            positions.append([px, py, pz])
        except Exception:
            continue

    pos_array = np.array(positions)
    N = len(pos_array)

    if N < 2:
        return

    tree = cKDTree(pos_array)
    pairs = tree.query_pairs(r=55.0)

    sigma = 20.0  # Positional uncertainty in km
    critical_conjunctions = []

    for i, j in pairs:
        d = float(np.linalg.norm(pos_array[i] - pos_array[j]))
        prob = math.exp(-(d ** 2) / (2.0 * (sigma ** 2)))

        sat1_id, sat1_name = sat_meta[i]
        sat2_id, sat2_name = sat_meta[j]

        threat_level = 'CRITICAL' if prob > 0.8 else ('HIGH' if prob > 0.5 else 'WARNING')

        if prob > 0.8:
            critical_conjunctions.append((
                sat1_id, sat1_name, sat2_id, sat2_name, d, prob, threat_level, tca_iso
            ))

    if critical_conjunctions:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        for item in critical_conjunctions:
            sat1_id, sat1_name, sat2_id, sat2_name, d, prob, threat, tca = item
            cursor.execute('''
                SELECT id FROM conjunction_events
                WHERE (sat1_id = ? AND sat2_id = ?) AND slashing_triggered = 0
            ''', (sat1_id, sat2_id))
            existing = cursor.fetchone()

            if not existing:
                cursor.execute('''
                    INSERT INTO conjunction_events (
                        sat1_id, sat1_name, sat2_id, sat2_name, miss_distance_km,
                        collision_prob, threat_level, tca_timestamp, slashing_triggered
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                ''', (sat1_id, sat1_name, sat2_id, sat2_name, round(d, 2), round(prob, 4), threat, tca))
                print(f"[CRITICAL THREAT] {sat1_name} ({sat1_id}) <-> {sat2_name} ({sat2_id}) | Distance: {d:.2f}km | Prob: {prob:.4f}")

        conn.commit()
        conn.close()

def main():
    print("[Phase 1] Starting KesslerGrid SGP4 Physics & Conjunction AI Engine...")
    init_db()
    ingest_csv()

    print("[Phase 1] Running continuous conjunction analysis loop (every 10 seconds)...")
    while True:
        try:
            run_conjunction_prediction()
        except Exception as e:
            print("[Predictor Error]", e)
        time.sleep(10)

if __name__ == '__main__':
    main()
