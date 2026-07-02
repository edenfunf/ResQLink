"""Site assistant endpoint — Q&A about the ResQLink system itself."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services import assistant_service

router = APIRouter(prefix="/v1/assistant", tags=["assistant"])


class AssistantTurn(BaseModel):
    role: str = Field(..., description="user | assistant")
    content: str


class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[AssistantTurn] = Field(default_factory=list, max_length=20)


class AssistantChatResponse(BaseModel):
    reply: str
    mode: str  # ai | kb
    suggestions: list[str]


@router.post("/chat", response_model=AssistantChatResponse, summary="Ask the site assistant")
def assistant_chat(
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
) -> AssistantChatResponse:
    result = assistant_service.chat(
        db,
        payload.message,
        [t.model_dump() for t in payload.history],
    )
    return AssistantChatResponse(**result)
