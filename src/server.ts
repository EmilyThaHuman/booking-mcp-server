import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourceTemplatesRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type ResourceTemplate,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Environment configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const RAPIDAPI_HOST = "booking-com13.p.rapidapi.com";

type BookingWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
  responseText: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const UI_COMPONENTS_DIR = path.resolve(ROOT_DIR, "ui-components");

function readWidgetHtml(componentName: string): string {
  if (!fs.existsSync(UI_COMPONENTS_DIR)) {
    console.warn(`Widget components directory not found at ${UI_COMPONENTS_DIR}`);
    return `<!DOCTYPE html><html><body><div id="root">Widget: ${componentName}</div></body></html>`;
  }

  const htmlPath = path.join(UI_COMPONENTS_DIR, `${componentName}.html`);
  
  if (fs.existsSync(htmlPath)) {
    return fs.readFileSync(htmlPath, "utf8");
  } else {
    console.warn(`Widget HTML for "${componentName}" not found`);
    return `<!DOCTYPE html><html><body><div id="root">Widget: ${componentName}</div></body></html>`;
  }
}

function widgetMeta(widget: BookingWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;
}

const widgets: BookingWidget[] = [
  {
    id: "accomodations.search",
    title: "Booking.com Accommodation Search",
    templateUri: "ui://widget/booking-com-search-results.html",
    invoking: "Searching for stays on Booking.com...",
    invoked: "Results from Booking.com ready",
    html: readWidgetHtml("booking-com-search-results"),
    responseText: "Found matching accommodations",
  },
];

const widgetsById = new Map<string, BookingWidget>();
const widgetsByUri = new Map<string, BookingWidget>();

widgets.forEach((widget) => {
  widgetsById.set(widget.id, widget);
  widgetsByUri.set(widget.templateUri, widget);
});

// Tool input schema
const accommodationSearchInputSchema = {
  type: "object",
  properties: {
    destination: {
      type: "string",
      description: "City name or destination",
    },
    coordinates: {
      type: "object",
      description: "Geographic coordinates if city is not available",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
      },
    },
    checkIn: {
      type: "string",
      description: "Check-in date (YYYY-MM-DD format)",
    },
    checkOut: {
      type: "string",
      description: "Check-out date (YYYY-MM-DD format)",
    },
    nights: {
      type: "number",
      description: "Number of nights",
      minimum: 1,
    },
    adults: {
      type: "number",
      description: "Number of adults",
      minimum: 1,
    },
    children: {
      type: "number",
      description: "Number of children",
      minimum: 0,
    },
    rooms: {
      type: "number",
      description: "Number of rooms",
      minimum: 1,
    },
    minPrice: {
      type: "number",
      description: "Minimum budget per night",
    },
    maxPrice: {
      type: "number",
      description: "Maximum budget per night",
    },
    accommodationType: {
      type: "string",
      description: "Type of accommodation",
      enum: [
        "hotel",
        "apartment",
        "hostel",
        "guest-house",
        "vacation-home",
        "resort",
        "villa",
        "chalet",
        "bed-and-breakfast",
        "lodge",
      ],
    },
    facilities: {
      type: "array",
      description: "Required facilities/amenities",
      items: {
        type: "string",
        enum: [
          "pool",
          "parking",
          "free-breakfast",
          "gym",
          "all-inclusive",
          "family-friendly",
          "wifi",
          "spa",
          "restaurant",
          "airport-shuttle",
          "pet-friendly",
          "beach-access",
          "kitchen",
        ],
      },
    },
    landmark: {
      type: "string",
      description: "Nearby landmark or point of interest",
    },
    rating: {
      type: "number",
      description: "Minimum guest rating (0-10)",
      minimum: 0,
      maximum: 10,
    },
  },
  required: ["destination"],
  additionalProperties: false,
} as const;

// Zod parser
const accommodationSearchInputParser = z.object({
  destination: z.string(),
  coordinates: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  nights: z.number().min(1).optional(),
  adults: z.number().min(1).optional(),
  children: z.number().min(0).optional(),
  rooms: z.number().min(1).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  accommodationType: z
    .enum([
      "hotel",
      "apartment",
      "hostel",
      "guest-house",
      "vacation-home",
      "resort",
      "villa",
      "chalet",
      "bed-and-breakfast",
      "lodge",
    ])
    .optional(),
  facilities: z.array(z.string()).optional(),
  landmark: z.string().optional(),
  rating: z.number().min(0).max(10).optional(),
});

// Helper function to search accommodations using RapidAPI
async function searchAccommodationsAPI(params: {
  destination: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  adults?: number;
  children?: number;
  rooms?: number;
  minPrice?: number;
  maxPrice?: number;
  accommodationType?: string;
  facilities?: string[];
  rating?: number;
}) {
  if (!RAPIDAPI_KEY) {
    console.warn("[server.ts][245] --> RAPIDAPI_KEY not set, using mock data");
    return null;
  }

  try {
    // First, search for destination
    const searchUrl = `https://${RAPIDAPI_HOST}/booking/searchDestinations`;
    const searchParams = new URLSearchParams({
      query: params.destination,
    });

    const searchResponse = await fetch(`${searchUrl}?${searchParams}`, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    });

    if (!searchResponse.ok) {
      console.error("[server.ts][268] --> Failed to search destination:", searchResponse.statusText);
      return null;
    }

    const searchData = await searchResponse.json();
    if (!searchData.data || searchData.data.length === 0) {
      console.warn("[server.ts][274] --> No destination found for:", params.destination);
      return null;
    }

    const destId = searchData.data[0].dest_id;

    // Calculate dates if not provided
    let checkIn = params.checkIn;
    let checkOut = params.checkOut;
    
    if (!checkIn || !checkOut) {
      const today = new Date();
      checkIn = checkIn || new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      checkOut = checkOut || new Date(today.getTime() + (7 + (params.nights || 3)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    // Search for accommodations
    const hotelsUrl = `https://${RAPIDAPI_HOST}/booking/searchHotels`;
    const hotelsParams = new URLSearchParams({
      dest_id: destId,
      search_type: "city",
      arrival_date: checkIn,
      departure_date: checkOut,
      adults: String(params.adults || 2),
      children_age: params.children ? String(params.children) : "0",
      room_qty: String(params.rooms || 1),
      page_number: "1",
      units: "metric",
      temperature_unit: "c",
      languagecode: "en-us",
      currency_code: "USD",
    });

    const hotelsResponse = await fetch(`${hotelsUrl}?${hotelsParams}`, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    });

    if (!hotelsResponse.ok) {
      console.error("[server.ts][319] --> Failed to search accommodations:", hotelsResponse.statusText);
      return null;
    }

    const hotelsData = await hotelsResponse.json();
    
    // Transform API response to our format
    const accommodations = (hotelsData.data?.hotels || [])
      .slice(0, 10)
      .map((hotel: any) => ({
        id: hotel.hotel_id || hotel.id,
        name: hotel.property?.name || hotel.hotel_name,
        type: determineAccommodationType(hotel.property?.accommodationType || "hotel"),
        destination: params.destination,
        pricePerNight: Math.round(hotel.property?.priceBreakdown?.grossPrice?.value || hotel.min_total_price || 0),
        totalPrice: Math.round((hotel.property?.priceBreakdown?.grossPrice?.value || hotel.min_total_price || 0) * (params.nights || 3)),
        currency: "USD",
        images: hotel.property?.photoUrls || [hotel.max_photo_url] || ["https://via.placeholder.com/800x600"],
        mainImage: hotel.property?.photoUrls?.[0] || hotel.max_photo_url || "https://via.placeholder.com/800x600",
        rating: hotel.property?.reviewScore || hotel.review_score || 8.0,
        reviewScore: getReviewScore(hotel.property?.reviewScore || hotel.review_score || 8.0),
        reviewCount: hotel.property?.reviewCount || hotel.review_nr || 0,
        location: {
          address: hotel.property?.address || "N/A",
          city: params.destination,
          distance: hotel.property?.distance || `${hotel.distance || 0} km from city center`,
          landmark: hotel.property?.landmark || "City center",
          coordinates: hotel.property?.coordinates || { latitude: 0, longitude: 0 },
        },
        facilities: hotel.property?.facilities || extractFacilities(hotel.hotel_facilities),
        cancellation: hotel.property?.freeCancellation ? "Free cancellation" : "Non-refundable",
        breakfast: hotel.property?.mealPlan || "Breakfast options available",
        sustainability: {
          certified: hotel.property?.sustainabilityLevel > 0,
          level: hotel.property?.sustainabilityLevel || 0,
        },
      }));

    // Apply filters
    let filtered = accommodations;
    
    if (params.accommodationType) {
      filtered = filtered.filter((acc: any) => acc.type === params.accommodationType);
    }
    if (params.minPrice) {
      filtered = filtered.filter((acc: any) => acc.pricePerNight >= params.minPrice!);
    }
    if (params.maxPrice) {
      filtered = filtered.filter((acc: any) => acc.pricePerNight <= params.maxPrice!);
    }
    if (params.rating) {
      filtered = filtered.filter((acc: any) => acc.rating >= params.rating!);
    }
    if (params.facilities && params.facilities.length > 0) {
      filtered = filtered.filter((acc: any) =>
        params.facilities!.every((facility) =>
          acc.facilities.some((f: string) => f.toLowerCase().includes(facility.toLowerCase()))
        )
      );
    }

    return filtered;
  } catch (error) {
    console.error("[server.ts][387] --> Error searching accommodations:", error);
    return null;
  }
}

// Helper to determine accommodation type
function determineAccommodationType(type: string): string {
  const typeMap: Record<string, string> = {
    hotel: "hotel",
    apartment: "apartment",
    hostel: "hostel",
    "guest house": "guest-house",
    "vacation home": "vacation-home",
    resort: "resort",
    villa: "villa",
    chalet: "chalet",
    "bed and breakfast": "bed-and-breakfast",
    lodge: "lodge",
  };
  return typeMap[type.toLowerCase()] || "hotel";
}

// Helper to get review score text
function getReviewScore(score: number): string {
  if (score >= 9.5) return "Exceptional";
  if (score >= 9.0) return "Superb";
  if (score >= 8.5) return "Wonderful";
  if (score >= 8.0) return "Very Good";
  if (score >= 7.5) return "Good";
  return "Pleasant";
}

// Helper to extract facilities from API response
function extractFacilities(facilities: any): string[] {
  if (Array.isArray(facilities)) {
    return facilities.map((f: any) => f.name || f).filter(Boolean);
  }
  return ["wifi", "parking"];
}

const tools: Tool[] = [
  {
    name: "accomodations.search",
    description:
      "Use this when the user wants to find, search, view or compare different accommodation types for their trip, for example, hotels, hostels, apartments, homes, guest houses, lodging, chalets, amongst many more. The user can find accommodations by destination, dates, number of nights, guests, budget, landmarks, and/or facilities (e.g., pool, parking, free breakfast, gym, all‑inclusive, family‑friendly). LLM must provide a city or, if a city is not available, resolve the destination to coordinates. Returns available accommodation options with price, photos, guest ratings, and facilities.",
    inputSchema: accommodationSearchInputSchema,
    _meta: widgetMeta(widgetsById.get("accomodations.search")!),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    },
  },
];

const resources: Resource[] = Array.from(widgetsById.values()).map((widget) => ({
  uri: widget.templateUri,
  name: widget.title,
  description: `${widget.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

const resourceTemplates: ResourceTemplate[] = Array.from(widgetsById.values()).map(
  (widget) => ({
    uriTemplate: widget.templateUri,
    name: widget.title,
    description: `${widget.title} widget markup`,
    mimeType: "text/html+skybridge",
    _meta: widgetMeta(widget),
  })
);

function createBookingServer(): Server {
  const server = new Server(
    {
      name: "booking-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (_request: ListResourcesRequest) => ({
      resources,
    })
  );

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      const widget = widgetsByUri.get(request.params.uri);

      if (!widget) {
        throw new Error(`Unknown resource: ${request.params.uri}`);
      }

      return {
        contents: [
          {
            uri: widget.templateUri,
            mimeType: "text/html+skybridge",
            text: widget.html,
            _meta: widgetMeta(widget),
          },
        ],
      };
    }
  );

  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async (_request: ListResourceTemplatesRequest) => ({
      resourceTemplates,
    })
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request: ListToolsRequest) => ({
      tools,
    })
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const toolName = request.params.name;

      if (toolName === "accomodations.search") {
        const args = accommodationSearchInputParser.parse(
          request.params.arguments ?? {}
        );
        const widget = widgetsById.get(toolName)!;

        // Try to use real API, fall back to mock data if API fails or key not set
        let accommodations = await searchAccommodationsAPI({
          destination: args.destination,
          checkIn: args.checkIn,
          checkOut: args.checkOut,
          nights: args.nights,
          adults: args.adults,
          children: args.children,
          rooms: args.rooms,
          minPrice: args.minPrice,
          maxPrice: args.maxPrice,
          accommodationType: args.accommodationType,
          facilities: args.facilities,
          rating: args.rating,
        });

        // Fallback to mock data if API call fails
        if (!accommodations || accommodations.length === 0) {
          console.warn("[server.ts][550] --> Using mock accommodation data");
          const mockAccommodations = [
            {
              id: "b1",
              name: "Grand Hotel & Spa",
              type: "hotel",
              destination: args.destination,
              pricePerNight: 185,
              totalPrice: (args.nights || 3) * 185,
              currency: "USD",
              images: [
                "https://via.placeholder.com/800x600",
                "https://via.placeholder.com/800x600",
              ],
              mainImage: "https://via.placeholder.com/800x600",
              rating: 8.9,
              reviewScore: "Excellent",
              reviewCount: 2847,
              location: {
                address: "123 Main Street",
                city: args.destination,
                distance: "0.5 km from city center",
                landmark: args.landmark || "Central Station",
                coordinates: args.coordinates || { latitude: 40.7128, longitude: -74.006 },
              },
              facilities: [
                "free-wifi",
                "pool",
                "spa",
                "gym",
                "restaurant",
                "parking",
                "airport-shuttle",
              ],
              cancellation: "Free cancellation until 24 hours before check-in",
              breakfast: "Breakfast included",
              sustainability: {
                certified: true,
                level: 2,
              },
            },
            {
              id: "b2",
              name: "Cozy Downtown Apartment",
              type: "apartment",
              destination: args.destination,
              pricePerNight: 120,
              totalPrice: (args.nights || 3) * 120,
              currency: "USD",
              images: ["https://via.placeholder.com/800x600"],
              mainImage: "https://via.placeholder.com/800x600",
              rating: 9.2,
              reviewScore: "Superb",
              reviewCount: 456,
              location: {
                address: "45 Park Avenue",
                city: args.destination,
                distance: "0.2 km from city center",
                landmark: args.landmark || "Main Square",
                coordinates: args.coordinates || { latitude: 40.7128, longitude: -74.006 },
              },
              facilities: [
                "free-wifi",
                "kitchen",
                "parking",
                "family-friendly",
                "washing-machine",
              ],
              cancellation: "Free cancellation until 3 days before check-in",
              breakfast: "Self-catering",
              sustainability: {
                certified: false,
                level: 0,
              },
            },
            {
              id: "b3",
              name: "Luxury Beach Resort",
              type: "resort",
              destination: args.destination,
              pricePerNight: 389,
              totalPrice: (args.nights || 3) * 389,
              currency: "USD",
              images: [
                "https://via.placeholder.com/800x600",
                "https://via.placeholder.com/800x600",
                "https://via.placeholder.com/800x600",
              ],
              mainImage: "https://via.placeholder.com/800x600",
              rating: 9.5,
              reviewScore: "Exceptional",
              reviewCount: 1523,
              location: {
                address: "789 Beachfront Drive",
                city: args.destination,
                distance: "3.2 km from city center",
                landmark: args.landmark || "Beach",
                coordinates: args.coordinates || { latitude: 40.7128, longitude: -74.006 },
              },
              facilities: [
                "free-wifi",
                "pool",
                "spa",
                "gym",
                "restaurant",
                "beach-access",
                "all-inclusive",
                "kids-club",
                "tennis-court",
              ],
              cancellation: "Non-refundable",
              breakfast: "All-inclusive (all meals included)",
              sustainability: {
                certified: true,
                level: 3,
              },
            },
          ];

          // Apply filters to mock data
          accommodations = mockAccommodations;
          
          if (args.accommodationType) {
            accommodations = accommodations.filter(
              (acc) => acc.type === args.accommodationType
            );
          }
          if (args.minPrice) {
            accommodations = accommodations.filter(
              (acc) => acc.pricePerNight >= args.minPrice!
            );
          }
          if (args.maxPrice) {
            accommodations = accommodations.filter(
              (acc) => acc.pricePerNight <= args.maxPrice!
            );
          }
          if (args.rating) {
            accommodations = accommodations.filter(
              (acc) => acc.rating >= args.rating!
            );
          }
          if (args.facilities && args.facilities.length > 0) {
            accommodations = accommodations.filter((acc) =>
              args.facilities!.every((facility) =>
                acc.facilities.some((f) => f.includes(facility.toLowerCase()))
              )
            );
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `Found ${accommodations.length} accommodation options in ${args.destination}${args.checkIn ? ` from ${args.checkIn}` : ""}${args.checkOut ? ` to ${args.checkOut}` : ""}.${!RAPIDAPI_KEY ? " (Using mock data - set RAPIDAPI_KEY for real results)" : ""}`,
            },
          ],
          structuredContent: {
            destination: args.destination,
            checkIn: args.checkIn,
            checkOut: args.checkOut,
            nights: args.nights || 3,
            adults: args.adults || 2,
            children: args.children || 0,
            rooms: args.rooms || 1,
            accommodations: accommodations,
            totalResults: accommodations.length,
            filters: {
              accommodationType: args.accommodationType,
              facilities: args.facilities,
              minPrice: args.minPrice,
              maxPrice: args.maxPrice,
              rating: args.rating,
            },
            usingMockData: !RAPIDAPI_KEY,
          },
          _meta: widgetMeta(widget),
        };
      }

      throw new Error(`Unknown tool: ${toolName}`);
    }
  );

  return server;
}

type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();

const ssePath = "/mcp";
const postPath = "/mcp/messages";

async function handleSseRequest(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = createBookingServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;

  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    sessions.delete(sessionId);
    await server.close();
  };

  transport.onerror = (error) => {
    console.error("SSE transport error", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(sessionId);
    console.error("Failed to start SSE session", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Failed to process message", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

const portEnv = Number(process.env.PORT ?? 8000);
const port = Number.isFinite(portEnv) ? portEnv : 8000;

const httpServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (
      req.method === "OPTIONS" &&
      (url.pathname === ssePath || url.pathname === postPath)
    ) {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === ssePath) {
      await handleSseRequest(res);
      return;
    }

    if (req.method === "POST" && url.pathname === postPath) {
      await handlePostMessage(req, res, url);
      return;
    }

    res.writeHead(404).end("Not Found");
  }
);

httpServer.on("clientError", (err: Error, socket) => {
  console.error("HTTP client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

httpServer.listen(port, () => {
  console.log(`Booking.com MCP server listening on http://localhost:${port}`);
  console.log(`  SSE stream: GET http://localhost:${port}${ssePath}`);
  console.log(
    `  Message post endpoint: POST http://localhost:${port}${postPath}?sessionId=...`
  );
});

