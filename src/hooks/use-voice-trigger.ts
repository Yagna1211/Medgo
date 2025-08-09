import { useEffect, useRef, useState } from "react";

interface VoiceTriggerOptions {
  phrase?: string | RegExp;
  onTrigger: () => void;
}

export const useVoiceTrigger = ({ phrase = /(\bcall (an )?ambulance\b)/i, onTrigger }: VoiceTriggerOptions) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Browser speech recognition (webkit prefix support)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          if (typeof phrase === 'string') {
            if (transcript.toLowerCase().includes(phrase.toLowerCase())) {
              onTrigger();
            }
          } else if (phrase.test(transcript)) {
            onTrigger();
          }
        }
      }
    };

    recognition.onend = () => {
      if (listening) {
        recognition.start(); // restart if still listening
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTrigger]);

  const start = async () => {
    if (!recognitionRef.current) return;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      recognitionRef.current.start();
      setListening(true);
    } catch (e) {
      console.error("Mic permission denied", e);
    }
  };

  const stop = () => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  };

  return { listening, start, stop } as const;
};
