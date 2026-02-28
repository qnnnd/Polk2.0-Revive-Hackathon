.PHONY: install dev node deploy seed smoke test lint build clean help

## ── Quick Start ─────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	cd contracts && pnpm install
	cd frontend && pnpm install

dev: ## One-click local dev: start node → deploy → seed → frontend
	@echo "🚀 Starting local development environment..."
	@echo "   Step 1: Starting Hardhat node (background)..."
	@cd contracts && npx hardhat node &
	@sleep 3
	@echo "   Step 2: Deploying contract..."
	@cd contracts && npx hardhat run scripts/deploy.ts --network localhost
	@echo "   Step 3: Seeding demo data (10 tasks)..."
	@cd contracts && SEED_COUNT=10 npx hardhat run scripts/seed.ts --network localhost
	@echo "   Step 4: Starting frontend..."
	@echo "   ✅ Open http://localhost:3000"
	@cd frontend && pnpm dev

node: ## Start Hardhat local node
	cd contracts && npx hardhat node

deploy: ## Deploy contract to local node
	cd contracts && npx hardhat run scripts/deploy.ts --network localhost

seed: ## Seed demo data (default 20 tasks)
	cd contracts && npx hardhat run scripts/seed.ts --network localhost

smoke: ## Run E2E smoke test
	cd contracts && npx hardhat run scripts/smoke.ts --network localhost

test: ## Run contract unit tests
	cd contracts && npx hardhat test

lint: ## Lint frontend
	cd frontend && pnpm lint

build: ## Build frontend for production
	cd frontend && pnpm build

clean: ## Clean build artifacts
	cd contracts && rm -rf artifacts cache typechain-types
	cd frontend && rm -rf .next
