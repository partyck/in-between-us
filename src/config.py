import tomllib

from models import ToneOptions

with open("config.toml", mode="rb") as fp:
    config = tomllib.load(fp)

# openIA
OPENIA_API_KEY: str = config["openia_api_key"]
DB_ROOMS: str = "rooms-" + config["dever"]

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


TONES_PROMPT = "The possible tones of conversation are: " + "; ".join(
    [f"{tone.tone_a.name}, {tone.tone_b.name}" for tone in TONES_WC]
)
