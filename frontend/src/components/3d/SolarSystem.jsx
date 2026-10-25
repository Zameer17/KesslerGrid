import React from 'react';
import SunMesh from './SunMesh';
import PlanetMesh from './PlanetMesh';

export default function SolarSystem() {
    const planetsData = [
        { name: 'Mercury', radius: 0.4, distance: 9, speed: 1.6, color: '#a8a29e', moons: [] },
        { name: 'Venus', radius: 0.75, distance: 15, speed: 1.2, color: '#f97316', moons: [] },
        {
            name: 'Earth', radius: 0.9, distance: 22, speed: 1.0, color: '#0284c7',
            moons: [{ name: 'Moon', radius: 0.25, distance: 2.2, color: '#94a3b8' }]
        },
        {
            name: 'Mars', radius: 0.5, distance: 30, speed: 0.8, color: '#ef4444',
            moons: [{ name: 'Phobos', radius: 0.12, distance: 1.5, color: '#64748b' }]
        },
        {
            name: 'Jupiter', radius: 2.0, distance: 42, speed: 0.5, color: '#d97706',
            moons: [
                { name: 'Io', radius: 0.18, distance: 3.2, color: '#fde047' },
                { name: 'Europa', radius: 0.16, distance: 4.2, color: '#e2e8f0' },
                { name: 'Ganymede', radius: 0.24, distance: 5.5, color: '#94a3b8' },
                { name: 'Callisto', radius: 0.22, distance: 6.8, color: '#64748b' }
            ]
        },
        {
            name: 'Saturn', radius: 1.7, distance: 56, speed: 0.35, color: '#fef08a', hasRings: true,
            moons: [{ name: 'Titan', radius: 0.28, distance: 4.5, color: '#f59e0b' }]
        },
        {
            name: 'Uranus', radius: 1.2, distance: 70, speed: 0.25, color: '#38bdf8',
            moons: [{ name: 'Titania', radius: 0.15, distance: 2.5, color: '#cfd8dc' }]
        },
        {
            name: 'Neptune', radius: 1.15, distance: 84, speed: 0.18, color: '#3b82f6',
            moons: [{ name: 'Triton', radius: 0.18, distance: 2.6, color: '#93c5fd' }]
        }
    ];

    return (
        <group>
            <SunMesh />
            {planetsData.map((planet) => (
                <PlanetMesh key={planet.name} {...planet} />
            ))}
        </group>
    );
}