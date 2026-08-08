# HACKCOMP - Hackathon Team Formation Platform

A comprehensive platform for hackathon team formation with resume parsing, GitHub skill verification, and AI-powered collaboration assessment.

## Project Structure

```
HACKCOMP/
├── platform_backend/      # Collaboration platform + Frontend
│   ├── app/              # FastAPI application
│   ├── alembic/          # Database migrations
│   ├── frontend/         # HTML/CSS/JS frontend
│   ├── requirements.txt  
│   └── .env             
│
└── resume_engine/        # Resume parser + GitHub verification
    ├── backend/          # FastAPI resume parsing API
    ├── github_verification_experiment/
    ├── requirements.txt  
    └── .env              
```

## Features

### 1. Resume Parser Engine
- **PDF parsing** with PyMuPDF
- **LLM-powered extraction** using Groq (llama-3.1-8b-instant)
- Extracts: technical skills, soft skills, projects, experience, hackathons, certifications
- **Automatic GitHub username detection** from resume text

### 2. GitHub Skill Verification
- Fetches user's repositories via GitHub GraphQL API
- Analyzes languages, dependencies, README content, topics
- Matches resume skills against GitHub evidence
- **Confidence scoring** (0-100) based on:
  - Evidence source weights (dependency=4, topic=3, readme=2, language=1)
  - Number of unique repositories
  - Number of unique evidence sources

### 3. Platform Backend
- User authentication & profiles
- Skill assessment system
- **AI-powered collaboration analysis** using Groq (llama-3.3-70b-versatile)
- Team formation recommendations
- PostgreSQL database (Supabase)

## Setup

### Prerequisites
- Python 3.11+
- PostgreSQL (or Supabase account)
- Groq API keys
- GitHub Personal Access Token (classic)

### 1. Platform Backend

```cmd
cd platform_backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Configure .env
# - DATABASE_URL (Supabase)
# - GROQ_API_KEY (llama-3.3-70b-versatile)
# - SECRET_KEY

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Access:**
- Frontend: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 2. Resume Engine

```cmd
cd resume_engine/backend
python -m venv ../.venv
..\.venv\Scripts\activate
pip install -r ../requirements.txt

# Configure .env
# - LLM_API_KEY (Groq - llama-3.1-8b-instant)
# - GITHUB_TOKEN (classic PAT with repo + read:user scopes)

# Start server
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**Access:**
- API Docs: http://localhost:8001/docs
- Endpoint: `POST /parse` (upload PDF + optional github_username)

## API Usage

### Resume Parser + GitHub Verification

```bash
curl -X POST "http://localhost:8001/parse" \
  -F "file=@resume.pdf" \
  -F "github_username=YourGitHubUsername"
```

**Response:**
```json
{
  "resume_profile": {
    "technical_skills": ["Python", "FastAPI", "React", ...],
    "soft_skills": ["Leadership", "Communication", ...],
    "projects": [...],
    "experience": [...],
    "hackathons": [...],
    "certifications": [...]
  },
  "github_verification": {
    "status": "completed",
    "username": "YourGitHubUsername",
    "matched_skills": [
      {
        "resume_skill": "Python",
        "github_skill": "Python",
        "confidence": {
          "score": 95,
          "level": "VERY_HIGH"
        },
        "evidence": [...]
      }
    ],
    "unmatched_skills": [...],
    "statistics": {
      "resume_skills_count": 25,
      "matched_count": 20,
      "unmatched_count": 5,
      "verification_percentage": 80.0
    }
  }
}
```

## GitHub API Rate Limits

- **5,000 requests/hour** with authenticated classic PAT
- **Per user:** ~26-41 requests (average ~26)
- **100 users:** ~2,600 requests (~30 minutes)

## Tech Stack

**Backend:**
- FastAPI
- SQLAlchemy + PostgreSQL
- Groq API (LLM)
- GitHub GraphQL & REST APIs
- PyMuPDF (PDF parsing)
- Pydantic (validation)

**Frontend:**
- Vanilla JavaScript
- HTML/CSS
- Fetch API

**Database:**
- PostgreSQL (Supabase)
- Alembic migrations

## Environment Variables

### Platform Backend (.env)
```
APP_NAME="Hackathon Team Formation Platform"
DATABASE_URL=postgresql://...
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

### Resume Engine (.env)
```
LLM_API_KEY=gsk_...
LLM_ENDPOINT=https://api.groq.com/openai/v1/chat/completions
LLM_MODEL=llama-3.1-8b-instant
GITHUB_TOKEN=ghp_...
```

## Development Notes

- **Fine-grained GitHub PATs don't work with GraphQL** — use classic PATs
- **bcrypt has 72 byte password limit** — consider using shorter passwords or switching to argon2
- **Resume parser handles chunking** for long resumes automatically
- **Skill normalization** is built-in (e.g., "FastApi" → "FastAPI")

## License

MIT
