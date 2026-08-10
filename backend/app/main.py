from fastapi import FastAPI

app = FastAPI(title="Silent Co-Driver", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze():
    # TODO: Day 1 - implement audio upload, transcription, emotion classification, OpenF1 lookup
    return {"message": "Not implemented yet"}