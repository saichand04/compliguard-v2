# SSL/TLS Certificate Setup

Place your SSL certificates in this directory before starting the nginx container.

Expected files:
- `cert.pem` — your certificate (or full chain)
- `key.pem` — your private key

---

## Option 1: Self-Signed Certificate (Development / Internal Use)

Generate a self-signed certificate valid for 10 years:

```bash
openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
  -keyout deploy/ssl/key.pem \
  -out deploy/ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=CompliGuard/CN=localhost"
```

> **Warning:** Browsers will show a security warning for self-signed certificates. Only use this for local/internal deployments.

---

## Option 2: Let's Encrypt (Recommended for Production)

### Using Certbot (standalone)

```bash
# Install certbot
sudo apt-get install certbot

# Obtain certificate (requires port 80 to be open and DNS pointing to your server)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates to the deploy/ssl directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem deploy/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem deploy/ssl/key.pem
sudo chown $(whoami):$(whoami) deploy/ssl/cert.pem deploy/ssl/key.pem
```

### Auto-renewal

Let's Encrypt certificates expire every 90 days. Set up auto-renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Add a cron job for auto-renewal (runs twice daily)
echo "0 */12 * * * root certbot renew --quiet --deploy-hook 'docker compose restart nginx'" | sudo tee /etc/cron.d/certbot
```

---

## Option 3: Bring Your Own Certificate

If you have a certificate from a commercial CA (DigiCert, Comodo, etc.):

1. Concatenate the certificate and any intermediate certificates into `cert.pem`:
   ```bash
   cat your_cert.crt intermediate.crt > deploy/ssl/cert.pem
   ```
2. Copy your private key:
   ```bash
   cp your_private.key deploy/ssl/key.pem
   ```

---

## Security Notes

- Ensure `key.pem` has restrictive permissions: `chmod 600 deploy/ssl/key.pem`
- Never commit private keys to version control — `deploy/ssl/*.pem` is in `.gitignore`
- For production, prefer TLSv1.2 and TLSv1.3 only (already configured in `nginx.conf`)
- Use an online SSL test (e.g., [SSL Labs](https://www.ssllabs.com/ssltest/)) to verify your configuration
