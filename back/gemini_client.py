# assistant.py
import google.generativeai as genai
from dotenv import load_dotenv
import os

load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
genai.configure(api_key=API_KEY)

# Generate text response
async def generate_text(prompt: str) -> str:
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"ERROR: {str(e)}"


# Generate MP3 audio using Gemini TTS
async def generate_audio(text: str) -> bytes:
    try:
        model = genai.GenerativeModel(
            "gemini-2.0-flash",
            system_instruction="You are a voice for an AI assistant."
        )

        audio_response = model.generate_content(
            text,
            generation_config={"response_mime_type": "audio/mp3"}
        )

        return audio_response._result.binary
    except Exception as e:
        print("TTS ERROR:", e)
        return b""  # return empty audio to prevent break
