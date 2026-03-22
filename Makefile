.PHONY: setup backend frontend dev clean

# Setup everything
setup: setup-backend setup-frontend
	cp -n .env.example .env || true
	@echo "Setup complete. Edit .env with your API keys, then run: make dev"

setup-backend:
	python -m venv .venv && .venv/bin/pip install -r backend/requirements.txt

setup-frontend:
	cd frontend && npm install

# Run backend (from project root so 'backend' is a proper Python package)
backend:
	.venv/bin/python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Run frontend
frontend:
	cd frontend && npm run dev

# Run both (requires two terminals, or use &)
dev:
	@echo "Run in separate terminals:"
	@echo "  make backend"
	@echo "  make frontend"

clean:
	rm -rf .venv frontend/node_modules neuronium.db __pycache__
