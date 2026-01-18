# QOL Makefile Template

Quick git workflow automation with AI-powered commit messages.

## Features

| Command | Description |
|---------|-------------|
| `make push` | Stage all changes, generate AI commit message (DeepSeek), push |
| `make push-quick` | Stage all changes, quick push with default message |
| `make branch NAME` | Create branch + push with upstream tracking |

## Setup

1. **Copy files to your project:**
   ```
   your-project/
   ├── Makefile          # Copy and merge with existing
   ├── scripts/
   │   └── autocommit.py # Copy this
   └── .env              # Add your API key
   ```

2. **Install dependencies:**
   ```bash
   pip install openai python-dotenv
   ```

3. **Add API key to `.env`:**
   ```
   DEEPSEEK_API_KEY=sk-your-key-here
   ```

4. **Adjust Python path in Makefile** (if using venv):
   ```makefile
   PYTHON = backend\venv\Scripts\python  # Windows
   # or
   PYTHON = venv/bin/python              # Linux/macOS
   ```

## Usage

```bash
# Make changes, then:
make push           # AI analyzes diff and writes commit message

# In a hurry:
make push-quick     # Uses generic "chore: quick update" message

# Start new feature:
make branch feature/auth-system
```

## Getting a DeepSeek API Key

1. Go to [platform.deepseek.com](https://platform.deepseek.com)
2. Sign up / Log in
3. Navigate to API Keys
4. Create a new key and add to your `.env`

**Cost:** DeepSeek is extremely cheap (~$0.001 per commit message)
