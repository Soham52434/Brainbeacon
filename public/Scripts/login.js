// public/Scripts/loginOverlay.js
document.addEventListener('DOMContentLoaded', function() {
  // Get the close button and login overlay elements by their IDs
  const closeLoginBtn = document.getElementById('close-login-btn');
  const loginOverlay = document.getElementById('login-overlay');

  // Check if both elements exist before adding event listener
  if (closeLoginBtn && loginOverlay) {
    closeLoginBtn.addEventListener('click', function() {
      // Hide the login overlay when the close button is clicked
      loginOverlay.style.display = 'none';
    });
  }
});