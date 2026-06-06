const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const { Parser } = require("json2csv");
const authRoutes = require("./routes/auth");
const { auth, authorize, requirePermission } = require("./middleware/auth");
const usersRoutes = require("./routes/users");

require("dotenv").config();

const connectDB = require("./config/database");
const Lead = require("./models/Lead");

connectDB();

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin || "*";

  res.header("Access-Control-Allow-Origin", origin);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

const corsOptions = {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);

const PORT = process.env.PORT || 7002;
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const scrapeJobs = new Map();

function createScrapeJob(query, limit) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const job = {
    id,
    query,
    limit,
    status: "queued",
    progress: 0,
    message: "Queued",
    results: [],
    skippedDuplicates: 0,
    error: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  scrapeJobs.set(id, job);
  return job;
}

function updateScrapeJob(id, changes) {
  const job = scrapeJobs.get(id);
  if (!job) return;

  Object.assign(job, changes, { updatedAt: new Date() });
}

function startScrapeJobAfterResponse(res, jobId) {
  res.once("finish", () => {
    setTimeout(() => {
      runScrapeJob(jobId).catch((error) => {
        console.error("\n=== SCRAPE JOB ERROR ===\n", error.message, "\n", error.stack);
        updateScrapeJob(jobId, {
          status: "failed",
          progress: 100,
          message: "Scraping failed",
          error: error.message,
        });
      });
    }, 5000);
  });
}

setInterval(() => {
  const maxAgeMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const [id, job] of scrapeJobs.entries()) {
    if (now - new Date(job.updatedAt).getTime() > maxAgeMs) {
      scrapeJobs.delete(id);
    }
  }
}, 60 * 60 * 1000).unref();

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Location Leads backend is running",
  });
});

app.get(["/test", "/api/test"], (req, res) => res.json({
  status: "OK",
  message: "Backend route reached",
  timestamp: new Date().toISOString(),
}));

app.get(
  "/leads",
  auth,
  authorize("admin", "sales", "marketing"),
  requirePermission("canViewLeads"),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const skip = (page - 1) * limit;

      const [leads, total] = await Promise.all([
        Lead.find().sort({ lastScrapedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
        Lead.countDocuments(),
      ]);

      res.json({
        leads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("Fetch leads error:", err.message);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  }
);

function generateDedupeKey(lead) {
  if (lead.website?.trim()) {
    return `website:${lead.website.trim().toLowerCase()}`;
  }

  if (lead.phone?.trim()) {
    return `phone:${lead.phone.replace(/\D/g, "")}`;
  }

  return `name-address:${`${lead.name || ""}|${lead.address || ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()}`;
}

app.post(
  "/scrape",
  auth,
  authorize("admin", "sales", "marketing"),
  requirePermission("canScrape"),
  startScrapeHandler
);

app.post(
  "/api/scrape",
  auth,
  authorize("admin", "sales", "marketing"),
  requirePermission("canScrape"),
  startScrapeHandler
);

app.post(
  "/scrape/start",
  auth,
  authorize("admin", "sales", "marketing"),
  requirePermission("canScrape"),
  startScrapeHandler
);

app.post(
  "/api/scrape/start",
  auth,
  authorize("admin", "sales", "marketing"),
  requirePermission("canScrape"),
  startScrapeHandler
);

app.post(
  "/api/scrape/debug",
  auth,
  authorize("admin", "sales", "marketing"),
  requirePermission("canScrape"),
  (req, res) => {
    res.status(200).json({
      status: "OK",
      message: "Authenticated scrape route reached",
      query: req.body?.query || "",
      limit: parseInt(req.body?.limit, 10) || 10,
      timestamp: new Date().toISOString(),
    });
  }
);

function startScrapeHandler(req, res) {
    const { query } = req.body;
    const limit = parseInt(req.body.limit, 10) || 10;

    if (!query) {
      return res.status(400).json({ message: "Query is required" });
    }

    const job = createScrapeJob(query, limit);
    const responseBody = JSON.stringify({
      jobId: job.id,
      status: job.status,
      message: "Scrape started",
    });

    startScrapeJobAfterResponse(res, job.id);

    res.status(202);
    res.set({
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(responseBody),
      "Connection": "close",
    });
    res.end(responseBody);
}

app.get(
  "/scrape/:jobId",
  auth,
  authorize("admin", "sales", "marketing"),
  requirePermission("canScrape"),
  (req, res) => {
    const job = scrapeJobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ message: "Scrape job not found" });
    }

    res.json(job);
  }
);

app.get(
  "/api/scrape/:jobId",
  auth,
  authorize("admin", "sales", "marketing"),
  requirePermission("canScrape"),
  (req, res) => {
    const job = scrapeJobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ message: "Scrape job not found" });
    }

    res.json(job);
  }
);

async function runScrapeJob(jobId) {
  const job = scrapeJobs.get(jobId);
  if (!job) return;

  const { query, limit } = job;
  let browser;

  console.log("\n=== SCRAPE JOB STARTED:", query, "limit:", limit, "job:", jobId, "===");
  updateScrapeJob(jobId, { status: "running", progress: 5, message: "Opening Google Maps" });

  try {
    const executablePath = await puppeteer.executablePath();

    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      protocolTimeout: FIVE_HOURS_MS,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1920,1080",
        "--lang=en-US,en",
      ],
      defaultViewport: null,
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(FIVE_HOURS_MS);
    page.setDefaultNavigationTimeout(FIVE_HOURS_MS);

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

    console.log("Navigating to:", mapsUrl);

    await page.goto(mapsUrl, {
      waitUntil: "domcontentloaded",
      timeout: FIVE_HOURS_MS,
    });

    await new Promise((r) => setTimeout(r, 4000));

    try {
      for (const sel of [
        "#L2AGLb",
        'button[aria-label*="Accept"]',
        "form:nth-child(2) button",
      ]) {
        const btn = await page.$(sel);

        if (btn) {
          await btn.click();
          await new Promise((r) => setTimeout(r, 2000));
          break;
        }
      }
    } catch (_) { }

    await page.screenshot({ path: "debug-screenshot.png" });

    console.log("Current URL:", page.url());

    let isFeed = false;

    try {
      updateScrapeJob(jobId, { progress: 15, message: "Waiting for Google Maps results" });
      await page.waitForSelector('div[role="feed"]', { timeout: FIVE_HOURS_MS });
      isFeed = true;
      console.log("Feed found ✓");
    } catch (_) {
      console.log("No feed — checking single result...");
    }

    if (!isFeed) {
      const hasSingleResult = await page.$("h1");

      if (hasSingleResult) {
        const data = await scrapePlacePage(page);

        if (data.name) {
          const dedupeKey = generateDedupeKey(data);
          const existingLead = await Lead.exists({ dedupeKey });

          if (existingLead) {
            updateScrapeJob(jobId, {
              status: "completed",
              progress: 100,
              message: "Duplicate skipped",
              results: [],
              skippedDuplicates: 1,
            });
            return;
          }

          const savedLead = await Lead.create({
            query,
            name: data.name || "",
            rating: data.rating || "",
            reviews: data.reviews || "",
            category: data.category || "",
            address: data.address || "",
            phone: data.phone || "",
            email: data.email || "",
            website: data.website || "",
            dedupeKey,
            lastScrapedAt: new Date(),
          });

          updateScrapeJob(jobId, {
            status: "completed",
            progress: 100,
            message: "Scrape completed",
            results: [savedLead],
            skippedDuplicates: 0,
          });
          return;
        }

        updateScrapeJob(jobId, {
          status: "completed",
          progress: 100,
          message: "No results found",
          results: [],
          skippedDuplicates: 0,
        });
        return;
      }

      const pageText = await page.evaluate(() => document.body.innerText.slice(0, 300));
      console.log("Page preview:", pageText);
      throw new Error("Could not find results. Check debug-screenshot.png");
    }

    await new Promise((r) => setTimeout(r, 2000));

    const scrollableDiv = await page.$('div[role="feed"]');

    if (scrollableDiv) {
      let lastCount = 0;
      let sameCount = 0;
      const maxScrolls = limit >= 30 ? 60 : 40;

      for (let i = 0; i < maxScrolls; i++) {
        await page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) {
            feed.scrollBy({ top: 3000, behavior: "instant" });
          }
        });
        await new Promise((r) => setTimeout(r, 2500));

        const currentCount = await page.$$eval(
          'a[href*="/place/"]',
          (els) => [...new Set(els.map((el) => el.href))].length
        );

        const endReached = await page.evaluate(() =>
          document.body.innerText.includes("You've reached the end of the list")
        );

        console.log(`Scroll ${i + 1}: ${currentCount} place links found`);
        updateScrapeJob(jobId, {
          progress: Math.min(45, 15 + Math.round((currentCount / limit) * 30)),
          message: `Finding result links (${Math.min(currentCount, limit)}/${limit})`,
        });

        if (currentCount >= limit) break;

        if (endReached) {
          console.log("Google Maps says end of list reached.");
          break;
        }

        if (currentCount === lastCount) {
          sameCount++;
        } else {
          sameCount = 0;
          lastCount = currentCount;
        }

        if (sameCount >= 12) {
          console.log("No new results after many scrolls. Stopping.");
          break;
        }
      }
    }

    const links = await page.$$eval('a[href*="/place/"]', (els) => [
      ...new Set(els.map((el) => el.href)),
    ]);

    console.log(`Found ${links.length} place links`);

    const results = [];
    const selectedLinks = links.slice(0, limit);

    for (const [index, link] of selectedLinks.entries()) {
      try {
        updateScrapeJob(jobId, {
          progress: Math.min(90, 45 + Math.round((index / Math.max(selectedLinks.length, 1)) * 45)),
          message: `Scraping lead ${index + 1}/${selectedLinks.length}`,
        });

        await page.goto(link, {
          waitUntil: "domcontentloaded",
          timeout: FIVE_HOURS_MS,
        });

        await new Promise((r) => setTimeout(r, 3000));

        const data = await scrapePlacePage(page);

        if (data.name) {
          results.push(data);
          console.log("✓ Scraped:", data.name);
        }
      } catch (err) {
        console.log("  ✗ Error:", err.message);
      }
    }

    updateScrapeJob(jobId, { progress: 92, message: "Saving leads" });

    let savedResults = [];
    let skippedDuplicates = 0;

    if (results.length > 0) {
      const leadsWithKeys = results.map((lead) => ({
        ...lead,
        dedupeKey: generateDedupeKey(lead),
      }));

      const existingKeys = new Set(
        (
          await Lead.find(
            { dedupeKey: { $in: leadsWithKeys.map((lead) => lead.dedupeKey) } },
            { dedupeKey: 1, _id: 0 }
          ).lean()
        ).map((lead) => lead.dedupeKey)
      );

      const seenNewKeys = new Set();
      const newLeads = leadsWithKeys.filter((lead) => {
        if (existingKeys.has(lead.dedupeKey) || seenNewKeys.has(lead.dedupeKey)) {
          return false;
        }

        seenNewKeys.add(lead.dedupeKey);
        return true;
      });

      skippedDuplicates = leadsWithKeys.length - newLeads.length;

      if (newLeads.length > 0) {
        const now = new Date();
        const documents = newLeads.map((lead) => ({
          query,
          name: lead.name || "",
          rating: lead.rating || "",
          reviews: lead.reviews || "",
          category: lead.category || "",
          address: lead.address || "",
          phone: lead.phone || "",
          email: lead.email || "",
          website: lead.website || "",
          dedupeKey: lead.dedupeKey,
          lastScrapedAt: now,
        }));

        await Lead.insertMany(documents, { ordered: false });

        savedResults = await Lead.find({
          dedupeKey: {
            $in: documents.map((lead) => lead.dedupeKey),
          },
        }).sort({ lastScrapedAt: -1, createdAt: -1 });
      }
    }

    console.log(
      `\n=== DONE: ${savedResults.length} new results returned, ${skippedDuplicates} duplicates skipped ===\n`
    );

    updateScrapeJob(jobId, {
      status: "completed",
      progress: 100,
      message: savedResults.length ? "Scrape completed" : "No new leads found",
      results: savedResults,
      skippedDuplicates,
    });
  } catch (error) {
    console.error("\n=== ERROR ===\n", error.message, "\n", error.stack);
    updateScrapeJob(jobId, {
      status: "failed",
      progress: 100,
      message: "Scraping failed",
      error: error.message,
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) { }
    }
  }
}

async function scrapePlacePage(page) {
  return page.evaluate(() => {
    const name = document.querySelector("h1")?.innerText?.trim() || "";
    const ratingLabel = Array.from(
      document.querySelectorAll('[aria-label*="star"], [aria-label*="Star"], [aria-label*="rating"], [aria-label*="Rating"]')
    )
      .map((el) => el.getAttribute("aria-label") || "")
      .find((label) => /(?:\d+(?:\.\d+)?)\s*(?:stars?|rating)/i.test(label));
    const rating = ratingLabel || "";
    const category = document.querySelector(".DkEaL")?.innerText?.trim() || "";

    let address = "";
    let phone = "";
    let website = "";
    let email = "";

    const addressEl = document.querySelector('[data-item-id="address"] .Io6YTe');
    if (addressEl) address = addressEl.innerText.trim();

    const phoneEl = document.querySelector('[data-item-id^="phone"] .Io6YTe');
    if (phoneEl) phone = phoneEl.innerText.trim();

    const websiteEl = document.querySelector('[data-item-id="authority"] .Io6YTe');
    if (websiteEl) website = websiteEl.innerText.trim();

    const bodyText = document.body.innerText;

    const emailMatch = bodyText.match(
      /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
    );

    if (emailMatch) email = emailMatch[0];

    const mailtoLink = document.querySelector('a[href^="mailto:"]');

    if (mailtoLink) {
      email = mailtoLink.href.replace("mailto:", "").split("?")[0];
    }

    if (!address || !phone || !website) {
      Array.from(document.querySelectorAll("button")).forEach((btn) => {
        const text = btn.innerText?.trim() || "";

        if (
          !address &&
          (text.includes("India") ||
            text.includes("Rajasthan") ||
            /\d{6}/.test(text))
        ) {
          address = text;
        }

        if (!phone && /(\+91|0)?[6-9]\d{9}/.test(text)) {
          phone = text.match(/(\+91[\s-]?)?[6-9]\d{9}/)?.[0] || text;
        }

        if (
          !website &&
          (text.includes(".com") ||
            text.includes(".in") ||
            text.includes(".org"))
        ) {
          website = text;
        }
      });
    }

    const reviewsEl = document.querySelector('span[aria-label*="review"]');
    const reviews = reviewsEl?.getAttribute("aria-label") || "";

    return {
      name,
      rating,
      reviews,
      category,
      address,
      phone,
      email,
      website,
    };
  });
}

app.post(
  "/download-csv",
  auth,
  authorize("admin", "sales", "marketing"),
  requirePermission("canExportCsv"),
  (req, res) => {
    const { results } = req.body;

    try {
      const fields = [
        "name",
        "rating",
        "reviews",
        "category",
        "address",
        "phone",
        "email",
        "website",
      ];

      const json2csv = new Parser({ fields });
      const csv = json2csv.parse(results);

      res.header("Content-Type", "text/csv");
      res.attachment("companies.csv");
      res.send(csv);
    } catch (err) {
      res.status(500).json({ message: "CSV generation failed" });
    }
  }
);

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.requestTimeout = FIVE_HOURS_MS;
server.headersTimeout = FIVE_HOURS_MS + 1000;
