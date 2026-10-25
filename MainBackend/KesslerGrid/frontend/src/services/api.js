import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Web3Provider } from './context/Web3Context';
import Navbar from './components/ui/Navbar';
import EarthSphere from './components/3d/EarthSphere';
import SatelliteMesh from './components/3d/SatelliteMesh';

// Dummy data to test rendering before backend connects
const mockSatellites = [
    { satId: 'SAT-101', pos: { x: 7500, y: 1500, z: 0 }, status: 'ACTIVE' },
    { satId: 'SAT-204', pos: { x: -6000, y: 3000, z: 2000 }, status: 'WARNING' },
    { satId: 'SAT-DEBRIS', pos: { x: 0, y: 8000, z: -1000 }, status: 'PENALIZED' },
];

export default function App() {
    const [satellites, setSatellites] = useState(mockSatellites);

    // TODO: Implement fetching real satellites via apiClient in a useEffect hook here.

    return (
        <Web3Provider>
            <div className="w-screen h-screen bg-black overflow-hidden relative font-sans">
                <Navbar />

                {/* 3D Canvas Layer */}
                <div className="absolute inset-0 z-0 cursor-move">
                    <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
                        <ambientLight intensity={0.2} />
                        <pointLight position={[10, 10, 10]} intensity={1.5} />
                        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                        <OrbitControls enablePan={false} maxDistance={15} minDistance={3} />

                        <EarthSphere />

                        {satellites.map((sat) => (
                            <SatelliteMesh
                                key={sat.satId}
                                satId={sat.satId}
                                position={sat.pos}
                                status={sat.status}
                            />
                        ))}
                    </Canvas>
                </div>

                {/* UI Overlay Layer (Bottom Left) */}
                <div className="absolute bottom-4 left-4 z-10 w-80">
                    <div className="bg-black/70 backdrop-blur border border-gray-700 rounded-lg p-4 text-white">
                        <h3 className="font-bold border-b border-gray-600 pb-2 mb-2">Live Orbital Tracking</h3>
                        <p className="text-sm text-gray-300 mb-1">Total Tracked Objects: {satellites.length}</p>
                        <p className="text-xs text-gray-500">Drag to rotate • Scroll to zoom</p>
                    </div>
                </div>
            </div>
        </Web3Provider>
    );
}