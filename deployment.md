# Deployment

The server runs on Cloud Run as a single instance, from the image built with [src/Dockerfile](src/Dockerfile): `python:3.11-slim` with the packages pinned in [requirements.txt](src/requirements.txt) (see [Updating dependencies](#updating-dependencies)), running the server as an unprivileged user. The service is `in-between-us` in `europe-west1`, in the GCP project `chat-ai-2025`, and the [Makefile](Makefile) deploys it. The two installations are iPads running the page as a home-screen app, each set up once as station A or B with the station key (see [Setting up the installations](#setting-up-the-installations)).

## Configuration

| Setting | Cloud Run | Local development |
| --- | --- | --- |
| OpenAI key | `OPENAI_API_KEY`, from Secret Manager | `openai_api_key` in `src/config.toml`, or `OPENAI_API_KEY`, which wins if both are set |
| Station key | `STATION_KEY`, from Secret Manager | `station_key` in `src/config.toml`, or `STATION_KEY`, which wins if both are set |
| `DEBUG` | Never set | `1`, set by the dev container |
| `PORT` | Set by Cloud Run | 8080 |
| Firestore credentials | The service's service account | Your gcloud Application Default Credentials |

- `DEBUG=1` turns on the reloader, request logs and template reloading. Werkzeug's interactive debugger is never used, in any environment, because in eventlet mode it serves a Python console at `/console`.
- `src/config.toml` is gitignored. [.dockerignore](src/.dockerignore) and [.gcloudignore](src/.gcloudignore) keep it, `.env` and `__pycache__` out of the image and out of the Cloud Build upload. Keep the two files in sync.
- With no key from either source, the server fails at startup with OpenAI's "The api_key client option must be set" error.
- Without a station key, it fails at startup with `STATION_KEY is not set`. Only a page that sends the right station key can open a socket, so without one no installation could connect.

## The Makefile

Run `make` from the repo root.

| Target | What it does |
| --- | --- |
| `make run` | Starts the local server, with the keys from `src/config.toml`. |
| `make secrets` | Creates the station key in Secret Manager, unless it exists, and checks that the OpenAI key is there. |
| `make station-key` | Prints the station key, to type on the iPads. |
| `make deploy` | Builds `src` with Cloud Build and deploys it to Cloud Run. |
| `make domain DOMAIN=<subdomain>` | Maps a custom subdomain to the service. |

- Every gcloud command in the Makefile uses the gcloud configuration `in-between-us`, which has the authors' private Google account, and the project `chat-ai-2025`. It never uses the active configuration or project, because on the dev Mac those are a work account.
- The variables at the top can be overridden on the command line, e.g. `make deploy SERVICE=in-between-us-test`.
- The region is `europe-west1`, because Cloud Run domain mappings only exist in some regions, and `europe-central2`, where the service used to run, isn't one of them. The Firestore database is in `nam5`, which doesn't matter: the color is written after the reply is sent.

For the gcloud commands in the rest of this file, set these once per shell. `CLOUDSDK_ACTIVE_CONFIG_NAME` makes gcloud use the configuration in this shell only.

```bash
export CLOUDSDK_ACTIVE_CONFIG_NAME=in-between-us
SERVICE=in-between-us
REGION=europe-west1
```

## One-time setup

1. Create the gcloud configuration, sign in with the private Google account, and set the project. Creating a configuration makes it the active one. `gcloud config configurations activate default` switches back.

   ```bash
   gcloud config configurations create in-between-us
   gcloud auth login
   gcloud config set project chat-ai-2025
   ```

2. Enable the APIs. They're already enabled in `chat-ai-2025`.

   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
   ```

3. Store the OpenAI key in Secret Manager as `openai-api-key`. Paste the key at the prompt: it isn't echoed and stays out of the shell history. `printf '%s'` matters, because a trailing newline would become part of the key.

   ```bash
   read -rs OPENAI_KEY; printf '%s' "$OPENAI_KEY" | gcloud secrets create openai-api-key --data-file=-; unset OPENAI_KEY
   ```

4. Create the station key, which the two installations send to be let in. It's typed on each iPad, so `make secrets` makes a short hex one: 16 characters, which is still far too many to guess over the network.

   ```bash
   make secrets
   ```

5. Check that the service account can read the secrets and write to Firestore. The service runs as the default compute service account. In `chat-ai-2025` it has Secret Manager Secret Accessor on the whole project, and Editor, which covers Firestore. In a project where it doesn't, grant the roles:

   ```bash
   SA=$(gcloud projects describe chat-ai-2025 --format='value(projectNumber)')-compute@developer.gserviceaccount.com
   gcloud projects add-iam-policy-binding chat-ai-2025 --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
   gcloud projects add-iam-policy-binding chat-ai-2025 --member=serviceAccount:$SA --role=roles/datastore.user
   ```

   The server writes the sender's slider color to `color/color` on every message. A failed write doesn't stop the chat. It's only logged, as `could not save color`.

6. Set a budget limit on the OpenAI project, in the OpenAI dashboard. The server holds each station to 20 messages a minute, at two OpenAI calls each, but only the budget limit caps the total.

## Deploy

1. Deploy:

   ```bash
   make deploy
   ```

   It uploads `src` as it is in the working tree, uncommitted changes included. `.gcloudignore` decides what's left out. Cloud Build builds the Dockerfile and stores the image in the Artifact Registry repository `cloud-run-source-deploy`. On the first deploy, gcloud asks to create that repository in `europe-west1`.

   Every deploy sets all of these flags again, so the service always has them. Never add `DEBUG` to the service's environment variables.

   | Flag | Why |
   | --- | --- |
   | `--source=src` | Builds the image with Cloud Build, from [src/Dockerfile](src/Dockerfile). |
   | `--allow-unauthenticated` | The installations open the URL without signing in. |
   | `--cpu=1 --memory=512Mi` | Below 1 vCPU, Cloud Run allows only one request per instance at a time, and each installation keeps a WebSocket open. |
   | `--max-instances=1` | Pairing state is in memory. A second instance has its own waiting slot and can leave the installations unable to reach each other (D5 in [todo.md](todo.md)). |
   | `--timeout=3600` | Cloud Run closes WebSockets at the request timeout, 5 minutes by default, which clears the chat. 60 minutes is the maximum (D2). |
   | `--set-secrets` | Sets `OPENAI_API_KEY` and `STATION_KEY` from Secret Manager. `latest` is read when an instance starts. |

   There's no `--min-instances`. With nobody connected, the service scales to zero, and the next page load waits for the server to start.

2. Check it:

   ```bash
   URL=$(gcloud run services describe $SERVICE --region $REGION --format='value(status.url)')
   curl -s -o /dev/null -w "%{http_code}\n" $URL/          # 200
   curl -s -o /dev/null -w "%{http_code}\n" $URL/console   # 404: no debugger
   ```

   Then check that the two installations pair. Pairing state lives in memory, so a deploy ends any chat in progress, and the installations log in again when they reconnect. Opening `$URL/` in any other browser should show the "Set up this installation" screen.

If the new revision fails to start, for example because a secret is missing or the service account can't read it, Cloud Run keeps serving the previous revision. The error is in the service's logs.

## Custom domain

1. Map the subdomain to the service:

   ```bash
   make domain DOMAIN=<subdomain>.porpatrick.com
   ```

   Domain mappings are still a beta command in gcloud. `porpatrick.com` is verified for the private Google account. A domain under another parent needs `gcloud domains verify <domain>` first.

2. gcloud prints the DNS record to add, a `CNAME` to `ghs.googlehosted.com.`. Add it in Cloudflare as DNS only (the grey cloud), not proxied. Google only issues the certificate once the name points to its servers.
3. Wait for the certificate. It takes from a few minutes up to a day. This shows its state:

   ```bash
   gcloud beta run domain-mappings describe --domain=<subdomain>.porpatrick.com --region=$REGION
   ```

The run.app URL keeps working alongside the domain.

## Earlier setup (removed)

Until 2026-10-08 the service was `chat-ai1` in `europe-central2`, deployed from images that `gcloud builds submit` pushed to the Artifact Registry repository `chat-ai-repo`. Cloud Run can't move a service to another region, so `in-between-us` in `europe-west1` is a new service. Once it ran, the old service, the repository and the old Cloud Build uploads in `gs://chat-ai-2025_cloudbuild/source/` were deleted on 2026-10-08.

The images and uploads made before the S3 fix contained `config.toml`, and the OpenAI key in it. That key was revoked in the OpenAI dashboard on the same day, and `openai-api-key` now holds a new one.

## Setting up the installations

Get the station key with `make station-key`. Then, on each iPad:

1. Open the custom domain in Safari, and add it to the home screen (Share, then Add to Home Screen).
2. Open the app from the home screen. It shows "Set up this installation".
3. Choose `A` on one iPad and `B` on the other, type the key, and press ok. Once the server accepts them, the app goes to the home screen.

- Do step 3 inside the home-screen app, not in Safari. iOS keeps the app's storage separate from Safari's, so a setup done in Safari doesn't carry over.
- The station and key are saved in the app's `localStorage`, so it only has to be done once. Removing the app from the home screen deletes them.
- The storage belongs to the address the app was added from. An app added from the run.app URL and one added from the custom domain are set up separately, so add the apps once the domain works. Apps added from the old `chat-ai1` URL no longer work: remove them.
- The server only pairs station A with station B. If it refuses the station or key, the app goes back to the setup screen with "The server refused this station or key."
- If both iPads are set up as the same station, the one that connected last takes it. The other shows "This installation was opened on another screen." with two buttons: "Use this screen" takes the station back, and "Change station" goes back to setup. That screen doesn't reload by itself, so two screens set up as the same station don't keep taking it from each other.
- There's no way back to setup while the app works normally, so a visitor can't reach it. To change a working iPad's station, remove the app from the home screen and add it again.
- On a computer, a `#station=A&key=<key>` fragment on the URL overrides the saved station, which helps when testing both stations in one browser. It never reaches the server or its logs.

## Rotating the OpenAI key

1. Create a new key in the OpenAI dashboard, and add it as a new secret version:

   ```bash
   read -rs OPENAI_KEY; printf '%s' "$OPENAI_KEY" | gcloud secrets versions add openai-api-key --data-file=-; unset OPENAI_KEY
   ```

2. Start a new revision, which reads the new version:

   ```bash
   gcloud run services update $SERVICE --region $REGION --update-secrets=OPENAI_API_KEY=openai-api-key:latest
   ```

3. Once messages go through, revoke the old key in the OpenAI dashboard, and disable the old version:

   ```bash
   gcloud secrets versions list openai-api-key
   gcloud secrets versions disable <old version> --secret=openai-api-key
   ```

## Rotating the station key

Rotate it if the key leaks.

1. Add a new version, and start a new revision, which reads it:

   ```bash
   openssl rand -hex 8 | tr -d '\n' | gcloud secrets versions add station-key --data-file=-
   gcloud run services update $SERVICE --region $REGION --update-secrets=STATION_KEY=station-key:latest
   ```

2. The new revision refuses the old key, so both iPads go back to the setup screen when they reconnect. Choose their station again and type the new key, from `make station-key`.
3. Disable the old version, as for the OpenAI key.

## Local development

- The dev container sets `DEBUG=1` in [devcontainer.json](.devcontainer/devcontainer.json). Rebuild the container after changing it.
- Put the keys in `src/config.toml`. The station key can be anything locally:

  ```toml
  openai_api_key = "sk-..."
  station_key = "dev"
  ```

- Open the two stations in two tabs, e.g. `http://localhost:8080/#station=A&key=dev` and `http://localhost:8080/#station=B&key=dev`. On devices, set them up on the setup screen instead.

- Firestore uses your Application Default Credentials (`gcloud auth application-default login`). The dev container links `~/.config/gcloud` to `~/.devcontainer-shared/gcloud-config` on the host, so the login survives rebuilds. When the credentials expire, color writes fail and are logged.
- Start the server with `make run` from the repo root, or `python3 src/main.py` from any directory. Port 8080 is published on all of your machine's network interfaces, so the installation devices can open `http://<your machine's IP>:8080` on the same network.
- The dev container installs [requirements.txt](src/requirements.txt) when it's created. After the requirements change, run `pip3 install --user -r src/requirements.txt` in it, or rebuild it.

## Updating dependencies

[requirements.in](src/requirements.in) lists the packages the code imports. [requirements.txt](src/requirements.txt) is generated from it with pip-compile. It pins every package the image installs, and notes which package needs each one. Change requirements.in, never requirements.txt by hand.

Run pip-compile on Python 3.11, like the image, because it resolves for the Python it runs on. In the dev container:

```bash
pip3 install --user pip-tools pip-audit
cd src
pip-compile --strip-extras --no-emit-index-url requirements.in             # after changing requirements.in
pip-compile --strip-extras --no-emit-index-url --upgrade requirements.in   # or: every package to its newest allowed version
pip-audit --no-deps --disable-pip -r requirements.txt                      # known advisories
```

On the Mac, without the dev container, the same commands run in Docker:

```bash
docker run --rm -v "$PWD/src:/src" -w /src python:3.11-slim sh -c 'pip install -q pip-tools pip-audit && pip-compile --strip-extras --no-emit-index-url requirements.in && pip-audit --no-deps --disable-pip -r requirements.txt'
```

- Run pip-audit now and then, not only after a change: advisories are published against versions that are already pinned. `pip-compile --upgrade-package <name> …` moves only the packages it names.
- `openai` and `pydantic` are pinned in requirements.in at the versions the prompts were tried with. Upgrade them on purpose, and send a few messages through OpenAI afterwards.
- After an upgrade, test both stations locally and read the server log. [`on_error`](src/main.py#L163-L171) catches every exception in a handler, so a library that calls a handler differently only shows up there as a traceback. That's how Flask-SocketIO's new `disconnect` argument was caught (D1 in [todo.md](todo.md)).
- eventlet prints an `EventletDeprecationWarning` at startup. That's expected (A2).

## Not handled yet

These are open in [todo.md](todo.md):

- **D4:** there's no health check, so nobody notices when a kiosk's browser crashes.
- **D6:** the service keeps Cloud Run's default of 80 requests at a time, and each open WebSocket holds one, so enough idle connections can keep the iPads out.
