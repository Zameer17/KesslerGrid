import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PYTHON_API = process.env.PYTHON_ANALYTICS_URL || 'http://localhost:8000';

/**
 * Triggers the Python AI Conjunction Engine with automatic embedded fallback
 * @param {Array} satellites - Array of formatted satellite positions
 */
export const checkConjunctionRisk = async (satellites) => {
    try {
        const response = await axios.post(`${PYTHON_API}/api/v1/detect-conjunction`, {
            satellites: satellites
        }, { timeout: 3000 });
        return response.data;
    } catch (error) {
        console.warn("⚠️ Python Analytics Engine offline or unreachable. Using embedded spatial fallback:", error.message);

        const alerts = [];
        if (!satellites || !Array.isArray(satellites)) return alerts;

        for (let i = 0; i < satellites.length; i++) {
            for (let j = i + 1; j < satellites.length; j++) {
                const satA = satellites[i];
                const satB = satellites[j];
                const dx = (satA.posX || 0) - (satB.posX || 0);
                const dy = (satA.posY || 0) - (satB.posY || 0);
                const dz = (satA.posZ || 0) - (satB.posZ || 0);
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (distance < 15.0) {
                    const riskScore = Math.max(0, 1.0 - (distance / 15.0));
                    alerts.push({
                        satA: satA.satId,
                        satB: satB.satId,
                        riskScore: parseFloat(riskScore.toFixed(4)),
                        distance: parseFloat(distance.toFixed(2))
                    });
                }
            }
        }
        return alerts;
    }
};
