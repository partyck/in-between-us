import tomllib

with open("config.toml", mode="rb") as fp:
    config = tomllib.load(fp)

# openIA
OPENIA_API_KEY: str = config["openia_api_key"]

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

TONES_PROMPT = "The possible tones of conversation are: " + "; ".join([f"{tone[0]}, {tone[1]}" for tone in TONES])
