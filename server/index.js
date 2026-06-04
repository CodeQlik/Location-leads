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

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);

const PORT = process.env.PORT || 7002;

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Location Leads backend is running",
  });
});

app.get("/test", (req, res) => res.json({ status: "OK" }));

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
  async (req, res) => {
    const { query } = req.body;
    const limit = parseInt(req.body.limit, 10) || 10;

    console.log("\n=== SCRAPE REQUEST:", query, "limit:", limit, "===");

    if (!query) {
      return res.status(400).json({ message: "Query is required" });
    }

    let browser;

    try {
      const executablePath = await puppeteer.executablePath();

      browser = await puppeteer.launch({
        headless: true,
        executablePath,
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

      await page.setViewport({ width: 1920, height: 1080 });

      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
      });

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(
        query
      )}`;

      console.log("Navigating to:", mapsUrl);

      await page.goto(mapsUrl, {
        waitUntil: "domcontentloaded",
        timeout: 280000,
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
        await page.waitForSelector('div[role="feed"]', { timeout: 60000 });
        isFeed = true;
        console.log("Feed found ✓");
      } catch (_) {
        console.log("No feed — checking single result...");
      }

      if (!isFeed) {
        const hasSingleResult = await page.$("h1");

        if (hasSingleResult) {
          const data = await scrapePlacePage(page);

          await browser.close();
          browser = null;

          if (data.name) {
            const dedupeKey = generateDedupeKey(data);

            const savedLead = await Lead.findOneAndUpdate(
              { dedupeKey },
              {
                $set: {
                  query,
                  lastScrapedAt: new Date(),
                },
                $setOnInsert: {
                  name: data.name || "",
                  rating: data.rating || "",
                  reviews: data.reviews || "",
                  category: data.category || "",
                  address: data.address || "",
                  phone: data.phone || "",
                  email: data.email || "",
                  website: data.website || "",
                  dedupeKey,
                },
              },
              {
                upsert: true,
                new: true,
              }
            );

            return res.json({ results: [savedLead] });
          }

          return res.json({ results: [] });
        }

        const pageText = await page.evaluate(() =>
          document.body.innerText.slice(0, 300)
        );

        console.log("Page preview:", pageText);

        await browser.close();
        browser = null;

        return res.status(500).json({
          message: "Could not find results. Check debug-screenshot.png",
        });
      }

      await new Promise((r) => setTimeout(r, 2000));

      const scrollableDiv = await page.$('div[role="feed"]');

      if (scrollableDiv) {
        await scrollableDiv.click();

        let lastCount = 0;
        let sameCount = 0;
        const maxScrolls = limit >= 100 ? 100 : 40;

        for (let i = 0; i < maxScrolls; i++) {
          await page.mouse.wheel({ deltaY: 3000 });
          await new Promise((r) => setTimeout(r, 2500));

          const currentCount = await page.$$eval(
            'a[href*="/place/"]',
            (els) => [...new Set(els.map((el) => el.href))].length
          );

          const endReached = await page.evaluate(() =>
            document.body.innerText.includes("You've reached the end of the list")
          );

          console.log(`Scroll ${i + 1}: ${currentCount} place links found`);

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

      for (const link of links.slice(0, limit)) {
        try {
          await page.goto(link, {
            waitUntil: "domcontentloaded",
            timeout: 280000,
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

      let savedResults = [];

      if (results.length > 0) {
        const operations = results.map((lead) => {
          const dedupeKey = generateDedupeKey(lead);

          return {
            updateOne: {
              filter: { dedupeKey },
              update: {
                $set: {
                  query,
                  lastScrapedAt: new Date(),
                },
                $setOnInsert: {
                  name: lead.name || "",
                  rating: lead.rating || "",
                  reviews: lead.reviews || "",
                  category: lead.category || "",
                  address: lead.address || "",
                  phone: lead.phone || "",
                  email: lead.email || "",
                  website: lead.website || "",
                  dedupeKey,
                },
              },
              upsert: true,
            },
          };
        });

        await Lead.bulkWrite(operations, { ordered: false });

        savedResults = await Lead.find({
          dedupeKey: {
            $in: results.map((lead) => generateDedupeKey(lead)),
          },
        }).sort({ lastScrapedAt: -1, createdAt: -1 });
      }

      await browser.close();
      browser = null;

      console.log(`\n=== DONE: ${savedResults.length} results returned ===\n`);

      res.json({ results: savedResults });
    } catch (error) {
      console.error("\n=== ERROR ===\n", error.message, "\n", error.stack);

      if (browser) {
        try {
          await browser.close();
        } catch (_) { }
      }

      res.status(500).json({
        message: "Scraping failed: " + error.message,
      });
    }
  }
);

async function scrapePlacePage(page) {
  return page.evaluate(() => {
    const name = document.querySelector("h1")?.innerText?.trim() || "";
    const ratingEl = document.querySelector('div[role="img"][aria-label]');
    const rating = ratingEl?.getAttribute("aria-label") || "";
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
