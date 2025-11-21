import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/index.css';

// Import widget
import BookingSearchResults from '../components/booking-search-results';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-[760px]">
        <BookingSearchResults />
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
