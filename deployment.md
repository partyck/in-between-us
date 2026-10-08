# Deployment

The server runs on Cloud Run as a single instance, from the image built with [src/Dockerfile](src/Dockerfile). The two installations are iPads running the page as a home-screen app, each set up once as station A or B with the station key (see [Setting up the installations](#setting-up-the-installations)).

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

## Values used below

Run the commands from the repo root. Set these once per shell:

```bash
PROJECT_ID=<project id>
REGION=<region, e.g. europe-west1>
SERVICE=<Cloud Run service name>
REPO=<Artifact Registry repository>
IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/in-between-us
gcloud config set project $PROJECT_ID
SA=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com
```

`SA` is the default compute service account, which Cloud Run uses unless the service has its own. To check, run `gcloud run services describe $SERVICE --region $REGION --format='value(spec.template.spec.serviceAccountName)'`. If it prints a different account, use that one.

## One-time setup

1. Enable the APIs:

   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
   ```

2. Create the Artifact Registry repository, unless it exists:

   ```bash
   gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION
   ```

3. Store the OpenAI key in Secret Manager, and let the service account read it. Paste the key at the prompt: it isn't echoed and stays out of the shell history. `printf '%s'` matters, because a trailing newline would become part of the key.

   ```bash
   read -rs OPENAI_KEY; printf '%s' "$OPENAI_KEY" | gcloud secrets create openai-api-key --data-file=-; unset OPENAI_KEY
   gcloud secrets add-iam-policy-binding openai-api-key --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
   ```

4. Create the station key, which the two installations send to be let in. It's typed on each iPad, so this makes a short hex one: 16 characters, which is still far too many to guess over the network.

   ```bash
   openssl rand -hex 8 | tr -d '\n' | gcloud secrets create station-key --data-file=-
   gcloud secrets add-iam-policy-binding station-key --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
   ```

5. Give the service account Firestore access. The server writes the sender's slider color to `color/color` on every message. The default compute account often has Editor, which already covers this.

   ```bash
   gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SA --role=roles/datastore.user
   ```

   A failed write doesn't stop the chat. It's only logged, as `could not save color`.

6. Set a budget limit on the OpenAI project, in the OpenAI dashboard. The server holds each station to 20 messages a minute, at two OpenAI calls each, but only the budget limit caps the total.

## Deploy

1. Build the image with Cloud Build. `src` is the build context, and `.gcloudignore` decides what's uploaded. Commit first, so the tag matches the code.

   ```bash
   TAG=$(git rev-parse --short HEAD)
   gcloud builds submit src --tag $IMAGE:$TAG
   ```

2. Deploy it:

   ```bash
   gcloud run deploy $SERVICE --image $IMAGE:$TAG --region $REGION \
     --allow-unauthenticated \
     --max-instances=1 \
     --timeout=3600 \
     --set-secrets=OPENAI_API_KEY=openai-api-key:latest,STATION_KEY=station-key:latest
   ```

   Cloud Run keeps these settings on the service, so once they're set, later deploys only need `--image` and `--region`. Never add `DEBUG` to the service's environment variables.

   If the service was deployed before the station key existed (S8 in [todo.md](todo.md)), add it on the first deploy after that change with `--update-secrets=STATION_KEY=station-key:latest`. `--set-secrets` replaces the service's whole secret list. Without the key, the new revision fails to start.

   | Flag | Why |
   | --- | --- |
   | `--allow-unauthenticated` | The installations open the URL without signing in. |
   | `--max-instances=1` | Pairing state is in memory. A second instance has its own waiting slot and can leave the installations unable to reach each other (D5 in [todo.md](todo.md)). |
   | `--timeout=3600` | Cloud Run closes WebSockets at the request timeout, 5 minutes by default, which clears the chat. 60 minutes is the maximum (D2). |
   | `--set-secrets` | Sets `OPENAI_API_KEY` and `STATION_KEY` from Secret Manager. `latest` is read when an instance starts. |

3. Check it:

   ```bash
   URL=$(gcloud run services describe $SERVICE --region $REGION --format='value(status.url)')
   curl -s -o /dev/null -w "%{http_code}\n" $URL/          # 200
   curl -s -o /dev/null -w "%{http_code}\n" $URL/console   # 404: no debugger
   ```

   Then check that the two installations pair. Pairing state lives in memory, so a deploy ends any chat in progress, and the installations log in again when they reconnect. Opening `$URL/` in any other browser should show the "Set up this installation" screen.

If the new revision fails to start, for example because the secret is missing or the service account can't read it, Cloud Run keeps serving the previous revision. The error is in the service's logs.

## Setting up the installations

Get the station key with `gcloud secrets versions access latest --secret=station-key`. Then, on each iPad:

1. Open the service URL in Safari, and add it to the home screen (Share, then Add to Home Screen).
2. Open the app from the home screen. It shows "Set up this installation".
3. Choose `A` on one iPad and `B` on the other, type the key, and press ok. Once the server accepts them, the app goes to the home screen.

- Do step 3 inside the home-screen app, not in Safari. iOS keeps the app's storage separate from Safari's, so a setup done in Safari doesn't carry over.
- The station and key are saved in the app's `localStorage`, so it only has to be done once. Removing the app from the home screen deletes them.
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

2. The new revision refuses the old key, so both iPads go back to the setup screen when they reconnect. Choose their station again and type the new key.
3. Disable the old version, as for the OpenAI key.

## Cleaning up after the S3 fix (one time)

Until S3 was fixed, `config.toml` was copied into every image, and `gcloud builds submit` uploaded it to Cloud Build. Anyone who can pull those images or read that bucket can read the key.

1. Rotate the OpenAI key, as above. This is the step that matters: it makes the old copies useless.
2. Once the new revision is serving, delete the old images, wherever they were pushed. For Artifact Registry:

   ```bash
   gcloud artifacts docker images list $IMAGE --include-tags
   gcloud artifacts docker images delete $IMAGE@<digest> --delete-tags
   ```

3. Delete the old Cloud Build source archives:

   ```bash
   gcloud storage ls gs://${PROJECT_ID}_cloudbuild/source/
   gcloud storage rm "gs://${PROJECT_ID}_cloudbuild/source/*"
   ```

Revisions that used the deleted images can't be rolled back to afterwards. They would use the revoked key anyway.

## Local development

- The dev container sets `DEBUG=1` in [devcontainer.json](.devcontainer/devcontainer.json). Rebuild the container after changing it.
- Put the keys in `src/config.toml`. The station key can be anything locally:

  ```toml
  openai_api_key = "sk-..."
  station_key = "dev"
  ```

- Open the two stations in two tabs, e.g. `http://localhost:8080/#station=A&key=dev` and `http://localhost:8080/#station=B&key=dev`. On devices, set them up on the setup screen instead.

- Firestore uses your Application Default Credentials (`gcloud auth application-default login`). The dev container links `~/.config/gcloud` to `~/.devcontainer-shared/gcloud-config` on the host, so the login survives rebuilds. When the credentials expire, color writes fail and are logged.
- Start the server with `python3 src/main.py`, from any directory. Port 8080 is published on all of your machine's network interfaces, so the installation devices can open `http://<your machine's IP>:8080` on the same network.

## Not handled yet

These are open in [todo.md](todo.md):

- **D1:** the image is built on the dev container image, runs as root, and installs packages nothing uses.
- **D4:** there's no health check, so nobody notices when a kiosk's browser crashes.
- **D6:** the service keeps Cloud Run's default of 80 requests at a time, and each open WebSocket holds one, so enough idle connections can keep the iPads out.