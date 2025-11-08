# Docker Infrastructure

This directory contains the Docker Compose infrastructure for the agent-coordinator monorepo.

## Services

### PostgreSQL (Port 5432)
- **Purpose**: State persistence for workflows, artifacts, and agent executions
- **Image**: postgres:16-alpine
- **Default Database**: coordinator
- **Schemas**: coordinator, storage, agents
- **Volume**: postgres_data (persistent)

### Redis (Port 6379)
- **Purpose**: Caching and rate limiting
- **Image**: redis:7-alpine
- **Configuration**: AOF persistence, LRU eviction
- **Max Memory**: 256MB (configurable)
- **Volume**: redis_data (persistent)

### Temporal (Port 7233)
- **Purpose**: Workflow orchestration engine
- **Image**: temporalio/auto-setup:1.23
- **Database**: PostgreSQL (shared with coordinator)
- **Namespace**: default
- **Web UI**: http://localhost:8080

### Temporal UI (Port 8080)
- **Purpose**: Web interface for monitoring workflows
- **Image**: temporalio/ui:2.22.0
- **Access**: http://localhost:8080

## Quick Start

### 1. Configure Environment

```bash
# Copy the example environment file
cp docker/.env.example docker/.env

# Edit docker/.env with your settings (optional for local dev)
```

### 2. Start Infrastructure

```bash
# From the project root
yarn infra:up

# Or using Docker Compose directly
docker compose -f docker/docker-compose.yml up -d
```

### 3. Verify Services

```bash
# Check service status
docker compose -f docker/docker-compose.yml ps

# View logs
yarn infra:logs

# Or for specific service
docker compose -f docker/docker-compose.yml logs -f postgres
```

### 4. Stop Infrastructure

```bash
# From the project root
yarn infra:down

# Or using Docker Compose directly
docker compose -f docker/docker-compose.yml down
```

## Database Management

### Connect to PostgreSQL

```bash
# Using psql
docker exec -it coordinator-postgres psql -U coordinator -d coordinator

# Or from host (if psql installed)
psql postgresql://coordinator:coordinator_dev@localhost:5432/coordinator
```

### Run Migrations

```bash
# Custom SQL scripts
docker exec -i coordinator-postgres psql -U coordinator -d coordinator < your-migration.sql
```

### Backup Database

```bash
# Create backup
docker exec coordinator-postgres pg_dump -U coordinator coordinator > backup.sql

# Restore backup
docker exec -i coordinator-postgres psql -U coordinator -d coordinator < backup.sql
```

## Redis Management

### Connect to Redis

```bash
# Using redis-cli
docker exec -it coordinator-redis redis-cli -a redis_dev

# Test connection
docker exec coordinator-redis redis-cli -a redis_dev PING
```

### Monitor Redis

```bash
# Watch commands in real-time
docker exec -it coordinator-redis redis-cli -a redis_dev MONITOR

# Get info
docker exec coordinator-redis redis-cli -a redis_dev INFO
```

### Clear Redis Cache

```bash
# Flush all data (CAUTION: destructive)
docker exec coordinator-redis redis-cli -a redis_dev FLUSHALL
```

## Temporal Management

### Access Temporal UI

Open http://localhost:8080 in your browser to access the Temporal Web UI.

### Temporal CLI

```bash
# List workflows
docker exec coordinator-temporal temporal workflow list

# Describe workflow
docker exec coordinator-temporal temporal workflow describe --workflow-id <id>

# Get workflow history
docker exec coordinator-temporal temporal workflow show --workflow-id <id>
```

## Troubleshooting

### Services Not Starting

```bash
# Check service logs
docker compose -f docker/docker-compose.yml logs

# Check specific service
docker compose -f docker/docker-compose.yml logs postgres
docker compose -f docker/docker-compose.yml logs redis
docker compose -f docker/docker-compose.yml logs temporal
```

### Port Conflicts

If you have port conflicts, modify the ports in `docker/.env`:

```env
POSTGRES_PORT=5433
REDIS_PORT=6380
TEMPORAL_PORT=7234
TEMPORAL_UI_PORT=8081
```

### Reset Everything

```bash
# Stop services and remove volumes (CAUTION: deletes all data)
docker compose -f docker/docker-compose.yml down -v

# Start fresh
yarn infra:up
```

### Health Checks

```bash
# PostgreSQL
docker exec coordinator-postgres pg_isready -U coordinator

# Redis
docker exec coordinator-redis redis-cli -a redis_dev PING

# Temporal
docker exec coordinator-temporal temporal --address 127.0.0.1:7233 operator search-attribute list
```

## Volume Management

### List Volumes

```bash
docker volume ls | grep coordinator
```

### Inspect Volume

```bash
docker volume inspect coordinator_postgres_data
docker volume inspect coordinator_redis_data
```

### Backup Volumes

```bash
# Backup PostgreSQL data
docker run --rm -v coordinator_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Backup Redis data
docker run --rm -v coordinator_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .
```

## Configuration Files

- `docker-compose.yml`: Main infrastructure configuration
- `.env.example`: Example environment variables
- `init-scripts/01-init.sql`: PostgreSQL initialization script
- `temporal/dynamicconfig/development.yaml`: Temporal runtime configuration

## Network

All services are connected via the `coordinator-network` bridge network, allowing them to communicate using service names:

- PostgreSQL: `postgres:5432`
- Redis: `redis:6379`
- Temporal: `temporal:7233`

## Security Notes

The default configuration is optimized for local development. For production:

1. Change all default passwords
2. Use strong passwords and store in secrets management
3. Enable SSL/TLS for database connections
4. Configure proper network security groups
5. Enable audit logging
6. Regular security updates for Docker images
7. Use read-only volumes where appropriate

## Production Considerations

For production deployment:

1. Use managed database services (RDS, Cloud SQL, etc.)
2. Use managed Redis (ElastiCache, Cloud Memorystore, etc.)
3. Use Temporal Cloud or self-hosted with high availability
4. Implement proper backup and disaster recovery
5. Configure monitoring and alerting
6. Use container orchestration (Kubernetes, ECS, etc.)
7. Implement proper secrets management
