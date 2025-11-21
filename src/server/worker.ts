/**
 * Cloudflare Worker for Booking.com MCP Server
 * This worker handles MCP protocol for ChatGPT integration
 */

import { z } from "zod";
import { WIDGET_HTML } from "./widget-html.js";

// Widget definition
const WIDGET = {
  id: "accommodations_search",
  title: "Booking.com Accommodation Search",
  templateUri: "ui://widget/booking-search-results.html",
  invoking: "Searching for stays on Booking.com...",
  invoked: "Results from Booking.com ready",
};

function widgetDescriptorMeta() {
  return {
    "openai/outputTemplate": WIDGET.templateUri,
    "openai/toolInvocation/invoking": WIDGET.invoking,
    "openai/toolInvocation/invoked": WIDGET.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;
}

function widgetInvocationMeta() {
  return {
    "openai/toolInvocation/invoking": WIDGET.invoking,
    "openai/toolInvocation/invoked": WIDGET.invoked,
  } as const;
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
  _meta: widgetDescriptorMeta(),
  annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
};

const resource = {
  uri: WIDGET.templateUri,
  name: WIDGET.title,
  description: `${WIDGET.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetDescriptorMeta(),
};

const resourceTemplate = {
  uriTemplate: WIDGET.templateUri,
  name: WIDGET.title,
  description: `${WIDGET.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetDescriptorMeta(),
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

            // Return the widget HTML just like server.ts does
            response = {
              contents: [{
                uri: WIDGET.templateUri,
                mimeType: "text/html+skybridge",
                text: WIDGET_HTML,
                _meta: widgetDescriptorMeta(),
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
    _meta: widgetInvocationMeta(),
  };
}

