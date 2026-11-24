const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    watchlist: { type: [String], default: [] },
    watchlistGroups: [
      {
        name: { type: String, required: true, trim: true, maxlength: 30 },
        symbols: { type: [String], default: [] },
      },
    ],
    notificationSettings: {
      inApp: { type: Boolean, default: true },   // show alerts in the bell and as popups
      email: { type: Boolean, default: false },  // also send alerts by email
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
