import { motion } from 'framer-motion';
import { Brain, Wifi, Activity } from 'lucide-react';

interface StatusIndicatorProps {
  isSpeaking: boolean;
  isListening: boolean;
}

export default function StatusIndicator({ isSpeaking, isListening }: StatusIndicatorProps) {
  const getStatus = () => {
    if (isSpeaking) return { text: 'Speaking', color: 'text-primary', pulse: true };
    if (isListening) return { text: 'Listening', color: 'text-accent', pulse: true };
    return { text: 'Ready', color: 'text-muted-foreground', pulse: false };
  };

  const status = getStatus();

  return (
    <div className="glass rounded-full px-6 py-3 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <motion.div
          animate={status.pulse ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Brain className={`w-5 h-5 ${status.color}`} />
        </motion.div>
        <span className={`text-sm font-medium ${status.color}`}>{status.text}</span>
      </div>

      <div className="w-px h-4 bg-border" />

      <div className="flex items-center gap-2">
        <Wifi className="w-4 h-4 text-primary" />
        <span className="text-xs text-muted-foreground">Connected</span>
      </div>

      <div className="w-px h-4 bg-border" />

      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <div className="flex gap-0.5">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-primary rounded-full"
              animate={{ height: [4, 12, 4] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
