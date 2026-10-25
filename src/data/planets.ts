import { Body } from 'astronomy-engine';

export interface PlanetDefinition {
  id: string;
  name: string;
  astronomyBody: Body;
  radius: number; // Visual scale radius
  distanceScale: number; // Scale factor for AU to 3D scene units
  axialTilt: number; // in degrees
  rotationPeriodHours: number; // sidereal rotation duration
  orbitColor: string; // signature orbit color hex
  orbitalPeriodDays: number; // real orbital period in Earth days
  textures: {
    day: string;
    night?: string;
    clouds?: string;
    atmosphere?: string;
    rings?: string;
  };
  ringParams?: {
    innerRadius: number;
    outerRadius: number;
  };
  hasMoon?: boolean;
}

export const SOLAR_SYSTEM: PlanetDefinition[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    astronomyBody: Body.Mercury,
    radius: 0.38,
    distanceScale: 80,
    axialTilt: 0.03,
    rotationPeriodHours: 1407.6,
    orbitColor: '#9e9e9e',
    orbitalPeriodDays: 87.97,
    textures: { day: '/textures/2k_mercury.jpg' },
  },
  {
    id: 'venus',
    name: 'Venus',
    astronomyBody: Body.Venus,
    radius: 0.95,
    distanceScale: 60,
    axialTilt: 177.3, // Retrograde rotation
    rotationPeriodHours: -5832.5,
    orbitColor: '#e0a96d',
    orbitalPeriodDays: 224.7,
    textures: {
      day: '/textures/2k_venus_surface.jpg',
      atmosphere: '/textures/2k_venus_atmosphere.jpg',
    },
  },
  {
    id: 'earth',
    name: 'Earth',
    astronomyBody: Body.Earth,
    radius: 1.0,
    distanceScale: 50,
    axialTilt: 23.44,
    rotationPeriodHours: 23.93,
    orbitColor: '#00d2ff',
    orbitalPeriodDays: 365.26,
    hasMoon: true,
    textures: {
      day: '/textures/2k_earth_daymap.jpg',
      night: '/textures/2k_earth_nightmap.jpg',
      clouds: '/textures/2k_earth_clouds.jpg',
    },
  },
  {
    id: 'mars',
    name: 'Mars',
    astronomyBody: Body.Mars,
    radius: 0.53,
    distanceScale: 40,
    axialTilt: 25.19,
    rotationPeriodHours: 24.62,
    orbitColor: '#ff6b4a',
    orbitalPeriodDays: 686.98,
    textures: { day: '/textures/2k_mars.jpg' },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    astronomyBody: Body.Jupiter,
    radius: 2.5,
    distanceScale: 18,
    axialTilt: 3.13,
    rotationPeriodHours: 9.93,
    orbitColor: '#d4a373',
    orbitalPeriodDays: 4332.59,
    textures: { day: '/textures/2k_jupiter.jpg' },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    astronomyBody: Body.Saturn,
    radius: 2.1,
    distanceScale: 12,
    axialTilt: 26.73,
    rotationPeriodHours: 10.7,
    orbitColor: '#eed7a1',
    orbitalPeriodDays: 10759.22,
    textures: {
      day: '/textures/2k_saturn.jpg',
      rings: '/textures/2k_saturn_ring_alpha.png',
    },
    ringParams: {
      innerRadius: 2.8,
      outerRadius: 5.2,
    },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    astronomyBody: Body.Uranus,
    radius: 1.5,
    distanceScale: 7.5,
    axialTilt: 97.77,
    rotationPeriodHours: -17.24,
    orbitColor: '#70d6ff',
    orbitalPeriodDays: 30688.5,
    textures: { day: '/textures/2k_uranus.jpg' },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    astronomyBody: Body.Neptune,
    radius: 1.45,
    distanceScale: 5.5,
    axialTilt: 28.32,
    rotationPeriodHours: 16.11,
    orbitColor: '#4361ee',
    orbitalPeriodDays: 60182,
    textures: { day: '/textures/2k_neptune.jpg' },
  },
];