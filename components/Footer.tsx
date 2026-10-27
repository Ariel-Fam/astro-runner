import Image from "next/image";

export default function Footer() {
  
  
  return (
    <footer className="w-screen  z-40">
      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-600/60 to-transparent" />
      
      <div className="  w-screen
          bg-[url('/Background.png')] bg-cover bg-center bg-no-repeat
          flex flex-col items-center 
          px-6 text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center gap-6">
            {/* Logo */}
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-emerald-600/20 via-yellow-500/20 to-emerald-600/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Image 
                src="/softwareLogo.png" 
                alt="Launch Narrative Software" 
                width={160} 
                height={80}
                className="relative drop-shadow-lg hover:scale-105 transition-transform duration-300"
              />
            </div>
            
    
            
            {/* Decorative line */}
            <div className="flex items-center gap-3 w-full max-w-xs">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-emerald-600/40" />
              <div className="w-2 h-2 rotate-45 bg-yellow-500/60" />
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-emerald-600/40" />
            </div>
            
            
          </div>
        </div>
      </div>
    </footer>
  );
}

