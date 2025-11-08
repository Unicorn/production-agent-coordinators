Quick start:
Start Temporal
    `docker compose -f docker/temporal/docker-compose.yml up -d`

Install and build
    `yarn install`
    `yarn build`

Run the worker
    `yarn dev:worker`

In a new terminal, start the Hello workflow
    `yarn dev:hello`

Dispatch the “HELLO” step (one-shot)
    `WORKFLOW_ID=hello-1 yarn dev:coord`

Inspect state
    `yarn state hello-1`