from pydantic import BaseModel


class MessageResponse(BaseModel):
    message: str

    def to_json(self) -> dict:
        return {"message": self.message}
