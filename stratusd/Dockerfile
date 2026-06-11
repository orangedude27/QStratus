FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8

RUN dpkg --add-architecture i386 \
    && apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    cmake \
    curl \
    git \
    libcjson-dev \
    libcurl4-openssl-dev \
    libdrm-dev \
    libegl1-mesa-dev \
    libevdev-dev \
    libexpat1-dev \
    libgles2-mesa-dev \
    libicu-dev \
    liblm-sensors-dev \
    libopus-dev \
    libpipewire-0.3-dev \
    pkg-config \
    ffmpeg \
    wine wine64 wine32 winetricks \
    libgl1-mesa-glx:amd64 \
    libgl1-mesa-glx:i386 \
    libgl1:amd64 \
    libgl1:i386 \
    libstdc++6:amd64 \
    libstdc++6:i386 \
    libasound2:amd64 \
    libasound2:i386 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/stratusd

COPY CMakeLists.txt main.c version.h.in ./
COPY cmake ./cmake
COPY Common ./Common
COPY Capture ./Capture
COPY CapturePw ./CapturePw
COPY Encode ./Encode
COPY Input ./Input
COPY SideCar ./SideCar
COPY Transport ./Transport
COPY libs ./libs

RUN cmake -DCMAKE_BUILD_TYPE=Release -B ./build \
    && cmake --build ./build -j"$(nproc)"

# Install Proton (latest stable by default)
ARG PROTON_VERSION=latest
RUN mkdir -p /opt/steamcmd/Proton \
    && if [ "$PROTON_VERSION" = "latest" ]; then \
        PROTON_VERSION=$$(curl -s https://api.github.com/repos/ValveSoftware/Proton/releases/latest 2>/dev/null | grep tag_name | cut -d'"' -f4 | sed 's/^proton-//') || PROTON_VERSION="9-11"; \
    fi \
    && echo "Installing Proton version: $$PROTON_VERSION" \
    && curl -L "https://github.com/ValveSoftware/Proton/releases/download/v$${PROTON_VERSION}/proton-$${PROTON_VERSION}.tar.gz" \
        -o /tmp/proton.tar.gz 2>/dev/null || echo "Proton download failed, skipping" \
    && if [ -f /tmp/proton.tar.gz ]; then \
        tar xzf /tmp/proton.tar.gz -C /opt/steamcmd/Proton --strip-components=1 2>/dev/null || echo "Proton extraction failed" \
        && rm /tmp/proton.tar.gz; \
    fi

# Initialize Wine prefix for non-Steam games
RUN mkdir -p /root/.wine \
    && WINEPREFIX=/root/.wine wineboot --init 2>/dev/null || true

# Default game directory can be overridden from docker compose.
ENV STRATUSD_GAME_DIR=/games
ENV STRATUSD_STEAM_PATH=/data/steam/steamapps/common
ENV STRATUSD_STEAM_PREFIX=/data/steam/userdata
ENV PROTON_VERSION=${PROTON_VERSION}

CMD ["/opt/stratusd/build/stratusd"]
