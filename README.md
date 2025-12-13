# Homepage Dashboard

A modern, Docker-deployable personal dashboard with customizable widgets, AI-powered link categorization, and service integrations.

## Features

- 🎨 **Modern UI** - Clean, responsive design with light/dark mode
- 🔗 **Quick Links** - Save and organize bookmarks with AI categorization
- 📝 **Notes** - Create notes with code snippet support and syntax highlighting
- 🌤️ **Weather** - Current conditions and 5-day forecast
- 🐳 **Docker** - Monitor container status, CPU, and memory usage
- 💻 **Proxmox** - View VM/container status and resource usage
- 🔧 **Drag & Drop** - Customize your dashboard layout with Gridstack
- 👥 **Multi-user** - User accounts with dashboard sharing

## Quick Start

### 1. Clone and Configure

```bash
cd homepage
cp .env.example .env
# Edit .env with your API keys
```

### 2. Run with Docker Compose

```bash
docker-compose up -d
```

### 3. Access Dashboard

Open http://localhost:8000 in your browser and create an account.

## Configuration

Edit `.env` file to configure:

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing key (change in production!) |
| `GEMINI_API_KEY` | Google AI API key for link categorization |
| `WEATHER_API_KEY` | OpenWeatherMap API key |
| `PROXMOX_HOST` | Proxmox server URL |
| `PROXMOX_USER` | Proxmox username |
| `PROXMOX_TOKEN_NAME` | Proxmox API token name |
| `PROXMOX_TOKEN_VALUE` | Proxmox API token value |

## Development

### Run Backend Locally

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Project Structure

```
homepage/
├── docker-compose.yml
├── Dockerfile
├── backend/
│   └── app/
│       ├── main.py
│       ├── core/          # Config, database, security
│       ├── models/        # SQLAlchemy models
│       ├── schemas/       # Pydantic schemas
│       ├── api/routers/   # API endpoints
│       └── services/      # Business logic
└── frontend/
    ├── index.html
    ├── css/              # Design system
    └── js/               # Application code
```

## License

MIT
