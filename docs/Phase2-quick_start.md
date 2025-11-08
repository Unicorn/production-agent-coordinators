How to run Phase 2 locally:

Build everything

yarn install

yarn build

Start Temporal + worker

docker compose -f docker/temporal/docker-compose.yml up -d

yarn dev:worker

Start the Todo workflow

WORKFLOW_ID=todo-1 TODO_TITLE="Minimal Todo App" yarn workspace cli start:todo

Dispatch steps (run as many times as needed until it completes)

WORKFLOW_ID=todo-1 yarn dev:coord

Inspect state

yarn state todo-1

Open generated app

check ./out/todo-1/index.html in your browser