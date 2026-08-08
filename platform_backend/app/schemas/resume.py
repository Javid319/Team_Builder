from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class ResumeOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    original_filename: str
    file_path: str
    content_type: Optional[str]
    is_current: bool
    parsed_text: Optional[str]
    parse_status: Optional[str]
    uploaded_at: datetime

    model_config = {"from_attributes": True}
