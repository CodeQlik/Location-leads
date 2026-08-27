const mongoose = require("mongoose");

const citySchema = new mongoose.Schema({
  name: { type: String, required: true },
  state: { type: mongoose.Schema.Types.ObjectId, ref: 'State', required: true },
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
});

// A city's name is unique within its specific state and country
citySchema.index({ name: 1, state: 1, country: 1 }, { unique: true });
// Index for fast querying by country and state
citySchema.index({ country: 1, state: 1 });

module.exports = mongoose.model("City", citySchema);
