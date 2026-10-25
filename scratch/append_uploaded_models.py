import re

with open('src/components/Satellite.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

new_models_code = """
// 20. Telecom Parabolic Dish Satellite (Uploaded Image 1)
function ModelTelecomParabolicDish({
  foilMap,
  blueSolarMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.24, 0.32, 24]} />
        <meshStandardMaterial map={foilMap} color="#e2e8f0" metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.08, 20, 1, true]} />
        <meshStandardMaterial color="#64748b" metalness={0.95} roughness={0.1} side={THREE.DoubleSide} />
      </mesh>
      {[
        { pos: [-0.22, 0.12, 0.12], rot: [0.4, -0.5, 0] },
        { pos: [0.22, 0.12, 0.12], rot: [0.4, 0.5, 0] },
        { pos: [-0.22, -0.12, -0.12], rot: [-0.4, -0.5, 0] },
        { pos: [0.22, -0.12, -0.12], rot: [-0.4, 0.5, 0] },
      ].map((dish, idx) => (
        <group key={idx} position={dish.pos as any} rotation={dish.rot as any}>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.14, 0.02, 0.05, 16, 1, true]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.1} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.24, 0, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.55, 0, 0]}>
            <boxGeometry args={[0.62, 0.44, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 21. Octagonal Optical Camera Sensor Satellite (Uploaded Image 2)
function ModelOpticalEarthObservation({
  foilMap,
  blueSolarMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.42, 8]} />
        <meshStandardMaterial map={foilMap} color="#475569" metalness={0.92} roughness={0.15} />
      </mesh>
      <group position={[0, 0, 0.22]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.04, 20]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.01, 20]} />
          <meshStandardMaterial color="#38bdf8" metalness={0.95} roughness={0.05} />
        </mesh>
      </group>
      <mesh position={[0, 0.23, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />
        <meshStandardMaterial color="#020617" metalness={0.8} roughness={0.3} />
      </mesh>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.25, 0, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.54, 0, 0]}>
            <boxGeometry args={[0.60, 0.48, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} color="#fbbf24" roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 22. High-Tech Sensor Boom Satellite (Uploaded Image 3)
function ModelHighTechSensorBoom({
  foilMap,
  blueSolarMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.26, 0.50, 0.26]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.10, 0.14]}>
        <boxGeometry args={[0.20, 0.22, 0.04]} />
        <meshStandardMaterial map={foilMap} color="#d97706" metalness={0.9} roughness={0.2} />
      </mesh>
      <group position={[0, -0.26, 0.08]} rotation={[0.4, 0, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.44, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
        <mesh position={[0, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.02, 0.04, 16, 1, true]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {[-0.06, 0.06].map((x, idx) => (
        <mesh key={idx} position={[x, 0.27, -0.06]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.07, 0.08, 12, 1, true]} />
          <meshStandardMaterial color="#334155" metalness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.22, 0.12, 0]} rotation={[0.2, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.52, 0, 0]}>
            <boxGeometry args={[0.58, 0.40, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
"""

# Insert new models before SatelliteNode
code_updated = code.replace("// Single Orbiting Satellite Instance Component\nfunction SatelliteNode", new_models_code + "\n// Single Orbiting Satellite Instance Component\nfunction SatelliteNode")

# Add render branches in SatelliteNode switch
model_switch_additions = """            {config.modelType === 'telecom_parabolic_dish' && (
              <ModelTelecomParabolicDish foilMap={textures.foil} blueSolarMap={textures.blueSolar} />
            )}
            {config.modelType === 'optical_earth_obs' && (
              <ModelOpticalEarthObservation foilMap={textures.foil} blueSolarMap={textures.blueSolar} />
            )}
            {config.modelType === 'hitech_sensor_boom' && (
              <ModelHighTechSensorBoom foilMap={textures.foil} blueSolarMap={textures.blueSolar} />
            )}
"""

code_updated = code_updated.replace("{config.modelType === 'early_warning' && (\n              <ModelEarlyWarning foilMap={textures.foil} blueSolarMap={textures.blueSolar} />\n            )}", "{config.modelType === 'early_warning' && (\n              <ModelEarlyWarning foilMap={textures.foil} blueSolarMap={textures.blueSolar} />\n            )}\n" + model_switch_additions)

with open('src/components/Satellite.tsx', 'w', encoding='utf-8') as f:
    f.write(code_updated)

print("Added 3 uploaded image 3D procedural models to Satellite.tsx!")
