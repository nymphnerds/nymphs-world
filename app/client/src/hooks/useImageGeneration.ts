import { useState, useEffect, useCallback, useRef } from 'react';
import {
  generateImage,
  getImageGenerationStatus,
  getImageGenerationProgress,
  startImageGenerationServer,
  stopImageGenerationServer,
  GenerateImagePayload,
  ImageGenStatus,
  ImageGenProgress,
  ImageGenVramWarning,
} from '../services/api';

export type ImageGenState = 'idle' | 'starting' | 'ready' | 'generating' | 'complete' | 'error';

export interface VramWarning {
  freeVramMb: number;
  requiredVramMb: number;
}

interface UseImageGenerationReturn {
  loading: boolean;
  progress: number;
  status: ImageGenState;
  error: string | null;
  lastImageUrl: string | null;
  serverRunning: boolean;
  serverInfo: ImageGenStatus | null;
  vramWarning: VramWarning | null;
  generate: (payload: GenerateImagePayload, minVramMb?: number) => Promise<'vram_warning' | void>;
  clearVramWarning: () => void;
  setVramWarningHandler: (handler: ((warning: VramWarning) => Promise<boolean>) | null) => void;
  stopServer: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

export function useImageGeneration(): UseImageGenerationReturn {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<ImageGenState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);
  const [serverRunning, setServerRunning] = useState(false);
  const [serverInfo, setServerInfo] = useState<ImageGenStatus | null>(null);
  const [vramWarning, setVramWarning] = useState<VramWarning | null>(null);

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onVramWarningRef = useRef<((warning: VramWarning) => Promise<boolean>) | null>(null);

  const setVramWarningHandler = useCallback((handler: ((warning: VramWarning) => Promise<boolean>) | null) => {
    onVramWarningRef.current = handler;
  }, []);

  const clearAllIntervals = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  }, []);

  const pollProgress = useCallback(() => {
    progressIntervalRef.current = setInterval(async () => {
      try {
        const progressData = await getImageGenerationProgress();
        setProgress(progressData.progressPercent);

        if (progressData.status === 'completed' || progressData.status === 'error' || !progressData.running) {
          clearAllIntervals();
          if (progressData.status === 'completed') {
            setStatus('complete');
            setLoading(false);
          } else if (progressData.status === 'error') {
            setStatus('error');
            setError(progressData.detail || 'Generation failed');
            setLoading(false);
          } else {
            setStatus('idle');
            setLoading(false);
          }
        }
      } catch {
        // Server may have stopped - stop polling
        clearAllIntervals();
      }
    }, 2000);
  }, [clearAllIntervals]);

  // Status polling while server is running
  useEffect(() => {
    if (serverRunning) {
      statusIntervalRef.current = setInterval(async () => {
        try {
          const st = await getImageGenerationStatus();
          setServerRunning(st.running);
          setServerInfo(st);
          if (!st.running) {
            setStatus('idle');
            if (statusIntervalRef.current) {
              clearInterval(statusIntervalRef.current);
              statusIntervalRef.current = null;
            }
          }
        } catch {
          setServerRunning(false);
          if (statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
        }
      }, 3000);
    }

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    };
  }, [serverRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllIntervals();
    };
  }, [clearAllIntervals]);

  const checkStatus = useCallback(async () => {
    try {
      const st = await getImageGenerationStatus();
      setServerRunning(st.running);
      setServerInfo(st);
      if (st.running) {
        setStatus('ready');
      }
    } catch {
      setServerRunning(false);
      setStatus('idle');
    }
  }, []);

  const generate = useCallback(async (payload: GenerateImagePayload, minVramMb?: number) => {
    clearAllIntervals();
    setLoading(true);
    setError(null);
    setProgress(0);
    setVramWarning(null);

    try {
      // Check if server is running
      const st = await getImageGenerationStatus();

      if (!st.running) {
        // Auto-start server (with VRAM check)
        setStatus('starting');
        try {
          const startResult = await startImageGenerationServer(minVramMb);

          // Check for VRAM warning
          if ('ok' in startResult && !startResult.ok && startResult.reason === 'insufficient_vram') {
            const warning: VramWarning = {
              freeVramMb: startResult.freeVramMb,
              requiredVramMb: startResult.requiredVramMb,
            };
            setVramWarning(warning);
            setStatus('idle');
            setLoading(false);

            // If panel has a VRAM warning handler, let it ask the user
            if (onVramWarningRef.current) {
              const proceed = await onVramWarningRef.current(warning);
              if (proceed) {
                // User confirmed - retry without VRAM check (pass 0 to bypass)
                setVramWarning(null);
                setLoading(true);
                setStatus('starting');
                await startImageGenerationServer(0);
                setServerRunning(true);
                setStatus('ready');
              } else {
                return 'vram_warning';
              }
            } else {
              return 'vram_warning';
            }
          }

          setServerRunning(true);
          setStatus('ready');
        } catch (startErr: any) {
          setStatus('error');
          setError(`Failed to start Z-Image server: ${startErr.message}`);
          setLoading(false);
          return;
        }
      }

      // Send generation request
      setStatus('generating');
      const result = await generateImage(payload);

      // Start progress polling
      pollProgress();

      // If we got a direct result with URL, set complete
      if (result.url) {
        setLastImageUrl(result.url);
        setStatus('complete');
        setProgress(100);
        setLoading(false);
        clearAllIntervals();
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Image generation failed');
      setLoading(false);
      clearAllIntervals();
    }
  }, [clearAllIntervals, pollProgress]);

  const stopServerAction = useCallback(async () => {
    clearAllIntervals();
    try {
      await stopImageGenerationServer();
      setServerRunning(false);
      setStatus('idle');
    } catch {
      // Ignore errors on stop
    }
  }, [clearAllIntervals]);

  const clearVramWarning = useCallback(() => {
    setVramWarning(null);
  }, []);

  return {
    loading,
    progress,
    status,
    error,
    lastImageUrl,
    serverRunning,
    serverInfo,
    vramWarning,
    generate,
    clearVramWarning,
    setVramWarningHandler,
    stopServer: stopServerAction,
    checkStatus,
  };
}