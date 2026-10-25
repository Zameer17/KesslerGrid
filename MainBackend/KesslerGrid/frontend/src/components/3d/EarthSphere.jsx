import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function EarthSphere() {
    const earthRef = useRef();

    useFrame(() => {
        if (earthRef.current) {
            earthRef.current.rotation.y += 0.001;
        }
    });

    return (
        <group>
            {/* Atmosphere Glow */}
            <mesh>
                <sphereGeometry args={[2.08, 64, 64]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} wireframe />
            </mesh>
            {/* Earth Core */}
            <mesh ref={earthRef} castShadow receiveShadow>
                <sphereGeometry args={[2, 64, 64]} />
                <meshStandardMaterial
                    color="#0284c7"
                    roughness={0.6}
                    metalness={0.2}
                />
            </mesh>
        </group>
    );
}