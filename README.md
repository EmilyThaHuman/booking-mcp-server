# Booking.com MCP Server with OpenAI Apps SDK

A TypeScript-based Model Context Protocol (MCP) server that integrates Booking.com accommodation search with ChatGPT using the OpenAI Apps SDK. This server provides interactive UI widgets for searching hotels, apartments, hostels, and other accommodations worldwide.

## Features

- **Comprehensive Accommodation Search** with support for:
  - 🏨 Hotels, Apartments, Hostels, Resorts, Villas, Guest Houses, and more
  - 📅 Flexible date ranges and number of nights
  - 👥 Multiple guests, children, and rooms
  - 💰 Budget filtering (min/max price)
  - ⭐ Star ratings and guest reviews
  - 🏊 Facilities (pool, parking, gym, breakfast, pet-friendly, etc.)
  - 📍 Landmark and location-based search

- **Beautiful Interactive Widget** - Booking.com-style cards with photos, ratings, and details
- **Sustainability Badges** - Shows Travel Sustainable Level certifications
- **Real API Integration** - Uses RapidAPI for live accommodation data (with mock data fallback)
- **Cloudflare Workers Ready** - Deploy globally with zero-config scaling
- **TypeScript** - Fully typed for better development experience

## Quick Start

```bash
cd booking-mcp-server
npm install

# Optional: Set up API key for real data
cp .env.example .env
# Edit .env and add your RAPIDAPI_KEY

npm run dev
```

## API Setup (Optional)

The server works without an API key using mock data. For real data:

1. Sign up at [RapidAPI](https://rapidapi.com/)
2. Subscribe to [Booking.com API](https://rapidapi.com/apidojo/api/booking-com13)
3. Copy your API key to `.env`:
   ```
   RAPIDAPI_KEY=your_key_here
   ```

See [API_SETUP_GUIDE.md](../API_SETUP_GUIDE.md) for detailed instructions.

## Current API Integration

**With RAPIDAPI_KEY:**
- Real-time accommodation searches from Booking.com
- Actual prices, availability, and guest reviews
- Live property details and amenities

**Without RAPIDAPI_KEY:**
- Automatically uses mock data
- Perfect for testing and development

## Custom API Integration

### Option 1: Booking.com Affiliate Partner Hub API

1. Sign up for [Booking.com Partner Hub](https://www.booking.com/affiliate-program/v2/index.html)
2. Get API credentials
3. Update `src/worker.ts` or `src/server.ts`:

```typescript
const BOOKING_API_BASE = 'https://distribution-xml.booking.com/2.7/json';

async function searchAccommodations(params: any) {
  const response = await fetch(`${BOOKING_API_BASE}/hotels`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(env.BOOKING_USERNAME + ':' + env.BOOKING_PASSWORD)}`,
    },
    params: new URLSearchParams({
      city_ids: params.cityId,
      checkin: params.checkIn,
      checkout: params.checkOut,
      room: params.adults,
      // ... other parameters
    })
  });
  
  return await response.json();
}
```

### Option 2: RapidAPI Booking.com

Use [RapidAPI's Booking.com endpoint](https://rapidapi.com/apidojo/api/booking):

```typescript
async function searchAccommodations(params: any) {
  const response = await fetch(
    'https://booking-com.p.rapidapi.com/v1/hotels/search',
    {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'booking-com.p.rapidapi.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dest_id: params.destId,
        checkin_date: params.checkIn,
        checkout_date: params.checkOut,
        adults_number: params.adults,
        // ... other parameters
      }),
    }
  );
  
  return await response.json();
}
```

## Tool Schema

### accomodations.search

**Input Parameters:**
- `destination` (required) - City name or destination
- `coordinates` - Geographic coordinates if city unavailable
- `checkIn` - Check-in date (YYYY-MM-DD format)
- `checkOut` - Check-out date (YYYY-MM-DD format)
- `nights` - Number of nights
- `adults` - Number of adults (default: 2)
- `children` - Number of children (default: 0)
- `rooms` - Number of rooms (default: 1)
- `minPrice` - Minimum budget per night
- `maxPrice` - Maximum budget per night
- `accommodationType` - Type (hotel, apartment, hostel, resort, etc.)
- `facilities` - Array of required amenities
- `landmark` - Nearby landmark or POI
- `rating` - Minimum guest rating (0-10)

**Output Widget:** Accommodation cards showing property details, pricing, ratings, facilities, and booking info

## Deployment to Cloudflare Workers

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

Add your API keys as secrets:
```bash
wrangler secret put BOOKING_API_KEY
wrangler secret put RAPIDAPI_KEY
```

## Using in ChatGPT

Example queries:
- "Find hotels in Paris from June 15 to June 20"
- "Show me pet-friendly apartments in Barcelona with parking"
- "Search for 5-star resorts in Bali with pool and spa under $200/night"
- "Find family-friendly hostels near Eiffel Tower with free breakfast"

## License

MIT License

---

Built with ❤️ using TypeScript, MCP, and OpenAI Apps SDK

