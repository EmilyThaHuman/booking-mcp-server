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
const RAPIDAPI_HOST = "booking-com.p.rapidapi.com";

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
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const ASSETS_DIR = path.resolve(ROOT_DIR, "assets");

function readWidgetHtml(componentName: string): string {
  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(
      `Widget assets not found. Expected directory ${ASSETS_DIR}. Run "npm run build" before starting the server.`
    );
  }

  // Try direct path first
  const directPath = path.join(ASSETS_DIR, `${componentName}.html`);
  let htmlContents: string | null = null;

  if (fs.existsSync(directPath)) {
    htmlContents = fs.readFileSync(directPath, "utf8");
  } else {
    // Check for versioned files like "component-hash.html"
    const candidates = fs
      .readdirSync(ASSETS_DIR)
      .filter(
        (file) => file.startsWith(`${componentName}-`) && file.endsWith(".html")
      )
      .sort();
    const fallback = candidates[candidates.length - 1];
    if (fallback) {
      htmlContents = fs.readFileSync(path.join(ASSETS_DIR, fallback), "utf8");
    } else {
      // Check in src/components subdirectory as fallback
      const nestedPath = path.join(ASSETS_DIR, "src", "components", `${componentName}.html`);
      if (fs.existsSync(nestedPath)) {
        htmlContents = fs.readFileSync(nestedPath, "utf8");
      }
    }
  }

  if (!htmlContents) {
    throw new Error(
      `Widget HTML for "${componentName}" not found in ${ASSETS_DIR}. Run "npm run build" to generate the assets.`
    );
  }

  return htmlContents;
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
    id: "accommodations_search",
    title: "Booking.com Accommodation Search",
    templateUri: "ui://widget/booking-search-results.html",
    invoking: "Searching for stays on Booking.com...",
    invoked: "Results from Booking.com ready",
    html: readWidgetHtml("booking-search-results"),
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
    console.warn("[server.ts] --> RAPIDAPI_KEY not set, using mock data");
    return null;
  }

  try {
    // First, search for destination to get dest_id
    const locationsUrl = `https://${RAPIDAPI_HOST}/v1/hotels/locations`;
    const locationsParams = new URLSearchParams({
      name: params.destination,
      locale: 'en-gb',
    });

    const locationsResponse = await fetch(`${locationsUrl}?${locationsParams}`, {
      method: "GET",
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    });

    if (!locationsResponse.ok) {
      console.error("[server.ts] --> Failed to search location:", locationsResponse.statusText);
      return null;
    }

    const locationsData: any = await locationsResponse.json();
    if (!locationsData || !Array.isArray(locationsData) || locationsData.length === 0) {
      console.warn("[server.ts] --> No location found for:", params.destination);
      return null;
    }

    const destId = locationsData[0].dest_id;
    const destType = locationsData[0].dest_type || 'city';

    // Calculate dates if not provided
    let checkIn = params.checkIn;
    let checkOut = params.checkOut;
    
    if (!checkIn || !checkOut) {
      const today = new Date();
      checkIn = checkIn || new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      checkOut = checkOut || new Date(today.getTime() + (7 + (params.nights || 3)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    // Search for hotels
    const searchUrl = `https://${RAPIDAPI_HOST}/v1/hotels/search`;
    const searchParams = new URLSearchParams({
      checkout_date: checkOut,
      units: 'metric',
      dest_id: String(destId),
      dest_type: destType,
      locale: 'en-gb',
      adults_number: String(params.adults || 2),
      order_by: 'popularity',
      filter_by_currency: 'USD',
      checkin_date: checkIn,
      room_number: String(params.rooms || 1),
      children_number: String(params.children || 0),
      page_number: '0',
      include_adjacency: 'true',
      children_ages: '5,0',
      categories_filter_ids: 'class::2,class::4,free_cancellation::1',
    });

    const searchResponse = await fetch(`${searchUrl}?${searchParams}`, {
      method: "GET",
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    });

    if (!searchResponse.ok) {
      console.error("[server.ts] --> Failed to search accommodations:", searchResponse.statusText);
      return null;
    }

    const searchData: any = await searchResponse.json();
    
    // Transform API response to our format
    const accommodations = (searchData.result || [])
      .slice(0, 10)
      .map((hotel: any) => ({
        id: String(hotel.hotel_id),
        name: hotel.hotel_name || hotel.hotel_name_trans,
        type: determineAccommodationType(hotel.accommodation_type_name || 'hotel'),
        destination: params.destination,
        pricePerNight: Math.round(hotel.min_total_price / (params.nights || 1)),
        totalPrice: Math.round(hotel.min_total_price || 0),
        currency: hotel.currency_code || 'USD',
        images: [hotel.max_1440_photo_url || hotel.max_photo_url],
        mainImage: hotel.max_1440_photo_url || hotel.max_photo_url || 'https://via.placeholder.com/800x600',
        rating: hotel.review_score || 8.0,
        reviewScore: hotel.review_score_word || getReviewScore(hotel.review_score || 8.0),
        reviewCount: hotel.review_nr || 0,
        location: {
          address: hotel.address || hotel.address_trans || 'N/A',
          city: hotel.city || params.destination,
          distance: hotel.distance_to_cc_formatted || `${hotel.distance || 0} km from city center`,
          landmark: hotel.district || 'City center',
          coordinates: {
            latitude: hotel.latitude || 0,
            longitude: hotel.longitude || 0,
          },
        },
        facilities: extractFacilitiesFromIds(hotel.hotel_facilities),
        cancellation: hotel.is_free_cancellable ? 'Free cancellation' : 'Non-refundable',
        breakfast: hotel.ribbon_text || 'Breakfast options available',
        sustainability: {
          certified: false,
          level: 0,
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
    console.error("[server.ts] --> Error searching accommodations:", error);
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
  return ["Wifi", "Parking"];
}

// Helper to extract facilities from facility IDs (Booking.com v1 API)
function extractFacilitiesFromIds(facilityIds: string): string[] {
  if (!facilityIds) return ["Wifi", "Parking"];
  
  // Common facility mappings based on Booking.com facility IDs
  const facilityMap: Record<string, string> = {
    '2': 'Parking',
    '3': 'Restaurant',
    '4': '24-hour front desk',
    '6': 'Non-smoking rooms',
    '7': 'Facilities for disabled guests',
    '8': 'Family rooms',
    '11': 'Airport shuttle',
    '14': 'Spa and wellness centre',
    '16': 'Bar',
    '17': 'Breakfast',
    '20': 'Free toiletries',
    '22': 'Hairdryer',
    '28': 'Car rental',
    '47': 'Safety deposit box',
    '48': 'Heating',
    '51': 'Soundproof rooms',
    '53': 'Express check-in/check-out',
    '54': 'Packed lunches',
    '75': 'Designated smoking area',
    '81': 'Sun terrace',
    '91': 'VIP room facilities',
    '96': 'Bridal suite',
    '107': 'Private check-in/check-out',
    '108': 'Swimming pool',
    '109': 'Terrace',
    '111': 'Ironing facilities',
    '121': 'Hot tub',
    '124': 'Fitness centre',
    '158': 'Gift shop',
    '160': 'Ticket service',
    '163': 'Business centre',
    '177': 'Air conditioning',
    '181': 'Electric kettle',
    '184': 'WiFi',
    '421': 'Mini golf',
    '436': 'BBQ facilities',
    '439': 'Meeting/banquet facilities',
    '449': 'Bicycle rental',
    '455': 'Massage',
    '459': 'Concierge service',
    '466': 'Lift',
    '490': 'Room service',
    '491': 'Currency exchange',
    '495': 'Laundry',
    '517': 'Shops on site',
  };

  const ids = facilityIds.split(',').map(id => id.trim());
  const facilities: string[] = [];
  
  // Get first 6 matched facilities
  for (const id of ids) {
    if (facilityMap[id]) {
      facilities.push(facilityMap[id]);
      if (facilities.length >= 6) break;
    }
  }
  
  // Ensure we have at least some facilities
  if (facilities.length === 0) {
    return ['WiFi', 'Parking', '24-hour front desk'];
  }
  
  return facilities;
}

const tools: Tool[] = [
  {
    name: "accommodations_search",
    description:
      "Use this when the user wants to find, search, view or compare different accommodation types for their trip, for example, hotels, hostels, apartments, homes, guest houses, lodging, chalets, amongst many more. The user can find accommodations by destination, dates, number of nights, guests, budget, landmarks, and/or facilities (e.g., pool, parking, free breakfast, gym, all‑inclusive, family‑friendly). LLM must provide a city or, if a city is not available, resolve the destination to coordinates. Returns available accommodation options with price, photos, guest ratings, and facilities.",
    inputSchema: accommodationSearchInputSchema,
    _meta: widgetMeta(widgetsById.get("accommodations_search")!),
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

      if (toolName === "accommodations_search") {
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
          console.warn("[server.ts][550] --> Using mock accommodation data from real Booking.com sample");
          const mockAccommodations = [
            {
              id: "7696424",
              name: "STAGES HOTEL Prague, a Tribute Portfolio Hotel",
              type: "hotel",
              destination: args.destination,
              pricePerNight: 220,
              totalPrice: (args.nights || 3) * 220,
              currency: "USD",
              images: [
                "https://cf.bstatic.com/xdata/images/hotel/max1280x900/430825435.jpg?k=3e8a521794862527b7c7ab2316a108088ddb3c23e39d861aa63322e7d0534c7d&o=",
                "https://cf.bstatic.com/xdata/images/hotel/1440x1440/430825435.jpg?k=3e8a521794862527b7c7ab2316a108088ddb3c23e39d861aa63322e7d0534c7d&o=",
              ],
              mainImage: "https://cf.bstatic.com/xdata/images/hotel/max1280x900/430825435.jpg?k=3e8a521794862527b7c7ab2316a108088ddb3c23e39d861aa63322e7d0534c7d&o=",
              rating: 9.4,
              reviewScore: "Superb",
              reviewCount: 15982,
              location: {
                address: "Ceskomoravska 19a",
                city: args.destination,
                distance: "5.6 km from city center",
                landmark: args.landmark || "Prague 9",
                coordinates: { latitude: 50.104384958882, longitude: 14.4953591788171 },
              },
              facilities: [
                "WiFi",
                "Parking",
                "Restaurant",
                "24-hour front desk",
                "Fitness centre",
                "Bar",
                "Spa and wellness centre",
                "Room service",
              ],
              cancellation: "Free cancellation",
              breakfast: "Breakfast included",
              sustainability: {
                certified: false,
                level: 0,
              },
            },
            {
              id: "77320",
              name: "Hotel Duo & Wellness",
              type: "hotel",
              destination: args.destination,
              pricePerNight: 165,
              totalPrice: (args.nights || 3) * 165,
              currency: "USD",
              images: [
                "https://cf.bstatic.com/xdata/images/hotel/max1280x900/493721137.jpg?k=058b6988395d2c397c8da154e92d9ab4022b0f3c4a6e59703e69c242fb2e9fdd&o=",
              ],
              mainImage: "https://cf.bstatic.com/xdata/images/hotel/max1280x900/493721137.jpg?k=058b6988395d2c397c8da154e92d9ab4022b0f3c4a6e59703e69c242fb2e9fdd&o=",
              rating: 8.7,
              reviewScore: "Excellent",
              reviewCount: 11781,
              location: {
                address: "Teplická 492",
                city: args.destination,
                distance: "6.8 km from city center",
                landmark: args.landmark || "Prague 9",
                coordinates: { latitude: 50.1203, longitude: 14.5156 },
              },
              facilities: [
                "WiFi",
                "Swimming pool",
                "Spa and wellness centre",
                "Parking",
                "Restaurant",
                "Bar",
                "Fitness centre",
                "Room service",
              ],
              cancellation: "Free cancellation",
              breakfast: "Breakfast available",
              sustainability: {
                certified: false,
                level: 0,
              },
            },
            {
              id: "mock_resort",
              name: "Luxury Beach Resort & Spa",
              type: "resort",
              destination: args.destination,
              pricePerNight: 389,
              totalPrice: (args.nights || 3) * 389,
              currency: "USD",
              images: [
                "https://cf.bstatic.com/xdata/images/hotel/max1280x900/400000000.jpg",
              ],
              mainImage: "https://cf.bstatic.com/xdata/images/hotel/max1280x900/400000000.jpg",
              rating: 9.5,
              reviewScore: "Exceptional",
              reviewCount: 1523,
              location: {
                address: "789 Beachfront Drive",
                city: args.destination,
                distance: "3.2 km from city center",
                landmark: args.landmark || "Beach",
                coordinates: { latitude: 40.7128, longitude: -74.006 },
              },
              facilities: [
                "WiFi",
                "Swimming pool",
                "Spa and wellness centre",
                "Restaurant",
                "Beach access",
                "Bar",
                "Fitness centre",
                "Airport shuttle",
              ],
              cancellation: "Non-refundable",
              breakfast: "All-inclusive (all meals included)",
              sustainability: {
                certified: true,
                level: 3,
              },
            },
            {
              id: "mock_apartment",
              name: "Modern City Center Apartment",
              type: "apartment",
              destination: args.destination,
              pricePerNight: 145,
              totalPrice: (args.nights || 3) * 145,
              currency: "USD",
              images: [
                "https://cf.bstatic.com/xdata/images/hotel/max1280x900/300000000.jpg",
              ],
              mainImage: "https://cf.bstatic.com/xdata/images/hotel/max1280x900/300000000.jpg",
              rating: 9.1,
              reviewScore: "Superb",
              reviewCount: 456,
              location: {
                address: "45 Park Avenue",
                city: args.destination,
                distance: "0.2 km from city center",
                landmark: args.landmark || "Main Square",
                coordinates: { latitude: 40.7128, longitude: -74.006 },
              },
              facilities: [
                "WiFi",
                "Kitchen",
                "Parking",
                "Family rooms",
                "Laundry",
                "Heating",
                "Air conditioning",
              ],
              cancellation: "Free cancellation until 3 days before check-in",
              breakfast: "Self-catering",
              sustainability: {
                certified: false,
                level: 0,
              },
            },
            {
              id: "mock_villa",
              name: "Secluded Mountain Villa",
              type: "villa",
              destination: args.destination,
              pricePerNight: 475,
              totalPrice: (args.nights || 3) * 475,
              currency: "USD",
              images: [
                "https://cf.bstatic.com/xdata/images/hotel/max1280x900/500000000.jpg",
              ],
              mainImage: "https://cf.bstatic.com/xdata/images/hotel/max1280x900/500000000.jpg",
              rating: 9.8,
              reviewScore: "Exceptional",
              reviewCount: 287,
              location: {
                address: "Mountain Ridge Road 15",
                city: args.destination,
                distance: "12 km from city center",
                landmark: args.landmark || "Mountain View",
                coordinates: { latitude: 40.7128, longitude: -74.006 },
              },
              facilities: [
                "WiFi",
                "Swimming pool",
                "Kitchen",
                "Parking",
                "Terrace",
                "BBQ facilities",
                "Heating",
                "Family rooms",
              ],
              cancellation: "Free cancellation until 7 days before check-in",
              breakfast: "Self-catering",
              sustainability: {
                certified: true,
                level: 2,
              },
            },
          ];

          // Apply filters to mock data
          accommodations = mockAccommodations;
          
          if (args.accommodationType) {
            accommodations = accommodations      .filter(
              (acc: any) => acc.type === args.accommodationType
            );
          }
          if (args.minPrice) {
            accommodations = accommodations      .filter(
              (acc: any) => acc.pricePerNight >= args.minPrice!
            );
          }
          if (args.maxPrice) {
            accommodations = accommodations      .filter(
              (acc: any) => acc.pricePerNight <= args.maxPrice!
            );
          }
          if (args.rating) {
            accommodations = accommodations      .filter(
              (acc: any) => acc.rating >= args.rating!
            );
          }
          if (args.facilities && args.facilities.length > 0) {
            accommodations = accommodations.filter((acc: any) =>
              args.facilities!.every((facility: string) =>
                acc.facilities.some((f: string) => f.includes(facility.toLowerCase()))
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
  // CORS headers are already set by main handler, but SSE needs them early
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
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
  // CORS headers are already set by main handler
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
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

// Handle direct JSON-RPC requests without SSE (for resource fetching)
async function handleDirectJsonRpc(
  req: IncomingMessage,
  res: ServerResponse
) {
  let body = "";
  
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    try {
      const request = JSON.parse(body);
      console.log("[handleDirectJsonRpc] Request:", request);

      // Handle resources/read for widget fetching
      if (request.method === "resources/read") {
        const uri = request.params?.uri;
        const widget = widgetsByUri.get(uri);

        if (!widget) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32602,
              message: `Unknown resource: ${uri}`,
            },
          }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            contents: [
              {
                uri: widget.templateUri,
                mimeType: "text/html+skybridge",
                text: widget.html,
                _meta: widgetMeta(widget),
              },
            ],
          },
        }));
        return;
      }

      // Handle resources/list
      if (request.method === "resources/list") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            resources: resources,
          },
        }));
        return;
      }

      // Method not supported in direct mode
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32601,
          message: `Method not supported in direct mode: ${request.method}`,
        },
      }));
    } catch (error: any) {
      console.error("[handleDirectJsonRpc] Error:", error);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
        },
      }));
    }
  });
}

const portEnv = Number(process.env.PORT ?? 8000);
const port = Number.isFinite(portEnv) ? portEnv : 8000;

// Helper function to set CORS headers
function setCorsHeaders(res: ServerResponse, origin?: string) {
  const allowedOrigins = [
    'https://zerotwo.ai',
    'http://localhost:3000',
    'http://localhost:5173', // Vite dev server
  ];
  
  const requestOrigin = origin || '*';
  const allowOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : '*';
  
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

const httpServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin;
    
    // Set CORS headers on all responses
    setCorsHeaders(res, origin);
    
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (
      req.method === "OPTIONS" &&
      (url.pathname === ssePath || url.pathname === postPath)
    ) {
      res.writeHead(204);
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

    // Handle direct JSON-RPC POST to /mcp (for resource fetching without SSE)
    if (req.method === "POST" && url.pathname === ssePath) {
      await handleDirectJsonRpc(req, res);
      return;
    }

    // Serve static assets for widgets
    if (req.method === "GET") {
      // Remove leading slash from pathname
      const assetPath = url.pathname.slice(1);
      const fullPath = path.join(ASSETS_DIR, assetPath);

      // Security check: ensure the path is within ASSETS_DIR
      const resolvedPath = path.resolve(fullPath);
      if (!resolvedPath.startsWith(path.resolve(ASSETS_DIR))) {
        res.writeHead(403).end("Forbidden");
        return;
      }

      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        const ext = path.extname(resolvedPath).toLowerCase();
        const contentTypes: { [key: string]: string } = {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".gif": "image/gif",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon",
        };

        const contentType = contentTypes[ext] || "application/octet-stream";
        
        res.writeHead(200, {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        });
        fs.createReadStream(resolvedPath).pipe(res);
        return;
      }
    }

    res.writeHead(404).end("Not Found");
  }
);

httpServer.on("clientError", (err: Error, socket: any) => {
  console.error("HTTP client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Booking.com MCP server listening on http://0.0.0.0:${port}`);
  console.log(`  SSE stream: GET http://0.0.0.0:${port}${ssePath}`);
  console.log(
    `  Message post endpoint: POST http://localhost:${port}${postPath}?sessionId=...`
  );
});

