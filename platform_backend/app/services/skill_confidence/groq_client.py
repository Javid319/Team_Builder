"""
Groq AI client for Skill Assessment.

Two responsibilities:
1. generate_questions()  — produce 10 fresh questions based on experience level
2. evaluate_answers()    — score the user's answers and return detected skills
"""
import json
import logging
import re
import threading
from typing import Any, List, Tuple

from groq import Groq

from app.core.config import settings

logger = logging.getLogger(__name__)
MODEL = settings.groq_model


class GroqKeyRotator:
    """
    Manages up to 5 rotating Groq API keys.
    Provides round-robin selection and automatic retry/failover across configured keys
    when rate limits or API errors occur.
    """

    def __init__(self, api_keys: List[str]):
        # Cap strictly at 5 keys maximum
        self.api_keys = [k.strip() for k in api_keys if k and k.strip()][:5]
        if not self.api_keys:
            raise ValueError("No valid Groq API keys provided for rotation.")

        self._clients = [Groq(api_key=key) for key in self.api_keys]
        self._index = 0
        self._lock = threading.Lock()

    @property
    def key_count(self) -> int:
        return len(self.api_keys)

    def get_next_client(self) -> Tuple[Groq, int, str]:
        """Thread-safe round-robin client retrieval."""
        with self._lock:
            idx = self._index % len(self._clients)
            self._index += 1
            client = self._clients[idx]
            key = self.api_keys[idx]
            masked_key = f"{key[:7]}...{key[-4:]}" if len(key) > 11 else "***"
            return client, idx, masked_key

    def execute_with_failover(self, call_fn) -> Any:
        """
        Executes call_fn(client) with round-robin start and failover retries across all keys.
        Attempts up to self.key_count times before giving up.
        """
        max_attempts = self.key_count
        attempts = 0
        last_exception = None

        with self._lock:
            start_idx = self._index % self.key_count
            self._index += 1

        for offset in range(max_attempts):
            idx = (start_idx + offset) % self.key_count
            client = self._clients[idx]
            key = self.api_keys[idx]
            masked_key = f"{key[:7]}...{key[-4:]}" if len(key) > 11 else "***"

            try:
                logger.info(f"Calling Groq API using Key [{idx + 1}/{self.key_count}] ({masked_key})")
                return call_fn(client)
            except Exception as e:
                attempts += 1
                last_exception = e
                logger.warning(
                    f"Groq API call failed on Key [{idx + 1}/{self.key_count}] ({masked_key}). "
                    f"Error: {str(e)}. Attempt {attempts}/{max_attempts}."
                )
                if attempts < max_attempts:
                    logger.info("Failing over to next available Groq key...")

        raise RuntimeError(f"All {max_attempts} Groq API keys failed. Last error: {str(last_exception)}") from last_exception


# Global rotator instance initialized with configured keys (up to 5 keys)
_rotator = GroqKeyRotator(settings.groq_api_keys_list)

# ── Prompts ────────────────────────────────────────────────────

_GENERATE_PROMPT = """
You are a senior software engineer creating a coding skill assessment.

Generate exactly 10 coding/technical questions for a {level} developer.
The user's technical skills are: {skills}.

STRICT RULES:
- ALL 10 questions MUST be from the skills listed above. No exceptions.
- Only ask about programming languages, frameworks, databases, tools, and technologies.
- Do NOT ask about soft skills, hobbies, sports, arts, dancing, music, or any non-technical topic.
- If a listed skill is not a technical/programming topic (e.g. "dancing", "cooking"), IGNORE it completely.
- If after filtering there are fewer than 2 valid technical skills, ask general Python, JavaScript, SQL, Git, REST API questions instead.
- Spread questions across different skills — do NOT ask all 10 about the same technology.

Question type distribution (use all four types):
- 3 × fill_in_code   : show code with one blank line marked __BLANK__, ask user to fill it
- 3 × debug          : show code with 1–2 bugs, ask user to identify and fix them
- 2 × mcq            : multiple choice with 4 options (a/b/c/d), one correct answer
- 2 × predict_output : show a short code snippet, ask what it prints/returns

Difficulty: {level}
- beginner:     basic syntax, simple functions, basic SQL SELECT, simple Git commands
- intermediate: decorators, async/await, SQL JOINs, REST design, OOP patterns
- experienced:  advanced async, query optimisation, system design trade-offs, Docker networking

Return ONLY a valid JSON array — no markdown, no explanation. Schema:
[
  {{
    "id": "q1",
    "type": "fill_in_code" | "debug" | "mcq" | "predict_output",
    "skills_tested": ["Python"],
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

Here are the 10 questions and the user's answers:
{qa_pairs}

STRICT SCORING RULES:
- Only report skills that appear in the "skills_tested" field of the questions above.
- Do NOT invent or add skills that were not tested in the questions.
- If the user left an answer blank, empty, or said "(no answer)" → score 0 for that question's skills.
- A completely wrong answer scores 0. Partial credit is fine for partial answers.
- If the user answered fewer than 3 questions, all confidence scores must be 40 or below.

Return ONLY a valid JSON array — no markdown, no explanation. Schema:
[
  {{
    "name": "AWS",
    "confidence_score": 29.00,
    "confidence_level": "low",
    "evidence_text": "Correctly answered 4 out of 10 questions, rest were unanswered"
  }}
]

confidence_level must be: "low" (0–40), "medium" (41–70), "high" (71–100)
Only include skills that appear in the skills_tested fields of the questions above.
Minimum 1 skill, maximum 8 skills.
""".strip()


# ── Public functions ───────────────────────────────────────────

# Known technical skills whitelist (lowercase) — anything not in this set is filtered out
_TECHNICAL_KEYWORDS = {
    "python", "javascript", "typescript", "java", "c", "c++", "c#", "go", "rust",
    "kotlin", "swift", "php", "ruby", "scala", "r", "dart", "flutter", "html", "css",
    "react", "next.js", "vue.js", "angular", "redux", "tailwind", "bootstrap",
    "fastapi", "django", "flask", "node.js", "express", "spring", "nestjs", "graphql",
    "postgresql", "mysql", "mongodb", "redis", "sqlite", "supabase", "firebase",
    "docker", "kubernetes", "aws", "gcp", "azure", "terraform", "linux", "nginx",
    "git", "github actions", "ci/cd", "rest", "rest apis", "websockets",
    "machine learning", "deep learning", "tensorflow", "pytorch", "scikit-learn",
    "pandas", "numpy", "langchain", "openai", "sql", "bash", "shell",
    "figma", "postman", "elasticsearch", "kafka", "rabbitmq",
}


def _filter_technical_skills(skills: list[str]) -> list[str]:
    """Keep only skills that are programming/tech related."""
    return [
        s for s in skills
        if any(kw in s.lower() for kw in _TECHNICAL_KEYWORDS)
        or any(s.lower() in kw for kw in _TECHNICAL_KEYWORDS)
    ]


def generate_questions(experience_level: str, skills: list[str] | None = None) -> list[dict[str, Any]]:
    """
    Call Groq to generate 10 assessment questions focused on the user's technical skills.
    Non-technical skills (hobbies, soft skills) are filtered out before sending to Groq.
    Returns a list of question dicts.
    """
    # Filter to only technical skills
    technical_skills = _filter_technical_skills(skills or [])
    skills_str = ", ".join(technical_skills) if technical_skills else "Python, JavaScript, SQL, Git, REST APIs"

    prompt = _GENERATE_PROMPT.format(level=experience_level, skills=skills_str)

    def _call(client: Groq):
        return client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=4096,
        )

    resp = _rotator.execute_with_failover(_call)

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
            f"Q (type={q.get('type','')}, skills_tested={q.get('skills_tested',[])}): "
            f"{q.get('question','')}\n"
            f"Correct answer: {q.get('correct_answer','')}\n"
            f"User answered: {ans.get('user_answer','') or '(no answer — blank/skipped)'}\n"
        )

    prompt = _EVALUATE_PROMPT.format(
        level=experience_level,
        qa_pairs="\n---\n".join(qa_lines),
    )

    def _call(client: Groq):
        return client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2048,
        )

    resp = _rotator.execute_with_failover(_call)

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
