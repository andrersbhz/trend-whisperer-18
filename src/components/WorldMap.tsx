import { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { motion, AnimatePresence } from 'framer-motion';

// GeoJSON for the world map
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface OnlineUser {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  country: string;
  city?: string;
}

const WorldMap = () => {
  const [users, setUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    const initialUsers: OnlineUser[] = [
      { id: '1', coordinates: [-46.6333, -23.5505], country: 'Brasil', city: 'São Paulo' },
      { id: '2', coordinates: [-43.1729, -22.9068], country: 'Brasil', city: 'Rio de Janeiro' },
      { id: '3', coordinates: [-74.0060, 40.7128], country: 'EUA', city: 'New York' },
      { id: '4', coordinates: [2.3522, 48.8566], country: 'França', city: 'Paris' },
      { id: '5', coordinates: [139.6503, 35.6762], country: 'Japão', city: 'Tokyo' },
      { id: '6', coordinates: [-0.1278, 51.5074], country: 'Reino Unido', city: 'London' },
      { id: '7', coordinates: [-9.1393, 38.7223], country: 'Portugal', city: 'Lisboa' },
    ];
    setUsers(initialUsers);

    const countryHubs: { name: string, coords: [number, number] }[] = [
      { name: 'Brasil', coords: [-47.8825, -15.7942] },
      { name: 'Portugal', coords: [-8.2245, 39.3999] },
      { name: 'EUA', coords: [-95.7129, 37.0902] },
      { name: 'Espanha', coords: [-3.7038, 40.4168] },
      { name: 'Angola', coords: [17.8739, -11.2027] },
      { name: 'Japão', coords: [138.2529, 36.2048] },
    ];

    const interval = setInterval(() => {
      setUsers(prev => {
        const next = [...prev];
        if (next.length > 12) next.shift();
        
        const hub = countryHubs[Math.floor(Math.random() * countryHubs.length)];
        // Add slight randomness to coordinates around the hub
        const randomCoords: [number, number] = [
          hub.coords[0] + (Math.random() - 0.5) * 5,
          hub.coords[1] + (Math.random() - 0.5) * 5
        ];

        next.push({
          id: Math.random().toString(),
          coordinates: randomCoords,
          country: hub.name
        });
        return next;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#050505] rounded-xl border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] relative">
      {/* Glow effect in background */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="p-5 border-b border-white/5 flex items-center justify-between relative z-10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-2.5 w-2.5 rounded-full bg-success animate-pulse shadow-[0_0_10px_#10b981]" />
            <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-success animate-ping opacity-75" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground leading-none">Global Network</h3>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1">Visitantes em tempo real</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-end max-w-[50%]">
          <AnimatePresence mode="popLayout">
            {Array.from(new Set(users.map(u => u.country))).slice(-4).map((country) => (
              <motion.span
                key={country}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-[9px] font-bold px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-primary shadow-neon-blue backdrop-blur-md uppercase tracking-tighter"
              >
                {country}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>
      
      <div className="h-[450px] w-full relative bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 150,
            center: [0, 25]
          }}
          className="w-full h-full filter drop-shadow-[0_0_30px_rgba(0,150,255,0.1)]"
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#111"
                  stroke="#222"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none", transition: "all 300ms" },
                    hover: { fill: "#1a1a1a", outline: "none" },
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
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                >
                  {/* Outer waves */}
                  <circle r="8" fill="var(--primary)" opacity="0.3">
                    <animate attributeName="r" from="2" to="20" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                  
                  {/* Point */}
                  <circle r="3.5" fill="var(--primary)" className="shadow-neon-blue" />
                  <circle r="1.5" fill="#fff" />

                  {/* Floating label */}
                  <motion.text
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: -12 }}
                    className="text-[8px] font-black uppercase tracking-tighter"
                    style={{ fill: "#fff", textShadow: "0 0 5px rgba(0,0,0,0.8)" }}
                    textAnchor="middle"
                  >
                    {user.country}
                  </motion.text>
                </motion.g>
              </Marker>
            ))}
          </AnimatePresence>
        </ComposableMap>

        {/* Dashboard Stat Overlay */}
        <div className="absolute bottom-6 right-6 flex flex-col items-end">
          <div className="bg-black/80 backdrop-blur-xl p-5 border border-white/10 rounded-lg shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <p className="text-[32px] font-black text-white tabular-nums leading-none tracking-tighter">
              {users.length + 158}
            </p>
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-2">Audiência Global</p>
            
            <div className="mt-4 flex gap-3">
              <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-2/3 animate-pulse" />
              </div>
              <div className="h-1 w-8 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-accent w-1/2 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldMap;

