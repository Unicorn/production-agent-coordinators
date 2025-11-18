# Kong Local Development Setup

Guide to setting up Kong API Gateway for local development.

## Docker Compose Setup

### docker-compose.kong.yml

```yaml
version: '3.8'

services:
  kong-database:
    image: postgres:15
    container_name: kong-database
    environment:
      POSTGRES_USER: kong
      POSTGRES_PASSWORD: kong
      POSTGRES_DB: kong
    volumes:
      - kong-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kong"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - kong-net

  kong-migrations:
    image: kong:3.4
    container_name: kong-migrations
    command: kong migrations bootstrap
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-database
      KONG_PG_USER: kong
      KONG_PG_PASSWORD: kong
      KONG_PG_DATABASE: kong
    depends_on:
      kong-database:
        condition: service_healthy
    networks:
      - kong-net
    restart: on-failure

  kong:
    image: kong:3.4
    container_name: kong
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-database
      KONG_PG_USER: kong
      KONG_PG_PASSWORD: kong
      KONG_PG_DATABASE: kong
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_ADMIN_LISTEN: 0.0.0.0:8001
      KONG_ADMIN_GUI_URL: http://localhost:8002
      # Optional: Enable admin API key
      # KONG_ADMIN_GUI_AUTH: basic-auth
      # KONG_ADMIN_GUI_AUTH_CONF: '{"admin": {"password": "admin"}}'
    ports:
      - "8000:8000"  # Proxy port
      - "8443:8443"  # Proxy SSL port
      - "8001:8001"  # Admin API
      - "8444:8444"  # Admin API SSL
      - "8002:8002"  # Admin GUI (optional)
    depends_on:
      kong-database:
        condition: service_healthy
      kong-migrations:
        condition: service_completed_successfully
    networks:
      - kong-net
    healthcheck:
      test: ["CMD", "kong", "health"]
      interval: 10s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  # Kong Admin GUI (optional - requires Kong Enterprise)
  # Uncomment if you have Kong Enterprise license
  # kong-admin-gui:
  #   image: kong/kong-manager:3.4
  #   container_name: kong-admin-gui
  #   environment:
  #     KONG_ADMIN_API_URL: http://kong:8001
  #   ports:
  #     - "8002:8002"
  #   depends_on:
  #     - kong
  #   networks:
  #     - kong-net
  #   restart: unless-stopped

volumes:
  kong-db-data:

networks:
  kong-net:
    driver: bridge
```

## Starting Kong

```bash
# Start Kong services
docker-compose -f docker-compose.kong.yml up -d

# Check Kong status
curl http://localhost:8001/status

# Verify admin API
curl http://localhost:8001/services
```

## Environment Variables

Create `.env.local`:

```env
# Kong Configuration
KONG_ADMIN_URL=http://localhost:8001
KONG_ADMIN_API_KEY=  # Optional for local dev
KONG_GATEWAY_URL=http://localhost:8000

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3010
WORKFLOW_API_BASE_URL=http://localhost:3010/api/workflows

# Environment
NODE_ENV=development
```

## Ngrok Setup

For ngrok development:

```bash
# Install ngrok
# https://ngrok.com/download

# Start ngrok tunnel
ngrok http 3010

# Update .env.local with ngrok URL
KONG_GATEWAY_URL=https://your-ngrok-url.ngrok.io
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok.io
WORKFLOW_API_BASE_URL=https://your-ngrok-url.ngrok.io/api/workflows
```

## Testing Kong Integration

```bash
# Create a test service
curl -i -X POST http://localhost:8001/services \
  --data "name=test-service" \
  --data "url=http://localhost:3010"

# Create a route
curl -i -X POST http://localhost:8001/services/test-service/routes \
  --data "paths[]=/test" \
  --data "methods[]=GET"

# Test the route
curl http://localhost:8000/test
```

## Troubleshooting

### Kong won't start
- Check database is healthy: `docker ps`
- Check logs: `docker logs kong`
- Verify migrations: `docker logs kong-migrations`

### Can't connect to Kong Admin API
- Verify port 8001 is accessible
- Check firewall settings
- Try: `curl http://localhost:8001/status`

### Routes not working
- Verify service exists: `curl http://localhost:8001/services`
- Check route configuration: `curl http://localhost:8001/routes`
- Test directly: `curl http://localhost:3010/api/workflows/...`

## Production Considerations

For production:
- Use Kong in DB mode (not DB-less)
- Set up proper authentication for Admin API
- Use environment-specific URLs
- Enable SSL/TLS
- Set up monitoring and logging
- Use Kong Enterprise for advanced features (optional)

