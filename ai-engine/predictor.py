import time
import random
import psycopg2
from web3 import Web3

# Connect to Local PostgreSQL Database (using trust authentication)
DB_CONFIG = {
    "dbname": "kessler_db",
    "user": "postgres",
    "password": "", 
    "host": "localhost",
    "port": 5432
}

# Connect to Local Hardhat Node
GANACHE_URL = "http://127.0.0.1:8545"
w3 = Web3(Web3.HTTPProvider(GANACHE_URL))

def evaluate_orbits():
    print("🛰️ AI Watchdog Engine: Scanning orbital telemetry for conjunction risks...")
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Using ORDER BY id DESC to safely fetch recent telemetry without timestamp column conflicts
        cur.execute("SELECT sat_id, pos_x, pos_y, pos_z FROM telemetry_logs ORDER BY id DESC LIMIT 10;")
        satellites = cur.fetchall()
        
        if len(satellites) >= 2:
            sat_a = satellites[0]
            sat_b = satellites[1]
            
            # Distance calculation
            distance = ((sat_a[1] - sat_b[1])**2 + (sat_a[2] - sat_b[2])**2 + (sat_a[3] - sat_b[3])**2)**0.5
            
            if distance < 50.0:  # Threshold for collision warning
                risk_score = 0.95
                print(f"🚨 CRITICAL CONJUNCTION DETECTED: {sat_a[0]} and {sat_b[0]} (Risk: {risk_score * 100}%)")
                
                cur.execute(
                    "INSERT INTO conjunction_events (sat_a, sat_b, risk_score) VALUES (%s, %s, %s);",
                    (sat_a[0], sat_b[0], risk_score)
                )
                conn.commit()
            else:
                print("✅ Orbital paths clear. No immediate conjunction risks.")
                
        cur.close()
        conn.close()
    except Exception as e:
        print(f"⚠️ Database/AI engine sync error: {e}")

if __name__ == "__main__":
    print("🚀 Starting KesslerGrid AI Orbital Watchdog...")
    while True:
        evaluate_orbits()
        time.sleep(10) # Run every 10 seconds