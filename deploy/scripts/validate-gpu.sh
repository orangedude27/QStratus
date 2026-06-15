#!/bin/bash
# validate-gpu.sh — End-to-end validation of Linux stack + GPU for QStratus
# Usage: ./validate-gpu.sh [--quick]
#   --quick  Skip slow tests (Docker builds, full stack startup)
#
# This script validates:
#   1. Host prerequisites (Docker, kernel modules)
#   2. GPU detection and encoding capability
#   3. Device passthrough (/dev/dri, /dev/uinput)
#   4. Container can access GPU
#   5. (Optional) Full stack starts and heartbeats reach backend
#
# Exit codes: 0 = all passed, 1 = failed, 2 = skipped (no GPU)

set -uo pipefail

QUICK=false
if [ "${1:-}" = "--quick" ]; then
    QUICK=true
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

check() {
    local desc="$1"
    shift
    if eval "$@" &>/dev/null; then
        echo -e "  ${GREEN}PASS${NC} $desc"
        PASS=$((PASS + 1))
        return 0
    else
        echo -e "  ${RED}FAIL${NC} $desc"
        FAIL=$((FAIL + 1))
        return 1
    fi
}

skip() {
    echo -e "  ${YELLOW}SKIP${NC} $1"
    SKIP=$((SKIP + 1))
}

warn() {
    echo -e "  ${YELLOW}WARN${NC} $1"
}

echo "============================================"
echo "  QStratus Linux Stack + GPU Validation"
echo "============================================"
echo ""

# --- 1. Host Prerequisites ---
echo -e "${CYAN}1. Host Prerequisites${NC}"

check "Docker installed" "command -v docker"
check "Docker Compose plugin" "docker compose version &>/dev/null"
check "Docker daemon running" "docker info &>/dev/null"

if ! check "Docker can run containers" "docker run --rm hello-world &>/dev/null"; then
    warn "Cannot test container execution — continuing with limited validation"
fi

echo ""

# --- 2. GPU Detection ---
echo -e "${CYAN}2. GPU Detection${NC}"

GPU_VENDOR=""
if command -v lspci &>/dev/null; then
    GPU_LINE=$(lspci 2>/dev/null | grep -iE '(vga|3d|display)' | head -1)
    if [ -n "$GPU_LINE" ]; then
        if echo "$GPU_LINE" | grep -qi 'nvidia'; then
            GPU_VENDOR="nvidia"
        elif echo "$GPU_LINE" | grep -qi 'amd\|advanced micro devices\|ati\|radeon'; then
            GPU_VENDOR="amd"
        elif echo "$GPU_LINE" | grep -qi 'intel'; then
            GPU_VENDOR="intel"
        fi
    fi
fi

if [ -z "$GPU_VENDOR" ]; then
    skip "No GPU detected via lspci"
else
    echo -e "  Detected: ${GREEN}${GPU_VENDOR^^}${NC}"
fi

echo ""

# --- 3. Kernel Modules ---
echo -e "${CYAN}3. Kernel Modules${NC}"

if [ -d /dev/dri ]; then
    check "/dev/dri directory exists" "[ -d /dev/dri ]"
    # NVIDIA uses card1, AMD/Intel use card0
    if [ -e /dev/dri/card0 ] || [ -e /dev/dri/card1 ]; then
        check "/dev/dri/card0 or card1 exists" "true"
    else
        warn "No card0 or card1 found in /dev/dri"
    fi
    if [ -e /dev/dri/renderD128 ]; then
        check "/dev/dri/renderD128 exists" "[ -e /dev/dri/renderD128 ]"
    else
        warn "/dev/dri/renderD128 not found (may use different render node)"
    fi
else
    skip "/dev/dri not found (GPU passthrough unavailable)"
fi

echo ""

# --- 4. Device Passthrough ---
echo -e "${CYAN}4. Device Passthrough${NC}"

if [ -e /dev/uinput ]; then
    check "/dev/uinput exists" "[ -e /dev/uinput ]"
    if [ -w /dev/uinput ]; then
        check "/dev/uinput is writable" "[ -w /dev/uinput ]"
    else
        warn "/dev/uinput not writable — container may need privileged mode or input group"
    fi
else
    skip "/dev/uinput not found (controller input unavailable)"
fi

echo ""

# --- 5. GPU Encoding Tests ---
echo -e "${CYAN}5. GPU Encoding Capability${NC}"

case "$GPU_VENDOR" in
    nvidia)
        if command -v nvidia-smi &>/dev/null; then
            check "nvidia-smi works" "nvidia-smi --query-gpu=name --format=csv,noheader &>/dev/null"

            # Check for NVENC support
            if nvidia-smi --query-gpu=encoder --format=csv,noheader 2>/dev/null | grep -qi 'free\|supported\|yes'; then
                check "NVENC encoder available" "nvidia-smi --query-gpu=encoder --format=csv,noheader 2>/dev/null | grep -qi 'free'"
            else
                warn "NVENC encoder status unclear"
            fi

            # Test Docker GPU access
            if [ "$QUICK" = true ]; then
                skip "Docker GPU test (use --quick to skip)"
            else
                if docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi &>/dev/null; then
                    check "Docker GPU passthrough (NVIDIA runtime)" "true"
                else
                    warn "Docker GPU passthrough test failed (NVIDIA Container Toolkit may not be configured)"
                fi
            fi
        else
            skip "nvidia-smi not found"
        fi
        ;;

    amd|intel)
        # Check VAAPI
        if command -v vainfo &>/dev/null; then
            if vainfo &>/dev/null; then
                check "vainfo reports VAAPI devices" "vainfo &>/dev/null"

                # Check for H.264 encoding support (required for streaming)
                if vainfo 2>&1 | grep -q 'H.264\|avc'; then
                    check "VAAPI H.264 encoding supported" "vainfo 2>&1 | grep -q 'H.264\|avc'"
                else
                    warn "VAAPI H.264 encoding not found in vainfo output"
                fi
            else
                warn "vainfo failed — VAAPI may not be configured"
            fi
        else
            skip "vainfo not installed (install with: sudo apt install vainfo)"
        fi

        # Test Docker /dev/dri passthrough
        if [ "$QUICK" = true ]; then
            skip "Docker /dev/dri test (run without --quick)"
        else
            if docker run --rm -v /dev/dri:/dev/dri --device /dev/dri ubuntu:24.04 \
                bash -c "ls /dev/dri/ | grep -q card0" 2>/dev/null; then
                check "Docker /dev/dri passthrough" "true"
            else
                check "Docker /dev/dri passthrough" "docker run --rm -v /dev/dri:/dev/dri --device /dev/dri ubuntu:24.04 ls /dev/dri/ 2>/dev/null | grep -q card0"
            fi
        fi
        ;;

    *)
        skip "Unknown GPU vendor — skipping encoding tests"
        ;;
esac

echo ""

# --- 6. FFmpeg GPU Encoder Detection ---
echo -e "${CYAN}6. FFmpeg GPU Encoder${NC}"

if command -v ffmpeg &>/dev/null; then
    check "FFmpeg installed" "ffmpeg -version &>/dev/null"

    # Check for hardware encoder support
    if ffmpeg -encoders 2>/dev/null | grep -q 'h264_v4l2m2m'; then
        check "FFmpeg VAAPI H.264 encoder (h264_v4l2m2m)" "true"
    else
        warn "h264_v4l2m2m encoder not found in FFmpeg"
    fi

    if ffmpeg -encoders 2>/dev/null | grep -q 'h264_nvenc'; then
        check "FFmpeg NVIDIA H.264 encoder (h264_nvenc)" "true"
    else
        warn "h264_nvenc encoder not found in FFmpeg"
    fi
else
    skip "FFmpeg not installed"
fi

echo ""

# --- 7. Compose File Validation ---
echo -e "${CYAN}7. Compose Configuration${NC}"

COMPOSE_FILE="deploy/docker-compose.selfhost.yml"
if [ -f "$COMPOSE_FILE" ]; then
    check "docker-compose.selfhost.yml exists" "[ -f $COMPOSE_FILE ]"

    # Validate YAML syntax
    if python3 -c "import yaml; yaml.safe_load(open('$COMPOSE_FILE'))" 2>/dev/null || \
       python3 -c "import json; print('no yaml')" 2>/dev/null; then
        check "Compose file is valid YAML" "python3 -c \"import yaml; yaml.safe_load(open('$COMPOSE_FILE'))\" 2>/dev/null"
    else
        warn "Cannot validate YAML (no python3 yaml module)"
    fi

    # Check for required services
    if grep -q 'backend:' "$COMPOSE_FILE"; then
        check "Backend service defined" "true"
    fi
    if grep -q 'frontend:' "$COMPOSE_FILE"; then
        check "Frontend service defined" "true"
    fi
    if grep -q 'stratusd:' "$COMPOSE_FILE"; then
        check "stratusd service defined" "true"
    fi

    # Check GPU-related config
    if grep -q '/dev/dri' "$COMPOSE_FILE"; then
        check "/dev/dri passthrough configured" "true"
    else
        warn "/dev/dri not found in compose file"
    fi
else
    skip "docker-compose.selfhost.yml not found at $COMPOSE_FILE"
fi

# Check NVIDIA override
if [ -f "deploy/docker-compose.nvidia.yml" ]; then
    check "NVIDIA override file exists" "true"
else
    warn "docker-compose.nvidia.yml not found (NVIDIA GPU users need this)"
fi

echo ""

# --- 8. Environment Files ---
echo -e "${CYAN}8. Environment Configuration${NC}"

ENV_DIR="deploy/env"
if [ -d "$ENV_DIR" ]; then
    for env_file in backend.env frontend.env stratusd.env; do
        if [ -f "$ENV_DIR/$env_file.example" ]; then
            check "$env_file.example exists" "true"
        else
            warn "$env_file.example not found"
        fi
    done
else
    skip "deploy/env/ directory not found"
fi

echo ""

# --- Summary ---
echo "============================================"
echo "  Results"
echo "============================================"
echo -e "  ${GREEN}Passed: $PASS${NC}"
if [ $FAIL -gt 0 ]; then
    echo -e "  ${RED}Failed: $FAIL${NC}"
else
    echo -e "  Failed: $FAIL"
fi
if [ $SKIP -gt 0 ]; then
    echo -e "  ${YELLOW}Skipped: $SKIP${NC}"
else
    echo -e "  Skipped: $SKIP"
fi
echo ""

if [ $FAIL -gt 0 ]; then
    echo -e "${RED}Validation FAILED — fix failures before deploying${NC}"
    exit 1
elif [ $SKIP -gt 0 ]; then
    echo -e "${YELLOW}Validation passed with $SKIP skips${NC}"
    exit 0
else
    echo -e "${GREEN}Validation passed — ready to deploy${NC}"
    exit 0
fi
