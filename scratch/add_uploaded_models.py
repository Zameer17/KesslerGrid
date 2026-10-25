import re

# Update noradSatellites.ts type definition and model type assignments
with open('src/data/noradSatellites.ts', 'r', encoding='utf-8') as f:
    ts_code = f.read()

# Add new model types to Union in noradSatellites.ts
new_types_union = """    | 'early_warning'
    | 'telecom_parabolic_dish'
    | 'optical_earth_obs'
    | 'hitech_sensor_boom';"""

ts_code = ts_code.replace("    | 'early_warning';", new_types_union)

# Update some satellite modelType assignments to use the 3 new uploaded 3D models
# Telecom satellites -> 'telecom_parabolic_dish'
ts_code = ts_code.replace("modelType: 'telecom_relay'", "modelType: 'telecom_parabolic_dish'")
# Earth Observation -> 'optical_earth_obs'
ts_code = ts_code.replace("modelType: 'cross_observation'", "modelType: 'optical_earth_obs'")
# Science / Sensor -> 'hitech_sensor_boom'
ts_code = ts_code.replace("modelType: 'reconnaissance'", "modelType: 'hitech_sensor_boom'")

with open('src/data/noradSatellites.ts', 'w', encoding='utf-8') as f:
    f.write(ts_code)

print("Updated noradSatellites.ts model types!")
