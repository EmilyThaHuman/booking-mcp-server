/**
 * Cloudflare Worker for Booking.com MCP Server
 * This worker handles SSE connections and MCP protocol for ChatGPT integration
 */

import { z } from "zod";

// Widget definition
const WIDGET = {
  id: "accomodations.search",
  title: "Booking.com Accommodation Search",
  templateUri: "ui://widget/booking-com-search-results.html",
  invoking: "Searching for stays on Booking.com...",
  invoked: "Results from Booking.com ready",
};

// UI Component as embedded HTML
const UI_COMPONENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking.com Search Results</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background: #f5f5f7; }
    .header { margin-bottom: 24px; }
    .search-title { font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
    .search-subtitle { font-size: 16px; color: #666; }
    .filters-applied { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .filter-tag { padding: 6px 12px; background: #003b95; color: white; border-radius: 16px; font-size: 13px; font-weight: 500; }
    .accommodations-container { display: grid; gap: 16px; }
    .accommodation-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.3s; cursor: pointer; display: flex; position: relative; }
    .accommodation-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.12); }
    .accommodation-image { width: 280px; height: 220px; object-fit: cover; background: #e0e0e0; }
    .accommodation-info { flex: 1; padding: 20px; }
    .accommodation-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; }
    .accommodation-name { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
    .accommodation-type { display: inline-block; padding: 4px 10px; background: #f0f0f0; color: #666; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: capitalize; margin-bottom: 8px; }
    .accommodation-price { text-align: right; }
    .price-amount { font-size: 28px; font-weight: 800; color: #003b95; }
    .price-label { font-size: 13px; color: #666; }
    .accommodation-rating { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .rating-badge { padding: 6px 10px; background: #003b95; color: white; border-radius: 8px 8px 8px 0; font-weight: 700; font-size: 16px; }
    .rating-text { font-weight: 600; font-size: 14px; }
    .review-count { font-size: 13px; color: #666; }
    .accommodation-location { font-size: 14px; color: #666; margin-bottom: 12px; }
    .facilities { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .facility { padding: 6px 12px; background: #e8f5e9; color: #2e7d32; border-radius: 16px; font-size: 12px; font-weight: 500; }
    .cancellation { font-size: 13px; color: #2e7d32; font-weight: 600; margin-top: 8px; }
    .sustainability-badge { position: absolute; top: 12px; left: 12px; padding: 6px 12px; background: rgba(46, 125, 50, 0.95); color: white; border-radius: 6px; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
    @media (max-width: 768px) { .accommodation-card { flex-direction: column; } .accommodation-image { width: 100%; height: 200px; } }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      const props = window.__WIDGET_PROPS__ || {};
      const { accommodations = [], destination = '', checkIn = '', checkOut = '', nights = 0, totalResults = 0, filters = {} } = props;
      
      const root = document.getElementById('root');
      const header = document.createElement('div');
      header.className = 'header';
      
      let headerHTML = '<div class="search-title">' + destination + '</div>';
      headerHTML += '<div class="search-subtitle">';
      if (checkIn && checkOut) headerHTML += checkIn + ' - ' + checkOut + ' · ' + nights + ' night' + (nights > 1 ? 's' : '') + ' · ';
      headerHTML += totalResults + ' properties found</div>';
      
      if (filters.accommodationType || filters.facilities || filters.minPrice || filters.maxPrice || filters.rating) {
        headerHTML += '<div class="filters-applied">';
        if (filters.accommodationType) headerHTML += '<span class="filter-tag">' + filters.accommodationType + '</span>';
        if (filters.facilities) filters.facilities.forEach(f => { headerHTML += '<span class="filter-tag">' + f + '</span>'; });
        if (filters.minPrice || filters.maxPrice) {
          const priceText = filters.minPrice && filters.maxPrice ? '$' + filters.minPrice + '-$' + filters.maxPrice : filters.minPrice ? 'Above $' + filters.minPrice : 'Below $' + filters.maxPrice;
          headerHTML += '<span class="filter-tag">' + priceText + '</span>';
        }
        if (filters.rating) headerHTML += '<span class="filter-tag">' + filters.rating + '+ rating</span>';
        headerHTML += '</div>';
      }
      
      header.innerHTML = headerHTML;
      root.appendChild(header);
      
      const container = document.createElement('div');
      container.className = 'accommodations-container';
      
      if (accommodations.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">No accommodations found. Try adjusting your filters.</div>';
      } else {
        accommodations.forEach(acc => {
          const card = document.createElement('div');
          card.className = 'accommodation-card';
          
          const facilityIcons = { 'wifi': '📶', 'pool': '🏊', 'parking': '🅿️', 'gym': '💪', 'spa': '💆', 'restaurant': '🍽️', 'breakfast': '🥐', 'beach': '🏖️' };
          const topFacilities = acc.facilities.slice(0, 6);
          const facilitiesHTML = topFacilities.map(f => {
            const icon = Object.keys(facilityIcons).find(key => f.includes(key));
            return '<span class="facility">' + (icon ? facilityIcons[icon] + ' ' : '') + f.replace(/-/g, ' ') + '</span>';
          }).join('');
          
          const sustainabilityHTML = acc.sustainability && acc.sustainability.certified ? '<div class="sustainability-badge">🌱 Travel Sustainable Level ' + acc.sustainability.level + '</div>' : '';
          
          card.innerHTML = sustainabilityHTML + '<img src="' + (acc.mainImage || 'https://via.placeholder.com/280x220') + '" class="accommodation-image" onerror="this.src=\'https://via.placeholder.com/280x220\'"><div class="accommodation-info"><div class="accommodation-header"><div><div class="accommodation-type">' + acc.type + '</div><div class="accommodation-name">' + acc.name + '</div></div><div class="accommodation-price"><div class="price-amount">$' + acc.pricePerNight + '</div><div class="price-label">per night</div></div></div><div class="accommodation-rating"><span class="rating-badge">' + acc.rating.toFixed(1) + '</span><span class="rating-text">' + acc.reviewScore + '</span><span class="review-count">(' + acc.reviewCount.toLocaleString() + ' reviews)</span></div><div class="accommodation-location">📍 ' + acc.location.distance + '</div><div class="facilities">' + facilitiesHTML + '</div><div class="cancellation">' + acc.cancellation + '</div></div>';
          
          card.addEventListener('click', () => {
            if (window.parent && window.parent.postMessage) {
              window.parent.postMessage({ type: 'accommodation-selected', data: { id: acc.id, name: acc.name } }, '*');
            }
          });
          
          container.appendChild(card);
        });
      }
      
      root.appendChild(container);
    })();
  </script>
</body>
</html>`;

function widgetMeta() {
  return {
    "openai/outputTemplate": WIDGET.templateUri,
    "openai/toolInvocation/invoking": WIDGET.invoking,
    "openai/toolInvocation/invoked": WIDGET.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  };
}

// Zod parser
const accommodationSearchInputParser = z.object({
  destination: z.string(),
  coordinates: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  nights: z.number().min(1).optional(),
  adults: z.number().min(1).optional(),
  children: z.number().min(0).optional(),
  rooms: z.number().min(1).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  accommodationType: z.enum(["hotel", "apartment", "hostel", "guest-house", "vacation-home", "resort", "villa", "chalet", "bed-and-breakfast", "lodge"]).optional(),
  facilities: z.array(z.string()).optional(),
  landmark: z.string().optional(),
  rating: z.number().min(0).max(10).optional(),
});

// Define tool
const tool = {
  name: WIDGET.id,
  description: "Use this when the user wants to find, search, view or compare different accommodation types for their trip, for example, hotels, hostels, apartments, homes, guest houses, lodging, chalets, amongst many more. The user can find accommodations by destination, dates, number of nights, guests, budget, landmarks, and/or facilities (e.g., pool, parking, free breakfast, gym, all‑inclusive, family‑friendly). LLM must provide a city or, if a city is not available, resolve the destination to coordinates. Returns available accommodation options with price, photos, guest ratings, and facilities.",
  inputSchema: {
    type: "object",
    properties: {
      destination: { type: "string", description: "City name or destination" },
      coordinates: { type: "object", properties: { latitude: { type: "number" }, longitude: { type: "number" } } },
      checkIn: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
      checkOut: { type: "string", description: "Check-out date (YYYY-MM-DD)" },
      nights: { type: "number", minimum: 1 },
      adults: { type: "number", minimum: 1 },
      children: { type: "number", minimum: 0 },
      rooms: { type: "number", minimum: 1 },
      minPrice: { type: "number" },
      maxPrice: { type: "number" },
      accommodationType: { type: "string", enum: ["hotel", "apartment", "hostel", "guest-house", "vacation-home", "resort", "villa", "chalet", "bed-and-breakfast", "lodge"] },
      facilities: { type: "array", items: { type: "string" } },
      landmark: { type: "string" },
      rating: { type: "number", minimum: 0, maximum: 10 },
    },
    required: ["destination"],
  },
  _meta: widgetMeta(),
  annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
};

const resource = {
  uri: WIDGET.templateUri,
  name: WIDGET.title,
  description: `${WIDGET.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(),
};

const resourceTemplate = {
  uriTemplate: WIDGET.templateUri,
  name: WIDGET.title,
  description: `${WIDGET.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(),
};

// Cloudflare Worker handler
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/mcp" && request.method === "GET") {
      return new Response("SSE not fully supported. Use POST /mcp/rpc", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    if (url.pathname === "/mcp/rpc" && request.method === "POST") {
      try {
        const body = await request.json() as any;
        const method = body.method;

        let response: any;

        switch (method) {
          case "tools/list":
            response = { tools: [tool] };
            break;

          case "resources/list":
            response = { resources: [resource] };
            break;

          case "resources/templates/list":
            response = { resourceTemplates: [resourceTemplate] };
            break;

          case "resources/read": {
            const uri = body.params?.uri;
            if (uri !== WIDGET.templateUri) {
              return new Response(JSON.stringify({ error: "Resource not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }

            response = {
              contents: [{
                uri,
                mimeType: "text/html+skybridge",
                text: UI_COMPONENT,
              }],
            };
            break;
          }

          case "tools/call": {
            const toolName = body.params?.name;
            const args = body.params?.arguments || {};

            if (toolName !== WIDGET.id) {
              return new Response(JSON.stringify({ error: "Unknown tool" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }

            response = await handleToolCall(args);
            break;
          }

          default:
            return new Response(JSON.stringify({ error: "Unknown method" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};

async function handleToolCall(args: any) {
  const parsed = accommodationSearchInputParser.parse(args);
  
  // Mock Booking.com data
  const mockAccommodations = [
    {
      id: "b1",
      name: "Grand Hotel & Spa",
      type: "hotel",
      destination: parsed.destination,
      pricePerNight: 185,
      totalPrice: (parsed.nights || 3) * 185,
      currency: "USD",
      mainImage: "https://via.placeholder.com/800x600",
      rating: 8.9,
      reviewScore: "Excellent",
      reviewCount: 2847,
      location: {
        distance: "0.5 km from city center",
      },
      facilities: ["free-wifi", "pool", "spa", "gym", "restaurant", "parking"],
      cancellation: "Free cancellation until 24 hours before check-in",
      sustainability: { certified: true, level: 2 },
    },
    {
      id: "b2",
      name: "Cozy Downtown Apartment",
      type: "apartment",
      destination: parsed.destination,
      pricePerNight: 120,
      totalPrice: (parsed.nights || 3) * 120,
      currency: "USD",
      mainImage: "https://via.placeholder.com/800x600",
      rating: 9.2,
      reviewScore: "Superb",
      reviewCount: 456,
      location: {
        distance: "0.2 km from city center",
      },
      facilities: ["free-wifi", "kitchen", "parking", "family-friendly"],
      cancellation: "Free cancellation until 3 days before check-in",
      sustainability: { certified: false, level: 0 },
    },
    {
      id: "b3",
      name: "Luxury Beach Resort",
      type: "resort",
      destination: parsed.destination,
      pricePerNight: 389,
      totalPrice: (parsed.nights || 3) * 389,
      currency: "USD",
      mainImage: "https://via.placeholder.com/800x600",
      rating: 9.5,
      reviewScore: "Exceptional",
      reviewCount: 1523,
      location: {
        distance: "3.2 km from city center",
      },
      facilities: ["free-wifi", "pool", "spa", "beach-access", "all-inclusive"],
      cancellation: "Non-refundable",
      sustainability: { certified: true, level: 3 },
    },
  ];

  let filteredAccommodations = mockAccommodations;

  if (parsed.accommodationType) {
    filteredAccommodations = filteredAccommodations.filter(acc => acc.type === parsed.accommodationType);
  }
  if (parsed.minPrice) {
    filteredAccommodations = filteredAccommodations.filter(acc => acc.pricePerNight >= parsed.minPrice!);
  }
  if (parsed.maxPrice) {
    filteredAccommodations = filteredAccommodations.filter(acc => acc.pricePerNight <= parsed.maxPrice!);
  }
  if (parsed.rating) {
    filteredAccommodations = filteredAccommodations.filter(acc => acc.rating >= parsed.rating!);
  }

  return {
    content: [{ type: "text", text: `Found ${filteredAccommodations.length} accommodations in ${parsed.destination}` }],
    structuredContent: {
      destination: parsed.destination,
      checkIn: parsed.checkIn,
      checkOut: parsed.checkOut,
      nights: parsed.nights || 3,
      accommodations: filteredAccommodations,
      totalResults: filteredAccommodations.length,
      filters: {
        accommodationType: parsed.accommodationType,
        facilities: parsed.facilities,
        minPrice: parsed.minPrice,
        maxPrice: parsed.maxPrice,
        rating: parsed.rating,
      },
    },
    _meta: widgetMeta(),
  };
}

