import { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
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
      { id: '3', coordinates: [-74.0060, 40.7128], country: 'EUA', city: 'New York' },
      { id: '4', coordinates: [2.3522, 48.8566], country: 'França', city: 'Paris' },
      { id: '5', coordinates: [139.6503, 35.6762], country: 'Japão', city: 'Tokyo' },
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
      { name: 'Austrália', coords: [133.7751, -25.2744] },
      { name: 'Canadá', coords: [-106.3468, 56.1304] },
    ];

    const interval = setInterval(() => {
      setUsers(prev => {
        const next = [...prev];
        if (next.length > 10) next.shift();
        
        const hub = countryHubs[Math.floor(Math.random() * countryHubs.length)];
        const randomCoords: [number, number] = [
          hub.coords[0] + (Math.random() - 0.5) * 4,
          hub.coords[1] + (Math.random() - 0.5) * 4
        ];

        next.push({
          id: Math.random().toString(),
          coordinates: randomCoords,
          country: hub.name
        });
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const continents = [
    { name: "América do Sul", coords: [-60, -15] },
    { name: "América do Norte", coords: [-100, 40] },
    { name: "Europa", coords: [15, 50] },
    { name: "África", coords: [20, 0] },
    { name: "Ásia", coords: [100, 35] },
    { name: "Oceania", coords: [135, -25] },
  ];

  return (
    <div className="w-full bg-[#030303] rounded-xl border border-primary/20 overflow-hidden shadow-[0_0_80px_rgba(0,100,255,0.15)] relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,150,255,0.05),transparent)] pointer-events-none" />
      
      <div className="p-5 border-b border-primary/20 flex items-center justify-between relative z-20 bg-black/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_15px_#0096ff]" />
            <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-primary animate-ping opacity-75" />
          </div>
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-foreground leading-none">Vortex Network</h3>
            <p className="text-[8px] text-primary/70 uppercase font-bold tracking-widest mt-1.5 flex items-center gap-2">
              <span className="h-px w-4 bg-primary/30" /> Painel Interativo
            </p>
          </div>
        </div>
        
        <div className="hidden sm:flex gap-1.5 items-center bg-primary/5 px-3 py-1.5 border border-primary/10 rounded-full">
          <span className="text-[8px] font-black text-primary/80 uppercase tracking-widest">Ativos Agora</span>
          <span className="h-1 w-1 rounded-full bg-primary/50" />
          <span className="text-[10px] font-black text-white tabular-nums">{users.length + 245}</span>
        </div>
      </div>
      
      <div className="h-[500px] w-full relative cursor-grab active:cursor-grabbing bg-[linear-gradient(rgba(0,150,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,150,255,0.03)_1px,transparent_1px)] [background-size:30px_30px]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 140,
            center: [0, 15]
          }}
          className="w-full h-full"
        >
          <ZoomableGroup zoom={1} minZoom={1} maxZoom={4}>
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#0a0a0a"
                    stroke="rgba(0, 150, 255, 0.4)"
                    strokeWidth={0.6}
                    style={{
                      default: { outline: "none", filter: "drop-shadow(0 0 2px rgba(0,150,255,0.2))" },
                      hover: { fill: "#111", stroke: "#00f6ff", strokeWidth: 0.8, outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* Continents Labels */}
            {continents.map((cont) => (
              <Marker key={cont.name} coordinates={cont.coords as [number, number]}>
                <text
                  textAnchor="middle"
                  className="text-[10px] font-black uppercase tracking-[0.2em] pointer-events-none fill-white/20 select-none"
                  style={{ fontSize: '7px' }}
                >
                  {cont.name}
                </text>
              </Marker>
            ))}

            <AnimatePresence>
              {users.map((user) => (
                <Marker key={user.id} coordinates={user.coordinates}>
                  <motion.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                  >
                    <circle r="4" fill="var(--primary)" className="shadow-neon-blue" />
                    <circle r="12" fill="var(--primary)" opacity="0.2">
                      <animate attributeName="r" from="2" to="18" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <motion.text
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: -10 }}
                      className="text-[7px] font-bold uppercase tracking-tighter fill-primary"
                      textAnchor="middle"
                    >
                      {user.country}
                    </motion.text>
                  </motion.g>
                </Marker>
              ))}
            </AnimatePresence>
          </ZoomableGroup>
        </ComposableMap>

        {/* Legend Overlay - Positioned outside the map path */}
        <div className="absolute top-6 right-6 z-30 pointer-events-none">
          <div className="bg-black/90 backdrop-blur-xl p-4 border border-primary/20 rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em] mb-3">Cobertura Global</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-8">
                <span className="text-[10px] font-bold text-white/50 uppercase">Dispositivos</span>
                <span className="text-[11px] font-black text-white">4.2k</span>
              </div>
              <div className="h-0.5 w-full bg-white/5 rounded-full">
                <div className="h-full bg-primary w-4/5 shadow-neon-blue" />
              </div>
            </div>
          </div>
        </div>

        {/* Zoom Help */}
        <div className="absolute bottom-6 left-6 z-30">
          <div className="text-[8px] font-bold text-primary/40 uppercase tracking-widest bg-black/40 px-3 py-1.5 rounded-full border border-primary/10">
            Scroll para Zoom • Arraste para Mover
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldMap;


