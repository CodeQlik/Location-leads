const express = require("express");
const router = express.Router();
const Area = require("../models/Area");
const { auth } = require("../middleware/auth");
const City = require("../models/City");
const State = require("../models/State");
const Country = require("../models/Country");

// Fetch areas for a specific city
router.get("/", auth, async (req, res) => {
  try {
    const { cityId, stateId, countryId } = req.query;
    if (!cityId || !stateId || !countryId) {
      return res.status(400).json({ message: "City, state, and country IDs are required." });
    }

    let areas = await Area.find({ 
      city: cityId, 
      state: stateId, 
      country: countryId 
    }).populate('city state country').sort({ name: 1 });

    // If no areas exist for this city, dynamically fetch original ones or fallback
    if (areas.length === 0) {
      let fetchedAreaNames = [];

      try {
        const cityDoc = await City.findById(cityId);
        const stateDoc = await State.findById(stateId);

        if (cityDoc && stateDoc) {
          const cityName = cityDoc.name;
          const stateName = stateDoc.name;

          console.log(`Fetching real areas for ${cityName}, ${stateName}...`);

          function normalizeState(state) {
            let s = state.toLowerCase().replace(/[^a-z]/g, "");
            if (s.includes("chhattisgarh") || s.includes("chattisgarh")) return "chhattisgarh";
            if (s.includes("odisha") || s.includes("orissa")) return "odisha";
            if (s.includes("uttarakhand") || s.includes("uttaranchal")) return "uttarakhand";
            if (s.includes("jammu")) return "jammu";
            return s;
          }

          // 1. Try Offline Finder first (0ms latency, extremely reliable)
          try {
            const { searchPincodes } = await import("india-pincode-finder");
            
            // Clean suffix/prefix
            const cleanName = cityName.replace(/\b(Mandi|Bara|Chota|Chhota|City|Road|Junction|Town|Village|Khas|Kalan|Khurd)\b/gi, "").trim();
            const namesToSearch = [cityName];
            if (cleanName !== cityName && cleanName.length >= 3) {
              namesToSearch.push(cleanName);
            }

            for (const name of namesToSearch) {
              const results = searchPincodes(name);
              const targetState = normalizeState(stateName);
              const filtered = results.filter(item => normalizeState(item.state) === targetState);

              if (filtered.length > 0) {
                const areaNamesSet = new Set();
                filtered.forEach(item => {
                  if (item.officename) {
                    const clean = item.officename.replace(/\b(H\.O|S\.O|B\.O|HO|SO|BO)\b/gi, "").replace(/\s+/g, " ").trim();
                    if (clean) areaNamesSet.add(clean);
                  }
                });
                fetchedAreaNames = Array.from(areaNamesSet);
                if (fetchedAreaNames.length > 0) {
                  console.log(`[Offline Success] Found ${fetchedAreaNames.length} areas for "${name}"`);
                  break;
                }
              }
            }
          } catch (err) {
            console.error("Offline lookup error:", err.message);
          }

          // 2. If offline search failed, try Nominatim Geocoding to get the Pincode
          if (fetchedAreaNames.length === 0) {
            let postcode = null;
            try {
              console.log(`[Nominatim] Geocoding "${cityName}, ${stateName}"...`);
              const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)},+${encodeURIComponent(stateName)},+India&format=json&addressdetails=1&limit=1`;
              const response = await fetch(nominatimUrl, {
                headers: { "User-Agent": "LocationLeadsScraper/1.0" }
              });
              if (response.ok) {
                const data = await response.json();
                if (data.length > 0 && data[0].address && data[0].address.postcode) {
                  postcode = data[0].address.postcode.replace(/\s+/g, "");
                  console.log(`[Nominatim] Resolved pincode: ${postcode}`);
                }
              }
            } catch (geoErr) {
              console.error("Nominatim geocoding error:", geoErr.message);
            }

            // 3. If we have a pincode, fetch areas using CDN-backed stable API
            if (postcode) {
              try {
                console.log(`[CDN API] Fetching pincode ${postcode} from GitHub Pages CDN...`);
                const cdnUrl = `https://aniket-thapa.github.io/india-pincode-api/pincodes/${postcode}.json`;
                const res = await fetch(cdnUrl);
                if (res.ok) {
                  const json = await res.json();
                  if (json && json.offices && Array.isArray(json.offices)) {
                    const areaNamesSet = new Set();
                    json.offices.forEach(off => {
                      if (off.officeName) {
                        const clean = off.officeName.replace(/\b(H\.O|S\.O|B\.O|HO|SO|BO)\b/gi, "").replace(/\s+/g, " ").trim();
                        if (clean) areaNamesSet.add(clean);
                      }
                    });
                    fetchedAreaNames = Array.from(areaNamesSet);
                    if (fetchedAreaNames.length > 0) {
                      console.log(`[CDN API Success] Found ${fetchedAreaNames.length} areas for pincode ${postcode}`);
                    }
                  }
                }
              } catch (cdnErr) {
                console.error("CDN API fetch error:", cdnErr.message);
              }

              // 4. Fallback to official Pincode API if CDN failed
              if (fetchedAreaNames.length === 0) {
                try {
                  console.log(`[Fallback API] Fetching pincode ${postcode} from api.postalpincode.in...`);
                  const pinRes = await fetch(`https://api.postalpincode.in/pincode/${postcode}`);
                  if (pinRes.ok) {
                    const pinJson = await pinRes.json();
                    const pinData = pinJson[0];
                    if (pinData && pinData.Status === "Success" && pinData.PostOffice) {
                      const areaNamesSet = new Set();
                      pinData.PostOffice.forEach(po => {
                        if (po.Name) {
                          const clean = po.Name.replace(/\b(H\.O|S\.O|B\.O|HO|SO|BO)\b/gi, "").replace(/\s+/g, " ").trim();
                          if (clean) areaNamesSet.add(clean);
                        }
                      });
                      fetchedAreaNames = Array.from(areaNamesSet);
                    }
                  }
                } catch (fallbackErr) {
                  console.error("Fallback API fetch error:", fallbackErr.message);
                }
              }
            }
          }
        }
      } catch (apiErr) {
        console.error("Locality lookup error:", apiErr.message);
      }

      // If no real sub-localities found, do not insert fallback placeholder data
      if (fetchedAreaNames.length === 0) {
        console.log("No real areas found for this city. Database remains clean.");
        return res.json([]);
      }

      // Prepare documents
      const docs = fetchedAreaNames.map(name => ({
        name,
        city: cityId,
        state: stateId,
        country: countryId
      }));

      try {
        await Area.insertMany(docs, { ordered: false });
      } catch (insertErr) {
        // Ignore duplicate errors if inserted concurrently
      }

      // Fetch newly inserted areas from DB
      areas = await Area.find({ 
        city: cityId, 
        state: stateId, 
        country: countryId 
      }).populate('city state country').sort({ name: 1 });
    }

    res.json(areas);
  } catch (err) {
    console.error("Error fetching areas:", err);
    res.status(500).json({ message: "Failed to fetch areas." });
  }
});

// Add a new area
router.post("/", auth, async (req, res) => {
  try {
    const { name, city, state, country } = req.body;
    if (!name || !city || !state || !country) {
      return res.status(400).json({ message: "All fields (name, city, state, country) are required." });
    }

    const newArea = new Area({
      name: name.trim(),
      city,
      state,
      country,
    });

    await newArea.save();
    res.status(201).json(newArea);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "This area already exists in this city for you." });
    }
    console.error("Error saving area:", err);
    res.status(500).json({ message: "Failed to save area." });
  }
});

// Delete an area
router.delete("/:id", auth, async (req, res) => {
  try {
    const deletedArea = await Area.findOneAndDelete({ _id: req.params.id });
    if (!deletedArea) {
      return res.status(404).json({ message: "Area not found or unauthorized." });
    }
    res.json({ message: "Area deleted successfully." });
  } catch (err) {
    console.error("Error deleting area:", err);
    res.status(500).json({ message: "Failed to delete area." });
  }
});

module.exports = router;
