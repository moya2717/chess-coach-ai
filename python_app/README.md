# Chess Coach Python App

This folder contains a Python-first interactive version of Chess Coach built with Streamlit.

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
