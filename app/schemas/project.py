from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

from app.models.project import ProjectSource


class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    technologies: Optional[str] = None       # JSON string, e.g. '["Python","FastAPI"]'
    github_repo_url: Optional[str] = None
    source: ProjectSource = ProjectSource.manual


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    technologies: Optional[str] = None
    github_repo_url: Optional[str] = None


class ProjectOut(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str]
    technologies: Optional[str]
    github_repo_url: Optional[str]
    source: ProjectSource
    created_at: datetime

    model_config = {"from_attributes": True}
