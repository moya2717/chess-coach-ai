# Chess Coach Python App

Python-first interactive Chess Coach built with Streamlit.

## What's improved

- Per-game performance metrics (issue counts, blunders, largest material drop)
- Actionable focus guidance based on recurring issue severity
- Auto-generated short training plan tied to detected game issues

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r python_app/requirements.txt
streamlit run python_app/app.py
```

## Test

```bash
PYTHONPATH=python_app pytest python_app/tests -q
```
