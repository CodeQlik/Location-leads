const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const { Parser } = require("json2csv");
const authRoutes = require("./routes/auth");
const { auth, authorize, requirePermission } = require("./middleware/auth");
const usersRoutes = require("./routes/users");
const areasRoutes = require("./routes/areas");

require("dotenv").config();

const { Country: CSC_Country, State: CSC_State, City: CSC_City } = require("country-state-city");

const connectDB = require("./config/database");
const Lead = require("./models/Lead");
const City = require("./models/City");
const State = require("./models/State");

const User = require("./models/User");

// One-time database migration for legacy leads
async function migrateLegacyLeads() {
  try {
    const adminUser = await User.findOne({ role: "admin", department: "admin" });
    if (!adminUser) return;

    const legacyCount = await Lead.countDocuments({ userId: { $exists: false } });
    if (legacyCount > 0) {
      console.log(`[Migration] Found ${legacyCount} legacy leads without userId. Migrating to admin: ${adminUser.email}`);

      // Update userId
      await Lead.updateMany({ userId: { $exists: false } }, { $set: { userId: adminUser._id } });

      // Find leads that don't have user ID prefixed in their dedupeKey
      const legacyLeadsToPrefix = await Lead.find({
        userId: adminUser._id,
        dedupeKey: { $not: new RegExp(`^${adminUser._id}_`) }
      });

      console.log(`[Migration] Prefixing dedupeKey for ${legacyLeadsToPrefix.length} legacy leads`);

      const bulkOps = legacyLeadsToPrefix.map(lead => ({
        updateOne: {
          filter: { _id: lead._id },
          update: { $set: { dedupeKey: `${adminUser._id}_${lead.dedupeKey}` } }
        }
      }));

      if (bulkOps.length > 0) {
        await Lead.bulkWrite(bulkOps);
      }

      console.log(`[Migration] Successfully migrated all legacy leads!`);
    }
  } catch (err) {
    console.error("[Migration Error]", err);
  }
}

connectDB().then(() => {
  migrateLegacyLeads();
});
const http = require("http");
const { Server } = require("socket.io");

connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("A client connected via socket.io:", socket.id);
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

app.set("etag", false);

app.use((req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.url}`);
  const origin = req.headers.origin || "*";

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] ||
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

const corsOptions = {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  credentials: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

const locationsRoutes = require("./routes/locations");

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/areas", areasRoutes);
app.use("/locations", locationsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/locations", locationsRoutes);

const PORT = process.env.PORT || 7002;
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const scrapeJobs = new Map();

function createScrapeJob(query, limit, userId) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const job = {
    id,
    query,
    limit,
    userId,
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

  // Emit real-time update to all connected clients
  io.emit(`scrape_update_${id}`, job);
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

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLeadsQuery(queryParams, reqUser) {
  const and = [];

  const isAdmin = reqUser?.role === "admin" && reqUser?.department === "admin";
  if (!isAdmin) {
    and.push({ userId: reqUser?._id });
  } else if (queryParams.userId) {
    and.push({ userId: queryParams.userId });
  }

  const search = String(queryParams.search || "").trim();
  const category = String(queryParams.category || "").trim();
  const city = String(queryParams.city || "").trim();
  const minRating = String(queryParams.minRating || "").trim();
  const hasPhone = String(queryParams.hasPhone || "").toLowerCase() === "true";
  const hasEmail = String(queryParams.hasEmail || "").toLowerCase() === "true";
  const hasWebsite = String(queryParams.hasWebsite || "").toLowerCase() === "true";

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");

    and.push({
      $or: [
        { name: regex },
        { category: regex },
        { address: regex },
        { phone: regex },
        { email: regex },
        { website: regex },
        { rating: regex },
        { reviews: regex },
        { query: regex },
      ],
    });
  }

  if (category) {
    and.push({ category: new RegExp(escapeRegex(category), "i") });
  }

  if (city) {
    and.push({ address: new RegExp(escapeRegex(city), "i") });
  }

  if (minRating) {
    let ratingRegex = null;

    if (minRating === "3") {
      ratingRegex = /^([3-5](\.\d+)?)/;
    } else if (minRating === "4") {
      ratingRegex = /^([4-5](\.\d+)?)/;
    } else if (minRating === "4.5") {
      ratingRegex = /^(4\.[5-9]|5(\.0)?)/;
    }

    if (ratingRegex) {
      and.push({ rating: ratingRegex });
    }
  }

  if (hasPhone) {
    and.push({ phone: { $exists: true, $nin: [null, ""] } });
  }

  if (hasEmail) {
    and.push({ email: { $exists: true, $nin: [null, ""] } });
  }

  if (hasWebsite) {
    and.push({ website: { $exists: true, $nin: [null, ""] } });
  }

  if (queryParams.dateFrom || queryParams.dateTo) {
    const effectiveDate = { $ifNull: ["$lastScrapedAt", "$createdAt"] };
    const dateConditions = [];

    if (queryParams.dateFrom) {
      const fromDate = new Date(queryParams.dateFrom);

      if (Number.isNaN(fromDate.getTime())) {
        const error = new Error("Invalid dateFrom");
        error.statusCode = 400;
        throw error;
      }

      dateConditions.push({ $gte: [effectiveDate, fromDate] });
    }

    if (queryParams.dateTo) {
      const toDate = new Date(queryParams.dateTo);

      if (Number.isNaN(toDate.getTime())) {
        const error = new Error("Invalid dateTo");
        error.statusCode = 400;
        throw error;
      }

      dateConditions.push({ $lte: [effectiveDate, toDate] });
    }

    if (dateConditions.length === 1) {
      and.push({ $expr: dateConditions[0] });
    } else if (dateConditions.length > 1) {
      and.push({ $expr: { $and: dateConditions } });
    }
  }

  return and.length ? { $and: and } : {};
}

app.get(
  ["/leads", "/api/leads"],
  auth,
  authorize("admin", "sales", "marketing"),
  requirePermission("canViewLeads"),
  async (req, res) => {
    try {
      res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Surrogate-Control": "no-store",
      });

      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const requestedLimit = parseInt(req.query.limit, 10) || 50;
      const limit = Math.min(Math.max(requestedLimit, 1), 500);
      const skip = (page - 1) * limit;

      // Important: build MongoDB query from filters first.
      // Pagination is applied only after MongoDB has matched filtered leads.
      const query = buildLeadsQuery(req.query, req.user);

      console.log("LEADS DB QUERY:", {
        page,
        limit,
        filters: {
          search: req.query.search || "",
          category: req.query.category || "",
          city: req.query.city || "",
          minRating: req.query.minRating || "",
          dateFrom: req.query.dateFrom || "",
          dateTo: req.query.dateTo || "",
          hasPhone: req.query.hasPhone || "",
          hasEmail: req.query.hasEmail || "",
          hasWebsite: req.query.hasWebsite || "",
        },
        query: JSON.stringify(query),
      });

      const [leads, total] = await Promise.all([
        Lead.find(query)
          .sort({ lastScrapedAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        Lead.countDocuments(query),
      ]);

      res.status(200).json({
        leads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      });
    } catch (err) {
      console.error("Fetch leads error:", err.message);
      res.status(err.statusCode || 500).json({ message: err.message || "Failed to fetch leads" });
    }
  }
);

app.get(
  ["/leads/export", "/api/leads/export"],
  auth,
  authorize("admin", "sales", "marketing"),
  requirePermission("canExportCsv"),
  async (req, res) => {
    try {
      res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Surrogate-Control": "no-store",
      });

      const query = buildLeadsQuery(req.query, req.user);

      console.log("LEADS EXPORT DB QUERY:", {
        filters: {
          search: req.query.search || "",
          category: req.query.category || "",
          city: req.query.city || "",
          minRating: req.query.minRating || "",
          dateFrom: req.query.dateFrom || "",
          dateTo: req.query.dateTo || "",
          hasPhone: req.query.hasPhone || "",
          hasEmail: req.query.hasEmail || "",
          hasWebsite: req.query.hasWebsite || "",
        },
        query: JSON.stringify(query),
      });

      const leads = await Lead.find(query)
        .sort({ lastScrapedAt: -1, createdAt: -1 })
        .lean();

      const fields = [
        { label: "Business", value: "name" },
        { label: "Search Query", value: "query" },
        { label: "Rating", value: "rating" },
        { label: "Reviews", value: "reviews" },
        { label: "Category", value: "category" },
        { label: "Address", value: "address" },
        { label: "Phone", value: "phone" },
        { label: "Email", value: "email" },
        { label: "Website", value: "website" },
        {
          label: "Scraped Date",
          value: (row) => {
            const dateValue = row.lastScrapedAt || row.createdAt;
            return dateValue ? new Date(dateValue).toLocaleString("en-IN") : "";
          },
        },
      ];

      const json2csv = new Parser({ fields });
      const csv = json2csv.parse(leads);
      const today = new Date().toISOString().slice(0, 10);

      res.header("Content-Type", "text/csv; charset=utf-8");
      res.attachment(`filtered-leads-${today}.csv`);
      res.send(`\uFEFF${csv}`);
    } catch (err) {
      console.error("Export leads error:", err.message);
      res.status(err.statusCode || 500).json({ message: err.message || "Failed to export leads" });
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

  const job = createScrapeJob(query, limit, req.user?._id);
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

  const { query, limit, userId } = job;
  let browser;

  console.log("\n=== SCRAPE JOB STARTED:", query, "limit:", limit, "job:", jobId, "===");
  updateScrapeJob(jobId, { status: "running", progress: 5, message: "Opening Google Maps" });

  try {
    // Helper to resolve state queries into multi-city queries
    async function getQueriesForSearch(origQuery) {
      const parts = origQuery.split(" in ");
      if (parts.length < 2) return [origQuery];

      const keyword = parts[0].trim();
      const locationPart = parts[1].trim();
      const locationParts = locationPart.split(",").map(p => p.trim());

      if (locationParts.length === 2) {
        const stateName = locationParts[0];
        const countryName = locationParts[1];

        // 1. Try curated database first (specifically for India)
        if (countryName.toLowerCase() === "india") {
          try {
            const stateDoc = await State.findOne({ name: new RegExp(`^${stateName}$`, "i") });
            if (stateDoc) {
              const cities = await City.find({ state: stateDoc._id }).limit(10);
              if (cities && cities.length > 0) {
                console.log(`[Auto-State Multiplexing] Resolved ${cities.length} cities from DB for state ${stateName}.`);
                return cities.map(city => `${keyword} in ${city.name}, ${stateName}, India`);
              }
            }
          } catch (dbErr) {
            console.error("[Auto-State Multiplexing] DB query error:", dbErr.message);
          }
        }

        // 2. Fallback to country-state-city library for global coverage (USA, Canada, etc.)
        try {
          const allCountries = CSC_Country.getAllCountries();
          const countryObj = allCountries.find(c =>
            c.name.toLowerCase() === countryName.toLowerCase() ||
            c.isoCode.toLowerCase() === countryName.toLowerCase()
          );

          if (countryObj) {
            const countryStates = CSC_State.getStatesOfCountry(countryObj.isoCode);
            const stateObj = countryStates.find(s =>
              s.name.toLowerCase() === stateName.toLowerCase() ||
              s.isoCode.toLowerCase() === stateName.toLowerCase()
            );

            if (stateObj) {
              const allCities = CSC_City.getCitiesOfState(countryObj.isoCode, stateObj.isoCode);
              if (allCities && allCities.length > 0) {
                // Select 12 cities spread evenly across the list to get a diverse distribution
                let selectedCities = [];
                if (allCities.length <= 12) {
                  selectedCities = allCities;
                } else {
                  const step = Math.floor(allCities.length / 12);
                  for (let i = 0; i < 12; i++) {
                    const idx = Math.min(i * step, allCities.length - 1);
                    selectedCities.push(allCities[idx]);
                  }
                }

                console.log(`[Auto-State Multiplexing] Resolved ${selectedCities.length} cities from CSC library for state ${stateName}, ${countryName}.`);
                return selectedCities.map(city => `${keyword} in ${city.name}, ${stateName}, ${countryObj.name}`);
              }
            }
          }
        } catch (cscErr) {
          console.error("[Auto-State Multiplexing] CSC library lookup error:", cscErr.message);
        }
      }
      return [origQuery];
    }

    const queriesToScrape = await getQueriesForSearch(query);
    const totalQueries = queriesToScrape.length;

    browser = await puppeteer.launch({
      headless: true,
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

    async function configurePage(p, timeoutMs = 30000) {
      await p.setRequestInterception(true);
      p.on('request', (req) => {
        try {
          const resourceType = req.resourceType();
          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            req.abort().catch(() => { });
          } else {
            req.continue().catch(() => { });
          }
        } catch (_) { }
      });
      p.setDefaultTimeout(timeoutMs);
      p.setDefaultNavigationTimeout(timeoutMs);
      await p.setViewport({ width: 1920, height: 1080 });
      await p.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
      await p.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
    }

    const allScrapedResults = [];
    const processedDedupeKeys = new Set();

    for (let qIndex = 0; qIndex < totalQueries; qIndex++) {
      const currentQuery = queriesToScrape[qIndex];
      const parsedParts = currentQuery.split(" in ");
      const locationLabel = parsedParts[1] ? parsedParts[1].split(",")[0].trim() : "target";

      const queryProgressBase = (qIndex / totalQueries) * 100;
      const queryProgressWeight = 100 / totalQueries;

      console.log(`\n--- Scraping Query ${qIndex + 1}/${totalQueries}: "${currentQuery}" ---`);
      updateScrapeJob(jobId, {
        progress: Math.min(95, Math.round(queryProgressBase + 5)),
        message: `Scraping ${locationLabel} (${qIndex + 1}/${totalQueries}) - Connecting...`,
      });

      const page = await browser.newPage();
      await configurePage(page, 180000); // 3 minutes timeout for the main search page operations

      const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(currentQuery)}`;
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

      let isFeed = false;
      try {
        await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
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
            if (data.website && !data.email) {
              try {
                data.email = await extractEmailFromWebsite(browser, data.website);
              } catch (emailErr) {
                console.log(`  ✗ Email extraction failed for ${data.website}:`, emailErr.message);
              }
            }
            const dedupeKey = generateDedupeKey(data);
            if (!processedDedupeKeys.has(dedupeKey)) {
              processedDedupeKeys.add(dedupeKey);
              allScrapedResults.push(data);
            }
          }
        }
        await page.close().catch(() => { });
        continue;
      }

      await new Promise((r) => setTimeout(r, 2000));
      const scrollableDiv = await page.$('div[role="feed"]');

      if (scrollableDiv) {
        let lastCount = 0;
        let sameCount = 0;
        // Limit query items dynamically
        const queryLimit = totalQueries > 1 ? Math.ceil(limit / 5) : limit;
        const maxScrolls = queryLimit >= 100 ? 80 : 30;

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
            progress: Math.min(95, Math.round(queryProgressBase + (currentCount / queryLimit) * queryProgressWeight * 0.4)),
            message: `Scraping ${locationLabel} (${qIndex + 1}/${totalQueries}) - Finding links (${Math.min(currentCount, queryLimit)}/${queryLimit})`,
          });

          if (currentCount >= queryLimit) break;
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

          if (sameCount >= 10) {
            console.log("No new results after many scrolls. Stopping.");
            break;
          }
        }
      }

      const links = await page.$$eval('a[href*="/place/"]', (els) => [
        ...new Set(els.map((el) => el.href)),
      ]);

      const queryLimit = totalQueries > 1 ? Math.ceil(limit / 5) : limit;
      const selectedLinks = links.slice(0, queryLimit);
      console.log(`Found ${selectedLinks.length} place links for ${locationLabel}`);

      const CONCURRENCY_LIMIT = 4;
      for (let i = 0; i < selectedLinks.length; i += CONCURRENCY_LIMIT) {
        const chunk = selectedLinks.slice(i, i + CONCURRENCY_LIMIT);

        updateScrapeJob(jobId, {
          progress: Math.min(95, Math.round(queryProgressBase + queryProgressWeight * 0.4 + (i / Math.max(selectedLinks.length, 1)) * queryProgressWeight * 0.5)),
          message: `Scraping ${locationLabel} (${qIndex + 1}/${totalQueries}) - Details ${i + 1} to ${Math.min(i + CONCURRENCY_LIMIT, selectedLinks.length)} of ${selectedLinks.length}`,
        });

        const promises = chunk.map(async (link) => {
          let newPage = null;
          try {
            newPage = await browser.newPage();
            await configurePage(newPage, 30000);
            await newPage.goto(link, {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });
            await new Promise((r) => setTimeout(r, 1500));
            const data = await scrapePlacePage(newPage);
            if (data.name) {
              if (data.website && !data.email) {
                try {
                  data.email = await extractEmailFromWebsite(browser, data.website);
                } catch (emailErr) {
                  console.log(`  ✗ Email extraction failed for ${data.website}:`, emailErr.message);
                }
              }
              console.log("✓ Scraped:", data.name, data.email ? `(Email: ${data.email})` : "(No email)");
              return data;
            }
          } catch (err) {
            console.log("  ✗ Error:", err.message);
          } finally {
            if (newPage) await newPage.close().catch(() => { });
          }
          return null;
        });

        const chunkResults = await Promise.all(promises);
        for (const res of chunkResults) {
          if (res) {
            const dedupeKey = generateDedupeKey(res);
            if (!processedDedupeKeys.has(dedupeKey)) {
              processedDedupeKeys.add(dedupeKey);
              allScrapedResults.push(res);
            }
          }
        }
      }

      await page.close().catch(() => { });
    }

    // Save all leads to the database
    updateScrapeJob(jobId, { progress: 96, message: "Saving leads" });

    let savedResults = [];
    let skippedDuplicates = 0;

    if (allScrapedResults.length > 0) {
      const leadsWithKeys = allScrapedResults.map((lead) => {
        const baseKey = generateDedupeKey(lead);
        // Prefix unique dedupeKey with userId to scope duplicates per user
        const dedupeKey = userId ? `${userId}_${baseKey}` : baseKey;
        return {
          ...lead,
          dedupeKey,
        };
      });

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
          userId,
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

async function extractEmailFromWebsite(browser, websiteUrl) {
  if (!websiteUrl || typeof websiteUrl !== "string") return "";
  let url = websiteUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  console.log(`[Email Extractor] Attempting to scrape email from: ${url}`);
  let page = null;
  try {
    page = await browser.newPage();
    // Intercept requests to block images, styles, fonts, etc.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      try {
        const type = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
          req.abort().catch(() => { });
        } else {
          req.continue().catch(() => { });
        }
      } catch (_) { }
    });

    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(12000);

    // Go to website homepage
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });

    // Find emails on the homepage
    let emails = await page.evaluate(() => {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}/g;

      function searchEmailsInText(text) {
        const matches = text.match(emailRegex) || [];
        const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js', '.bmp', '.tiff'];
        const list = [];
        for (const match of matches) {
          const lower = match.toLowerCase();
          if (invalidExtensions.some(ext => lower.endsWith(ext))) continue;
          if (lower.includes('sentry.io') || lower.startsWith('npm@') || lower.startsWith('bootstrap@') || lower.includes('example.com') || lower.includes('yourdomain')) continue;
          if (!list.includes(match)) {
            list.push(match);
          }
        }
        return list;
      }

      // Check mailto links first
      const mailtoEmails = [];
      const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
      for (const link of mailtoLinks) {
        const email = link.href.replace(/^mailto:/i, "").split("?")[0].trim();
        if (email && email.includes('@') && !mailtoEmails.includes(email)) {
          const lower = email.toLowerCase();
          const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js'];
          if (!invalidExtensions.some(ext => lower.endsWith(ext))) {
            mailtoEmails.push(email);
          }
        }
      }
      if (mailtoEmails.length > 0) return mailtoEmails;

      // Check body text
      const bodyEmails = searchEmailsInText(document.body.innerText);
      if (bodyEmails.length > 0) return bodyEmails;

      // Check whole HTML
      return searchEmailsInText(document.documentElement.innerHTML);
    });

    if (emails && emails.length > 0) {
      console.log(`[Email Extractor] Found email: ${emails[0]} on homepage`);
      return emails[0];
    }

    // If no email found, try to locate a Contact or About page
    console.log(`[Email Extractor] No email on homepage of ${url}. Looking for Contact/About link...`);
    const contactUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const href = link.href || '';
        const text = (link.innerText || '').toLowerCase();
        if (
          href.includes('contact') ||
          href.includes('about') ||
          href.includes('reach') ||
          text.includes('contact') ||
          text.includes('about') ||
          text.includes('get in touch') ||
          text.includes('support')
        ) {
          return link.href;
        }
      }
      return null;
    });

    if (contactUrl && contactUrl !== url && /^https?:\/\//i.test(contactUrl)) {
      console.log(`[Email Extractor] Found contact link: ${contactUrl}. Navigating...`);
      await page.goto(contactUrl, { waitUntil: "domcontentloaded", timeout: 12000 });

      emails = await page.evaluate(() => {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}/g;

        function searchEmailsInText(text) {
          const matches = text.match(emailRegex) || [];
          const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js', '.bmp', '.tiff'];
          const list = [];
          for (const match of matches) {
            const lower = match.toLowerCase();
            if (invalidExtensions.some(ext => lower.endsWith(ext))) continue;
            if (lower.includes('sentry.io') || lower.startsWith('npm@') || lower.startsWith('bootstrap@') || lower.includes('example.com') || lower.includes('yourdomain')) continue;
            if (!list.includes(match)) {
              list.push(match);
            }
          }
          return list;
        }

        const mailtoEmails = [];
        const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
        for (const link of mailtoLinks) {
          const email = link.href.replace(/^mailto:/i, "").split("?")[0].trim();
          if (email && email.includes('@') && !mailtoEmails.includes(email)) {
            const lower = email.toLowerCase();
            const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js'];
            if (!invalidExtensions.some(ext => lower.endsWith(ext))) {
              mailtoEmails.push(email);
            }
          }
        }
        if (mailtoEmails.length > 0) return mailtoEmails;

        const bodyEmails = searchEmailsInText(document.body.innerText);
        if (bodyEmails.length > 0) return bodyEmails;

        return searchEmailsInText(document.documentElement.innerHTML);
      });

      if (emails && emails.length > 0) {
        console.log(`[Email Extractor] Found email: ${emails[0]} on contact page`);
        return emails[0];
      }
    }

  } catch (err) {
    console.log(`[Email Extractor] Error extracting email from ${url}: ${err.message}`);
  } finally {
    if (page) {
      await page.close().catch(() => { });
    }
  }

  return "";
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
    const category = document.querySelector(".DkEaL")?.innerText?.trim() ||
      document.querySelector('button[jsaction*="category"]')?.innerText?.trim() ||
      "";

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
  ["/download-csv", "/api/download-csv"],
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

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.requestTimeout = FIVE_HOURS_MS;
server.headersTimeout = FIVE_HOURS_MS + 1000;
