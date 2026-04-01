import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Scrape Letterboxd
  app.get("/api/scrape/:username", async (req, res) => {
    const { username: rawUsername } = req.params;
    if (!rawUsername) {
      return res.status(400).json({ error: "Username is required" });
    }
    const username = encodeURIComponent(rawUsername.trim().replace(/^@/, "").toLowerCase());

    let top4: string[] = [];
    let recent: { title: string; rating: string }[] = [];
    let filmsLogged = "0";

    const commonHeaders = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    };

    // 1. Try RSS for Recent Activity (Prioritized)
    try {
      const rssUrl = `https://letterboxd.com/${username}/rss/`;
      console.log(`Fetching RSS: ${rssUrl}`);
      const rssResponse = await axios.get(rssUrl, { 
        headers: commonHeaders,
        timeout: 5000 
      });
      const $rss = cheerio.load(rssResponse.data, { xmlMode: true });
      
      $rss("item").each((i, el) => {
        if (i >= 5) return;
        const fullTitle = $rss(el).find("title").text();
        const ratingMatch = fullTitle.match(/ - (★+½?|½)$/);
        const rating = ratingMatch ? ratingMatch[1] : "No rating";
        const title = fullTitle.replace(/ - (★+½?|½)$/, "");
        
        recent.push({ title, rating });
      });
    } catch (rssErr: any) {
      if (rssErr.response?.status === 404) {
        console.warn(`RSS not found for ${username} (might be private or non-existent)`);
      } else {
        console.error(`RSS Fetch failed for ${username}:`, rssErr.message);
      }
    }

    // Small delay to avoid rapid requests
    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. Try Profile Page for Top 4 and Stats
    try {
      const url = `https://letterboxd.com/${username}/`;
      const response = await axios.get(url, {
        headers: commonHeaders,
        timeout: 8000,
        validateStatus: (status) => status < 500, // Handle 404/403 manually
      });

      if (response.status === 404) {
        return res.status(404).json({ 
          error: "User not found", 
          message: `The Letterboxd user "${rawUsername}" does not exist. Please check the spelling.` 
        });
      }

      if (response.status === 403) {
        return res.status(403).json({ 
          error: "Access Denied", 
          message: "Letterboxd is currently blocking our automated request. Please try again in a few minutes, or ensure your profile isn't restricted by privacy settings." 
        });
      }

      const $ = cheerio.load(response.data);
      console.log(`Scraping profile for ${username}, status: ${response.status}`);

      // Check for "This profile is private" or "Page not found"
      const pageTitle = $("title").text().toLowerCase();
      const bodyText = $("body").text().toLowerCase();

      if (pageTitle.includes("not found")) {
        return res.status(404).json({ 
          error: "User not found", 
          message: `The Letterboxd user "${rawUsername}" does not exist.` 
        });
      }

      if (bodyText.includes("this profile is private") || pageTitle.includes("private")) {
        return res.status(403).json({ 
          error: "Private Profile", 
          message: "This Letterboxd profile is set to private. We can't roast what we can't see! Check your profile settings." 
        });
      }

      // Top 4 Favorite Films
      const favoriteSelectors = [
        ".section.favorite-films .poster-container img",
        ".favorite-films .poster img",
        ".favorite-films .film-poster img",
        "#favorite-films img",
        ".section.favorite-films img",
        ".poster-list.favorite-films img",
        "section#favorite-films img"
      ];

      for (const selector of favoriteSelectors) {
        if (top4.length > 0) break;
        $(selector).each((_, el) => {
          const title = $(el).attr("alt") || $(el).attr("title") || $(el).closest("a").attr("title") || $(el).attr("data-film-name") || $(el).closest(".poster").attr("data-film-name");
          if (title && !top4.includes(title)) {
            top4.push(title);
          }
        });
      }
      
      if (top4.length === 0) {
        $(".favorite-films .poster, .favorite-films .film-poster, .section.favorite-films .poster").each((_, el) => {
          const title = $(el).attr("data-film-name");
          if (title && !top4.includes(title)) {
            top4.push(title);
          }
        });
      }
      
      if (top4.length === 0) {
        $("section, .section").each((_, section) => {
          const headerText = $(section).find("h2, h3, .section-heading").text().toLowerCase();
          if (headerText.includes("favorite films")) {
            $(section).find("img").each((_, img) => {
              const title = $(img).attr("alt") || $(img).attr("title");
              if (title && !top4.includes(title)) {
                top4.push(title);
              }
            });
          }
        });
      }
      
      top4 = top4.slice(0, 4);
      console.log(`Found ${top4.length} favorite films for ${username}`);

      // Stats
      let rawFilmsLogged = $(".profile-stats .stat-link[href*='/films/'] .stat-count").text().trim() || 
                           $(".profile-stats a[href*='/films/'] .stat-count").text().trim() || 
                           $("a[href$='/films/'] .stat-count").first().text().trim() ||
                           $(".profile-navigation a[href*='/films/'] .count").text().trim() ||
                           $(".profile-stats .stat-count").first().text().trim() ||
                           "0";
      filmsLogged = rawFilmsLogged.replace(/,/g, "");
      console.log(`Films logged for ${username}: ${filmsLogged}`);

      // Fallback for Recent Activity if RSS failed
      if (recent.length === 0) {
        $(".section.recent-activity .poster-container").each((i, el) => {
          if (i >= 5) return;
          const title = $(el).find("img").attr("alt") || "Unknown";
          const rating = $(el).find(".rating").text().trim() || "No rating";
          recent.push({ title, rating });
        });
      }

      if (recent.length === 0 && top4.length === 0) {
        return res.status(404).json({ 
          error: "Incomplete Profile", 
          message: "We found the profile, but it seems to have no favorite films or recent activity to roast." 
        });
      }
    } catch (profileErr: any) {
      console.error("Profile Scrape failed:", profileErr.message);
      return res.status(500).json({ 
        error: "Scraping Error", 
        message: "Something went wrong while trying to read the Letterboxd page. Please try again in a few minutes." 
      });
    }

    if (recent.length === 0 && top4.length === 0) {
      return res.status(500).json({ 
        error: "Data Fetch Failure", 
        message: "Could not fetch any data from Letterboxd. They might be blocking us or the profile is private." 
      });
    }

    res.json({
      username,
      top4,
      recent,
      filmsLogged,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
