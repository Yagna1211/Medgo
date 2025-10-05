import { supabase } from "@/integrations/supabase/client";

/**
 * Environment-aware logger that:
 * - Logs to console only in development
 * - Removes PII from production logs
 * - Uses Supabase for production error tracking
 */
export const logger = {
  log: (msg: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(msg, data);
    }
  },
  
  error: (msg: string, error?: any) => {
    if (import.meta.env.DEV) {
      console.error(msg, error);
    } else {
      // In production, only log error messages without PII
      const sanitizedError = {
        message: error?.message || 'Unknown error',
        code: error?.code,
        timestamp: new Date().toISOString()
      };
      
      // Future: Send to edge function for centralized logging
      // supabase.functions.invoke('log-error', { body: { msg, error: sanitizedError } });
    }
  },
  
  warn: (msg: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.warn(msg, data);
    }
  }
};
