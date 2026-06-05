import { useEffect, useState, useMemo, useRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2 } from 'lucide-react';

// URL for world map with countries and optionally states/regions
// Using a higher resolution world map that includes more detail
const worldGeoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
// Brazil states GeoJSON for detailed view
const brazilGeoUrl = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

interface OnlineUser {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  country: string;
  city?: string;
  state?: string;
}

const WorldMap = () => {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [zoom, setZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  useEffect(() => {
    const initialUsers: OnlineUser[] = [
      { id: '1', coordinates: [-46.6333, -23.5505], country: 'Brasil', city: 'São Paulo', state: 'SP' },
      { id: '3', coordinates: [-74.0060, 40.7128], country: 'EUA', city: 'New York' },
      { id: '4', coordinates: [2.3522, 48.8566], country: 'França', city: 'Paris' },
      { id: '5', coordinates: [139.6503, 35.6762], country: 'Japão', city: 'Tokyo' },
      { id: '7', coordinates: [-9.1393, 38.7223], country: 'Portugal', city: 'Lisboa' },
      { id: '8', coordinates: [-43.1729, -22.9068], country: 'Brasil', city: 'Rio de Janeiro', state: 'RJ' },
    ];
    setUsers(initialUsers);

    const countryHubs: { name: string, coords: [number, number], states?: string[] }[] = [
      { name: 'Brasil', coords: [-47.8825, -15.7942], states: ['SP', 'RJ', 'MG', 'BA', 'RS', 'PR', 'PE', 'AM'] },
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
        if (next.length > 15) next.shift();
        
        const hub = countryHubs[Math.floor(Math.random() * countryHubs.length)];
        const randomCoords: [number, number] = [
          hub.coords[0] + (Math.random() - 0.5) * (hub.name === 'Brasil' ? 10 : 6),
          hub.coords[1] + (Math.random() - 0.5) * (hub.name === 'Brasil' ? 10 : 6)
        ];

        next.push({
          id: Math.random().toString(),
          coordinates: randomCoords,
          country: hub.name,
          state: hub.states ? hub.states[Math.floor(Math.random() * hub.states.length)] : undefined
        });
        return next;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const continentMarkers = useMemo(() => [
    { name: "América do Sul", coords: [-60, -15] as [number, number] },
    { name: "América do Norte", coords: [-100, 40] as [number, number] },
    { name: "Europa", coords: [15, 50] as [number, number] },
    { name: "África", coords: [20, 0] as [number, number] },
    { name: "Ásia", coords: [100, 35] as [number, number] },
    { name: "Oceania", coords: [135, -25] as [number, number] },
  ], []);

  return (
    <div 
      ref={mapContainerRef}
      className={`w-full bg-[#020202] overflow-hidden relative perspective-1000 transition-all duration-500 ${
        isFullScreen ? 'fixed inset-0 z-[9999] rounded-0' : 'rounded-xl border border-primary/30 shadow-[0_0_100px_rgba(0,100,255,0.2)]'
      }`}
    >
      {/* 3D Depth effect layers */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(0,150,255,0.1),transparent)] pointer-events-none z-10" />
      
      <div className="p-5 border-b border-primary/20 flex items-center justify-between relative z-30 bg-black/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-3 w-3 rounded-full bg-primary animate-pulse shadow-[0_0_20px_#0096ff]" />
            <div className="absolute inset-0 h-3 w-3 rounded-full bg-primary animate-ping opacity-75" />
          </div>
          <div>
            <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-foreground leading-none text-glow-blue">Vortex Real-Time</h3>
            <p className="text-[8px] text-primary/80 uppercase font-black tracking-widest mt-1.5 flex items-center gap-2">
              <span className="h-px w-6 bg-primary/50" /> Monitor de Tráfego 3D
            </p>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[7px] font-black text-primary/60 uppercase tracking-widest">Status da Rede</span>
            <span className="text-[10px] font-black text-success uppercase tracking-tighter">Estável • {users.length + 312} Nodes</span>
          </div>
          <div className="h-8 w-[1px] bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 border border-primary/20 rounded-sm skew-x-[-10deg]">
             <span className="text-[11px] font-black text-white tabular-nums skew-x-[10deg]">{zoom.toFixed(1)}x</span>
          </div>
          <button 
            onClick={toggleFullScreen}
            className="flex items-center justify-center h-8 w-8 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-sm transition-colors text-primary"
            title={isFullScreen ? "Sair da Tela Cheia" : "Expandir para Tela Cheia"}
          >
            {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      
      <div className={`w-full relative cursor-grab active:cursor-grabbing bg-[linear-gradient(rgba(0,150,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,150,255,0.05)_1px,transparent_1px)] [background-size:40px_40px] overflow-hidden transition-all duration-500 ${
        isFullScreen ? 'h-[calc(100vh-80px)]' : 'h-[600px]'
      }`}>
        {/* Decorative 3D elements */}
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none animate-pulse" />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent/5 rounded-full blur-[100px] pointer-events-none animate-pulse" />

        <div className="w-full h-full transform transition-transform duration-700" style={{ transform: 'rotateX(5deg)' }}>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 140,
              center: [0, 15]
            }}
            className="w-full h-full filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]"
          >
            <ZoomableGroup 
              zoom={zoom} 
              minZoom={1} 
              maxZoom={12} 
              onMoveEnd={({ zoom }) => setZoom(zoom)}
            >
              <Geographies geography={worldGeoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#050505"
                      stroke="rgba(0, 150, 255, 0.5)"
                      strokeWidth={0.8 / zoom}
                      style={{
                        default: { outline: "none", transition: "all 300ms" },
                        hover: { fill: "#111", stroke: "#00f6ff", strokeWidth: 1 / zoom, outline: "none" },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {/* Detail Layer: Brazil States (Visible when zoomed in) */}
              {zoom > 3 && (
                <Geographies geography={brazilGeoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="transparent"
                        stroke="rgba(0, 246, 255, 0.3)"
                        strokeWidth={0.4 / zoom}
                        style={{
                          default: { outline: "none" },
                          hover: { fill: "rgba(0, 150, 255, 0.05)", outline: "none" },
                        }}
                      />
                    ))
                  }
                </Geographies>
              )}

              {/* Continents Labels (Fade out when zoomed in) */}
              <AnimatePresence>
                {zoom < 3 && continentMarkers.map((cont) => (
                  <Marker key={cont.name} coordinates={cont.coords}>
                    <motion.text
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.15 }}
                      exit={{ opacity: 0 }}
                      textAnchor="middle"
                      className="text-[10px] font-black uppercase tracking-[0.4em] pointer-events-none fill-white select-none"
                      style={{ fontSize: '8px' }}
                    >
                      {cont.name}
                    </motion.text>
                  </Marker>
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {users.map((user) => (
                  <Marker key={user.id} coordinates={user.coordinates}>
                    <motion.g
                      initial={{ scale: 0, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0, opacity: 0 }}
                    >
                      {/* Vertical line for 3D depth look */}
                      <line x1="0" y1="0" x2="0" y2="-15" stroke="var(--primary)" strokeWidth={0.5 / zoom} strokeDasharray="2,2" opacity="0.4" />
                      
                      {/* Base point */}
                      <circle r={2.5 / zoom} fill="var(--primary)" />
                      
                      {/* Pulsing rings */}
                      <circle r={8 / zoom} fill="var(--primary)" opacity="0.2">
                        <animate attributeName="r" from={1 / zoom} to={15 / zoom} dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
                      </circle>

                      {/* Info label (Higher detail when zoomed) */}
                      <motion.g transform={`translate(0, -${20 / zoom})`}>
                         <rect 
                           x={-24 / zoom} 
                           y={-10 / zoom} 
                           width={48 / zoom} 
                           height={12 / zoom} 
                           fill="rgba(0,0,0,0.9)" 
                           stroke="rgba(57, 255, 20, 0.6)" 
                           strokeWidth={0.5 / zoom} 
                           rx={2 / zoom}
                         />
                         
                         {/* Neon green dot inside label */}
                         <circle cx={-18 / zoom} cy={-4 / zoom} r={1.5 / zoom} fill="#39FF14" className="animate-pulse shadow-[0_0_5px_#39FF14]" />
                         
                         <text
                           textAnchor="start"
                           x={-14 / zoom}
                           y={-2 / zoom}
                           className="font-black uppercase tracking-tighter"
                           style={{ fontSize: `${6 / zoom}px`, fill: "#fff" }}
                         >
                           {user.state ? `${user.state}` : user.country}
                         </text>
                      </motion.g>
                    </motion.g>
                  </Marker>
                ))}
              </AnimatePresence>
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Floating Side Info Panel */}
        <div className="absolute top-6 left-6 z-40 pointer-events-none hidden lg:block">
           <div className="bg-black/60 backdrop-blur-md p-4 border-l-2 border-primary space-y-4 shadow-2xl">
              <div className="space-y-1">
                 <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em]">Região Dominante</p>
                 <p className="text-[14px] font-black text-white uppercase tracking-tighter">América do Sul (68%)</p>
              </div>
              <div className="space-y-1">
                 <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em]">Latência Média</p>
                 <p className="text-[14px] font-black text-success uppercase tracking-tighter">24ms</p>
              </div>
           </div>
        </div>

        {/* Control Interface Overlay */}
        <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-2">
           <div className="bg-black/90 backdrop-blur-xl p-5 border border-primary/20 rounded-sm shadow-[0_0_40px_rgba(0,0,0,0.8)] border-b-4 border-b-primary">
              <div className="flex items-center justify-between gap-10 mb-2">
                 <span className="text-[10px] font-black text-primary uppercase tracking-widest">Global Reach</span>
                 <span className="text-[14px] font-black text-white tabular-nums">1.2M+</span>
              </div>
              <div className="flex gap-1">
                 {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className={`h-1.5 w-4 rounded-none ${i < 7 ? 'bg-primary' : 'bg-white/10'} ${i === 6 ? 'animate-pulse' : ''}`} />
                 ))}
              </div>
           </div>
        </div>

        {/* Floating HUD Instructions */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
           <div className="flex items-center gap-4 bg-black/60 backdrop-blur-sm px-5 py-2 rounded-full border border-white/5">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-primary" />
                 <span className="text-[8px] font-black text-white/70 uppercase tracking-widest">Zoom Level: {zoom > 3 ? 'Deep Insight' : 'Global View'}</span>
              </div>
              <div className="w-[1px] h-3 bg-white/20" />
              <p className="text-[8px] font-black text-primary uppercase tracking-widest animate-pulse">
                 {zoom > 3 ? 'Visualizando Divisões Estaduais' : 'Aproxime para ver Estados'}
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default WorldMap;



