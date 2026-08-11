"""
AI-powered Team Recommendation report generator (Groq).

Builds a personalized "Improve Team Recommendations" report from the user's
profile, personality assessment, and collaboration assessment.
"""
import json
import logging
import re
from typing import Any, Dict

from groq import Groq

from app.core.config import settings
from app.services.skill_confidence.groq_client import _rotator, MODEL

logger = logging.getLogger(__name__)


_PROMPT = """
You are an expert team-match analyst for a hackathon team formation platform.

Use the developer's profile, personality and collaboration assessment to write a
personalized report that helps improve how well this developer is recommended
to (and fits within) teams.

DEVELOPER PROFILE:
- Skills: {skills}
- Experience level: {experience_level}
- College degree / department: {degree}

PERSONALITY ASSESSMENT:
- Big Five scores: {personality_scores}
- Work style: {work_style}
- Communication style: {communication_style}
- Preferred role: {preferred_role}
- Strengths: {strengths}

COLLABORATION ASSESSMENT (team dimension percentages):
{collaboration_dimensions}

STRICT RULES:
- Be specific and actionable, grounded in the data above. Do not invent skills.
- The report is for the developer themselves, to understand how to stand out
  to team leads and match well with teammates.
- 3-5 strengths, 3-5 improvements, 2-4 ideal roles, 3-5 tips.
- Return ONLY a valid JSON object — no markdown, no explanation:
{{
  "summary": "2-3 sentence overview of this developer's team fit",
  "strengths": ["..."],
  "improvements": ["specific, actionable improvement suggestions"],
  "ideal_roles": ["team roles this developer fits best"],
  "tips": ["practical tips to improve team recommendations"]
}}
""".strip()


def generate_report(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Call Groq to generate the team recommendation report.
    Returns a dict matching RecommendationContent.
    """
    collab_lines = "\n".join(
        f"- {dim}: {pct}%" for dim, pct in context.get("collaboration_dimensions", {}).items()
    )

    prompt = _PROMPT.format(
        skills=", ".join(context.get("skills", [])) or "none declared",
        experience_level=context.get("experience_level", "unknown"),
        degree=context.get("degree", ""),
        personality_scores=json.dumps(context.get("personality_scores", {})),
        work_style=context.get("work_style", ""),
        communication_style=context.get("communication_style", ""),
        preferred_role=context.get("preferred_role", ""),
        strengths=", ".join(context.get("strengths", [])) or "none",
        collaboration_dimensions=collab_lines or "not completed",
    )

    def _call(client: Groq):
        return client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=2048,
        )

    resp = _rotator.execute_with_failover(_call)

    raw = resp.choices[0].message.content.strip()
    data = _parse_json(raw)

    if not isinstance(data, dict):
        raise ValueError(f"Groq recommendation returned unexpected structure: {raw[:200]}")

    return data


def _parse_json(text: str) -> Any:
    """Strip markdown fences and parse JSON."""
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    return json.loads(text.strip())
