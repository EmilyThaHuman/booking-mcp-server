# Booking.com MCP Server

Model Context Protocol server for Booking.com accommodation search with the ChatGPT Apps SDK. Provides an interactive UI widget for searching hotels and accommodations with rich filtering options.

## Features

- **Accommodation Search** with interactive UI widget
- **Rich Filtering** — destination, dates, guests, rooms, budget, amenities, star rating
- **OAuth 2.0 Authentication** — secure Booking.com API access
- **OpenAI Apps SDK** — inline widgets rendered directly in ChatGPT
- **Railway + Docker** deployment ready

## Tools

### `accommodations_search`

Search hotels and accommodations on Booking.com.

**Input Parameters:**
- `destination` (required) — City name or destination
- `checkIn` (required) — Check-in date (YYYY-MM-DD)
- `checkOut` (required) — Check-out date (YYYY-MM-DD)
- `adults` — Number of adults (default: 2)
- `children` — Number of children (default: 0)
- `rooms` — Number of rooms (default: 1)
- `minBudget` — Minimum budget per night
- `maxBudget` — Maximum budget per night
- `accommodationType` — Type of accommodation (hotel, apartment, hostel, etc.)
- `amenities` — Required facilities (wifi, pool, parking, gym, etc.)
- `minRating` — Minimum guest rating (0–10)

## Installation

```bash
npm install
```

## Environment Variables

```bash
BOOKING_CLIENT_ID=your_client_id
BOOKING_CLIENT_SECRET=your_client_secret
REDIRECT_URI=http://localhost:8000/auth/callback
PORT=8000
```

## Development

```bash
# Run development server
npm run dev

# Build server and widgets
npm run build

# Build server only
npm run build:server

# Build widgets only
npm run build:widgets
```

## Deployment

Configured for Railway deployment with Docker. Set environment variables in your Railway project dashboard.

## Architecture

Built with the [OpenAI Apps SDK](https://github.com/openai/openai-apps-sdk-examples) and Model Context Protocol. The accommodation search tool returns rich, interactive widget results directly inside ChatGPT.

## License

MIT

---

## Powered by ZeroTwo

This MCP server is part of the [ZeroTwo AI platform](https://zerotwo.ai) — a unified workspace that combines GPT-5, Claude, Gemini, and smart travel integrations like this Booking.com connector into a single subscription.

| | |
|---|---|
| 🌐 **[ZeroTwo — All AI Models in One App](https://zerotwo.ai)** | Search hotels and book travel with the help of GPT-5, Claude, and Gemini — all in one place. |
| ✨ **[ZeroTwo Features](https://zerotwo.ai/features)** | AI chat, image studio, video, web search, documents, and MCP-powered travel tools. |
| 🤖 **[AI Models — GPT-5, Claude & Gemini](https://zerotwo.ai/zerotwo-models)** | Access every top AI model without juggling multiple subscriptions. |
| 🔌 **[ZeroTwo Connectors & Integrations](https://zerotwo.ai/connectors)** | Connect Booking.com, Gmail, Airtable, and more to your AI assistant. |
| 💰 **[ZeroTwo Pricing](https://zerotwo.ai/pricing)** | One subscription that replaces ChatGPT Plus, Claude Pro, and Gemini Advanced. |
| 📝 **[ZeroTwo Blog](https://zerotwo.ai/blog)** | AI travel tips, updates, and insights from the ZeroTwo team. |
| 🚀 **[Try ZeroTwo Free](https://app.zerotwo.ai/auth/login)** | Plan your next trip with AI — get started free today. |

> **Built for ZeroTwo** — Use this Booking.com MCP server with [ZeroTwo's AI assistant](https://zerotwo.ai) to search accommodations worldwide using natural language, with beautiful interactive results rendered inline in your chat.
