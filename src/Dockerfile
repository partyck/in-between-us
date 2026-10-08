# Python 3.11, like the dev container. The slim image has no compilers or dev tools, so every requirement has to install
# from a wheel or be pure Python.
FROM python:3.11-slim-trixie

# Logs go straight to Cloud Run instead of waiting in a buffer. pip keeps no cache in the image.
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /chat-ai
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

COPY . .

# The code belongs to root and the server runs as a user without privileges, so it can't change its own code or the
# installed packages.
RUN useradd --system --no-create-home app
USER app

CMD ["python", "main.py"]
