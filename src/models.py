from dataclasses import asdict, dataclass
from typing import Optional, Self

from pydantic import BaseModel

from utils.json import dict_to_json_convention


@dataclass
class User:
    session_id: str
    user_name: str

    def __init__(self, session_id: str, user_name: str) -> None:
        self.session_id = session_id
        self.user_name = user_name

    def to_json(self):
        return dict_to_json_convention(asdict(self))

    @classmethod
    def from_json(cls, data: dict) -> Self:
        return cls(session_id=data["sessionId"], user_name=data["userName"])


@dataclass
class Color:
    r: int
    g: int
    b: int

    def to_json(self):
        return dict_to_json_convention(asdict(self))

    @classmethod
    def from_json(cls, data: dict) -> Self:
        h = data["color"].lstrip("#")
        (
            r,
            g,
            b,
        ) = tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))
        return cls(
            r=r,
            g=g,
            b=b,
        )


@dataclass
class Room:
    active: bool
    user_a: User
    user_b: Optional[User]

    def __init__(self, active: bool, user_a: User, user_b: Optional[User]) -> None:
        self.active = active
        self.user_a = user_a
        self.user_b = user_b

    def to_json(self) -> dict:
        user_a_json = self.user_a.to_json()
        user_b_json = self.user_b.to_json() if self.user_b else None
        return {"active": self.active, "userA": user_a_json, "userB": user_b_json}

    @classmethod
    def from_json(cls, data: dict) -> Self:
        user_a = User.from_json(data["userA"])
        user_b = User.from_json(data["userB"]) if data.get("userB") else None
        return cls(active=data["active"], user_a=user_a, user_b=user_b)


class MessageResponse(BaseModel):
    user_name: str
    message: str


class ToneResponse(BaseModel):
    tone_a: str
    tone_b: str


@dataclass
class ToneOption:
    name: str
    color: Color


@dataclass
class ToneOptions:
    tone_a: ToneOption
    tone_b: ToneOption

    @classmethod
    def from_json(cls, data: dict) -> Self:
        return cls(
            tone_a=ToneOption(
                name=data["toneA"]["name"],
                color=Color(
                    r=data["toneA"]["color"]["r"], g=data["toneA"]["color"]["g"], b=data["toneA"]["color"]["b"]
                ),
            ),
            tone_b=ToneOption(
                name=data["toneB"]["name"],
                color=Color(
                    r=data["toneB"]["color"]["r"], g=data["toneB"]["color"]["g"], b=data["toneB"]["color"]["b"]
                ),
            ),
        )


@dataclass
class Tone:
    tone: str
    value: float


@dataclass
class MessageInput:
    user_name: str
    message: str
    tone_1: Tone
    tone_2: Tone
    color: str
    message_history: list[dict[str, str]]

    def message_history_prompt(self) -> str:
        if self.message_history:
            history_m = "".join(
                [message["name"] + '": "' + message["content"] + '"\n' for message in self.message_history]
            )
            return "Here is the conversation history:\n" + history_m
        else:
            return "There is no conversation history."

    def higher_tone_value(self) -> int:
        return int(max(self.tone_1.value, self.tone_2.value) * 100)

    def higher_tone_name(self) -> str:
        return self.tone_1.tone if self.tone_1.value > self.tone_2.value else self.tone_2.tone

    def add_message(self, new_message: MessageResponse):
        self.message_history.append({"name": new_message.user_name, "content": new_message.message})

    @classmethod
    def from_json(cls, data: dict) -> Self:
        if data["messageHistory"]:
            history_m = [message for message in data["messageHistory"]]
        else:
            history_m = []
        tone_1 = Tone(tone=data["tone"]["tone1"], value=data["tone"]["tone1Value"])
        tone_2 = Tone(tone=data["tone"]["tone2"], value=data["tone"]["tone2Value"])
        color = data["tone"]["color"]
        if tone_2.value > tone_1.value:
            aux = tone_1
            tone_1 = tone_2
            tone_2 = aux
        return cls(
            user_name=data["userName"],
            message=data["message"],
            tone_1=tone_1,
            tone_2=tone_2,
            message_history=history_m,
            color=color,
        )
