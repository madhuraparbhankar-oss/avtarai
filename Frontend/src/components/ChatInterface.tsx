import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Volume2, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

// WebSocket URL
const WS_URL = import.meta.env.VITE_WS_URL;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  onSpeakingChange: (speaking: boolean) => void;
  onListeningChange: (listening: boolean) => void;
  onAudioCreated?: (audio: HTMLAudioElement) => void;
}

export default function ChatInterface({ onSpeakingChange, onListeningChange, onAudioCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm ARIA, your Advanced Real-time Interactive Assistant. I'm here to help you with anything you need. Feel free to type a message or use voice input!",
      timestamp: new Date(),
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recogRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioQueue = useRef<string[]>([]);
  const isPlayingAudio = useRef<boolean>(false);
  const currentMessageId = useRef<string | null>(null);

  const playNextAudio = () => {
    if (audioQueue.current.length === 0) {
      isPlayingAudio.current = false;
      setIsSpeaking(false);
      return;
    }
    const url = audioQueue.current.shift()!;
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.playbackRate = 1.25;
      audioRef.current.play().catch(e => console.error("Audio block:", e));
      isPlayingAudio.current = true;
      setIsSpeaking(true);
      audioRef.current.onended = () => {
        URL.revokeObjectURL(url);
        playNextAudio();
      };
    }
  };

  // -------------------------
  // Connect to WebSocket backend
  // -------------------------
  useEffect(() => {
    if (wsRef.current) return;

    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;

    socket.onopen = () => console.log('✅ WebSocket connected');
    socket.onerror = (err) => {
      console.error('❌ WebSocket error:', err);
      toast.error('Failed to connect to backend. Is it running on port 8002?');
    };

    socket.onmessage = (event) => {
    if (typeof event.data === "string") {
      try {
        const msg = JSON.parse(event.data);

        // Stream starting
        if (msg.type === "text_start") {
          const newId = Date.now().toString();
          currentMessageId.current = newId;
          setMessages((prev) => [
            ...prev,
            { id: newId, role: "assistant", content: "", timestamp: new Date() },
          ]);
          setIsProcessing(false); // Typing started
        }
        // Stream reading
        else if (msg.type === "text_chunk") {
          if (!currentMessageId.current) {
             // Fallback if start wasn't fired
             const newId = Date.now().toString();
             currentMessageId.current = newId;
             setMessages((prev) => [...prev, { id: newId, role: "assistant", content: msg.content, timestamp: new Date() }]);
          } else {
             setMessages((prev) => 
               prev.map(m => m.id === currentMessageId.current ? { ...m, content: m.content + msg.content } : m)
             );
          }
          setIsProcessing(false);
        }
        // Stream completed
        else if (msg.type === "text_end") {
           currentMessageId.current = null;
        }
        // Fallback for legacy single message
        else if (msg.type === "text") {
          const aiMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: msg.content,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
          setIsProcessing(false);
        }
        else if (msg.type === "audio") {
          // Audio header, wait for next binary
        }
      } catch (err) {
        console.error("Invalid JSON from backend", err);
      }
    }
    // Binary chunk → audio sentence
    else {
      const blob = new Blob([event.data], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      if (!audioRef.current) {
        audioRef.current = new Audio();
        if (onAudioCreated) {
          onAudioCreated(audioRef.current);
        }
      }
      
      audioQueue.current.push(url);
      if (!isPlayingAudio.current) {
        playNextAudio();
      }
    }
  };
    socket.onclose = () => {
      wsRef.current = null;
      console.warn('⚠️ WebSocket disconnected');
      toast.warning('Lost connection to backend.');
    };

    return () => socket.close();
  }, [onSpeakingChange]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  // -------------------------
  // Send text message
  // -------------------------
  const handleSendMessage = () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    const socket = wsRef.current;
    if (!socket) {
      console.error('❌ WebSocket not initialized');
      setIsProcessing(false);
      return;
    }

    const sendPayload = () => socket.send(JSON.stringify({ type: 'text', content: userMessage.content }));

    if (socket.readyState === WebSocket.OPEN) {
      sendPayload();
    } else {
      socket.addEventListener('open', sendPayload, { once: true });
    }
  };

  // -------------------------
  // Toggle mic recording
  // -------------------------
  const toggleListening = () => {
    if (!wsRef.current) return;

    const newListening = !isListening;
    setIsListening(newListening);
    onListeningChange(newListening);

    if (newListening) {
      const SR =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SR) {
        toast.error('Microphone or Speech Recognition is not supported in this browser.');
        setIsListening(false);
        onListeningChange(false);
        return;
      }

      const recog = new SR();
      recog.lang = 'en-US';
      recog.continuous = true;
      recog.interimResults = false;

      recog.onresult = (event: any) => {
        const text = event.results[event.results.length - 1][0].transcript;
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() },
        ]);

        wsRef.current?.send(JSON.stringify({ type: 'text', content: text }));
        setIsProcessing(true);
      };

      recog.onend = () => {
        setIsListening(false);
        onListeningChange(false);
      };

      recog.start();
      recogRef.current = recog;
    } else {
      recogRef.current?.stop();
      setIsListening(false);
      onListeningChange(false);
    }
  };

  // -------------------------
  // UI JSX below is untouched
  // -------------------------
  return (
    <div className="flex flex-col h-full glass-strong rounded-2xl overflow-hidden border border-primary/20">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-primary animate-ping opacity-50" />
          </div>
          <h2 className="font-display text-lg text-gradient-primary tracking-wider">ARIA ASSISTANT</h2>
          <Sparkles className="w-4 h-4 text-primary/60 ml-auto" />
        </div>
        <p className="text-muted-foreground text-sm mt-1">AI-Powered Conversational Interface</p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-4 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-primary/15 border border-primary/30'
                      : 'bg-secondary/60 border border-border/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {message.role === 'assistant' ? (
                      <>
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                          <Volume2 className="w-3 h-3 text-primary" />
                        </div>
                        <span className="text-xs text-primary font-display tracking-wide">ARIA</span>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                          <User className="w-3 h-3 text-accent" />
                        </div>
                        <span className="text-xs text-accent font-medium">You</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{message.content}</p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-secondary/60 border border-border/40 p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2.5 h-2.5 bg-primary rounded-full"
                        animate={{ 
                          scale: [1, 1.3, 1],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">ARIA is thinking...</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border/50 bg-gradient-to-r from-transparent via-primary/3 to-transparent">
        <div className="flex items-center gap-3">

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleListening}
              className={`rounded-full w-12 h-12 transition-all duration-300 ${
                isListening
                  ? 'bg-primary/20 border-primary glow-primary text-primary'
                  : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              {isListening ? (
                <Mic className="w-5 h-5 animate-pulse" />
              ) : (
                <MicOff className="w-5 h-5 text-muted-foreground" />
              )}
            </Button>
          </motion.div>

          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your message or click the mic..."
              className="bg-secondary/40 border-border/40 rounded-full px-5 pr-4 py-6 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/50"
            />
          </div>

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing}
              className="rounded-full w-12 h-12 bg-primary hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
              style={{
                boxShadow: inputValue.trim() ? '0 0 20px hsl(var(--primary) / 0.4)' : 'none'
              }}
            >
              <Send className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>

        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-center justify-center gap-3"
            >
              <div className="flex gap-1 items-end h-6">
                {[...Array(7)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-primary rounded-full"
                    animate={{ height: [8, 20 + Math.random() * 8, 8] }}
                    transition={{
                      duration: 0.4 + Math.random() * 0.2,
                      repeat: Infinity,
                      delay: i * 0.08,
                    }}
                  />
                ))}
              </div>
              <span className="text-sm text-primary font-medium">Listening...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
