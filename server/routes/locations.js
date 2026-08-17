const express = require("express");
const router = express.Router();
const Country = require("../models/Country");
const State = require("../models/State");
const City = require("../models/City");
const { auth } = require("../middleware/auth");

// Fetch all countries
router.get("/countries", auth, async (req, res) => {
  try {
    const countries = await Country.find().sort({ name: 1 });
    res.json(countries);
  } catch (err) {
    console.error("Error fetching countries:", err);
    res.status(500).json({ message: "Failed to fetch countries." });
  }
});

// Fetch states for a specific country
router.get("/states", auth, async (req, res) => {
  try {
    const { countryId } = req.query;
    if (!countryId) {
      return res.status(400).json({ message: "countryId is required." });
    }
    const states = await State.find({ country: countryId }).sort({ name: 1 });
    res.json(states);
  } catch (err) {
    console.error("Error fetching states:", err);
    res.status(500).json({ message: "Failed to fetch states." });
  }
});

// Fetch cities for a specific state in a country
router.get("/cities", auth, async (req, res) => {
  try {
    const { countryId, stateId } = req.query;
    if (!countryId || !stateId) {
      return res.status(400).json({ message: "countryId and stateId are required." });
    }
    const cities = await City.find({ country: countryId, state: stateId }).sort({ name: 1 });
    res.json(cities);
  } catch (err) {
    console.error("Error fetching cities:", err);
    res.status(500).json({ message: "Failed to fetch cities." });
  }
});

module.exports = router;
