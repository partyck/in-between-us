from dataclasses import dataclass
from typing import Self

from pydantic import BaseModel


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
