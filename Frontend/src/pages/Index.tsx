import { useState } from 'react';
import { motion } from 'framer-motion';
import Avatar3D from '@/components/Avatar3D';
import ChatInterface from '@/components/ChatInterface';
import StatusIndicator from '@/components/StatusIndicator';

const Index = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent/5 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_70%)]" />
      </div>

      {/* Grid overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-4 py-6 h-screen flex flex-col">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="font-display text-2xl md:text-3xl text-gradient-primary">
              ARIA
            </h1>
            <p className="text-sm text-muted-foreground">Advanced Real-time Interactive Assistant</p>
          </div>
          <StatusIndicator isSpeaking={isSpeaking} isListening={isListening} />
        </motion.header>

        {/* Main grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* 3D Avatar Section */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative rounded-2xl overflow-hidden glass border border-border/30"
          >
            <Avatar3D isSpeaking={isSpeaking} isListening={isListening} audio={audio} />
            
            {/* Avatar label */}
            <div className="absolute bottom-4 left-4 glass rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-primary animate-pulse' : isListening ? 'bg-accent animate-pulse' : 'bg-muted-foreground'}`} />
                <span className="text-sm font-display text-foreground/80">
                  {isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Avatar Ready'}
                </span>
              </div>
            </div>

            {/* Scan line effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <motion.div
                className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                animate={{ y: ['-100%', '400%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </motion.div>

          {/* Chat Section */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="min-h-0"
          >
            <ChatInterface
              onSpeakingChange={setIsSpeaking}
              onListeningChange={setIsListening}
              onAudioCreated={setAudio}
            />
          </motion.div>
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-4 text-center"
        >
          <p className="text-xs text-muted-foreground">
            Powered by Advanced AI • Real-time Voice Processing • 3D Visualization
          </p>
        </motion.footer>
      </div>
    </div>
  );
};

export default Index;
