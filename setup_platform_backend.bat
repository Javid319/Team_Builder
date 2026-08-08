@echo off
echo Creating virtual environment for Platform Backend...
cd /d D:\HACKCOMP\platform_backend
python -m venv platform_venv
echo Activating virtual environment...
call platform_venv\Scripts\activate.bat
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Platform Backend environment setup complete!
echo.
echo To activate in the future, run:
echo cd D:\HACKCOMP\platform_backend
echo platform_venv\Scripts\activate.bat
echo uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause