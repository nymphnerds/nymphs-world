import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Image as ImageIcon, Loader, Dice5, ImagePlus, X, AlertTriangle, Clock, FileText, Upload, Copy, Check, Type, FilePlus } from 'lucide-react';
import { ImageExplorer } from './ImageExplorer';
import { GenerateImageModal } from './GenerateImageModal';
import { useImageGeneration, ImageGenState, VramWarning } from '../hooks/useImageGeneration';
import { GenerateImagePayload, transcribeImage } from '../services/api';
import { listFiles, FileItem } from '../services/api';

const SIZE_PRESETS = [
  { label: '512×512', w: 512, h: 512 },
  { label: '768×768', w: 768, h: 768 },
  { label: '1024×1024', w: 1024, h: 1024 },
  { label: '1280×720', w: 1280, h: 720 },
  { label: '720×1280', w: 720, h: 1280 },
  { label: '1344×768', w: 1344, h: 768 },
  { label: '1152×896', w: 1152, h: 896 },
  { label: '896×1152', w: 896, h: 1152 },
  { label: '1024×768', w: 1024, h: 768 },
  { label: '768×1024', w: 768, h: 1024 },
];

interface ImageGeneratorPanelProps {
  width: number;
  onImageSelect?: (url: string, path: string) => void;
  onOpenTranscription?: (text: string) => void;
}

export function ImageGeneratorPanel({ width, onImageSelect, onOpenTranscription }: ImageGeneratorPanelProps) {
  const [showExplorer, setShowExplorer] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [info, setInfo] = useState<{ modelId?: string; backend?: string; version?: string; device?: string; supportedModes?: string[] }>({});
  const [vramWarning, setVramWarning] = useState<VramWarning | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [pickerFiles, setPickerFiles] = useState<FileItem[]>([]);

  const [mode, setMode] = useState<'txt2img' | 'img2img' | 'img2txt'>('txt2img');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(2); // 1024×1024
  const [steps, setSteps] = useState(9);
  const [seed, setSeed] = useState('');
  const [img2imgStrength, setImg2imgStrength] = useState(0.7);
  const [selectedInitImage, setSelectedInitImage] = useState<string | null>(null);
  const [initImageBase64, setInitImageBase64] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');

  // Image-to-Text state
  const [img2txtImage, setImg2txtImage] = useState<string | null>(null);
  const [img2txtImagePath, setImg2txtImagePath] = useState<string | null>(null);
  const [img2txtPrompt, setImg2txtPrompt] = useState('');
  const [img2txtTranscribing, setImg2txtTranscribing] = useState(false);
  const [img2txtResult, setImg2txtResult] = useState<string | null>(null);
  const [img2txtCopied, setImg2txtCopied] = useState(false);

  // Z-Image operation mode (managed vs external)
  const [zImageMode, setZImageMode] = useState(() => {
    try {
      return localStorage.getItem('wbu_zimage_mode') || 'managed';
    } catch {
      return 'managed';
    }
  });

  // Refresh mode from localStorage on storage events (Settings change)
  useEffect(() => {
    const handler = () => {
      try {
        setZImageMode(localStorage.getItem('wbu_zimage_mode') || 'managed');
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', handler);
    // Also poll periodically since storage events don't fire in same tab
    const interval = setInterval(handler, 1000);
    return () => {
      window.removeEventListener('storage', handler);
      clearInterval(interval);
    };
  }, []);

  const getMinVramMb = () => {
    try {
      const v = localStorage.getItem('imageGen_minFreeVramMb');
      return v ? parseInt(v, 10) : undefined;
    } catch { return undefined; }
  };

  // ---- Image server health / info ----
  const refreshServerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/llm/image-generation/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('wbu_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsRunning(!!data.running);
        setInfo(data);
      } else {
        setIsRunning(false);
      }
    } catch {
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    refreshServerStatus();
  }, [refreshServerStatus]);

  // ---- Hook ----
  const { generate, loading, progress, status: genStatus, error: genError, lastImageUrl, serverRunning: hookServerRunning, vramWarning: hookVramWarning, stopServer, checkStatus, clearVramWarning, setVramWarningHandler } = useImageGeneration();

  // ---- Init image picker ----
  const openImagePicker = async () => {
    setShowImagePicker(true);
    setPickerFiles([]);
    try {
      const items = await listFiles('');
      const imgItems = items.filter(i => i.type === 'folder') as FileItem[];
      setPickerFiles(imgItems);
    } catch {
      setPickerFiles([]);
    }
  };

  const pickerSelect = async (filePath: string) => {
    setShowImagePicker(false);
    setSelectedInitImage(filePath);
    try {
      const res = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('wbu_token')}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => setInitImageBase64(reader.result as string);
        reader.readAsDataURL(blob);
      }
    } catch {
      setLocalError('Failed to load image');
    }
  };

  // ---- Handlers ----
  const handleStartServer = async () => {
    setIsStarting(true);
    try {
      const res = await fetch('/api/llm/image-generation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('wbu_token')}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLocalError(data.error || 'Failed to start image server');
        setIsStarting(false);
      } else {
        setLocalError('');
        refreshServerStatus();
      }
    } catch {
      setLocalError('Failed to start image server');
      setIsStarting(false);
    }
  };

  const handleStopServer = async () => {
    setIsStopping(true);
    try {
      const res = await fetch('/api/llm/image-generation/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('wbu_token')}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLocalError(data.error || 'Failed to stop image server');
      } else {
        setLocalError('');
        refreshServerStatus();
      }
    } catch {
      setLocalError('Failed to stop image server');
    }
    setIsStopping(false);
  };

  const handleGenerate = async () => {
    setLocalError('');

    if (!prompt.trim()) {
      setLocalError('Please enter a prompt.');
      return;
    }

    if (mode === 'img2img' && !initImageBase64) {
      setLocalError('Please select an init image for img2img mode.');
      return;
    }

    setShowResultModal(true);

    const preset = SIZE_PRESETS[selectedPreset];
    const payload: GenerateImagePayload = {
      mode: mode === 'img2txt' ? 'txt2img' : mode,
      prompt: prompt.trim(),
      width: preset.w,
      height: preset.h,
      steps,
      seed: seed.trim() ? parseInt(seed.trim()) : null,
    };

    if (negativePrompt.trim()) payload.negative_prompt = negativePrompt.trim();
    if (mode === 'img2img') {
      payload.image = initImageBase64 || undefined;
      payload.strength = img2imgStrength;
    }

    const minVram = getMinVramMb();
    const result = await generate(payload, minVram);

    // If VRAM warning, don't proceed with generation
    if (result === 'vram_warning') {
      // Wait for user confirmation via dialog
    }
  };

  // Image-to-Text handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImg2txtImage(reader.result as string);
      setImg2txtImagePath(file.name);
      setImg2txtResult(null);
      setImg2txtCopied(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectImageForTranscribe = async (filePath: string) => {
    setShowImagePicker(false);
    setImg2txtImagePath(filePath);
    try {
      const res = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setImg2txtImage(reader.result as string);
          setImg2txtResult(null);
          setImg2txtCopied(false);
        };
        reader.readAsDataURL(blob);
      }
    } catch {
      setLocalError('Failed to load image');
    }
  };

  const handleTranscribe = async () => {
    setLocalError('');
    if (!img2txtImage) {
      setLocalError('Please select or upload an image first.');
      return;
    }
    setImg2txtTranscribing(true);
    setImg2txtResult(null);
    setImg2txtCopied(false);
    try {
      const result = await transcribeImage(img2txtImage, img2txtPrompt || undefined);
      setImg2txtResult(result.text);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setImg2txtTranscribing(false);
    }
  };

  const handleCopyTranscript = () => {
    if (img2txtResult) {
      navigator.clipboard.writeText(img2txtResult);
      setImg2txtCopied(true);
      setTimeout(() => setImg2txtCopied(false), 2000);
    }
  };

  const handleInsertTranscript = () => {
    if (img2txtResult) {
      setPrompt(img2txtResult);
      setMode('txt2img');
    }
  };

  const handleRandomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 2147483647).toString());
  };

  return (
    <div className="flex flex-col h-full bg-background" style={{ width, minWidth: width }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-yellow-400" />
          <h2 className="text-xs font-semibold text-gray-200">Image Generator</h2>
          {(loading || genStatus === 'starting' || genStatus === 'generating') && (
            <Loader size={12} className="animate-spin text-blue-400" />
          )}
        </div>
      </div>

      {/* Content - form controls inline */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Server status & controls */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isRunning ? 'bg-green-400' : 'bg-gray-500'}`} />
          <span className="text-[10px] text-gray-400">
            {isRunning ? `${info.modelId || 'Running'}` : 'Stopped'}
            {info.device ? ` · ${info.device}` : ''}
          </span>
          {zImageMode === 'external' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#a78bfa]/20 text-[#a78bfa]">External</span>
          )}
          {zImageMode === 'managed' && !isRunning && (
            <button
              onClick={handleStartServer}
              disabled={isStarting}
              className="px-2 py-0.5 text-[10px] rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
            >
              {isStarting ? 'Starting...' : 'Start'}
            </button>
          )}
          {zImageMode === 'managed' && isRunning && (
            <button
              onClick={handleStopServer}
              disabled={isStopping}
              className="px-2 py-0.5 text-[10px] rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50"
            >
              {isStopping ? 'Stopping...' : 'Stop'}
            </button>
          )}
        </div>

        {/* Mode toggle */}
        <div className="form-group">
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #e0e0e0)' }}>Mode:</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`doc-type-btn ${mode === 'txt2img' ? 'active' : ''}`}
              onClick={() => setMode('txt2img')}
              style={{ flex: 1 }}
            >
              Text to Image
            </button>
            <button
              className={`doc-type-btn ${mode === 'img2img' ? 'active' : ''}`}
              onClick={() => setMode('img2img')}
              style={{ flex: 1 }}
            >
              Image to Image
            </button>
            <button
              className={`doc-type-btn ${mode === 'img2txt' ? 'active' : ''}`}
              onClick={() => setMode('img2txt')}
              style={{ flex: 1 }}
            >
              Image to Text
            </button>
          </div>
        </div>

        {/* Image to Text Mode UI */}
        {mode === 'img2txt' && (
          <div className="flex flex-col gap-3">
            {/* Image upload area */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #e0e0e0)' }}>Source Image:</label>
              {img2txtImage ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{
                    width: '100%', maxHeight: '200px', borderRadius: '8px',
                    border: '1px solid var(--border, #444)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', background: 'var(--surface, #1e1e2e)',
                  }}>
                    <img src={img2txtImage} alt="Source" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{
                      flex: 1, fontSize: '11px', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: 'var(--text-muted, #888)',
                    }}>
                      {img2txtImagePath || 'Uploaded image'}
                    </span>
                    <button
                      className="btn-secondary"
                      onClick={() => { setImg2txtImage(null); setImg2txtImagePath(null); setImg2txtResult(null); }}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-md border-2 border-dashed border-border/50 hover:border-primary/50 hover:bg-secondary/20 cursor-pointer transition-colors">
                    <Upload size={20} className="text-gray-500" />
                    <span className="text-[11px] text-gray-400">Drop image or click to upload</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/bmp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    className="btn-secondary flex items-center justify-center gap-2 w-full"
                    onClick={openImagePicker}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    <ImagePlus size={14} />
                    Select from Workspace
                  </button>
                </div>
              )}
            </div>

            {/* Custom prompt */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #e0e0e0)' }}>
                Instructions <span className="text-gray-500">(optional)</span>:
              </label>
              <textarea
                className="prompt-textarea"
                placeholder="Transcribe all text, preserving formatting and paragraphs..."
                value={img2txtPrompt}
                onChange={(e) => setImg2txtPrompt(e.target.value)}
                rows={2}
              />
            </div>

            {/* Transcribe button */}
            <button
              onClick={handleTranscribe}
              disabled={img2txtTranscribing || !img2txtImage}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm rounded-md bg-primary/20 hover:bg-primary/30 text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-primary/30"
            >
              {img2txtTranscribing ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Transcribing...
                </>
              ) : (
                <>
                  <Type size={16} />
                  Transcribe to Text
                </>
              )}
            </button>

            {/* Transcription result */}
            {img2txtResult && (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #e0e0e0)' }}>Result:</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn-secondary flex items-center gap-1"
                      onClick={handleCopyTranscript}
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                    >
                      {img2txtCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      {img2txtCopied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      className="btn-secondary flex items-center gap-1"
                      onClick={handleInsertTranscript}
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                    >
                      <FileText size={12} />
                      Insert in Prompt
                    </button>
                    {onOpenTranscription && (
                      <button
                        className="flex items-center gap-1 rounded-md bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-colors"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={() => img2txtResult && onOpenTranscription(img2txtResult)}
                      >
                        <FilePlus size={12} />
                        Open in Editor
                      </button>
                    )}
                  </div>
                </div>
                <div className="whitespace-pre-wrap" style={{
                  maxHeight: '250px', overflowY: 'auto', background: 'var(--surface, #1e1e2e)',
                  border: '1px solid var(--border, #444)', borderRadius: '6px', padding: '10px',
                  fontSize: '12px', color: 'var(--text, #e0e0e0)', lineHeight: '1.5',
                }}>
                  {img2txtResult}
                </div>
              </div>
            )}

            {/* Local error */}
            {localError && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-red-600/10 border border-red-600/20 text-red-400 text-[11px]">
                <AlertTriangle size={12} />
                {localError}
              </div>
            )}

            {/* Info */}
            <div className="px-2 py-3 rounded-md bg-secondary/10 border border-border/30 space-y-1.5">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Convert handwritten or printed documents to text using your LLM's vision capabilities.
              </p>
              <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                Requires a vision-capable model (e.g., LLaVA, GPT-4o, Claude Vision).
                Configure your model in Settings.
              </p>
            </div>
          </div>
        )}

        {/* Image Generation Form (hidden in img2txt mode) */}
        {mode !== 'img2txt' && (
          <>
            {/* Prompt */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #e0e0e0)' }}>Prompt:</label>
              <textarea
                className="prompt-textarea"
                placeholder="Describe the image you want to generate..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
            </div>

            {/* Negative Prompt */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #e0e0e0)' }}>Negative Prompt:</label>
              <textarea
                className="prompt-textarea"
                placeholder="Things to avoid in the image..."
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={2}
              />
            </div>

            {/* Size preset */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #e0e0e0)' }}>Size:</label>
              <div className="grid grid-cols-5 gap-1">
                {SIZE_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    className={`text-[10px] px-1 py-1 rounded transition-colors ${
                      selectedPreset === i ? 'bg-primary/30 text-primary border border-primary/50' : 'bg-secondary/30 text-gray-400 hover:bg-secondary/50 border border-transparent'
                    }`}
                    onClick={() => setSelectedPreset(i)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Steps + Seed row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #e0e0e0)' }}>Steps:</label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={steps}
                  onChange={(e) => setSteps(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="text-[10px] text-gray-400 text-center mt-0.5">{steps}</div>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #e0e0e0)' }}>Seed:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="Random"
                    className="flex-1 bg-background/50 text-gray-200 text-[11px] px-2 py-1 rounded border border-border/50 focus:border-primary/50 focus:outline-none"
                  />
                  <button
                    onClick={handleRandomizeSeed}
                    className="p-1 rounded hover:bg-accent text-gray-400 hover:text-white transition-colors"
                    title="Randomize seed"
                  >
                    <Dice5 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* img2img section */}
            {mode === 'img2img' && (
              <div className="form-group space-y-2">
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #e0e0e0)' }}>Init Image:</label>
                {selectedInitImage ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{
                      width: '100%', maxHeight: '150px', borderRadius: '8px',
                      backgroundImage: `url(${initImageBase64})`,
                      backgroundSize: 'contain', backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      border: '1px solid var(--border, #444)',
                    }} />
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{
                        flex: 1, fontSize: '11px', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: 'var(--text-muted, #888)',
                      }}>
                        {selectedInitImage}
                      </span>
                      <button
                        className="btn-secondary"
                        onClick={() => { setSelectedInitImage(null); setInitImageBase64(null); }}
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-md border-2 border-dashed border-border/50 hover:border-primary/50 hover:bg-secondary/20 cursor-pointer transition-colors">
                      <Upload size={20} className="text-gray-500" />
                      <span className="text-[11px] text-gray-400">Drop image or click to upload</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setInitImageBase64(reader.result as string);
                            setSelectedInitImage(file.name);
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden"
                      />
                    </label>
                    <button
                      className="btn-secondary flex items-center justify-center gap-2 w-full"
                      onClick={openImagePicker}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      <ImagePlus size={14} />
                      Select from Workspace
                    </button>
                  </div>
                )}

                {/* Strength slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>Strength:</span>
                    <span style={{ fontSize: '11px', color: 'var(--text, #e0e0e0)' }}>{img2imgStrength.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.01}
                    value={img2imgStrength}
                    onChange={(e) => setImg2imgStrength(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span>Subtle</span>
                    <span>Strong</span>
                  </div>
                </div>
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={
                !isRunning ||
                (mode === 'txt2img' ? !prompt.trim() : mode === 'img2img' ? (!prompt.trim() || !initImageBase64) : !prompt.trim())
              }
              className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm rounded-md bg-primary/20 hover:bg-primary/30 text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-primary/30"
            >
              <Sparkles size={16} />
              Generate
            </button>

            {/* Local error */}
            {localError && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-red-600/10 border border-red-600/20 text-red-400 text-[11px]">
                <AlertTriangle size={12} />
                {localError}
              </div>
            )}

            {/* Info text */}
            <div className="px-2 py-3 rounded-md bg-secondary/10 border border-border/30 space-y-1.5">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Generate images using the local Z-Image model (Z-Image-Turbo).
              </p>
              <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                Supports txt2img and img2img modes. Generated images are saved to{' '}
                <code className="text-muted-foreground">assets/images/</code>.
              </p>
              <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
                The image server starts automatically when needed.
              </p>
              <div className="flex items-start gap-1.5 pt-1 text-[10px] text-blue-300/60">
                <Clock size={10} className="mt-0.5 flex-shrink-0" />
                <span>Image generation takes 15–30 seconds depending on steps and resolution. Only one image can be generated at a time.</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* VRAM Warning Dialog */}
      {vramWarning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
          <div className="bg-background rounded-lg shadow-xl w-[90vw] max-w-md border border-yellow-600/30">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <AlertTriangle size={16} className="text-yellow-400" />
              <h3 className="text-sm font-semibold text-yellow-400">VRAM Warning</h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-gray-300">
                Only <strong className="text-yellow-400">{vramWarning.freeVramMb} MB</strong> of VRAM is free.
                Image generation requires at least <strong className="text-yellow-400">{vramWarning.requiredVramMb} MB</strong>.
              </p>
              <p className="text-[11px] text-gray-400">
                Proceeding may cause GPU crashes or system instability. Consider stopping other GPU-intensive applications first.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  className="btn-secondary px-3 py-1.5 text-[11px]"
                  onClick={() => setVramWarning(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-1.5 text-[11px] rounded-md bg-yellow-600/30 text-yellow-400 hover:bg-yellow-600/40 border border-yellow-600/30 transition-colors"
                  onClick={() => {
                    setVramWarning(null);
                    handleGenerate();
                  }}
                >
                  Generate Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50" onClick={() => setShowResultModal(false)}>
          <div className="bg-background rounded-lg shadow-xl w-[90vw] max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-gray-200">Image Generation</h3>
              <button onClick={() => setShowResultModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* State-driven progress */}
              {genStatus === 'idle' && (
                <div className="py-8 text-center text-[11px] text-gray-400">Idle</div>
              )}
              {genStatus === 'starting' && (
                <div className="py-6 text-center space-y-2">
                  <Loader size={20} className="mx-auto animate-spin text-blue-400" />
                  <p className="text-[11px] text-gray-400">Starting image server...</p>
                </div>
              )}
              {genStatus === 'generating' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Generating image...</span>
                    <span className="text-primary font-medium">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-secondary/30 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
              {genStatus === 'complete' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-green-400 text-center">Image generated successfully!</p>
                  <div className="flex justify-center">
                    {lastImageUrl && (
                      <img
                        src={lastImageUrl}
                        alt="Generated"
                        style={{ maxHeight: '300px', borderRadius: '8px', border: '1px solid var(--border, #444)' }}
                      />
                    )}
                  </div>
                </div>
              )}
              {genStatus === 'error' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-red-400">
                    <AlertTriangle size={14} />
                    {genError || 'Generation failed'}
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-center pt-2">
                <button
                  className="btn-secondary px-3 py-1.5 text-[11px]"
                  onClick={() => setShowResultModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Init Image Picker Modal */}
      {showImagePicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowImagePicker(false)}>
          <div className="bg-background rounded-lg shadow-xl w-[90vw] max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-gray-200">Select Init Image</h3>
              <button onClick={() => setShowImagePicker(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {pickerFiles.length === 0 ? (
                <div className="py-8 text-center text-[11px] text-gray-500">No folders found</div>
              ) : (
                pickerFiles.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => pickerSelect(f.path)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/30 text-left"
                  >
                    <ImageIcon size={14} className="text-blue-400" />
                    <span className="text-[11px] text-gray-300 truncate">{f.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Explorer Modal */}
      {showExplorer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowExplorer(false)}>
          <div className="bg-background rounded-lg shadow-xl w-[90vw] h-[80vh] max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <ImageExplorer
              onImageSelect={(url: string, path: string) => {
                setShowExplorer(false);
                onImageSelect?.(url, path);
              }}
              onClose={() => setShowExplorer(false)}
              baseFolder="assets/images"
            />
          </div>
        </div>
      )}
    </div>
  );
}