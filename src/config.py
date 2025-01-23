import tomllib

with open("config.toml", mode="rb") as fp:
    config = tomllib.load(fp)

# openIA
OPENIA_API_KEY: str = config["openia_api_key"]
