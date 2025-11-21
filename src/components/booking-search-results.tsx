import React, { useRef, useState, useEffect } from 'react';
import { useWidgetProps, useDisplayMode } from '../hooks';
import '../styles/index.css';
import { cn } from '../lib/utils';

interface Accommodation {
  id: string;
  name: string;
  type: string;
  mainImage?: string;
  rating: number;
  reviewCount?: number;
  pricePerNight: number;
  location?: {
    distance?: string;
  };
  facilities: string[];
  sustainability?: {
    certified: boolean;
    level?: number;
  };
}

interface Props extends Record<string, unknown> {
  accommodations: Accommodation[];
  destination: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalResults: number;
  filters?: Record<string, unknown>;
}

const BookingSearchResults: React.FC = () => {
  const props = useWidgetProps<Props>({
    accommodations: [],
    destination: 'Search Results',
    checkIn: '',
    checkOut: '',
    nights: 0,
    totalResults: 0,
    filters: {}
  });

  const { accommodations, destination, checkIn, checkOut, nights, totalResults } = props;
  const displayMode = useDisplayMode();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPrevButton, setShowPrevButton] = useState(false);
  const [showNextButton, setShowNextButton] = useState(true);

  const updateButtons = () => {
    if (!containerRef.current) return;
    
    const scrollLeft = containerRef.current.scrollLeft;
    const maxScroll = containerRef.current.scrollWidth - containerRef.current.clientWidth;
    
    setShowPrevButton(scrollLeft > 0);
    setShowNextButton(scrollLeft < maxScroll - 1);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    updateButtons();
    
    container.addEventListener('scroll', updateButtons);
    window.addEventListener('resize', updateButtons);
    
    return () => {
      container.removeEventListener('scroll', updateButtons);
      window.removeEventListener('resize', updateButtons);
    };
  }, [accommodations]);

  const scrollPrev = () => {
    if (containerRef.current) {
      const scrollAmount = containerRef.current.clientWidth;
      containerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollNext = () => {
    if (containerRef.current) {
      const scrollAmount = containerRef.current.clientWidth;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleAccommodationClick = (acc: Accommodation) => {
    if (window.parent && window.parent.postMessage) {
      window.parent.postMessage({
        type: 'accommodation-selected',
        data: { 
          id: acc.id, 
          name: acc.name,
          price: acc.pricePerNight,
          rating: acc.rating,
          type: acc.type
        }
      }, '*');
    }
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating / 2);
    const stars = [];
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <svg key={i} className="w-4 h-4 fill-yellow-500" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    }
    return stars;
  };

  const getAccommodationTypeIcon = (type: string): JSX.Element => {
    const typeIcons: Record<string, JSX.Element> = {
      'hotel': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-6v7H3V6H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/>
        </svg>
      ),
      'apartment': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 11V3H7v4H3v14h8v-4h2v4h8V11h-4zM7 19H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm4 4H9v-2h2v2zm0-4H9V9h2v2zm0-4H9V5h2v2zm4 8h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm4 12h-2v-2h2v2zm0-4h-2v-2h2v2z"/>
        </svg>
      ),
      'resort': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 22q-.825 0-1.412-.587Q4 20.825 4 20V10q0-.825.588-1.413Q5.175 8 6 8h1V6q0-.825.588-1.413Q8.175 4 9 4h6q.825 0 1.413.587Q17 5.175 17 6v2h1q.825 0 1.413.587Q20 9.175 20 10v10q0 .825-.587 1.413Q18.825 22 18 22zm3-10h6v-2H9zm0 4h6v-2H9z"/>
        </svg>
      ),
      'hostel': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 8V4l8 4-8 4zm8-2l2-1v1h5v4h-2v6h-2v-6H9V5l3 1.5V6z"/>
          <path d="M2 17v2h2v-2h2v-2H2v2zm0 4v2h6v-2H2zm4-2H4v2h2v-2z"/>
        </svg>
      ),
      'villa': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 10c-1.1 0-2 .9-2 2h-1V3L3 8v13h18v-9c0-1.1-.9-2-2-2zM5 9.37l9-3.46V12H9v7H5V9.37zM19 19h-3v-3h-2v3h-3v-5h8v5z"/>
        </svg>
      ),
      'guest-house': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.84L18 11v8h-2v-6H8v6H6v-8l6-5.16z"/>
        </svg>
      ),
      'vacation-home': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5.69l5 4.5V18h-2v-6H9v6H7v-7.81l5-4.5M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"/>
        </svg>
      ),
      'chalet': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3L4 9v12h16V9l-8-6zm6 16h-3v-4h-2v4H8v-7l4-3 4 3v7z"/>
        </svg>
      ),
      'bed-and-breakfast': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V7H1v13h2v-2h18v2h2v-9c0-2.21-1.79-4-4-4z"/>
        </svg>
      ),
      'lodge': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z"/>
        </svg>
      ),
    };
    
    const normalizedType = type.toLowerCase().replace(/\s+/g, '-');
    return typeIcons[normalizedType] || typeIcons['hotel'];
  };

  const getFacilityIcon = (facility: string): JSX.Element | null => {
    const facilityLower = facility.toLowerCase();
    const facilityMap: Record<string, JSX.Element> = {
      'parking': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z"/>
        </svg>
      ),
      'wifi': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
          <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
          <line x1="12" y1="20" x2="12.01" y2="20"/>
        </svg>
      ),
      '24-hour': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
        </svg>
      ),
      'terrace': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/>
        </svg>
      ),
      'pool': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22 21c-1.11 0-1.73-.37-2.18-.64-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.08.64-2.19.64-1.11 0-1.73-.37-2.18-.64-.37-.23-.6-.36-1.15-.36s-.78.13-1.15.36c-.46.27-1.08.64-2.19.64v-2c.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64 1.11 0 1.73.37 2.18.64.37.22.6.36 1.15.36s.78-.13 1.15-.36c.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36v2zm0-4.5c-1.11 0-1.73-.37-2.18-.64-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.45.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.45.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36s-.78.13-1.15.36c-.47.27-1.09.64-2.2.64v-2c.56 0 .78-.13 1.15-.36.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36.56 0 .78-.13 1.15-.36.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36s.78-.13 1.15-.36c.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36v2zM8.67 12c.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64 1.11 0 1.73.37 2.18.64.37.22.6.36 1.15.36s.78-.13 1.15-.36c.12-.07.26-.15.41-.23L10.48 5C8.93 3.45 7.5 2.99 5 3v2.5c1.82-.01 2.89.39 4 1.5l1 1-3.25 3.25c.31.12.56.27.77.39.37.23.59.36 1.15.36z"/>
        </svg>
      ),
      'swimming': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22 21c-1.11 0-1.73-.37-2.18-.64-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.08.64-2.19.64-1.11 0-1.73-.37-2.18-.64-.37-.23-.6-.36-1.15-.36s-.78.13-1.15.36c-.46.27-1.08.64-2.19.64v-2c.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64 1.11 0 1.73.37 2.18.64.37.22.6.36 1.15.36s.78-.13 1.15-.36c.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36v2z"/>
        </svg>
      ),
      'restaurant': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
        </svg>
      ),
      'gym': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
        </svg>
      ),
      'fitness': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
        </svg>
      ),
      'spa': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.55 12c-1.07-.71-2.25-1.27-3.53-1.61 1.28.34 2.46.9 3.53 1.61zm10.43-1.61c-1.29.34-2.49.91-3.57 1.64 1.08-.73 2.28-1.3 3.57-1.64z"/>
          <path d="M15.49 9.63c-.18-2.79-1.31-5.51-3.43-7.63-2.14 2.14-3.32 4.86-3.55 7.63 1.28.68 2.46 1.56 3.49 2.63 1.03-1.06 2.21-1.94 3.49-2.63zm-6.5 2.65c-.14-.1-.3-.19-.45-.29.15.11.31.19.45.29zm6.42-.25c-.13.09-.27.16-.4.26.13-.1.27-.17.4-.26zM12 15.45C9.85 12.17 6.18 10 2 10c0 5.32 3.36 9.82 8.03 11.49.63.23 1.29.4 1.97.51.68-.12 1.33-.29 1.97-.51C18.64 19.82 22 15.32 22 10c-4.18 0-7.85 2.17-10 5.45z"/>
        </svg>
      ),
      'bar': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 5V3H3v2l8 9v5H6v2h12v-2h-5v-5l8-9zM7.43 7L5.66 5h12.69l-1.78 2H7.43z"/>
        </svg>
      ),
      'breakfast': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.9 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/>
        </svg>
      ),
      'air conditioning': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22 11h-4.17l3.24-3.24-1.41-1.42L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.42L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.42-1.41L13 15v-2h2l4.66 4.66 1.41-1.42L17.83 13H22z"/>
        </svg>
      ),
      'airport': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
      ),
      'beach': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.127 14.56l1.43-1.43 6.44 6.443L19.57 21zm4.293-5.73l2.86-2.86c-3.95-3.95-10.35-3.96-14.3-.02 3.93-1.3 8.31-.25 11.44 2.88zM5.95 5.98c-3.94 3.95-3.93 10.35.02 14.3l2.86-2.86C5.7 14.29 4.65 9.91 5.95 5.98zm.02-.02l-.01.01c-.38 3.01 1.17 6.88 4.3 10.02l5.73-5.73c-3.13-3.13-7.01-4.68-10.02-4.3z"/>
        </svg>
      ),
      'lift': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM8 6c.83 0 1.5.67 1.5 1.5S8.83 9 8 9s-1.5-.67-1.5-1.5S7.17 6 8 6zm2 12H6v-1c0-1.33 2.67-2 4-2s4 .67 4 2v1h-4zm6-6h-3v3h-2v-3h-3V9h3V6h2v3h3v3z"/>
        </svg>
      ),
      'heating': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4zm-4-8c0-.55.45-1 1-1s1 .45 1 1h-1v1h1v2h-1v1h1v2h-2V5z"/>
        </svg>
      ),
      'safety': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
        </svg>
      ),
      'laundry': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.17 16.83c1.56 1.56 4.1 1.56 5.66 0 1.56-1.56 1.56-4.1 0-5.66l-5.66 5.66zM18 2.01L6 2c-1.11 0-2 .89-2 2v16c0 1.11.89 2 2 2h12c1.11 0 2-.89 2-2V4c0-1.11-.89-1.99-2-1.99zM10 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM7 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm5 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
        </svg>
      ),
      'room service': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 17h20v2H2zm11.84-9.21c.1-.24.16-.51.16-.79 0-1.1-.9-2-2-2s-2 .9-2 2c0 .28.06.55.16.79C6.25 8.6 3.27 11.93 3 16h18c-.27-4.07-3.25-7.4-7.16-8.21z"/>
        </svg>
      ),
      'non-smoking': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 6l6.99 7H2v3h9.99l7 7 1.26-1.25-17-17zm18.5 7H22v3h-1.5zM18 13h1.5v3H18zm.85-8.12c.62-.61 1-1.45 1-2.38h-1.5c0 1.02-.83 1.85-1.85 1.85v1.5c2.24 0 4 1.83 4 4.07V12H22V9.92c0-2.23-1.28-4.15-3.15-5.04zM14.5 8.7h1.53c1.05 0 1.97.74 1.97 2.05V12h1.5v-1.59c0-1.8-1.6-3.16-3.47-3.16H14.5c-1.02 0-1.85-.98-1.85-2s.83-1.75 1.85-1.75V2c-1.85 0-3.35 1.5-3.35 3.35s1.5 3.35 3.35 3.35zm2.5 7.23V13h-2.93z"/>
        </svg>
      ),
      'family': (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63C19.68 7.55 18.92 7 18.06 7h-.12c-.86 0-1.62.55-1.9 1.37L13.5 16H16v6h4zM5.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm2 16v-7H9V9c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v6h1.5v7h4zm6.5-18c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm1 17v-7h1.5V9c0-1.1-.9-2-2-2h-1c-1.1 0-2 .9-2 2v5H13v7h2z"/>
        </svg>
      ),
    };
    
    // Try to find a matching icon
    for (const [key, icon] of Object.entries(facilityMap)) {
      if (facilityLower.includes(key)) {
        return icon;
      }
    }
    
    // Default icon for unmapped facilities
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    );
  };

  if (accommodations.length === 0) {
    return (
      <div className="w-full p-10 text-center text-gray-500 dark:text-gray-400">
        No accommodations found
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <div className="relative w-full p-4">
        <div
          ref={containerRef}
          className="flex gap-4 overflow-x-auto scroll-smooth p-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {accommodations.map((acc, index) => {
            const badgeClass = 'bg-[#003b95] text-white dark:bg-blue-600';
            const topFacilities = acc.facilities.slice(0, 3);

            return (
              <div
                key={acc.id}
                className={cn(
                  "flex-shrink-0 w-[270px]",
                  "transition-all duration-300 opacity-100 translate-y-0"
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div
                  onClick={() => handleAccommodationClick(acc)}
                  className={cn(
                    "rounded-3xl overflow-hidden h-full",
                    "transition-all duration-300 cursor-pointer flex flex-col",
                    "bg-transparent",
                    "hover:shadow-lg dark:hover:shadow-gray-900/50"
                  )}
                >
                  <div className="flex-shrink-0 flex items-center justify-center">
                    <figure className="relative w-[270px] h-[270px] overflow-hidden bg-gray-100 dark:bg-gray-700 rounded-3xl mt-3">
                      <img
                        alt={acc.name}
                        className="w-full h-full object-cover block"
                        src={acc.mainImage || 'https://via.placeholder.com/400x400/e0e0e0/666666?text=Property'}
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400/e0e0e0/666666?text=Property';
                        }}
                      />
                    </figure>
                  </div>

                  <div className="p-3 flex-1 flex flex-col">
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1 mb-1">
                          {renderStars(acc.rating)}
                        </div>
                        <div className="flex-shrink-0">
                          <span className={cn(
                            "inline-flex items-center justify-center min-w-[32px] h-6 px-2",
                            "rounded-md text-[13px] font-bold",
                            badgeClass
                          )}>
                            {acc.rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      
                      <h3 className="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
                        {acc.name}
                      </h3>
                      
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 mb-2">
                        {getAccommodationTypeIcon(acc.type)}
                        <span className="capitalize">{acc.type.replace(/-/g, ' ')}</span>
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {acc.reviewCount ? `${acc.reviewCount.toLocaleString()} reviews` : 'No reviews'}
                      </div>
                      
                      {topFacilities.length > 0 && (
                        <div className="space-y-1">
                          {topFacilities.map((facility, idx) => {
                            const icon = getFacilityIcon(facility);
                            return (
                              <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                <span className="text-gray-500 dark:text-gray-400">{icon || <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"/></svg>}</span>
                                <span>{facility}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-3">
                      <div className="flex items-baseline gap-1 mb-2">
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          ${acc.pricePerNight.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          per night
                        </div>
                      </div>
                      <button
                        className={cn(
                          "w-full bg-gray-900 text-white border-none rounded-3xl py-2.5 px-4",
                          "text-sm font-semibold cursor-pointer transition-colors duration-200",
                          "hover:bg-gray-800",
                          "dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                        )}
                        style={{ zIndex: 200 }}
                      >
                        Book on Booking.com
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Carousel Controls */}
        <div className="absolute top-1/2 left-0 right-0 flex justify-between -translate-y-1/2 pointer-events-none z-10">
          <button
            onClick={scrollPrev}
            disabled={!showPrevButton}
            className={cn(
              "pointer-events-auto w-10 h-10 rounded-3xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600",
              "shadow-md cursor-pointer flex items-center justify-center transition-all duration-200 mx-2",
              "hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed",
              !showPrevButton && "opacity-0 pointer-events-none"
            )}
            aria-label="Show previous card"
          >
            <svg className="w-6 h-6 stroke-gray-900 dark:stroke-gray-100" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button
            onClick={scrollNext}
            disabled={!showNextButton}
            className={cn(
              "pointer-events-auto w-10 h-10 rounded-3xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600",
              "shadow-md cursor-pointer flex items-center justify-center transition-all duration-200 mx-2",
              "hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed",
              !showNextButton && "opacity-0 pointer-events-none"
            )}
            aria-label="Show next card"
          >
            <svg className="w-6 h-6 stroke-gray-900 dark:stroke-gray-100" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingSearchResults;








