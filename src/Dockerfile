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

# gunicorn listens on 0.0.0.0:$PORT. Cloud Run sets PORT itself, and this default is for running the image locally.
ENV PORT=8080
# One worker, because the pairing state lives in its memory. Each open WebSocket or long-poll holds a thread. 100 is
# more than the 80 requests Cloud Run sends an instance at a time, so Cloud Run's limit is the one open connections run
# into first (D6), and threads only start when they're needed. --timeout 0 turns off gunicorn's worker timeout,
# as in Google's Cloud Run samples, and leaves timeouts to Cloud Run. --no-control-socket turns off the socket through
# which gunicornc can add workers at runtime, which would split the pairing state, and which would be created in the home
# directory the user app doesn't have.
CMD ["gunicorn", "--workers", "1", "--threads", "100", "--timeout", "0", "--no-control-socket", "main:app"]
