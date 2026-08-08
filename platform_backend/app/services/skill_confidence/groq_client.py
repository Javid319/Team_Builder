"""
Groq AI client for Skill Assessment.

Two responsibilities:
1. generate_questions()  — produce 7 fresh questions based on experience level
2. evaluate_answers()    — score the user's answers and return detected skills
"""
import json
import re
from typing import Any

from groq import Groq

from app.core.config import settings

_client = Groq(api_key=settings.groq_api_key)
MODEL   = settings.groq_model

# ── Prompts ────────────────────────────────────────────────────

_GENERATE_PROMPT = """
You are a senior software engineer creating a short skill assessment.

Generate exactly 7 coding assessment questions for a {level} developer.
The user has listed these skills: {skills}.

IMPORTANT: Focus AT LEAST 5 of the 7 questions on the user's listed skills above.
The remaining 2 questions can cover related topics (e.g. if user knows Python, you can ask FastAPI or SQL).
Do NOT ask about completely unrelated technologies the user hasn't listed.

Question type distribution (use all four types):
- 2 × fill_in_code   : show code with one blank line marked __BLANK__, ask user to fill it
- 2 × debug          : show code with 1–2 bugs, ask user to identify and fix them
- 2 × mcq            : multiple choice with 4 options (a/b/c/d), one correct answer
- 1 × predict_output : show a short code snippet, ask what it prints/returns

Difficulty: {level}
- beginner:     basic syntax, simple functions, basic SQL SELECT, simple Git commands
- intermediate: decorators, async/await, SQL JOINs, REST design, OOP patterns
- experienced:  advanced async, query optimisation, system design trade-offs, Docker networking

Return ONLY a valid JSON array — no markdown, no explanation. Schema:
[
  {{
    "id": "q1",
    "type": "fill_in_code" | "debug" | "mcq" | "predict_output",
    "skills_tested": ["Python", "FastAPI"],
    "time_limit": 45,
    "question": "Question text here",
    "code_snippet": "code block if applicable, else null",
    "options": {{"a": "...", "b": "...", "c": "...", "d": "..."}} or null,
    "correct_answer": "the correct answer or option letter",
    "explanation": "brief explanation of the correct answer"
  }}
]
""".strip()


_EVALUATE_PROMPT = """
You are a senior software engineer evaluating a developer's skill assessment.

Experience level: {level}

Here are the 7 questions and the user's answers:
{qa_pairs}

For each skill demonstrated across all answers, return a confidence score (0.00–100.00).
Be fair but accurate. Partial credit is fine. A completely wrong answer scores 0.

Return ONLY a valid JSON array — no markdown, no explanation. Schema:
[
  {{
    "name": "Python",
    "confidence_score": 72.50,
    "confidence_level": "medium",
    "evidence_text": "Correctly identified the async bug but missed the missing await keyword"
  }}
]

confidence_level must be: "low" (0–40), "medium" (41–70), "high" (71–100)
Include only skills that were actually tested. Minimum 2 skills, maximum 8.
""".strip()


# ── Public functions ───────────────────────────────────────────

def generate_questions(experience_level: str, skills: list[str] | None = None) -> list[dict[str, Any]]:
    """
    Call Groq to generate 7 assessment questions focused on the user's skills.
    Returns a list of question dicts.
    """
    skills_str = ", ".join(skills) if skills else "general programming"
    prompt = _GENERATE_PROMPT.format(level=experience_level, skills=skills_str)

    resp = _client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=4096,
    )

    raw = resp.choices[0].message.content.strip()
    questions = _parse_json(raw)

    if not isinstance(questions, list) or len(questions) == 0:
        raise ValueError(f"Groq returned unexpected structure: {raw[:200]}")

    return questions


def evaluate_answers(
    experience_level: str,
    questions: list[dict[str, Any]],
    answers: list[dict[str, Any]],   # [{question_id, user_answer}]
) -> list[dict[str, Any]]:
    """
    Call Groq to evaluate the user's answers.
    Returns a list of skill dicts with confidence scores.
    """
    # Build the Q&A pairs string for the prompt
    qa_lines = []
    q_map = {q["id"]: q for q in questions}

    for ans in answers:
        q = q_map.get(ans["question_id"], {})
        qa_lines.append(
            f"Q ({q.get('type','')}, skills: {q.get('skills_tested',[])}): "
            f"{q.get('question','')}\n"
            f"Correct: {q.get('correct_answer','')}\n"
            f"User answered: {ans.get('user_answer','(no answer)')}\n"
        )

    prompt = _EVALUATE_PROMPT.format(
        level=experience_level,
        qa_pairs="\n---\n".join(qa_lines),
    )

    resp = _client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=2048,
    )

    raw = resp.choices[0].message.content.strip()
    skills = _parse_json(raw)

    if not isinstance(skills, list):
        raise ValueError(f"Groq evaluation returned unexpected structure: {raw[:200]}")

    return skills


# ── Internal ───────────────────────────────────────────────────

def _parse_json(text: str) -> Any:
    """Strip markdown fences and parse JSON."""
    # Remove ```json ... ``` or ``` ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$",          "", text, flags=re.MULTILINE)
    return json.loads(text.strip())
