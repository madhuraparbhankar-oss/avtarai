import os
import json
import re
import asyncio
from io import BytesIO
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from gtts import gTTS
from google.genai import Client

# Load API Key
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyA3t8EAPbfvvo0oKBnjjmJ-Zm5gS6sSFz0")
print(f"Using API key: {GEMINI_API_KEY[:10]}...") 
client = Client(api_key=GEMINI_API_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def make_tts(text: str) -> bytes:
    tts = gTTS(text)
    buf = BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return buf.read()

@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected")

    try:
        while True:
            try:
                data = await websocket.receive_text()
                msg = json.loads(data)
                user_text = msg.get("content", "").strip()
                if not user_text:
                    continue

                await websocket.send_text(json.dumps({"type": "text_start"}))

                audio_queue = asyncio.Queue()

                async def tts_worker():
                    while True:
                        sentence = await audio_queue.get()
                        if sentence is None:
                            break
                        try:
                            audio_bytes = await asyncio.to_thread(make_tts, sentence)
                            await websocket.send_text(json.dumps({"type": "audio"}))
                            await websocket.send_bytes(audio_bytes)
                        except Exception as e:
                            print(f"TTS error: {e}")
                        finally:
                            audio_queue.task_done()

                tts_task = asyncio.create_task(tts_worker())

                try:
                    response_stream = await client.aio.models.generate_content_stream(
                        model="models/gemini-2.5-flash",
                        contents=user_text
                    )

                    sentence_buffer = ""
                    async for chunk in response_stream:
                        txt = chunk.text
                        if not txt:
                            continue

                        await websocket.send_text(json.dumps({
                            "type": "text_chunk",
                            "content": txt
                        }))
                        
                        sentence_buffer += txt
                        
                        # Match sentence boundaries ending with spacing or newline
                        while True:
                            match = re.search(r'([.!?\n]+(?:\s+|$))', sentence_buffer)
                            if match:
                                end_pos = match.end()
                                sentence = sentence_buffer[:end_pos].strip()
                                sentence_buffer = sentence_buffer[end_pos:]
                                if sentence:
                                    clean_sent = sentence.replace('*', '').replace('#', '')
                                    if clean_sent.strip():
                                        await audio_queue.put(clean_sent)
                            else:
                                break
                    
                    if sentence_buffer.strip():
                        clean_sent = sentence_buffer.replace('*', '').replace('#', '').strip()
                        if clean_sent:
                            await audio_queue.put(clean_sent)

                except Exception as stream_e:
                    print(f"Stream error ({type(stream_e).__name__}): {stream_e}")
                    resp = client.models.generate_content(
                        model="models/gemini-2.5-flash",
                        contents=user_text
                    )
                    await websocket.send_text(json.dumps({
                        "type": "text_chunk",
                        "content": resp.text
                    }))
                    clean_sent = resp.text.replace('*', '').replace('#', '').strip()
                    if clean_sent:
                        await audio_queue.put(clean_sent)

                await websocket.send_text(json.dumps({"type": "text_end"}))
                
                await audio_queue.put(None)
                await tts_task

            except WebSocketDisconnect:
                print("Client disconnected mid-interaction")
                break
            except Exception as e:
                print("Interaction Error:", str(e))
                try:
                    await websocket.send_text(json.dumps({
                        "type": "text_chunk",
                        "content": "Sorry, I had trouble processing that. Can you try again?"
                    }))
                    await websocket.send_text(json.dumps({"type": "text_end"}))
                except:
                    break

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as fatal_error:
        print("Fatal WebSocket Error:", str(fatal_error))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
