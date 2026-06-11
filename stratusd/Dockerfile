FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
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

# Default game directory can be overridden from docker compose.
ENV STRATUSD_GAME_DIR=/games

CMD ["/opt/stratusd/build/stratusd"]
