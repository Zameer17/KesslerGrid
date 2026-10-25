from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import uvicorn
import math

app = FastAPI(title="KesslerGrid AI Analytics Engine")

# 1. Define the incoming Data Structure from Node.js
class Satellite(BaseModel):
    satId: str
    posX: float
    posY: float
    posZ: float

class ConjunctionRequest(BaseModel):
    satellites: List[Satellite]

# 2. Create the Endpoint that pythonBridge.js is looking for
@app.post("/api/v1/detect-conjunction")
async def detect_conjunction(data: ConjunctionRequest):
    alerts = []
    sats = data.satellites
    
    # 3. Analyze spatial data for collision risks (O(N^2) comparison)
    for i in range(len(sats)):
        for j in range(i + 1, len(sats)):
            satA = sats[i]
            satB = sats[j]
            
            # Calculate 3D Euclidean distance
            distance = math.sqrt(
                (satA.posX - satB.posX)**2 + 
                (satA.posY - satB.posY)**2 + 
                (satA.posZ - satB.posZ)**2
            )
            
            # If satellites are closer than 15 units, it's a conjunction risk!
            if distance < 15.0:
                # Calculate risk score (closer = higher risk, max 1.0)
                risk_score = 1.0 - (distance / 15.0) 
                
                alerts.append({
                    "satA": satA.satId,
                    "satB": satB.satId,
                    "riskScore": round(risk_score, 4),
                    "distance": round(distance, 2)
                })

    print(f"🛰️ Analyzed {len(sats)} satellites. Found {len(alerts)} risks.")
    return alerts

if __name__ == "__main__":
    # Start the server on port 8000
    print("🚀 Starting KesslerGrid AI Analytics Engine on Port 8000...")
    uvicorn.run("run:app", host="0.0.0.0", port=8000, reload=True)