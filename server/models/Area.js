const mongoose = require("mongoose");

const areaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      required: true,
    },
    state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'State',
      required: true,
    },
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Country',
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate areas for the same city globally
areaSchema.index({ name: 1, city: 1, state: 1, country: 1 }, { unique: true });

module.exports = mongoose.model("Area", areaSchema);
