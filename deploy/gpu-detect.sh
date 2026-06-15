#!/bin/bash
# gpu-detect.sh — Detect GPU vendor and validate encoding capability
# Usage: ./gpu-detect.sh
# Exit codes: 0 = success, 1 = error, 2 = no GPU found

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err()   { echo -e "${RED}[ERR]${NC} $1"; }

# Check if running as root (not required but some checks need it)
IS_ROOT=false
if [ "$(id -u)" -eq 0 ]; then
    IS_ROOT=true
fi

# --- GPU Detection ---
echo "========================================="
echo "  QStratus GPU Detection"
echo "========================================="
echo ""

# Try lspci first (most reliable)
GPU_VENDOR=""
GPU_MODEL=""
GPU_BUS=""

if command -v lspci &>/dev/null; then
    # Look for VGA compatible controller or 3D controller
    GPU_LINE=$(lspci 2>/dev/null | grep -iE '(vga|3d|display)' | head -1)
    if [ -n "$GPU_LINE" ]; then
        GPU_BUS=$(echo "$GPU_LINE" | cut -d' ' -f1)
        GPU_MODEL=$(echo "$GPU_LINE" | cut -d' ' -f3-)

        if echo "$GPU_LINE" | grep -qi 'nvidia'; then
            GPU_VENDOR="nvidia"
        elif echo "$GPU_LINE" | grep -qi 'amd\|advanced micro devices\|ati\|radeon'; then
            GPU_VENDOR="amd"
        elif echo "$GPU_LINE" | grep -qi 'intel'; then
            GPU_VENDOR="intel"
        else
            GPU_VENDOR="unknown"
        fi
    fi
fi

# Fallback: check /dev/dri
if [ -z "$GPU_VENDOR" ] && [ -d /dev/dri ]; then
    log_info "/dev/dri exists, checking render nodes..."
    ls -la /dev/dri/ 2>/dev/null || true
    GPU_VENDOR="detected"
fi

# Fallback: check nvidia-smi
if [ -z "$GPU_VENDOR" ] && command -v nvidia-smi &>/dev/null; then
    GPU_VENDOR="nvidia"
    GPU_MODEL=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
fi

if [ -z "$GPU_VENDOR" ] || [ "$GPU_VENDOR" = "unknown" ]; then
    log_err "No GPU detected."
    log_info "Install 'pciutils' (lspci) for detection."
    exit 2
fi

echo -e "GPU Vendor:  ${GREEN}${GPU_VENDOR^^}${NC}"
if [ -n "$GPU_MODEL" ]; then
    echo -e "GPU Model:   ${GREEN}${GPU_MODEL}${NC}"
fi
echo ""

# --- Vendor-specific checks ---
case "$GPU_VENDOR" in
    nvidia)
        log_info "=== NVIDIA GPU ==="

        # Check NVIDIA driver
        if command -v nvidia-smi &>/dev/null; then
            log_ok "nvidia-smi available"
            DRIVER_VERSION=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)
            log_info "Driver version: $DRIVER_VERSION"

            # Check CUDA capability
            CUDA_VERSION=$(nvidia-smi --query-gpu=cuda.version --format=csv,noheader 2>/dev/null | head -1)
            if [ -n "$CUDA_VERSION" ]; then
                log_info "CUDA version: $CUDA_VERSION"
            fi
        else
            log_warn "nvidia-smi not found — NVIDIA drivers may not be installed"
        fi

        # Check /dev/dri
        if [ -e /dev/dri/card0 ] && [ -e /dev/dri/renderD128 ]; then
            log_ok "/dev/dri devices present"
        else
            log_warn "/dev/dri devices not found (may still work with NVIDIA Container Toolkit)"
        fi

        # Check NVIDIA Container Toolkit
        if command -v nvidia-ctk &>/dev/null || docker info 2>/dev/null | grep -q 'nvidia'; then
            log_ok "NVIDIA Container Toolkit detected"
            log_info "Use: docker compose -f docker-compose.selfhost.yml -f docker-compose.nvidia.yml up -d"
        else
            log_warn "NVIDIA Container Toolkit not detected"
            log_info "To install:"
            log_info "  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg"
            log_info "  curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list"
            log_info "  sudo apt update && sudo apt install nvidia-container-toolkit"
            log_info "  sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker"
        fi

        # Test Docker GPU access
        log_info "Testing Docker GPU access..."
        if docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi &>/dev/null; then
            log_ok "Docker GPU access working"
        else
            log_warn "Docker GPU access test failed (may need NVIDIA Container Toolkit)"
        fi
        ;;

    amd|intel)
        log_info "=== ${GPU_VENDOR^^} GPU (VAAPI) ==="

        # Check /dev/dri
        if [ -e /dev/dri/card0 ]; then
            log_ok "/dev/dri/card0 present"
        else
            log_err "/dev/dri/card0 not found — GPU passthrough will not work"
            exit 1
        fi

        if [ -e /dev/dri/renderD128 ]; then
            log_ok "/dev/dri/renderD128 present"
        else
            log_warn "renderD128 not found (check permissions)"
        fi

        # Check VAAPI
        if command -v vainfo &>/dev/null; then
            log_ok "vainfo available"
            VAINFO_OUTPUT=$(vainfo 2>&1) || true
            if echo "$VAINFO_OUTPUT" | grep -q "error\|fail\|not found"; then
                log_warn "vainfo reported errors"
                echo "$VAINFO_OUTPUT" | head -5
            else
                log_ok "VAAPI devices detected"
            fi
        else
            log_warn "vainfo not found — install 'vainfo' to validate VAAPI"
            log_info "  sudo apt install vainfo"
        fi

        # Check Mesa drivers
        if command -v glxinfo &>/dev/null; then
            GL_VENDOR=$(glxinfo 2>/dev/null | grep "OpenGL vendor" | head -1) || true
            if [ -n "$GL_VENDOR" ]; then
                log_info "$GL_VENDOR"
            fi
        else
            log_warn "glxinfo not found — install 'mesa-utils' for OpenGL info"
        fi

        # Test Docker GPU access
        log_info "Testing Docker GPU access..."
        if docker run --rm -v /dev/dri:/dev/dri --device /dev/dri ubuntu:24.04 \
            bash -c "ls -la /dev/dri/" &>/dev/null; then
            log_ok "Docker /dev/dri passthrough working"
        else
            log_err "Docker /dev/dri passthrough failed"
            exit 1
        fi

        # Check uinput
        if [ -e /dev/uinput ]; then
            log_ok "/dev/uinput present"
            # Check if writable
            if [ -w /dev/uinput ]; then
                log_ok "/dev/uinput is writable"
            else
                log_warn "/dev/uinput is not writable — add container user to 'input' group or use privileged mode"
                log_info "  sudo chmod 666 /dev/uinput  (temporary)"
                log_info "  or: sudo usermod -aG input \$USER && sudo reboot  (permanent)"
            fi
        else
            log_err "/dev/uinput not found — controller input will not work"
            log_info "  sudo mknod /dev/uinput c 10 223"
            log_info "  sudo chmod 666 /dev/uinput"
        fi
        ;;

    *)
        log_warn "Unknown GPU vendor: $GPU_VENDOR"
        log_info "The /dev/dri mount should work for most GPUs."
        ;;
esac

echo ""
echo "========================================="
echo "  Detection complete"
echo "========================================="
