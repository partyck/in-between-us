import os
import tomllib
from pathlib import Path

from models import ToneOptions

# Optional, for local development only. The Docker image leaves it out (see .dockerignore).
CONFIG_PATH = Path(__file__).with_name("config.toml")
config = tomllib.loads(CONFIG_PATH.read_text(encoding="utf-8")) if CONFIG_PATH.exists() else {}

# On Cloud Run the key comes from Secret Manager as OPENAI_API_KEY.
# Locally it can also be set in config.toml. With neither, the OpenAI client fails at startup.
OPENAI_API_KEY: str | None = os.environ.get("OPENAI_API_KEY") or config.get("openai_api_key")
# Only the two installations may connect. Each is set up once as station A or B with the station key (setup.js), and
# the server rejects any other socket. The key comes from Secret Manager as STATION_KEY on Cloud Run, or from
# config.toml locally.
STATIONS = ("A", "B")
STATION_KEY: str | None = os.environ.get("STATION_KEY") or config.get("station_key")
# Development mode: restart on code changes, log requests and reload templates. Off unless DEBUG=1.
# Only the dev container sets it. The Docker image and Cloud Run never do.
DEBUG: bool = os.environ.get("DEBUG") == "1"

TONES = [
    ("Friendly", "Hostile"),
    ("Informal", "Formal"),
    ("Humorous", "Serious"),
    ("Supportive", "Dismissive"),
    ("Respectful", "Rude"),
    ("Relaxed", "Tense"),
    ("Empathetic", "Cold"),
    ("Flirty", "Distant"),
]

TONES_WC = [
    ToneOptions.from_json(tone)
    for tone in [
        {
            "toneA": {"name": "Informal", "color": {"r": 0, "g": 242, "b": 96}},
            "toneB": {"name": "Formal", "color": {"r": 5, "g": 117, "b": 230}},
        },
        {
            "toneA": {"name": "Friendly", "color": {"r": 144, "g": 238, "b": 144}},
            "toneB": {"name": "Hostile", "color": {"r": 235, "g": 66, "b": 66}},
        },
        {
            "toneA": {"name": "Humorous", "color": {"r": 255, "g": 255, "b": 28}},
            "toneB": {"name": "Serious", "color": {"r": 0, "g": 195, "b": 255}},
        },
        {
            "toneA": {"name": "Supportive", "color": {"r": 135, "g": 206, "b": 250}},
            "toneB": {"name": "Dismissive", "color": {"r": 169, "g": 169, "b": 169}},
        },
        {
            "toneA": {"name": "Respectful", "color": {"r": 252, "g": 92, "b": 125}},
            "toneB": {"name": "Rude", "color": {"r": 106, "g": 130, "b": 251}},
        },
        {
            "toneA": {"name": "Relaxed", "color": {"r": 169, "g": 128, "b": 255}},
            "toneB": {"name": "Tense", "color": {"r": 255, "g": 111, "b": 111}},
        },
        {
            "toneA": {"name": "Empathetic", "color": {"r": 255, "g": 192, "b": 203}},
            "toneB": {"name": "Cold", "color": {"r": 176, "g": 224, "b": 230}},
        },
        {
            "toneA": {"name": "Flirty", "color": {"r": 255, "g": 105, "b": 237}},
            "toneB": {"name": "Distant", "color": {"r": 137, "g": 255, "b": 253}},
        },
    ]
]

TONES_BY_NAME = {tone.tone_a.name: tone.tone_a for tone in TONES_WC} | {
    tone.tone_b.name: tone.tone_b for tone in TONES_WC
}

# Each pair of opposite tones under the name OpenAI picks it by, e.g. "Informal / Formal". OpenAI can only answer with
# one of these names (message_response_format in models.py), so a pair never comes back mixed or misspelled.
TONE_PAIRS = {f"{pair.tone_a.name} / {pair.tone_b.name}": pair for pair in TONES_WC}
# Tone name -> the name of its pair, to find the pair a slider shows from the tones a message carries.
TONE_PAIR_OF = {tone.name: name for name, pair in TONE_PAIRS.items() for tone in (pair.tone_a, pair.tone_b)}
