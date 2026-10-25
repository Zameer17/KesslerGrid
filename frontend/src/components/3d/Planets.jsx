import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export default function PlanetMesh({ name, radius, distance, speed, color, hasRings, moons = [] }) {
    const pivotRef = useRef();
    const planetRef = useRef();
    const moonPivotsRef = useRef([]);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime() * speed * 0.3;
        if (pivotRef.current) {
            pivotRef.current.rotation.y = t;
        }
        if (planetRef.current) {
            planetRef.current.rotation.y += 0.01;
        }
        moonPivotsRef.current.forEach((pivot, idx) => {
            if (pivot) {
                pivot.rotation.y = t * (2 + idx * 0.5);
            }
        });
    });

    return (
        <group>
            {/* Orbit Path Guide Ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[distance - 0.04, distance + 0.04, 128]} />
                <meshBasicMaterial color="#334155" side={THREE.DoubleSide} transparent opacity={0.4} />
            </mesh>

            {/* Revolution Pivot */}
            <group ref={pivotRef}>
                <group position={[distance, 0, 0]}>
                    <mesh ref={planetRef} castShadow receiveShadow>
                        <sphereGeometry args={[radius, 32, 32]} />
                        <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />

                        {hasRings && (
                            <mesh rotation={[Math.PI / 3, 0, 0]}>
                                <ringGeometry args={[radius * 1.3, radius * 2.2, 64]} />
                                <meshStandardMaterial color="#ca8a04" side={THREE.DoubleSide} transparent opacity={0.8} />
                            </mesh>
                        )}
                    </mesh>

                    {/* Moons */}
                    {moons.map((moon, index) => (
                        <group key={moon.name} ref={el => moonPivotsRef.current[index] = el}>
                            <mesh position={[moon.distance, 0, 0]} castShadow receiveShadow>
                                <sphereGeometry args={[moon.radius, 16, 16]} />
                                <meshStandardMaterial color={moon.color} roughness={0.9} />
                            </mesh>
                        </group>
                    ))}

                    <Html distanceFactor={25} center>
                        <div className="bg-slate-900/90 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-500/40 shadow-xl whitespace-nowrap backdrop-blur-md">
                            {name}
                        </div>
                    </Html>
                </group>
            </group>
        </group>
    );
}