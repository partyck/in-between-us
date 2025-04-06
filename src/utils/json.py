import re
from typing import Any, Optional


def json_to_dict_convention(json: Optional[dict]) -> Any:
    if isinstance(json, list):
        return [json_to_dict_convention(item) for item in json]
    if isinstance(json, dict):
        return {_camel_to_snake(key): json_to_dict_convention(value) for (key, value) in json.items()}
    return json


def _camel_to_snake(name: str) -> str:
    name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", name).lower()


def dict_to_json_convention(data: Optional[dict]) -> Any:
    if isinstance(data, list):
        return [dict_to_json_convention(item) for item in data]
    if isinstance(data, dict):
        return {_snake_to_camel(key): dict_to_json_convention(value) for (key, value) in data.items()}
    return data


def _snake_to_camel(name: str) -> str:
    components = name.split("_")
    return components[0] + "".join(item.title() for item in components[1:])
