#!/bin/bash

GIT_DIR="$(dirname "$CONTAINER_WORKSPACE_FOLDER")"
printf "\nSetting git safe directory for: ${GIT_DIR}\n\n"
git config --global --add safe.directory $GIT_DIR

# Persist gcloud auth config
printf "\nSetting GCloud auth:\n\n"
if [ ! -d ~/.config ]; then mkdir ~/.config; fi
if [ -d ~/.config/gcloud ]; then rm -Rf ~/.config/gcloud; fi
ln -fs ~/.devcontainer-shared/gcloud-config ~/.config/gcloud
gcloud auth list

# Install python project libs
printf "\nInstalling python libraries:\n\n"
pip3 install --upgrade pip
pip3 install --user -r requirements.txt

exit 0
