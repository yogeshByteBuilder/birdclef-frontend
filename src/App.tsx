import { useState, useRef, useCallback, useEffect } from "react";
import { Client } from "@gradio/client";

// ── CONFIG — replace with your HuggingFace Space URL ─────────────────────
const HF_SPACE = "Yogesh523/birdclef-backend";  // e.g. "johndoe/birdclef-2026"

// ── TYPES ──────────────────────────────────────────────────────────────────
type Prediction = { label: string; confidence: number };
type Status = "idle" | "recording" | "processing" | "done" | "error";

// ── SPECIES DISPLAY NAMES (common name lookup — extend as needed) ──────────
const COMMON_NAMES: Record<string, string> = {
  // add entries like: "eafdov1": "Eurasian Feral Dove",
  // left empty — falls back to showing the code itself
};

function getDisplayName(code: string): string {
  return COMMON_NAMES[code] ?? code.replace(/_/g, " ").toUpperCase();
}

// ── WAVEFORM VISUALIZER ────────────────────────────────────────────────────
function WaveformBars({ active }: { active: boolean }) {
  return (
    <div className="waveform">
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          className="bar"
          style={{
            animationDelay: `${(i * 0.07) % 0.8}s`,
            animationPlayState: active ? "running" : "paused",
          }}
        />
      ))}
    </div>
  );
}

// ── CONFIDENCE BAR ─────────────────────────────────────────────────────────
function PredictionCard({
  pred,
  rank,
  animate,
}: {
  pred: Prediction;
  rank: number;
  animate: boolean;
}) {
  const pct = Math.round(pred.confidence * 100);
  const hue = 160 + rank * 15;

  return (
    <div className={`pred-card ${animate ? "fade-in" : ""}`} style={{ animationDelay: `${rank * 0.1}s` }}>
      <div className="pred-header">
        <span className="pred-rank">#{rank + 1}</span>
        <span className="pred-name">{getDisplayName(pred.label)}</span>
        <span className="pred-pct">{pct}%</span>
      </div>
      <div className="pred-bar-bg">
        <div
          className="pred-bar-fill"
          style={{
            width: animate ? `${pct}%` : "0%",
            background: `hsl(${hue}, 72%, 52%)`,
            transition: `width 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${rank * 0.1}s`,
          }}
        />
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function App() {
  const [status, setStatus]         = useState<Status>("idle");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [errorMsg, setErrorMsg]     = useState("");
  const [audioUrl, setAudioUrl]     = useState<string | null>(null);
  const [fileName, setFileName]     = useState("");
  const [animate, setAnimate]       = useState(false);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const mediaRef      = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const dropRef       = useRef<HTMLDivElement>(null);

  // ── run inference against HF Spaces ──────────────────────────────────────
  const runInference = useCallback(async (file: File | Blob, name = "audio") => {
    setStatus("processing");
    setPredictions([]);
    setAnimate(false);
    setErrorMsg("");

    try {
      const client = await Client.connect(HF_SPACE);
      const result = await client.predict("/predict", { audio_path: file });

      // result.data[0] = {label: conf} dict from Gradio Label component
     // Get the main output object from Gradio
      const outputObj = (result.data as any[])[0];
      
      // Gradio's Label component actually returns the array inside an object
      // under the key "confidences"
      const sorted: Prediction[] = outputObj.confidences.map((item: any) => ({
        label: item.label,
        confidence: item.confidence
      })).slice(0, 5);

      setPredictions(sorted);
      setStatus("done");
      setTimeout(() => setAnimate(true), 50);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setStatus("error");
    }
  }, []);

  // ── file upload / drop ─────────────────────────────────────────────────
  const handleFile = (file: File) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setFileName(file.name);
    runInference(file, file.name);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
    dropRef.current?.classList.remove("drag-over");
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.add("drag-over");
  };
  const onDragLeave = () => dropRef.current?.classList.remove("drag-over");

  // ── microphone recording ───────────────────────────────────────────────
// ── microphone recording ───────────────────────────────────────────────
  const startRecording = async () => { // <-- 1. Removed 'err' from here
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        // 2. Removed the "audio/webm" type so Apple devices (iOS/Mac) don't crash!
        const blob = new Blob(chunksRef.current); 
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setFileName("recorded_audio");
        runInference(blob, "recorded_audio");
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setStatus("recording");
    } catch (error: any) { // <-- 3. Catch the actual error here!
      console.error("The exact microphone error is:", error.name, error.message);
      
      // 4. Tell the React UI to show the red error box
      setStatus("error");
      
      if (error.name === 'NotAllowedError') {
        setErrorMsg("Browser or OS blocked access. Please allow mic permissions.");
      } else if (error.name === 'NotFoundError') {
        setErrorMsg("No microphone detected. Please plug one in.");
      } else if (error.name === 'NotReadableError') {
        setErrorMsg("Another app (like Zoom or Meet) is currently using the mic.");
      } else {
        setErrorMsg("Microphone error: " + error.message);
      }
    }
  };
  const stopRecording = () => {
    mediaRef.current?.stop();
    setStatus("processing");
  };

  // cleanup
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  return (
    <>
      <style>{CSS}</style>

      <div className="page">
        {/* background decorative circles */}
        <div className="bg-circle c1" />
        <div className="bg-circle c2" />

        {/* ── header ─────────────────────────────────────────────────── */}
        <header>
          <div className="header-icon">🐦</div>
          <div>
            <h1>BIODIVERSITY MONITOR </h1>
            <p className="subtitle">AUTOMATED BIRD SPECIES IDENTIFICATION FROM AUDIO SOUNDSCAPES</p>
          </div>
        </header>

        {/* ── upload / record zone ──────────────────────────────────── */}
        <div
          className="drop-zone"
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => status === "idle" || status === "done" || status === "error"
            ? fileInputRef.current?.click()
            : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.ogg,.mp3,.wav,.flac"
            style={{ display: "none" }}
            onChange={onFileChange}
          />

          {status === "idle" && (
            <>
              <div className="drop-icon">🎵</div>
              <p className="drop-title">Drop audio here or click to upload</p>
              <p className="drop-hint">.ogg · .mp3 · .wav · .flac  |  5–60 seconds</p>
            </>
          )}

          {status === "recording" && (
            <>
              <WaveformBars active />
              <p className="drop-title recording-text">● Recording…</p>
              <p className="drop-hint">Click Stop when done</p>
            </>
          )}

          {status === "processing" && (
            <>
              <div className="spinner" />
              <p className="drop-title">Analysing audio…</p>
              <p className="drop-hint">Running model inference + TTA</p>
            </>
          )}

          {(status === "done" || status === "error") && fileName && (
            <>
              <div className="drop-icon">✅</div>
              <p className="drop-title">{fileName}</p>
              <p className="drop-hint">Click to upload a different file</p>
            </>
          )}
        </div>

        {/* ── audio playback ────────────────────────────────────────── */}
        {audioUrl && (
          <audio className="audio-player" controls src={audioUrl} />
        )}

        {/* ── mic button ───────────────────────────────────────────── */}
        <div className="btn-row">
          {status !== "recording" ? (
            <button
              className="btn mic-btn"
              onClick={startRecording}
              disabled={status === "processing"}
            >
              🎤  Record from Microphone
            </button>
          ) : (
            <button className="btn stop-btn" onClick={stopRecording}>
              ⏹  Stop Recording
            </button>
          )}
        </div>

        {/* ── error message ─────────────────────────────────────────── */}
        {status === "error" && (
          <div className="error-box">
            ⚠️  {errorMsg || "Something went wrong. Check the HF Space URL."}
          </div>
        )}

        {/* ── predictions ───────────────────────────────────────────── */}
        {predictions.length > 0 && (
          <section className="results">
            <h2 className="results-title">
              Top {predictions.length} Predictions
            </h2>
            {predictions.map((p, i) => (
              <PredictionCard key={p.label} pred={p} rank={i} animate={animate} />
            ))}
          </section>
        )}

        {/* ── footer ────────────────────────────────────────────────── */}
        <footer>
          <span>Pushkal Sharma · Yogesh Shrivastava · MITS Gwalior</span>
          <span>Guided by prof. Manisha Pathak</span>
        </footer>
      </div>
    </>
  );
}

// ── STYLES ─────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #060d12;
    --surface: #0d1f2b;
    --card:    #112433;
    --border:  #1c3547;
    --teal:    #0eb8c5;
    --teal2:   #06d6a0;
    --amber:   #fca311;
    --muted:   #6a8fa0;
    --white:   #e8f4f8;
    --red:     #ef4444;
    --radius:  14px;
  }

  body {
    background: var(--bg);
    color: var(--white);
    font-family: 'Syne', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .page {
    max-width: 680px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
    position: relative;
    z-index: 1;
  }

  /* decorative background circles */
  .bg-circle {
    position: fixed;
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
  }
  .c1 {
    width: 520px; height: 520px;
    top: -120px; right: -160px;
    background: radial-gradient(circle, rgba(14,184,197,.12) 0%, transparent 70%);
  }
  .c2 {
    width: 400px; height: 400px;
    bottom: 60px; left: -140px;
    background: radial-gradient(circle, rgba(6,214,160,.08) 0%, transparent 70%);
  }

  /* header */
  header {
    display: flex;
    align-items: center;
    gap: 1.2rem;
    margin-bottom: 2.4rem;
  }
  .header-icon {
    font-size: 2.8rem;
    line-height: 1;
    filter: drop-shadow(0 0 16px rgba(14,184,197,.6));
  }
  h1 {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 2rem;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, var(--teal), var(--teal2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .subtitle {
    color: var(--muted);
    font-size: 0.78rem;
    font-family: 'Space Mono', monospace;
    margin-top: 2px;
  }

  /* drop zone */
  .drop-zone {
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 2.8rem 2rem;
    text-align: center;
    cursor: pointer;
    transition: border-color .25s, background .25s, transform .15s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .7rem;
    min-height: 180px;
    justify-content: center;
  }
  .drop-zone:hover, .drop-zone.drag-over {
    border-color: var(--teal);
    background: #0f2433;
    transform: translateY(-2px);
  }
  .drop-icon { font-size: 2.5rem; }
  .drop-title { font-size: 1.05rem; font-weight: 600; color: var(--white); }
  .drop-hint  { font-family: 'Space Mono', monospace; font-size: .72rem; color: var(--muted); }
  .recording-text { color: var(--red); animation: pulse 1s ease-in-out infinite; }

  /* waveform */
  .waveform {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 48px;
  }
  .bar {
    display: block;
    width: 4px;
    background: linear-gradient(to top, var(--teal), var(--teal2));
    border-radius: 2px;
    animation: wave 0.8s ease-in-out infinite alternate;
    min-height: 4px;
  }
  @keyframes wave {
    from { height: 6px; }
    to   { height: 40px; }
  }

  /* spinner */
  .spinner {
    width: 44px; height: 44px;
    border: 3px solid var(--border);
    border-top-color: var(--teal);
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* audio player */
  .audio-player {
    width: 100%;
    margin-top: 1rem;
    border-radius: 8px;
    background: var(--surface);
    accent-color: var(--teal);
  }

  /* buttons */
  .btn-row {
    display: flex;
    justify-content: center;
    margin-top: 1.2rem;
  }
  .btn {
    font-family: 'Syne', sans-serif;
    font-weight: 600;
    font-size: .92rem;
    padding: .65rem 1.6rem;
    border-radius: 50px;
    border: none;
    cursor: pointer;
    transition: transform .15s, box-shadow .15s, opacity .15s;
  }
  .btn:disabled { opacity: .45; cursor: not-allowed; }
  .btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.4); }

  .mic-btn  { background: linear-gradient(135deg, var(--teal), var(--teal2)); color: #060d12; }
  .stop-btn { background: linear-gradient(135deg, var(--red), #ff6b6b); color: #fff; }

  /* error */
  .error-box {
    margin-top: 1rem;
    padding: .9rem 1.2rem;
    border-radius: var(--radius);
    background: rgba(239,68,68,.1);
    border: 1px solid rgba(239,68,68,.3);
    color: #fca5a5;
    font-family: 'Space Mono', monospace;
    font-size: .8rem;
  }

  /* results */
  .results { margin-top: 2rem; }
  .results-title {
    font-weight: 700;
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .08em;
    font-family: 'Space Mono', monospace;
    font-size: .78rem;
  }

  .pred-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: .9rem 1.1rem;
    margin-bottom: .7rem;
    opacity: 0;
  }
  .pred-card.fade-in {
    animation: fadeUp .5s ease forwards;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }

  .pred-header {
    display: flex;
    align-items: center;
    gap: .6rem;
    margin-bottom: .55rem;
  }
  .pred-rank {
    font-family: 'Space Mono', monospace;
    font-size: .7rem;
    color: var(--muted);
    min-width: 24px;
  }
  .pred-name {
    flex: 1;
    font-weight: 600;
    font-size: .95rem;
    letter-spacing: .01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pred-pct {
    font-family: 'Space Mono', monospace;
    font-size: .8rem;
    font-weight: 700;
    color: var(--teal);
  }

  .pred-bar-bg {
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
  }
  .pred-bar-fill {
    height: 100%;
    border-radius: 3px;
    width: 0%;
  }

  /* footer */
  footer {
    margin-top: 3.5rem;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: .5rem;
    font-family: 'Space Mono', monospace;
    font-size: .68rem;
    color: var(--muted);
    border-top: 1px solid var(--border);
    padding-top: 1.2rem;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: .5; }
  }

  @media (max-width: 500px) {
    h1 { font-size: 1.5rem; }
    .drop-zone { padding: 2rem 1rem; }
    footer { font-size: .62rem; }
  }
`;
