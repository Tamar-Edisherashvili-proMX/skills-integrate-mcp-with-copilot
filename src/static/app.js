document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const authStatus = document.getElementById("auth-status");
  const signupHelp = document.getElementById("signup-help");

  const accountButton = document.getElementById("account-button");
  const accountMenu = document.getElementById("account-menu");
  const openLoginButton = document.getElementById("open-login");
  const logoutButton = document.getElementById("logout-button");

  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeLoginButton = document.getElementById("close-login");

  let adminSession = {
    logged_in: false,
    username: null,
  };

  function setMessage(text, variant) {
    messageDiv.textContent = text;
    messageDiv.className = variant;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function renderAuthState() {
    const isTeacher = adminSession.logged_in;
    authStatus.textContent = isTeacher
      ? `Teacher logged in: ${adminSession.username}`
      : "Viewing as student (read-only)";

    signupForm.querySelectorAll("input, select, button").forEach((field) => {
      field.disabled = !isTeacher;
    });

    signupHelp.className = isTeacher ? "hidden" : "info";
    openLoginButton.classList.toggle("hidden", isTeacher);
    logoutButton.classList.toggle("hidden", !isTeacher);
  }

  async function fetchSession() {
    try {
      const response = await fetch("/admin/session");
      adminSession = await response.json();
    } catch (error) {
      adminSession = { logged_in: false, username: null };
      console.error("Error fetching session:", error);
    }
    renderAuthState();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        adminSession.logged_in
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    if (!adminSession.logged_in) {
      setMessage("Teacher login required to register students.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  accountButton.addEventListener("click", () => {
    accountMenu.classList.toggle("hidden");
  });

  openLoginButton.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    accountMenu.classList.add("hidden");
  });

  closeLoginButton.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.detail || "Login failed", "error");
        return;
      }

      loginForm.reset();
      loginModal.classList.add("hidden");
      await fetchSession();
      await fetchActivities();
      setMessage(result.message, "success");
    } catch (error) {
      setMessage("Login failed. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/admin/logout", { method: "POST" });
      const result = await response.json();
      await fetchSession();
      await fetchActivities();
      setMessage(result.message || "Logged out", "success");
    } catch (error) {
      setMessage("Logout failed. Please try again.", "error");
      console.error("Error logging out:", error);
    } finally {
      accountMenu.classList.add("hidden");
    }
  });

  // Initialize app
  fetchSession().then(fetchActivities);
});
