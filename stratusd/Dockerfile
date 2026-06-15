FROM archlinux:base

ENV LANG=C.UTF-8

RUN pacman -Syu --noconfirm --needed \
    base-devel \
    cmake \
    curl \
    git \
    cjson \
    libdrm \
    libglvnd \
    libevdev \
    expat \
    icu \
    lm_sensors \
    opus \
    pipewire \
    pkgconf \
    ffmpeg \
    wine \
    mesa \
    alsa-lib \
    && rm -rf /var/cache/pacman/pkg/*

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
COPY scripts/install-proton.sh /tmp/install-proton.sh
RUN chmod +x /tmp/install-proton.sh && \
    PROTON_VERSION=${PROTON_VERSION} bash /tmp/install-proton.sh

# Initialize Wine prefix for non-Steam games
RUN mkdir -p /root/.wine \
    && WINEPREFIX=/root/.wine wineboot --init 2>/dev/null || true

# Default game directory can be overridden from docker compose.
ENV STRATUSD_GAME_DIR=/games
ENV STRATUSD_STEAM_PATH=/data/steam/steamapps/common
ENV STRATUSD_STEAM_PREFIX=/data/steam/userdata
ENV PROTON_VERSION=${PROTON_VERSION}

CMD ["/opt/stratusd/build/stratusd"]
