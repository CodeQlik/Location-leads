const express = require("express");
const router = express.Router();
const Area = require("../models/Area");
const { auth } = require("../middleware/auth");

// Fetch areas for a specific city
router.get("/", auth, async (req, res) => {
  try {
    const { cityId, stateId, countryId } = req.query;
    if (!cityId || !stateId || !countryId) {
      return res.status(400).json({ message: "City, state, and country IDs are required." });
    }

    const areas = await Area.find({ 
      city: cityId, 
      state: stateId, 
      country: countryId 
    }).populate('city state country').sort({ name: 1 });

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
