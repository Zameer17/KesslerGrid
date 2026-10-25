import sys
import os
import time
import math
import sqlite3
import datetime
import requests
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from sgp4.api import Satrec, WGS72, jday

# Force UTF-8 encoding for Windows standard output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Configuration & File Paths
DB_PATH = os.path.join(os.path.dirname(__file__), '../backend/kessler.db')
CSV_PATH = os.path.join(os.path.dirname(__file__), '../backend/active_satellites.csv')
CELESTRAK_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=csv'
MAX_SATELLITES = 3200
PROXIMITY_THRESHOLD_KM = 55.0
SIGMA_KM = 20.0  # Mock positional uncertainty for Gaussian probability calculation
PROBABILITY_ALERT_THRESHOLD = 0.8  # P_c > 0.8 triggers CRITICAL alert


def get_db_connection():
    """Safely opens a SQLite database connection with timeout handling."""
    conn = sqlite3.connect(DB_PATH, timeout=20.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Phase 1: Database Setup - Creates orbital_data and conjunction_events tables."""
    print("🛠️ [Phase 1] Initializing SQLite tables in kessler.db...")
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Table 1: orbital_data (Keplerian elements for SGP4 propagation)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orbital_data (
                norad_cat_id INTEGER PRIMARY KEY,
                object_name TEXT,
                epoch TEXT,
                mean_motion REAL,
                eccentricity REAL,
                inclination REAL,
                ra_of_asc_node REAL,
                arg_of_pericenter REAL,
                mean_anomaly REAL,
                bstar REAL
            );
        """)

        # Table 2: conjunction_events (Collision threats for Node.js Watchdog & Web3 Slashing)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conjunction_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                primary_sat_id TEXT,
                secondary_sat_id TEXT,
                miss_distance_km REAL,
                collision_probability REAL,
                risk_level TEXT,
                slashing_triggered BOOLEAN DEFAULT 0,
                sat_a TEXT,
                sat_b TEXT,
                risk_score REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Ensure all columns exist in conjunction_events (migration safeguard)
        cursor.execute("PRAGMA table_info(conjunction_events);")
        columns = [row['name'] for row in cursor.fetchall()]

        cols_to_add = [
            ('primary_sat_id', 'TEXT'),
            ('secondary_sat_id', 'TEXT'),
            ('miss_distance_km', 'REAL'),
            ('collision_probability', 'REAL'),
            ('risk_level', 'TEXT'),
            ('slashing_triggered', 'BOOLEAN DEFAULT 0'),
            ('sat_a', 'TEXT'),
            ('sat_b', 'TEXT'),
            ('risk_score', 'REAL')
        ]
        for col_name, col_type in cols_to_add:
            if col_name not in columns:
                try:
                    cursor.execute(f"ALTER TABLE conjunction_events ADD COLUMN {col_name} {col_type};")
                except Exception:
                    pass

        conn.commit()
    print("✅ [Phase 1] Database tables verified successfully.")


def download_or_load_dataset():
    """Phase 1: Ingest active satellite dataset into local active_satellites.csv."""
    if not os.path.exists(CSV_PATH) or os.path.getsize(CSV_PATH) == 0:
        print(f"📥 Downloading active satellite dataset from CelesTrak...")
        try:
            res = requests.get(CELESTRAK_URL, timeout=15)
            if res.status_code == 200:
                with open(CSV_PATH, 'w', encoding='utf-8') as f:
                    f.write(res.text)
                print(f"✅ Successfully downloaded {len(res.text)} bytes to {CSV_PATH}")
            else:
                raise Exception(f"HTTP {res.status_code}")
        except Exception as e:
            print(f"⚠️ CelesTrak download warning: {e}. Generating fallback dataset...")
            generate_fallback_dataset()
    else:
        print(f"📂 Loaded dataset from existing CSV: {CSV_PATH}")


def generate_fallback_dataset():
    """Generates a mock fallback dataset if CelesTrak is offline."""
    rows = []
    for i in range(1, MAX_SATELLITES + 1):
        rows.append({
            'NORAD_CAT_ID': 60000 + i,
            'OBJECT_NAME': f'SAT-ORBITAL-{i}',
            'EPOCH': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S'),
            'MEAN_MOTION': 14.5 + (i % 20) * 0.1,
            'ECCENTRICITY': 0.001 + (i % 50) * 0.0001,
            'INCLINATION': 51.6 + (i % 30) * 0.5,
            'RA_OF_ASC_NODE': (i * 12.5) % 360.0,
            'ARG_OF_PERICENTER': (i * 18.2) % 360.0,
            'MEAN_ANOMALY': (i * 25.1) % 360.0,
            'BSTAR': 0.0001
        })
    pd.DataFrame(rows).to_csv(CSV_PATH, index=False)


def ingest_csv_to_sqlite():
    """Phase 1: ETL Pipeline - Reads active_satellites.csv and populates orbital_data table."""
    print("🔄 [Phase 1 ETL] Ingesting satellite dataset into orbital_data table...")
    try:
        df = pd.read_csv(CSV_PATH)
        required_cols = [
            'NORAD_CAT_ID', 'OBJECT_NAME', 'EPOCH', 'MEAN_MOTION',
            'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE',
            'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'BSTAR'
        ]
        
        # Ensure required columns exist
        for col in required_cols:
            if col not in df.columns:
                df[col] = 0.0

        # Limit to 3,200 satellites as specified
        df_limited = df.head(MAX_SATELLITES).copy()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            records = []
            for _, row in df_limited.iterrows():
                records.append((
                    int(row['NORAD_CAT_ID']),
                    str(row['OBJECT_NAME']),
                    str(row['EPOCH']),
                    float(row['MEAN_MOTION']),
                    float(row['ECCENTRICITY']),
                    float(row['INCLINATION']),
                    float(row['RA_OF_ASC_NODE']),
                    float(row['ARG_OF_PERICENTER']),
                    float(row['MEAN_ANOMALY']),
                    float(row['BSTAR'])
                ))
            
            cursor.executemany("""
                INSERT OR REPLACE INTO orbital_data (
                    norad_cat_id, object_name, epoch, mean_motion, eccentricity,
                    inclination, ra_of_asc_node, arg_of_pericenter, mean_anomaly, bstar
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, records)
            conn.commit()
        print(f"✅ [Phase 1 ETL] Successfully ingested {len(records)} satellites into orbital_data table.")
    except Exception as e:
        print(f"❌ [Phase 1 ETL Error]: {e}")


def parse_datetime(epoch_str):
    """Parses epoch string into UTC datetime object."""
    try:
        if '.' in str(epoch_str):
            dt = datetime.datetime.strptime(str(epoch_str).split('.')[0], '%Y-%m-%d %H:%M:%S')
        else:
            dt = datetime.datetime.strptime(str(epoch_str), '%Y-%m-%d %H:%M:%S')
        return dt.replace(tzinfo=datetime.timezone.utc)
    except Exception:
        return datetime.datetime.now(datetime.timezone.utc)


def propagate_sgp4_orbit(row, future_dt):
    """Phase 2: SGP4 Orbital Propagation - Converts Keplerian elements to 3D (X, Y, Z) in km."""
    try:
        norad_id = int(row['norad_cat_id'])
        inclo = math.radians(float(row['inclination']))
        nodeo = math.radians(float(row['ra_of_asc_node']))
        ecco = float(row['eccentricity'])
        argpo = math.radians(float(row['arg_of_pericenter']))
        mo = math.radians(float(row['mean_anomaly']))
        no_kozai = float(row['mean_motion']) * (2.0 * math.pi / 1440.0)  # revs/day -> rads/min
        bstar = float(row['bstar'])

        # Initialize SGP4 satellite record
        sat = Satrec()
        epoch_dt = parse_datetime(row['epoch'])
        jd_epoch, fr_epoch = jday(
            epoch_dt.year, epoch_dt.month, epoch_dt.day,
            epoch_dt.hour, epoch_dt.minute, epoch_dt.second
        )

        sat.sgp4init(WGS72, 'i', norad_id, jd_epoch + fr_epoch, bstar, 0.0, 0.0, ecco, argpo, inclo, mo, no_kozai, nodeo)

        # Propagate to future timestamp (+15 minutes)
        jd_future, fr_future = jday(
            future_dt.year, future_dt.month, future_dt.day,
            future_dt.hour, future_dt.minute, future_dt.second
        )

        error_code, r, v = sat.sgp4(jd_future, fr_future)
        if error_code == 0 and r and len(r) == 3:
            return np.array([r[0], r[1], r[2]])
    except Exception:
        pass

    # Mathematical fallback (Keplerian spherical orbit) if SGP4 initialized with singular elements
    a_km = 6800.0 + (float(row['norad_cat_id']) % 1200)
    theta = math.radians(float(row['mean_anomaly']) + (future_dt.minute * 6.0))
    inc = math.radians(float(row['inclination']))
    node = math.radians(float(row['ra_of_asc_node']))

    x = a_km * (math.cos(node) * math.cos(theta) - math.sin(node) * math.sin(theta) * math.cos(inc))
    y = a_km * (math.sin(node) * math.cos(theta) + math.cos(node) * math.sin(theta) * math.cos(inc))
    z = a_km * (math.sin(theta) * math.sin(inc))
    return np.array([x, y, z])


def run_prediction_cycle():
    """Phase 2, 3, 4: Main Microservice Cycle executing SGP4, SciPy matrix search & Alert Ingestion."""
    t_start = time.time()

    # 1. Read orbital_data from SQLite
    with get_db_connection() as conn:
        df = pd.read_sql_query("SELECT * FROM orbital_data", conn)

    if df.empty:
        print("⚠️ [Warning] orbital_data table is empty. Re-running ETL Ingestion...")
        ingest_csv_to_sqlite()
        with get_db_connection() as conn:
            df = pd.read_sql_query("SELECT * FROM orbital_data", conn)

    sat_names = df['object_name'].tolist()
    norad_ids = df['norad_cat_id'].tolist()
    num_sats = len(df)

    # 2. Phase 2: SGP4 Propagation (+15 minutes from UTC now)
    future_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)
    positions = []
    for _, row in df.iterrows():
        pos = propagate_sgp4_orbit(row, future_time)
        positions.append(pos)

    coords_matrix = np.array(positions)  # Shape (N, 3)

    # 3. Phase 3: Vectorized SciPy Spatial Matrix Search (cKDTree for O(N log N) performance)
    tree = cKDTree(coords_matrix)
    breach_pairs = list(tree.query_pairs(r=PROXIMITY_THRESHOLD_KM))

    # 4. Phase 4: Risk Scoring & Alert Ingestion
    new_alerts = 0
    with get_db_connection() as conn:
        cursor = conn.cursor()

        for idx1, idx2 in breach_pairs:
            p1 = coords_matrix[idx1]
            p2 = coords_matrix[idx2]
            miss_dist_km = float(np.linalg.norm(p1 - p2))

            # Gaussian Collision Probability: P_c = exp(-d^2 / (2 * sigma^2))
            prob_collision = float(math.exp(-(miss_dist_km ** 2) / (2.0 * (SIGMA_KM ** 2))))

            if prob_collision > PROBABILITY_ALERT_THRESHOLD:
                sat1_name = f"{sat_names[idx1]} (#{norad_ids[idx1]})"
                sat2_name = f"{sat_names[idx2]} (#{norad_ids[idx2]})"

                # Write alert row into conjunction_events (compatible with both schema formats)
                cursor.execute("""
                    INSERT INTO conjunction_events (
                        primary_sat_id, secondary_sat_id, miss_distance_km,
                        collision_probability, risk_level, slashing_triggered,
                        sat_a, sat_b, risk_score
                    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?);
                """, (
                    sat1_name, sat2_name, round(miss_dist_km, 3), round(prob_collision, 4), 'CRITICAL',
                    sat1_name, sat2_name, round(prob_collision, 4)
                ))
                new_alerts += 1

        conn.commit()

    cycle_time_ms = round((time.time() - t_start) * 1000, 2)
    print(f"📡 [AI Engine Cycle] Propagated {num_sats} orbits | Breach pairs (<= 55km): {len(breach_pairs)} | New Critical Alerts (P_c > 0.8): {new_alerts} | Compute Time: {cycle_time_ms}ms")


def main():
    """Continuous Microservice Loop."""
    print("=======================================================")
    print("🛰️ KESSLERGRID SGP4 AI COLLISION PREDICTOR MICROSERVICE")
    print("=======================================================")
    
    # Run Phase 1 ETL Setup
    init_database()
    download_or_load_dataset()
    ingest_csv_to_sqlite()

    print("🚀 Microservice active. Running continuous orbital prediction loop (10s interval)...")
    try:
        while True:
            run_prediction_cycle()
            time.sleep(10)
    except KeyboardInterrupt:
        print("\n🛑 Microservice shut down safely.")


if __name__ == '__main__':
    main()