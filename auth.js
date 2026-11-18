// Already logged in? Go straight to the dashboard
if (getToken()) location.href = "index.html";

let mode = "login";

const tabs = document.getElementById("authTabs");
const form = document.getElementById("authForm");
const nameInput = document.getElementById("aName");
const emailInput = document.getElementById("aEmail");
const passwordInput = document.getElementById("aPassword");
const errorEl = document.getElementById("authError");
const submitBtn = document.getElementById("authSubmit");

function setMode(newMode) {
  mode = newMode;
  tabs.querySelectorAll(".tf-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  nameInput.hidden = mode !== "register";
  nameInput.required = mode === "register";
  passwordInput.autocomplete = mode === "register" ? "new-password" : "current-password";
  submitBtn.textContent = mode === "register" ? "Create account" : "Login";
  errorEl.hidden = true;
}

tabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tf-btn");
  if (btn) setMode(btn.dataset.mode);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;

  const body = { email: emailInput.value.trim(), password: passwordInput.value };
  if (mode === "register") body.name = nameInput.value.trim();

  try {
    const data = await api(mode === "register" ? "/auth/register" : "/auth/login", "POST", body);
    setSession(data.token, data.user);
    location.href = "index.html";
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    submitBtn.disabled = false;
  }
});