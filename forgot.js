const form = document.getElementById("forgotForm");
const emailInput = document.getElementById("fEmail");
const errorEl = document.getElementById("forgotError");
const submitBtn = document.getElementById("forgotSubmit");
const doneEl = document.getElementById("forgotDone");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending…";

  try {
    const res = await api("/password/forgot", "POST", { email: emailInput.value.trim() });
    form.hidden = true;
    doneEl.textContent = res.message + " The link works for 30 minutes. Check your spam folder too.";
    doneEl.hidden = false;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Send reset link";
  }
});