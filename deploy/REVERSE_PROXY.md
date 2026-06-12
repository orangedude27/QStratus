# Reverse Proxy Configuration

This directory contains example configurations for running QStratus behind a reverse proxy with TLS termination.

## Why Use a Reverse Proxy?

- **TLS/HTTPS**: Encrypts traffic between clients and your server
- **Port management**: Serve everything on standard ports (80/443)
- **Security headers**: Add HSTS, CSP, and other security headers
- **Rate limiting**: Additional DDoS protection
- **Load balancing**: Future-proof for multi-node deployments

## Prerequisites

- A domain name pointing to your server
- Docker Compose stack running (`deploy/docker-compose.selfhost.yml`)
- UDP port 4433 open in your firewall (for WebTransport)

## Nginx Setup

1. Install Nginx and Certbot:
   ```bash
   sudo apt update
   sudo apt install nginx certbot python3-certbot-nginx
   ```

2. Copy the configuration:
   ```bash
   sudo cp nginx/qstratus.conf /etc/nginx/sites-available/qstratus
   sudo ln -s /etc/nginx/sites-available/qstratus /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   ```

3. Edit the config and replace `your-domain.com` with your actual domain.

4. Test the configuration:
   ```bash
   sudo nginx -t
   ```

5. Obtain SSL certificate:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

6. Restart Nginx:
   ```bash
   sudo systemctl restart nginx
   ```

7. Set up auto-renewal (should be automatic with Certbot).

## Caddy Setup

1. Install Caddy:
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update
   sudo apt install caddy
   ```

2. Copy the configuration:
   ```bash
   sudo cp caddy/Caddyfile /etc/caddy/Caddyfile
   ```

3. Edit the config and replace `your-domain.com` with your actual domain.

4. Restart Caddy:
   ```bash
   sudo systemctl restart caddy
   ```

Caddy automatically obtains and renews SSL certificates.

## WebTransport (QUIC/UDP) Configuration

WebTransport uses UDP on port 4433. You have two options:

### Option 1: Direct Exposure (Recommended)

Expose stratusd directly on port 4433 with its own TLS certificate:

```bash
# Obtain a separate certificate for QUIC
sudo certbot certonly --standalone -d your-domain.com --preferred-challenges tls

# Update stratusd.env to use the certificate
STRATUSD_TLS_CERT=/etc/letsencrypt/live/your-domain.com/fullchain.pem
STRATUSD_TLS_KEY=/etc/letsencrypt/live/your-domain.com/privkey.pem
```

Then open UDP 4433 in your firewall:
```bash
sudo ufw allow 4433/udp
```

### Option 2: Reverse Proxy with QUIC Support

Nginx 1.25.0+ supports QUIC. Uncomment the QUIC server block in `nginx/qstratus.conf` and rebuild Nginx with QUIC support.

## Firewall Configuration

Ensure the following ports are open:

| Port | Protocol | Purpose |
|------|----------|---------|
| 80 | TCP | HTTP (redirects to HTTPS) |
| 443 | TCP | HTTPS (frontend + API) |
| 4433 | UDP | WebTransport (QUIC) |

```bash
# Using UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 4433/udp
sudo ufw enable
```

## Updating Environment Variables

When using a reverse proxy, update your frontend environment:

```env
# frontend.env
NEXT_PUBLIC_BACKEND_PATH=https://your-domain.com/api
NEXT_PUBLIC_STRATUSD_PORT=4433
```

The backend path should include the `/api` prefix if you're using the reverse proxy configuration.
