import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import BookingSearchResults from './booking-search-results';

// Listen for theme from parent window
const initializeTheme = () => {
  // Set transparent background
  document.body.style.background = 'transparent';
  document.documentElement.style.background = 'transparent';
  
  // Check if theme is provided via window global
  const theme = (window as any).__THEME__ || 'light';
  
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // Listen for theme changes from parent
  window.addEventListener('message', (event) => {
    if (event.data.type === 'theme-changed') {
      const newTheme = event.data.theme;
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  });
};

// Initialize theme before rendering
initializeTheme();

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BookingSearchResults />
    </React.StrictMode>
  );
}









