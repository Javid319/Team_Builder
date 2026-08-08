@echo off
echo Creating virtual environment for Resume Engine...
cd /d D:\HACKCOMP\resume_engine
python -m venv resume_venv
echo Activating virtual environment...
call resume_venv\Scripts\activate.bat
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Resume Engine environment setup complete!
echo.
echo To activate in the future, run:
echo cd D:\HACKCOMP\resume_engine
echo resume_venv\Scripts\activate.bat
echo cd backend
echo uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
pause