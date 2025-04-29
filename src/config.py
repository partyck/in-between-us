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
            "toneA": {"name": "Friendly", "color": {"r": 144, "g": 238, "b": 144}},
            "toneB": {"name": "Hostile", "color": {"r": 178, "g": 34, "b": 34}},
        },
        {
            "toneA": {"name": "Informal", "color": {"r": 255, "g": 223, "b": 0}},
            "toneB": {"name": "Formal", "color": {"r": 33, "g": 33, "b": 33}},
        },
        {
            "toneA": {"name": "Humorous", "color": {"r": 255, "g": 165, "b": 0}},
            "toneB": {"name": "Serious", "color": {"r": 54, "g": 69, "b": 79}},
        },
        {
            "toneA": {"name": "Supportive", "color": {"r": 135, "g": 206, "b": 250}},
            "toneB": {"name": "Dismissive", "color": {"r": 169, "g": 169, "b": 169}},
        },
        {
            "toneA": {"name": "Respectful", "color": {"r": 147, "g": 112, "b": 219}},
            "toneB": {"name": "Rude", "color": {"r": 139, "g": 0, "b": 0}},
        },
        {
            "toneA": {"name": "Relaxed", "color": {"r": 147, "g": 112, "b": 219}},
            "toneB": {"name": "Tense", "color": {"r": 139, "g": 0, "b": 0}},
        },
        {
            "toneA": {"name": "Empathetic", "color": {"r": 255, "g": 192, "b": 203}},
            "toneB": {"name": "Cold", "color": {"r": 176, "g": 224, "b": 230}},
        },
        {
            "toneA": {"name": "Flirty", "color": {"r": 255, "g": 105, "b": 180}},
            "toneB": {"name": "Distant", "color": {"r": 105, "g": 105, "b": 105}},
        },
    ]
]

COLORS_BY_TONE = {tone.tone_a.name: tone.tone_a.color for tone in TONES_WC} | {
    tone.tone_b.name: tone.tone_b.color for tone in TONES_WC
}


TONES_PROMPT = "The possible tones of conversation are: " + "; ".join(
    [f"{tone.tone_a.name}, {tone.tone_b.name}" for tone in TONES_WC]
)
