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
class Room:
    user_a: User
    user_b: Optional[User]

    def __init__(self, user_a: User, user_b: Optional[User]) -> None:
        self.user_a = user_a
        self.user_b = user_b

    def to_json(self) -> dict:
        user_a_json = self.user_a.to_json()
        user_b_json = self.user_b.to_json() if self.user_b else {}
        return {"userA": user_a_json, "userB": user_b_json}

    @classmethod
    def from_json(cls, data: dict) -> Self:
        user_a = User.from_json(data["userA"])
        user_b = User.from_json(data["userB"]) if data.get("userB") else None
        return cls(user_a=user_a, user_b=user_b)


class MessageResponse(BaseModel):
    user_name: str
    message: str


@dataclass
class MessageInput:
    user_name: str
    message: str
    message_history: str

    @classmethod
    def from_json(cls, data: dict) -> Self:
        if data["messageHistory"]:
            history_m = "".join(
                [message["name"] + '": "' + message["content"] + '"\n' for message in data["messageHistory"]]
            )
            history_m = "Here is the conversation history:\n" + history_m
        else:
            history_m = "There is no conversation history."
        return cls(user_name=data["userName"], message=data["message"], message_history=history_m)
