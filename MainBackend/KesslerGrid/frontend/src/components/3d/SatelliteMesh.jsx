import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

export default function SatelliteMesh({ satId, position, status }) {
    const meshRef = useRef();

    const scaleFactor = 3000;
    const x = position.x / scaleFactor;
    const y = position.y / scaleFactor;
    const z = position.z / scaleFactor;

    const color = status === 'WARNING' ? '#f59e0b' : status === 'PENALIZED' ? '#ef4444' : '#06b6d4';

    useFrame(({ clock }) => {
        if (meshRef.current) {
            meshRef.current.rotation.x = clock.getElapsedTime() * 0.4;
            meshRef.current.rotation.y = clock.getElapsedTime() * 0.4;
        }
    });

    return (
        <mesh ref={meshRef} position={[x, y, z]}>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />

            <Html distanceFactor={12} center>
                <div className="bg-slate-900/95 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded-md border border-cyan-500/40 shadow-xl whitespace-nowrap backdrop-blur-md">
                    {satId} [{status}]
                </div>
            </Html>
        </mesh>
    );
}