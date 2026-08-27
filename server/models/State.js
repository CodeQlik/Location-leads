const mongoose = require("mongoose");

const stateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  isoCode: { type: String, required: true },
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
});

// A state's isoCode is unique within a specific country
stateSchema.index({ isoCode: 1, country: 1 }, { unique: true });
// Index for fast query by country
stateSchema.index({ country: 1 });

module.exports = mongoose.model("State", stateSchema);
