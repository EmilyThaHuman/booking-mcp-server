import { useOpenAiGlobal } from "./use-openai-global";

export function useWidgetProps<T extends Record<string, unknown>>(
  defaultState?: T | (() => T)
): T {
  // In preview mode, return mock data instead of reading from OpenAI global
  const mockData = {
    accommodations: [
      {
        id: '7696424',
        name: 'STAGES HOTEL Prague, a Tribute Portfolio Hotel',
        type: 'hotel',
        mainImage: 'https://cf.bstatic.com/xdata/images/hotel/max1280x900/430825435.jpg?k=3e8a521794862527b7c7ab2316a108088ddb3c23e39d861aa63322e7d0534c7d&o=',
        rating: 9.4,
        reviewCount: 15982,
        pricePerNight: 220,
        location: {
          distance: '5.6 km from city center',
        },
        facilities: ['WiFi', 'Parking', 'Restaurant', '24-hour front desk', 'Fitness centre', 'Bar', 'Spa and wellness centre', 'Room service'],
        sustainability: {
          certified: false,
          level: 0,
        },
      },
      {
        id: '77320',
        name: 'Hotel Duo & Wellness',
        type: 'hotel',
        mainImage: 'https://cf.bstatic.com/xdata/images/hotel/max1280x900/493721137.jpg?k=058b6988395d2c397c8da154e92d9ab4022b0f3c4a6e59703e69c242fb2e9fdd&o=',
        rating: 8.7,
        reviewCount: 11781,
        pricePerNight: 165,
        location: {
          distance: '6.8 km from city center',
        },
        facilities: ['WiFi', 'Swimming pool', 'Spa and wellness centre', 'Parking', 'Restaurant', 'Bar', 'Fitness centre'],
        sustainability: {
          certified: false,
          level: 0,
        },
      },
      {
        id: 'mock_resort',
        name: 'Luxury Beach Resort & Spa',
        type: 'resort',
        mainImage: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop',
        rating: 9.5,
        reviewCount: 1523,
        pricePerNight: 389,
        location: {
          distance: '3.2 km from city center',
        },
        facilities: ['WiFi', 'Swimming pool', 'Spa and wellness centre', 'Restaurant', 'Beach access', 'Bar', 'Fitness centre', 'Airport shuttle'],
        sustainability: {
          certified: true,
          level: 3,
        },
      },
      {
        id: 'mock_apartment',
        name: 'Modern City Center Apartment',
        type: 'apartment',
        mainImage: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
        rating: 9.1,
        reviewCount: 456,
        pricePerNight: 145,
        location: {
          distance: '0.2 km from city center',
        },
        facilities: ['WiFi', 'Kitchen', 'Parking', 'Family rooms', 'Laundry', 'Heating', 'Air conditioning'],
        sustainability: {
          certified: false,
          level: 0,
        },
      },
      {
        id: 'mock_villa',
        name: 'Secluded Mountain Villa',
        type: 'villa',
        mainImage: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop',
        rating: 9.8,
        reviewCount: 287,
        pricePerNight: 475,
        location: {
          distance: '12 km from city center',
        },
        facilities: ['WiFi', 'Swimming pool', 'Kitchen', 'Parking', 'Terrace', 'BBQ facilities', 'Heating', 'Family rooms'],
        sustainability: {
          certified: true,
          level: 2,
        },
      },
    ],
    destination: 'Prague, Czech Republic',
    checkIn: 'Dec 15, 2024',
    checkOut: 'Dec 18, 2024',
    nights: 3,
    totalResults: 390,
    filters: {},
  };

  return mockData as unknown as T;
}
