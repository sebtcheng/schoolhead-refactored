# Consolidated Nginx Configuration (Staging VM)

This document preserves the bulletproof Nginx configuration used to manage the four primary application environments on the Staging VM (`20.24.58.49`).

## 🗺️ Site Mapping & Port Architecture

| Site Name | Sub-path | Backend Port | Technology |
| :--- | :--- | :--- | :--- |
| **STRIDE Dashboard** | `/` | `3002` | Next.js |
| **OpDash** | `/opdash/` | `3001` | Express |
| **InsightEd Staging** | `/insighted-staging/` | `5001` | Express (Vite) |
| **InsightEd Production**| `/insighted/` | `5000` | Express |

## 🛠️ Key Configuration Decisions
1.  **Single-Source-of-Truth**: All four sites are managed within a single `stride.conf` server block to prevent "conflicting server name" warnings for `stride.deped.gov.ph`.
2.  **Database-First Assets**: The traditional `location /uploads/` static alias blocks have been **removed**. This ensures that all asset requests fall through to the Express handlers, which serve binary data directly from the PostgreSQL `unified_binaries` table.
3.  **Graceful Health Checks**: The root path (`= /`) includes a specific check for Azure/LoadBalancer User-Agents to return a `200 healthy` status for infrastructure monitoring.
4.  **Timeout Hardening (ADR-003)**: Increased staging API timeouts to 600s and disabled request buffering to support 20MB+ PDF uploads for the Hydra pipeline.

## 📄 Final Nginx Configuration (`stride.conf`)

```nginx
server {
    listen 80;
    server_name stride.deped.gov.ph;
    client_max_body_size 100M;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2 default_server;
    server_name stride.deped.gov.ph;
    client_max_body_size 100M;

    ssl_certificate /etc/nginx/ssl/fullchain3.pem;
    ssl_certificate_key /etc/nginx/ssl/privatekey3.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers EECDH+AESGCM:EDH+AESGCM;

    # 1. STRIDE Dashboard (Root)@3002
    location = / {
        if ($http_user_agent ~* "HealthProbe|Azure|LoadBalancer|TrafficManager") {
            return 200 'healthy';
        }
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. OpDash Frontend & API@3001
    location /opdash/ {
        alias /var/www/html/opdash/;
        try_files $uri $uri/ /opdash/index.html;
    }

    location /opdash/api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Staging Frontend & API@5001
    location /insighted-staging/ {
        alias /var/www/html/InsightEd-Staging/dist/;
        try_files $uri $uri/ /insighted-staging/index.html;
    }

    location /insighted-staging/api/ {
        proxy_pass http://localhost:5001/api/;
        client_max_body_size 100M;
        proxy_request_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_connect_timeout 600s;
        client_body_timeout 600s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 4. Production Frontend & API@5000
    location /insighted/ {
        alias /var/www/html/InsightEd-Mobile-PWA/dist/;
        try_files $uri $uri/ /insighted/index.html;
    }

    location /insighted/api/ {
        proxy_pass http://localhost:5000/api/;
        client_max_body_size 100M;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 5. Legacy/Generic API (Redirect to Production@5000)
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        client_max_body_size 100M;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📋 Restoration Commands
If the configuration is ever lost, use the following commands on the VM:
```bash
# 1. Back up current
sudo cp /etc/nginx/sites-available/stride.conf /etc/nginx/sites-available/stride.conf.bak.$(date +%F)

# 2. Overwrite with this consolidated version
# (Copy text above into stride.conf)

# 3. Verify and Reload
sudo nginx -t && sudo systemctl reload nginx
```
