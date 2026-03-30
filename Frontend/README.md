# AvtarAi — FastAPI WebSocket Server

Advanced Real-time Interactive Assistant backend powered by Gemini 2.5 Flash + gTTS.

## Tech Stack

- **FastAPI** — WebSocket server
- **Google Gemini 2.5 Flash** — LLM responses
- **gTTS** — Text-to-speech audio generation
- **Uvicorn** — ASGI server

## Project Structure
```
backend/
├── main.py
├── requirements.txt
├── render.yaml
└── README.md
```

## Local Development

### Prerequisites
- Python 3.9+
- Google Gemini API key

### Setup
```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/aria-backend.git
cd aria-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Set your API key
export GOOGLE_API_KEY=your_gemini_api_key_here   # Mac/Linux
set GOOGLE_API_KEY=your_gemini_api_key_here      # Windows
```

### Run
```bash
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

Server starts at `ws://localhost:8002/ws`

## Deployment (Render)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Set the following:
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variable:
   - `GOOGLE_API_KEY` = your Gemini API key
6. Deploy

Live WebSocket URL: `wss://your-service-name.onrender.com/ws`

## WebSocket API

### Client → Server

Send a JSON message:
```json
{
  "content": "Hello, what is the weather today?"
}
```

### Server → Client

The server sends a sequence of messages per interaction:

| Type | Format | Description |
|------|--------|-------------|
| `text_start` | `{"type": "text_start"}` | Signals response is starting |
| `text_chunk` | `{"type": "text_chunk", "content": "..."}` | Streamed text token |
| `audio` | `{"type": "audio"}` | Signals next message is audio bytes |
| `(binary)` | `bytes` | Raw MP3 audio for the sentence |
| `text_end` | `{"type": "text_end"}` | Signals response is complete |

### Example Flow
```
Client  →  {"content": "Tell me a joke"}
Server  →  {"type": "text_start"}
Server  →  {"type": "text_chunk", "content": "Why don't"}
Server  →  {"type": "text_chunk", "content": " scientists trust atoms?"}
Server  →  {"type": "audio"}
Server  →  <binary MP3 bytes>
Server  →  {"type": "text_end"}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Gemini API key from Google AI Studio |
| `PORT` | Auto (Render) | Port to run the server on |

## Notes

- Free tier on Render spins down after 15 min of inactivity — first response may take ~30s
- Use [UptimeRobot](https://uptimerobot.com) (free) to ping every 10 min and keep it alive
- Audio is streamed sentence-by-sentence for low latency
- Frontend must connect via `wss://` (not `ws://`) in production

## License

MIT
