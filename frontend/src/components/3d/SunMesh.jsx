import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function SunMesh() {
    const sunRef = useRef();

    useFrame(() => {
        if (sunRef.current) {
            sunRef.current.rotation.y += 0.002;
        }
    });

    return (
        <group position={[0, 0, 0]}>
            <mesh ref={sunRef}>
                <sphereGeometry args={[4.5, 64, 64]} />
                <meshBasicMaterial color="#ffaa00" />
            </mesh>
            <mesh>
                <sphereGeometry args={[5.2, 32, 32]} />
                <meshBasicMaterial color="#ff6600" transparent opacity={0.35} side={2} />
            </mesh>
            <pointLight intensity={4} distance={300} decay={1} color="#ffedd5" />
        </group>
    );
}