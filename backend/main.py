from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

app = FastAPI()

# Enable CORS for your Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify your Vercel frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExecutionRequest(BaseModel):
    language: str
    code: str

@app.post("/api/execute")
async def execute_code(req: ExecutionRequest):
    # Map common language names to Piston runtime language codes if needed
    lang_map = {
        "python": "python",
        "javascript": "javascript",
        "java": "java",
        "c++": "cpp"
    }
    
    piston_lang = lang_map.get(req.language.lower(), req.language.lower())

    payload = {
        "language": piston_lang,
        "version": "*",
        "files": [
            {
                "content": req.code
            }
        ]
    }

    try:
        response = requests.post("https://emkc.org/api/v2/piston/execute", json=payload)
        data = response.json()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"status": "SyncSpace Backend is running!"}