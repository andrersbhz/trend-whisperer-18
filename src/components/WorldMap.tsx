import { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { motion, AnimatePresence } from 'framer-motion';

// GeoJSON for the world map
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface OnlineUser {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  city?: string;
}

const WorldMap = () => {
  const [users, setUsers] = useState<OnlineUser[]>([]);

  // Simulate real-time users for demonstration (or you can fetch from Supabase if you have tracking)
  useEffect(() => {
    const initialUsers: OnlineUser[] = [
      { id: '1', coordinates: [-46.6333, -23.5505], city: 'São Paulo' },
      { id: '2', coordinates: [-43.1729, -22.9068], city: 'Rio de Janeiro' },
      { id: '3', coordinates: [-47.8825, -15.7942], city: 'Brasília' },
      { id: '4', coordinates: [-34.8770, -8.0476], city: 'Recife' },
      { id: '5', coordinates: [-74.0060, 40.7128], city: 'New York' },
      { id: '6', coordinates: [2.3522, 48.8566], city: 'Paris' },
      { id: '7', coordinates: [139.6503, 35.6762], city: 'Tokyo' },
      { id: '8', coordinates: [-0.1278, 51.5074], city: 'London' },
    ];
    setUsers(initialUsers);

    // Randomly add/remove "pings" to simulate real-time
    const interval = setInterval(() => {
      setUsers(prev => {
        const next = [...prev];
        if (next.length > 15) next.shift();
        
        // Add a random coordinate near Brazil or major hubs
        const isBrazil = Math.random() > 0.4;
        let coords: [number, number];
        
        if (isBrazil) {
          coords = [
            -70 + Math.random() * 35, // Longitude
            -30 + Math.random() * 25  // Latitude
          ];
        } else {
          coords = [
            -180 + Math.random() * 360,
            -60 + Math.random() * 120
          ];
        }

        next.push({
          id: Math.random().toString(),
          coordinates: coords
        });
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#0a0a0a] rounded-lg border border-white/5 overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Visitantes Online</h3>
        </div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase">Tempo Real</div>
      </div>
      
      <div className="h-[400px] w-full relative bg-dot-pattern">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 140,
            center: [0, 20]
          }}
          className="w-full h-full"
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1a1a1a"
                  stroke="#333"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "#222", outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          <AnimatePresence>
            {users.map((user) => (
              <Marker key={user.id} coordinates={user.coordinates}>
                <motion.g
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 1 }}
                >
                  {/* Ping effect */}
                  <circle r="6" fill="#00a3ff" opacity="0.4">
                    <animate
                      attributeName="r"
                      from="2"
                      to="12"
                      dur="1.5s"
                      begin="0s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.6"
                      to="0"
                      dur="1.5s"
                      begin="0s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle r="3" fill="#00a3ff" stroke="#fff" strokeWidth={1} />
                </motion.g>
              </Marker>
            ))}
          </AnimatePresence>
        </ComposableMap>

        {/* Legend/Info Overlay */}
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md p-3 border border-white/10 rounded-sm">
          <p className="text-[24px] font-black text-white tabular-nums leading-none">
            {users.length + 142}
          </p>
          <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-1">Pessoas Ativas</p>
        </div>
      </div>
    </div>
  );
};

export default WorldMap;
