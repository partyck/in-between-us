# Run from the repo root. Override any variable on the command line, e.g. `make deploy SERVICE=in-between-us-test`.
# gcloud runs with its own configuration (your private Google account) and an explicit project, never the active ones.
GCLOUD_CONFIG ?= in-between-us
PROJECT ?= chat-ai-2025
# europe-west1, because Cloud Run domain mappings only exist in some regions, and europe-central2 isn't one of them
REGION ?= europe-west1
SERVICE ?= in-between-us
# the custom subdomain for `make domain`, e.g. DOMAIN=<name>.porpatrick.com (porpatrick.com is verified for the account)
DOMAIN ?=
GCLOUD = gcloud --configuration=$(GCLOUD_CONFIG) --project=$(PROJECT)

.PHONY: run secrets station-key deploy domain gcp

# local server, with the keys from src/config.toml (deployment.md)
run:
	python3 src/main.py

# Creates the station key in Secret Manager, unless it exists: 16 hex characters, short enough to type on the iPads.
# The OpenAI key is added by hand (deployment.md), so this only checks that it's there.
secrets: gcp
	$(GCLOUD) secrets describe openai-api-key >/dev/null || { echo "No openai-api-key secret: see deployment.md"; exit 1; }
	$(GCLOUD) secrets describe station-key >/dev/null 2>&1 || \
		openssl rand -hex 8 | tr -d '\n' | $(GCLOUD) secrets create station-key --data-file=-

# prints the station key, to type on the iPads' setup screen
station-key: gcp
	@$(GCLOUD) secrets versions access latest --secret=station-key; echo

# Builds src/Dockerfile with Cloud Build and deploys it. One instance only: the pairing state lives in memory.
# --timeout=3600 is the longest Cloud Run keeps a WebSocket open. Both keys come from Secret Manager.
deploy: gcp
	$(GCLOUD) run deploy $(SERVICE) --region=$(REGION) --source=src \
		--allow-unauthenticated --cpu=1 --memory=512Mi --max-instances=1 --timeout=3600 \
		--set-secrets=OPENAI_API_KEY=openai-api-key:latest,STATION_KEY=station-key:latest

# Maps DOMAIN to the service. gcloud prints the DNS record to add in Cloudflare, and Google then issues the certificate.
domain: gcp
	@test -n "$(DOMAIN)" || { echo "No domain: set DOMAIN at the top of the Makefile or pass DOMAIN=<subdomain>"; exit 1; }
	$(GCLOUD) beta run domain-mappings create --service=$(SERVICE) --domain=$(DOMAIN) --region=$(REGION)

gcp:
	@test -n "$(PROJECT)" || { echo "No GCP project: set PROJECT at the top of the Makefile or pass PROJECT=<id>"; exit 1; }
