import React from 'react';

const SpaceBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-[#02040a]">
      {/* Deep space gradient */}
      <div className="absolute inset-0 bg-radial-gradient from-blue-900/10 via-transparent to-transparent opacity-30"></div>
      
      {/* Animated stars layer 1 */}
      <div className="stars-container absolute inset-0">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      {/* Nebula effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      
      {/* Moving cosmic dust / particles */}
      <div className="absolute inset-0 opacity-20">
        <div className="cosmic-dust"></div>
      </div>
    </div>
  );
};

export default SpaceBackground;
