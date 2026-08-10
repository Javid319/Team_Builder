from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


from pydantic import field_validator


class ProjectObject(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    name: Optional[str] = None
    description: Optional[str] = None
    technologies: Optional[list[str]] = Field(default_factory=list)

    @field_validator("technologies", mode="before")
    @classmethod
    def coerce_technologies(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            return [v] if v.strip() else []
        return v


class HackathonObject(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    name: Optional[str] = None
    role: Optional[str] = None


class ExperienceObject(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    company: Optional[str] = None
    role: Optional[str] = None
    duration: Optional[str] = None
    description: Optional[str] = None


class EducationObject(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    institution: Optional[str] = None   # college / university / school
    degree: Optional[str] = None        # e.g. B.E., B.Tech, B.Sc
    course: Optional[str] = None        # e.g. Computer Science


def _coerce_list(v):
    """Coerce None or a bare string into a list."""
    if v is None:
        return []
    if isinstance(v, str):
        return [v] if v.strip() else []
    return v


class ResumeProfile(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    github_username: Optional[str] = None
    projects: Optional[list[ProjectObject]] = Field(default_factory=list)
    technical_skills: Optional[list[str]] = Field(default_factory=list)
    soft_skills: Optional[list[str]] = Field(default_factory=list)
    certifications: Optional[list[str]] = Field(default_factory=list)
    achievements: Optional[list[str]] = Field(default_factory=list)
    hackathons: Optional[list[HackathonObject]] = Field(default_factory=list)
    experience: Optional[list[ExperienceObject]] = Field(default_factory=list)
    education: Optional[list[EducationObject]] = Field(default_factory=list)

    @field_validator("projects", "hackathons", "experience", "education", mode="before")
    @classmethod
    def coerce_object_lists(cls, v):
        return _coerce_list(v)

    @field_validator("technical_skills", "soft_skills", "certifications", "achievements", mode="before")
    @classmethod
    def coerce_str_lists(cls, v):
        return _coerce_list(v)
