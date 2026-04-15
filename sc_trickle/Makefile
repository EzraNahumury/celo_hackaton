# ─────────────────────────────────────────────────────────────
#  TrickleVault – Makefile
#  Usage: make <target>
# ─────────────────────────────────────────────────────────────

-include .env
export

# ── Config ──────────────────────────────────────────────────

FORGE          := forge
NETWORK        ?= celo-sepolia       # override: make deploy NETWORK=celo
DEPLOY_SCRIPT  := script/Deploy.s.sol:Deploy
CONTRACT_SRC   := src/TrickleVault.sol:TrickleVault

# Read deployed address from saved JSON (requires jq)
DEPLOYED_ADDR  = $(shell cat deployments/11142220.json 2>/dev/null | grep TrickleVault | sed 's/.*"TrickleVault": "\(.*\)".*/\1/')

# ── Phony Targets ────────────────────────────────────────────

.PHONY: install build test test-verbose snapshot clean \
        deploy deploy-dry verify check-env

# ── Setup ────────────────────────────────────────────────────

install: ## Install / update Foundry dependencies
	$(FORGE) install

# ── Build ────────────────────────────────────────────────────

build: ## Compile all contracts
	$(FORGE) build

# ── Test ─────────────────────────────────────────────────────

test: ## Run all unit tests (local)
	$(FORGE) test

test-verbose: ## Run tests with full stack traces
	$(FORGE) test -vvvv

snapshot: ## Generate gas snapshot
	$(FORGE) snapshot

# ── Deploy ───────────────────────────────────────────────────

check-env:
	@test -n "$(PRIVATE_KEY)"       || (echo "ERROR: PRIVATE_KEY not set in .env"; exit 1)
	@test -n "$(CELOSCAN_API_KEY)"  || (echo "WARN: CELOSCAN_API_KEY not set – verification will be skipped")

deploy-dry: check-env ## Simulate deployment (no broadcast)
	$(FORGE) script $(DEPLOY_SCRIPT) \
		--rpc-url $(NETWORK) \
		-vvvv

deploy: check-env ## Deploy to $(NETWORK) and verify on Celoscan
	$(FORGE) script $(DEPLOY_SCRIPT) \
		--rpc-url $(NETWORK) \
		--broadcast \
		--verify \
		-vvvv

# ── Verify ───────────────────────────────────────────────────

verify: ## Verify already-deployed contract (reads address from deployments/11142220.json)
	@test -n "$(DEPLOYED_ADDR)" || (echo "ERROR: No deployed address found. Run 'make deploy' first."; exit 1)
	$(FORGE) verify-contract $(DEPLOYED_ADDR) $(CONTRACT_SRC) \
		--chain celo-sepolia \
		--watch

# ── Clean ────────────────────────────────────────────────────

clean: ## Remove build artifacts
	$(FORGE) clean

# ── Help ─────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'
