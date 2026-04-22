import { useState, useRef, useCallback, useEffect } from "react";
import { Client } from "@gradio/client";

// ── CONFIG — replace with your HuggingFace Space URL ─────────────────────
const HF_SPACE = "Yogesh523/birdclef-backend";  // e.g. "johndoe/birdclef-2026"

// ── TYPES ──────────────────────────────────────────────────────────────────
type Prediction = { label: string; confidence: number };
type Status = "idle" | "recording" | "processing" | "done" | "error";

// ── SPECIES DISPLAY NAMES (common name lookup — extend as needed) ──────────
const COMMON_NAMES: Record<string, string> = 
{
  "1161364": "Guyalna cuta",
  "116570": "Southern Spectacled Caiman",
  "1176823": "Wrestler Frog",
  "1491113": "Guaran\u00ed leaf-litter frog",
  "1595929": "Uruguay Harlequin Frog",
  "209233": "Feral Horse",
  "22930": "Basin White-lipped Frog",
  "22956": "Mustached Frog",
  "22961": "Pointedbelly Frog",
  "22967": "Marbled White-lipped Frog",
  "22973": "Whistling Grass Frog",
  "22983": "Pepper Frog",
  "22985": "Peter's Jungle Frog",
  "23150": "Central Dwarf Frog",
  "23154": "Bahia Dwarf Frog",
  "23158": "Pale-legged Weeping Frog",
  "23176": "Cope's Swamp Froglet",
  "23724": "Waxy Monkey Tree Frog",
  "24279": "Lesser Snouted Tree Frog",
  "24285": "Snouted Tree Frog",
  "24287": "Brown-bordered Snouted Tree Frog",
  "24321": "Mato Grosso Snouted Tree Frog",
  "244024": "Giant Cicada",
  "25073": "Chiasmocleis mehelyi",
  "25092": "Two-colored oval frog",
  "25214": "Muller's Termite Frog",
  "326272": "Weeping Frog",
  "41970": "Jaguar",
  "43435": "Black Howling Monkey",
  "47144": "Domestic Dog",
  "47158son01": "Insect sonotype01",
  "47158son02": "Insect sonotype02",
  "47158son03": "Insect sonotype03",
  "47158son04": "Insect sonotype04",
  "47158son05": "Insect sonotype05",
  "47158son06": "Insect sonotype06",
  "47158son07": "Insect sonotype07",
  "47158son08": "Insect sonotype08",
  "47158son09": "Insect sonotype09",
  "47158son10": "Insect sonotype10",
  "47158son11": "Insect sonotype11",
  "47158son12": "Insect sonotype12",
  "47158son13": "Insect sonotype13",
  "47158son14": "Insect sonotype14",
  "47158son15": "Insect sonotype15",
  "47158son16": "Insect sonotype16",
  "47158son17": "Insect sonotype17",
  "47158son18": "Insect sonotype18",
  "47158son19": "Insect sonotype19",
  "47158son20": "Insect sonotype20",
  "47158son21": "Insect sonotype21",
  "47158son22": "Insect sonotype22",
  "47158son23": "Insect sonotype23",
  "47158son24": "Insect sonotype24",
  "47158son25": "Insect sonotype25",
  "476521": "Cuyaba Dwarf Frog",
  "516975": "Hooded Capuchin",
  "517063": "Southern Orange-legged Leaf Frog",
  "555123": "Usina Tree Frog",
  "555145": "Polka-dot Tree Frog",
  "555146": "Chaco Tree Frog",
  "64898": "Yungas de la Paz Poison Frog",
  "65377": "Lesser Tree Frog",
  "65380": "Dwarf Tree Frog",
  "66971": "Paraguayan Swimming Frog",
  "67107": "Rococo Toad",
  "67252": "Milk Frog",
  "70711": "Cei's White-lipped Frog",
  "738183": "White-coated Titi",
  "74113": "Highland",
  "74580": "Black-tailed Marmoset",
  "760266": "Prionacris erosa",
  "ashgre1": "Ashy-headed Greenlet",
  "astcra1": "Ash-throated Crake",
  "bafcur1": "Bare-faced Curassow",
  "baffal1": "Barred Forest-Falcon",
  "banana": "Bananaquit",
  "barant1": "Barred Antshrike",
  "batbel1": "Bare-throated Bellbird",
  "baymac": "Blue-and-yellow Macaw",
  "bbwduc": "Black-bellied Whistling Duck",
  "bcwfin2": "Black-capped Warbling Finch",
  "bkcdon": "Black-capped Donacobius",
  "bkhpar": "Nanday Parakeet",
  "blchaw1": "Black-collared Hawk",
  "blheag1": "Black Hawk-Eagle",
  "blttit1": "Black-tailed Tityra",
  "bncfly": "Brown-crested Flycatcher",
  "bobfly1": "Boat-billed Flycatcher",
  "brcmar1": "Brown-chested Martin",
  "brnowl": "American Barn Owl",
  "bucmot4": "Amazonian Motmot",
  "bucpar": "Blue-crowned Parakeet",
  "bufpar": "Turquoise-fronted Amazon",
  "bunibi1": "Buff-necked Ibis",
  "burowl": "Burrowing Owl",
  "camfli1": "Campo Flicker",
  "chacha1": "Chaco Chachalaca",
  "chbmoc1": "Chalk-browed Mockingbird",
  "chobla1": "Chopi Blackbird",
  "chvcon1": "Chestnut-vented Conebill",
  "cibspi1": "Cinereous-breasted Spinetail",
  "coffal1": "Collared Forest-Falcon",
  "compau": "Pauraque",
  "compot1": "Common Potoo",
  "crbthr1": "Creamy-bellied Thrush",
  "crebec1": "Crested Becard",
  "dwatin1": "Dwarf Tinamou",
  "epaori4": "Variable Oriole",
  "eulfly1": "Euler's Flycatcher",
  "fabwre1": "Fawn-breasted Wren",
  "fepowl": "Ferruginous Pygmy Owl",
  "ficman1": "Fiery-capped Manakin",
  "flawar1": "Flavescent Warbler",
  "fotfly": "Fork-tailed Flycatcher",
  "fusfly1": "Fuscous Flycatcher",
  "gilhum1": "Gilded Hummingbird",
  "giwrai1": "Giant Wood Rail",
  "glteme1": "Glittering-throated Emerald",
  "grasal3": "Bluish-grey Saltator",
  "greani1": "Greater Ani",
  "greant1": "Great Antshrike",
  "greela": "Greenish Elaenia",
  "grekis": "Great Kiskadee",
  "grepot1": "Great Potoo",
  "gretho2": "Greater Thornbird",
  "greyel": "Greater Yellowlegs",
  "grfdov1": "Grey-fronted Dove",
  "grhtan1": "Grey-headed Tanager",
  "gycwor1": "Grey-cowled Wood Rail",
  "horscr1": "Horned Screamer",
  "houspa": "House Sparrow",
  "hyamac1": "Hyacinth Macaw",
  "larela1": "Large Elaenia",
  "lesela1": "Lesser Elaenia",
  "lesgrf1": "Lesser Grass-Finch",
  "limpki": "Limpkin",
  "linwoo1": "Lineated Woodpecker",
  "litcuc2": "Little Cuckoo",
  "litnig1": "Little Nightjar",
  "mabpar": "Maroon-bellied Parakeet",
  "magant1": "Mato Grosso Antbird",
  "magtan2": "Magpie Tanager",
  "masgna1": "Masked Gnatcatcher",
  "nacnig1": "Nacunda Nighthawk",
  "ocecra1": "Ocellated Crake",
  "oliwoo1": "Olivaceous Woodcreeper",
  "orbtro3": "Orange-backed Troupial",
  "orwpar": "Orange-winged Amazon",
  "osprey": "Osprey",
  "pabspi1": "Pale-breasted Spinetail",
  "palhor3": "Pale-legged Hornero",
  "paltan1": "Palm Tanager",
  "phecuc1": "Pheasant Cuckoo",
  "picpig2": "Picazuro Pigeon",
  "pirfly1": "Piratic Flycatcher",
  "plasla1": "Planalto Slaty Antshrike",
  "platyr1": "Plain Inezia",
  "plcjay1": "Plush-crested Jay",
  "pluibi1": "Plumbeous Ibis",
  "purjay1": "Purplish Jay",
  "pvttyr1": "Pearly-vented Tody-Tyrant",
  "ragmac1": "Red-and-green Macaw",
  "rebscy1": "Red-billed Scythebill",
  "recfin1": "Red-crested Finch",
  "redjun": "Red Junglefowl",
  "relser1": "Red-legged Seriema",
  "rinkin1": "Ringed Kingfisher",
  "rivwar1": "Riverbank Warbler",
  "roahaw": "Roadside Hawk",
  "rubthr1": "Rufous-bellied Thrush",
  "rufcac2": "Rufous Cacholote",
  "rufcas2": "Rufous Casiornis",
  "rufgna3": "Rufous Gnateater",
  "rufhor2": "Rufous Hornero",
  "rufnig1": "Rufous Nightjar",
  "ruftho1": "Rufous-fronted Thornbird",
  "ruftof1": "Rusty-fronted Tody-Flycatcher",
  "rumfly1": "Rusty-margined Flycatcher",
  "ruther1": "Rufescent Tiger Heron",
  "rutjac1": "Rufous-tailed Jacamar",
  "sabspa1": "Saffron-billed Sparrow",
  "saffin": "Saffron Finch",
  "saytan1": "Sayaca Tanager",
  "scadov1": "Scaled Dove",
  "schpar1": "Scaly-headed Parrot",
  "scther1": "Scale-throated Hermit",
  "shcfly1": "Short-crested Flycatcher",
  "shshaw": "Sharp-shinned Hawk",
  "shtnig1": "Short-tailed Nighthawk",
  "sibtan2": "Silver-beaked Tanager",
  "smbani": "Smooth-billed Ani",
  "smbtin1": "Small-billed Tinamou",
  "sobcac1": "Solitary Cacique",
  "sobtyr1": "Southern Beardless Tyrannulet",
  "socfly1": "Social Flycatcher",
  "sofspi1": "Sooty-fronted Spinetail",
  "souant1": "Southern Antpipit",
  "soulap1": "Southern Lapwing",
  "souscr1": "Southern Screamer",
  "spbant3": "Spot-backed Antshrike",
  "spispi1": "Spix's Spinetail",
  "sptnig1": "Spot-tailed Nightjar",
  "squcuc1": "Common Squirrel-Cuckoo",
  "stbwoo2": "Straight-billed Woodcreeper",
  "strcuc1": "Striped Cuckoo",
  "strher2": "Striated Heron",
  "strowl1": "Striped Owl",
  "swthum1": "Swallow-tailed Hummingbird",
  "swtman1": "Swallow-tailed Manakin",
  "tattin1": "Tataupa Tinamou",
  "thlwre1": "Thrush-like Wren",
  "toctou1": "Toco Toucan",
  "trokin": "Tropical Kingbird",
  "trsowl": "Tropical Screech Owl",
  "undtin1": "Undulated Tinamou",
  "varant1": "Variable Antshrike",
  "watjac1": "Wattled Jacana",
  "wesfie1": "Western Fire-eye",
  "wfwduc1": "White-faced Whistling Duck",
  "whbant2": "White-bearded Antshrike",
  "whbwar2": "White-browed Warbler",
  "whiwoo1": "White Woodpecker",
  "whlspi1": "White-lored Spinetail",
  "whnjay1": "White-naped Jay",
  "whtdov": "White-tipped Dove",
  "whwpic1": "White-wedged Piculet",
  "y00678": "Crested Caracara",
  "yebcar": "Yellow-billed Cardinal",
  "yebela1": "Yellow-bellied Elaenia",
  "yecmac": "Golden-collared Macaw",
  "yecpar": "Yellow-chevroned Parakeet",
  "yehcar1": "Yellow-headed Caracara",
  "yeofly1": "Yellow-olive Flatbill"

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
