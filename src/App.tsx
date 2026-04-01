import { useState, useEffect, FormEvent, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, Type } from "@google/genai";
import { Film, Ghost, Share2, RefreshCw, AlertCircle, Terminal, Download } from "lucide-react";
import { toPng } from "html-to-image";

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const LOADING_MESSAGES = [
  "Judging your Top 4...",
  "Cringing at your all-lowercase reviews...",
  "Calculating your A24 dependency...",
  "Validating your 'literally me' complex...",
  "Analyzing your criterion-to-marvel ratio...",
  "Scanning for pretentious black-and-white films...",
  "Checking if you actually watched 'Jeanne Dielman'...",
  "Measuring your obsession with Timothée Chalamet...",
  "Consulting the Filmtwt elders...",
  "Checking if you've ever seen a movie not made by Christopher Nolan...",
  "Calculating your 'kino' score...",
  "Detecting 'mid' taste levels...",
  "Analyzing your Greta Gerwig obsession...",
  "Searching for a personality behind those 5-star ratings...",
];

interface RoastData {
  diagnosisTitle: string;
  top4Roast: string;
  overallVibe: string;
}

interface ScrapedData {
  username: string;
  top4: string[];
  recent: { title: string; rating: string }[];
  filmsLogged: string;
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, delay: 0.5 }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [roast, setRoast] = useState<RoastData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [kinoStats, setKinoStats] = useState({
    pretension: 0,
    recencyBias: 0,
    filmBroEnergy: 0,
  });

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleRoast = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError(null);
    setRoast(null);
    setScrapedData(null);

    try {
      // 1. Scrape data
      const scrapeRes = await fetch(`/api/scrape/${username}`);
      const data = await scrapeRes.json();

      if (!scrapeRes.ok) {
        throw new Error(data.message || data.error || "Could not find that Letterboxd profile. Is it private?");
      }
      
      setScrapedData(data);

      // 2. Generate Roast with Gemini
      const prompt = `User Letterboxd Username: ${data.username}
Top 4 Favorite Films: ${data.top4.join(", ")}
Recently Watched: ${data.recent.map(r => `${r.title} (${r.rating})`).join(", ")}
Total Films Logged: ${data.filmsLogged}`;

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: `You are a hyper-pretentious, aggressive, and snarky film critic AI, deeply embedded in "Film Twitter" (Filmtwt) culture. 
          The user will provide their Letterboxd Top 4 movies and recently watched movies. You must ruthlessly roast their taste using Filmtwt slang (e.g., "kino", "cinema", "movies", "literally me", "pilled", "mid", "peak", "caped shit", "soul vs soulless", "visceral", "elevated", "theme park", "grain", "35mm", "70mm", "IMAX", "color grading", "needle drops", "aspect ratio", "blocking", "pacing", "non-linear", "practical effects", "digital vs film", "over-edited", "the score carries", "cinematography is just vibes", "letterboxd core", "mubi core", "criterion core").
          
          Critique specific technical aspects if applicable:
          - Editing: "The pacing is as bloated as your ego." or "Did they edit this on a phone?"
          - Score: "The score is doing all the heavy lifting for this mid script." or "Abysmal needle drops."
          - Cinematography: "Vibes-based cinematography isn't a substitute for a personality." or "Natural lighting doesn't make it a masterpiece."
          
          Diagnose their specific archetype based on their Top 4:
          - The "Literally Me" Sigma: (Drive, Blade Runner 2049, Joker, Nightcrawler) - Thinks they are Ryan Gosling.
          - The A24 Cultist: (Midsommar, Hereditary, Everything Everywhere All At Once) - Thinks A24 is the only studio that exists.
          - The Criterion Snob: (Seven Samurai, Stalker, Jeanne Dielman) - Only watches 4-hour black and white films.
          - The Artsy Sad Girl: (Lady Bird, Frances Ha, Portrait of a Lady on Fire) - Thinks Greta Gerwig is their mother.
          - The Film Bro: (Pulp Fiction, Fight Club, The Dark Knight, Interstellar) - Thinks they are the first person to discover Christopher Nolan.
          - The "Elevated Horror" Gatekeeper: (The Witch, It Follows, Barbarian) - Thinks jump scares are for the weak.
          - The Mainstream NPC: (Marvel movies, Star Wars, Disney) - Thinks "cinema" is a theme park.
          - The Over-Caffeinated Indie Darling: (Aftersun, Past Lives, The Worst Person in the World, Eighth Grade) - Thinks a movie isn't good unless it features a coming-of-age story and a synth-pop soundtrack.
          - The Nostalgia-Blind 80s Kid: (The Goonies, Back to the Future, Raiders of the Lost Ark, E.T.) - Thinks practical effects are the only true art form and refuses to watch anything released after the fall of the Berlin Wall.
          - The "I Only Watch Foreign Films" Intellectual: (Parasite, In the Mood for Love, Spirited Away, Amélie) - Thinks reading subtitles is a personality trait and constantly reminds you that "the original title is much better."
          - The "I Miss the 90s" Blockbuster Junkie: (Jurassic Park, The Matrix, Independence Day, Titanic) - Thinks CGI peaked in 1993 and Hans Zimmer is the only composer that matters.
          - The "Auteur Theory" Obsessive: (The Grand Budapest Hotel, Inherent Vice, Mulholland Drive, The Tree of Life) - Will defend a 3-hour movie with no plot as long as the director's name is in the opening credits.
          - The "TikTok Aesthetic" Curator: (The Virgin Suicides, Pearl, Bottoms, Priscilla) - Chooses movies based on whether the color palette matches their bedroom decor.
          - The "Found Footage" Truthist: (The Blair Witch Project, Cloverfield, [REC], Paranormal Activity) - Thinks shaky cam is the only way to feel "immersion" and defends every low-budget horror movie on Tubi.
          - The "Slow Cinema" Martyr: (Sátántangó, An Elephant Sitting Still, Goodbye, Dragon Inn, Memoria) - Brags about not checking their phone during a 7-minute shot of a wall.
          - The "Modern Musical" Hater: (La La Land, West Side Story, Tick, Tick... Boom!, In the Heights) - Thinks they're too cool for people breaking into song but secretly knows every lyric to 'City of Stars'.
          
          Catalogue of Filmtwt Roast Phrases to use:
          - "Your Top 4 looks like the 'Popular' tab on Letterboxd."
          - "Did you actually watch this or just log it for the aesthetic?"
          - "Tell me you're a film bro without telling me you're a film bro."
          - "A24's strongest soldier."
          - "You definitely have a 'Movies' folder on your desktop that's just 1080p YTS rips."
          - "You think [Movie] is deep because it has a slow zoom."
          - "Your taste is just 'Movies that make me feel like a misunderstood intellectual'."
          - "You rate everything 4.5 stars because you're afraid of having an opinion."
          - "You definitely use the word 'visceral' in every review."
          - "This Top 4 is just a cry for help from someone who hasn't seen a movie made before 1990."
          - "Your personality is just whatever the Curzon cinema schedule tells you it is."
          - "You definitely own a Criterion tote bag but haven't opened the shrink wrap on half your collection."
          - "You think 'cinematography' just means 'neon lights at night'."
          - "Your Letterboxd is just a mood board for a life you're not living."
          - "You're the reason why people think film students are insufferable."
          - "This Top 4 screams 'I just discovered MUBI and now I'm better than you'."
          - "You definitely have a 'literally me' poster in your room that you bought from Redbubble."
          - "Your taste is so mid it's actually impressive. It's like you've never had an original thought in your life."
          - "You think a movie is 'experimental' if it has one dream sequence."
          - "The color grading in your life is as washed out as your opinions."
          - "You definitely argue about frame rates in YouTube comments."
          - "Your Top 4 is just the 'Criterion Channel' landing page."
          - "You think 'slow cinema' is a personality trait, but you definitely scrolled TikTok during the 10-minute tracking shot."
          
          Create a fake diagnostic title in a slug format (e.g., 'a24-pilled-sigma-male-final-boss'). 
          Insult their Top 4 specifically and call out any "mid" ratings in their recent activity.
          Keep it under 150 words. Be mean, sarcastic, and funny. 
          Format your response in JSON with three keys: diagnosisTitle, top4Roast, and overallVibe.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              diagnosisTitle: { type: Type.STRING },
              top4Roast: { type: Type.STRING },
              overallVibe: { type: Type.STRING },
            },
            required: ["diagnosisTitle", "top4Roast", "overallVibe"],
          },
        },
      });

      const roastJson = JSON.parse(response.text || "{}");
      setRoast(roastJson);

      // Random Kino Stats
      setKinoStats({
        pretension: Math.floor(Math.random() * 40) + 60,
        recencyBias: Math.floor(Math.random() * 50) + 50,
        filmBroEnergy: Math.floor(Math.random() * 100),
      });

    } catch (err: any) {
      setError(err.message || "Something went wrong. Letterboxd might be blocking us.");
    } finally {
      setLoading(false);
    }
  };

  const shareToX = () => {
    if (!roast) return;
    const text = `My Letterboxd taste is officially "${roast.diagnosisTitle}". Roast yours at ${window.location.origin}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  const downloadShareImage = async () => {
    if (!shareCardRef.current) return;
    try {
      const dataUrl = await toPng(shareCardRef.current, { cacheBust: true });
      const link = document.createElement("a");
      link.download = `letterboxd-roast-${username}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download image:", err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      {/* Hidden Share Card for Capture */}
      <div className="fixed left-[-9999px] top-0">
        <div 
          ref={shareCardRef}
          className="w-[1200px] h-[630px] bg-zinc-950 flex flex-col p-12 relative overflow-hidden text-white font-sans"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,224,84,0.1),transparent)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
          
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-4 mb-8">
                <div className="flex gap-1">
                  <div className="w-4 h-4 bg-lb-orange rounded-full" />
                  <div className="w-4 h-4 bg-lb-blue rounded-full" />
                  <div className="w-4 h-4 bg-lb-green rounded-full" />
                </div>
                <span className="text-sm font-bold tracking-[0.3em] text-lb-text uppercase">Letterboxd Roast</span>
              </div>
              
              <h2 className="text-7xl font-black text-lb-green tracking-tighter mb-4 uppercase">
                {roast?.diagnosisTitle}
              </h2>
              <p className="text-2xl text-zinc-400 font-mono italic max-w-3xl">
                "{roast?.overallVibe}"
              </p>
            </div>

            <div className="flex justify-between items-end">
              <div className="space-y-4">
                <div className="flex gap-4">
                  {scrapedData?.top4.slice(0, 4).map((film, i) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-lb-green">
                      {film}
                    </div>
                  ))}
                </div>
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">
                  @{username} • {scrapedData?.filmsLogged} Films Logged
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-600 uppercase tracking-[0.5em]">Generated by AIS Roast</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <header className="mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 mb-4"
        >
          <div className="w-8 h-8 bg-lb-orange rounded-full" />
          <div className="w-8 h-8 bg-lb-blue rounded-full" />
          <div className="w-8 h-8 bg-lb-green rounded-full" />
        </motion.div>
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tighter">
          HOW BAD IS YOUR <span className="text-lb-green">LETTERBOXD?</span>
        </h1>
        <p className="text-lb-text max-w-md mx-auto text-sm md:text-base italic">
          "Our AI will judge your pretentious taste so you don't have to."
        </p>
      </header>

      <main className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {!loading && !roast && (
            <motion.div
              key="input"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900/50 p-8 rounded-xl border border-zinc-800 shadow-2xl"
            >
              <form onSubmit={handleRoast} className="space-y-6">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-lb-text mb-2 font-bold">
                    Letterboxd Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. bratty_cinephile"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-4 text-white focus:outline-none focus:border-lb-green transition-colors font-mono"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-lb-green text-lb-bg font-bold py-4 rounded-lg hover:bg-opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Film size={20} />
                  ROAST ME
                </button>
              </form>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 bg-red-900/20 border border-red-900/50 rounded-lg flex items-start gap-3 text-red-400 text-sm"
                >
                  <AlertCircle className="shrink-0 mt-0.5" size={18} />
                  <div className="space-y-1">
                    <p className="font-bold uppercase tracking-widest text-[10px]">Error Detected</p>
                    <p className="leading-relaxed">{error}</p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <div className="relative inline-block mb-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 border-4 border-lb-green/20 border-t-lb-green rounded-full"
                />
                <Ghost className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-lb-green" size={24} />
              </div>
              <p className="text-xl font-bold text-lb-green animate-pulse">
                {LOADING_MESSAGES[loadingMsgIndex]}
              </p>
            </motion.div>
          )}

          {roast && scrapedData && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-zinc-900/50 p-8 rounded-xl border border-zinc-800 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-lb-green" />
                
                <div className="mb-8">
                  <span className="text-xs uppercase tracking-widest text-lb-text font-bold">Diagnosis</span>
                  <h2 className="text-3xl md:text-5xl font-bold text-lb-green leading-none mt-2 break-words">
                    {roast.diagnosisTitle}
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lb-text text-xs uppercase font-bold tracking-widest">
                      <Terminal size={14} />
                      The Roast
                    </div>
                    <div className="bg-zinc-950 p-4 rounded border border-zinc-800 font-mono text-sm leading-relaxed text-zinc-300">
                      {roast.top4Roast}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lb-text text-xs uppercase font-bold tracking-widest">
                      <Ghost size={14} />
                      Overall Vibe
                    </div>
                    <div className="bg-zinc-950 p-4 rounded border border-zinc-800 font-mono text-sm leading-relaxed text-zinc-300">
                      {roast.overallVibe}
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-8 mb-8">
                  <h3 className="text-xs uppercase tracking-widest text-lb-text font-bold mb-6 flex items-center gap-2">
                    <Film size={14} />
                    Recent Activity
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {scrapedData.recent.map((film, i) => (
                      <div key={i} className="flex justify-between items-center bg-zinc-950/50 p-3 rounded border border-zinc-800/50">
                        <span className="text-sm font-medium text-zinc-300 truncate mr-4">{film.title}</span>
                        <span className="text-lb-orange font-mono text-xs whitespace-nowrap">{film.rating}</span>
                      </div>
                    ))}
                    {scrapedData.recent.length === 0 && (
                      <p className="text-zinc-500 text-xs italic col-span-full">No recent activity found.</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-8">
                  <h3 className="text-xs uppercase tracking-widest text-lb-text font-bold mb-6">Kino Stats</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <StatBar label="Pretension" value={kinoStats.pretension} color="bg-lb-blue" />
                    <StatBar label="Recency Bias" value={kinoStats.recencyBias} color="bg-lb-orange" />
                    <StatBar label="Film Bro Energy" value={kinoStats.filmBroEnergy} color="bg-lb-green" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={shareToX}
                  className="flex-1 bg-white text-black font-bold py-4 rounded-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                >
                  <Share2 size={20} />
                  SHARE TO X
                </button>
                <button
                  onClick={downloadShareImage}
                  className="flex-1 bg-lb-blue text-white font-bold py-4 rounded-lg hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  DOWNLOAD CARD
                </button>
                <button
                  onClick={() => {
                    setRoast(null);
                    setScrapedData(null);
                    setUsername("");
                  }}
                  className="flex-1 bg-zinc-800 text-white font-bold py-4 rounded-lg hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={20} />
                  ROAST ANOTHER
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-20 text-lb-text/40 text-[10px] uppercase tracking-[0.2em] text-center">
        Not affiliated with Letterboxd. We just like making fun of you.
      </footer>
    </div>
  );
}
