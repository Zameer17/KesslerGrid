import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PYTHON_API = process.env.PYTHON_ANALYTICS_URL || 'http://localhost:8000';

/**
 * Triggers the Python AI Conjunction Engine
 * @param {Array} satellites - Array of formatted satellite positions
 */
export const checkConjunctionRisk = async (satellites) => {
    try {
        const response = await axios.post(`${PYTHON_API}/api/v1/detect-conjunction`, {
            satellites: satellites
        });
        return response.data;
    } catch (error) {
        console.error("Python Bridge Error:", error.message);
        throw new Error("Failed to communicate with Python Analytics Engine.");
    }
};