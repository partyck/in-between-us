#!/bin/bash

# Check gcloud shared config
printf "\nChecking gcloud shared config:\n"

if [ ! -d ~/.devcontainer-shared ]; then
    mkdir ~/.devcontainer-shared
fi

if [ ! -d ~/.devcontainer-shared/gcloud-config ]; then
    mkdir ~/.devcontainer-shared/gcloud-config
fi

# --------- END ---------
printf "\nDone.\n"
exit 0
