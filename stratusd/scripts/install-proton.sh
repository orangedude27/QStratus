#!/bin/bash
set -e

mkdir -p /opt/steamcmd/Proton

if [ "$PROTON_VERSION" = "latest" ]; then
    PROTON_VERSION=$(curl -s https://api.github.com/repos/ValveSoftware/Proton/releases/latest 2>/dev/null | grep '"tag_name"' | sed 's/.*"tag_name": *"proton-//;s/".*//') || PROTON_VERSION="9-11"
fi

echo "Installing Proton version: $PROTON_VERSION"

curl -L "https://github.com/ValveSoftware/Proton/releases/download/v${PROTON_VERSION}/proton-${PROTON_VERSION}.tar.gz" \
    -o /tmp/proton.tar.gz 2>/dev/null || { echo "Proton download failed, skipping"; exit 0; }

if [ -f /tmp/proton.tar.gz ]; then
    tar xzf /tmp/proton.tar.gz -C /opt/steamcmd/Proton --strip-components=1 2>/dev/null || echo "Proton extraction failed"
    rm /tmp/proton.tar.gz
fi
