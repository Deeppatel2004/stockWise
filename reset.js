const form = document.getElementById("resetForm");
const passwordInput = document.getElementById("rPassword");
const confirmInput = document.getElementById("rConfirm");
const errorEl = document.getElementById("resetError");
const submitBtn = document.getElementById("resetSubmit");
const doneEl = document.getElementById("resetDone");

const token = new URLSearchParams(location.search).get("token") || "";

function showError(text) {
  errorEl.textContent = text;
  errorEl.hidden = false;
}

// The link must contain the 64-character code from the email
if (!/^[a-f0-9]{64}$/.test(token)) {
  form.hidden = true;
  showError("This reset link is not valid. Please ask for a new one.");
  document.querySelector(".auth-link").insertAdjacentHTML("beforebegin", '<p class="auth-link"><a href="forgot.html">Get a new reset link</a></p>');
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.hidden = true;

  if (passwordInput.value !== confirmInput.value) {
    showError("The two passwords are not the same");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  try {
    const res = await api("/password/reset", "POST", { token, password: passwordInput.value });
    form.hidden = true;
    doneEl.textContent = res.message + " Taking you to the login page…";
    doneEl.hidden = false;
    setTimeout(() => (location.href = "login.html"), 2500);
  } catch (err) {
    showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Change password";
  }
});