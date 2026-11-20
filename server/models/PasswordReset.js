const mongoose = require("mongoose");

// One row per reset link that was sent. Only a hash of the link's token is stored.
const passwordResetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB deletes expired rows by itself

module.exports = mongoose.model("PasswordReset", passwordResetSchema);
