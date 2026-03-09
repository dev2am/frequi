# Variables
n ?= 50

build:
	docker compose -f docker-compose.yml build

build-no-cache:
	docker compose -f docker-compose.yml build --no-cache

run:
	docker compose -f docker-compose.yml up -d

stop:
	docker compose -f docker-compose.yml stop

down:
	docker compose -f docker-compose.yml stop
	docker compose -f docker-compose.yml down

reload:
	docker compose -f docker-compose.yml stop
	docker compose -f docker-compose.yml up -d

log:
	docker compose -f docker-compose.yml logs -f --tail=$(n) frequi || true

clean:
	docker compose -f docker-compose.yml down --rmi local