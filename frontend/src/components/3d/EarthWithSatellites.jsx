import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export default function EarthWithSatellites({ satellites }) {
    const earthRef = useRef();
    const cloudsRef = useRef();
    const satellitesRef = useRef();

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (earthRef.current) {
            earthRef.current.rotation.y += 0.002;
        }
        if (cloudsRef.current) {
            cloudsRef.current.rotation.y += 0.003;
        }
        if (satellitesRef.current) {
            satellitesRef.current.rotation.y = t * 0.5;
        }
    });

    return (
        <group>
            {/* Atmosphere Glow */}
            <mesh>
                <sphereGeometry args={[2.35, 64, 64]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.15} wireframe />
            </mesh>

            {/* Clouds Layer */}
            <mesh ref={cloudsRef}>
                <sphereGeometry args={[2.1, 64, 64]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.35} blending={THREE.AdditiveBlending} />
            </mesh>

            {/* Earth Core */}
            <mesh ref={earthRef} castShadow receiveShadow>
                <sphereGeometry args={[2, 64, 64]} />
                <meshStandardMaterial color="#0284c7" roughness={0.5} metalness={0.2} />
            </mesh>

            {/* Satellites Orbiting Earth */}
            <group ref={satellitesRef}>
                {satellites.map((sat, index) => {
                    const angle = (index / satellites.length) * Math.PI * 2;
                    const orbitRadius = 3.2 + (index % 2) * 0.6;
                    const x = Math.cos(angle) * orbitRadius;
                    const z = Math.sin(angle) * orbitRadius;
                    const y = (index % 2 === 0 ? 0.5 : -0.5);

                    const color = sat.status === 'WARNING' ? '#f59e0b' : sat.status === 'PENALIZED' ? '#ef4444' : '#06b6d4';

                    return (
                        <group key={sat.satId} position={[x, y, z]}>
                            <mesh>
                                <boxGeometry args={[0.15, 0.15, 0.15]} />
                                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
                            </mesh>
                            <mesh position={[0.2, 0, 0]}>
                                <boxGeometry args={[0.3, 0.02, 0.1]} />
                                <meshStandardMaterial color="#94a3b8" metalness={0.8} />
                            </mesh>
                            <mesh position={[-0.2, 0, 0]}>
                                <boxGeometry args={[0.3, 0.02, 0.1]} />
                                <meshStandardMaterial color="#94a3b8" metalness={0.8} />
                            </mesh>

                            <Html distanceFactor={15} center>
                                <div className="bg-slate-900/90 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-500/40 shadow-xl whitespace-nowrap backdrop-blur-md">
                                    {sat.satId} [{sat.status}]
                                </div>
                            </Html>
                        </group>
                    );
                })}
            </group>
        </group>
    );
}