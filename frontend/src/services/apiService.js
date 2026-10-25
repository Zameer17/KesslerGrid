const API_BASE_URL = "http://localhost:5000/api/v1";

// 1. Fetch Satellites
export const fetchSatellites = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/satellites`);
        if (!response.ok) throw new Error("Backend responded with an error.");
        return await response.json();
    } catch (error) {
        console.warn("⚠️ Backend offline: Using fallback satellite data.");
        // Fallback mock data
        return [
            { satId: "SAT-ALPHA-01", status: "Active Grid" },
            { satId: "SAT-BETA-02", status: "Active Grid" }
        ];
    }
};

// 2. Fetch Conjunction Alerts
export const fetchConjunctionAlerts = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/conjunctions`);
        if (!response.ok) throw new Error("Backend responded with an error.");
        return await response.json();
    } catch (error) {
        console.warn("⚠️ Backend offline: Using fallback conjunction alerts.");
        // Fallback mock alerts
        return [
            { satA: "SAT-ALPHA-01", satB: "DEBRIS-99", riskScore: 0.85 }
        ];
    }
};

// 3. Fetch Telemetry Logs
export const fetchTelemetryLogs = async (satId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/telemetry/${satId}`);
        if (!response.ok) throw new Error("Backend responded with an error.");
        return await response.json();
    } catch (error) {
        console.warn(`⚠️ Backend offline: Using fallback telemetry for ${satId}.`);
        // Fallback mock telemetry
        return [
            { timestamp: Date.now(), posX: 120.5, posY: -45.2, posZ: 300.1 },
            { timestamp: Date.now() - 5000, posX: 119.5, posY: -44.2, posZ: 299.1 },
            { timestamp: Date.now() - 10000, posX: 118.5, posY: -43.2, posZ: 298.1 }
        ];
    }
};