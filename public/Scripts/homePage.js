document.getElementById('viewArticlesBtn').addEventListener('click', function () {
    window.location.href = '/article';
});
document.getElementById('writeArticlesBtn').addEventListener('click', function () {
    window.location.href = '/write-articles';
});

document.querySelector('.newsletter form').addEventListener('submit', function (event) {
    event.preventDefault();
    alert('Thank you for subscribing!');
});
const specialI = document.getElementById("specialI");
const dot = document.getElementById("dot");

specialI.addEventListener("animationend", () => {
    dot.style.opacity = "1";
    dot.addEventListener("animationend", () => {
        specialI.style.color = "#FDA700";
    });
});

// Function to set a cookie
function setCookie(name, value, minutes) {
    let expires = "";
    if (minutes !== undefined) {
        const date = new Date();
        date.setTime(date.getTime() + minutes * 60 * 1000);
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

// Function to get a cookie
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';').map(c => c.trim());
    for (let i = 0; i < ca.length; i++) {
        const c = ca[i];
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

// Function to handle animation completion
function onAnimationComplete() {
    // Set the 'animationPlayed' cookie to 'true'
    setCookie('animationPlayed', 'true');
    // Set the 'lastActiveTime' cookie to the current time
    setCookie('lastActiveTime', new Date().getTime());
}

// Add event listener for animation completion
// Assuming your animation element has an ID of 'animation-element'
document.getElementById('animation-element').addEventListener('animationend', function () {
    onAnimationComplete();
});

// Function to update 'lastActiveTime' on user activity
function updateLastActiveTime() {
    setCookie('lastActiveTime', new Date().getTime());
}

// Add event listeners for user activity
window.addEventListener('click', updateLastActiveTime);
window.addEventListener('mousemove', updateLastActiveTime);
window.addEventListener('keydown', updateLastActiveTime);
window.addEventListener('scroll', updateLastActiveTime);
document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
        updateLastActiveTime();
    }
});

// Function to check inactivity and reset 'animationPlayed' cookie
function checkInactivity() {
    const lastActiveTime = getCookie('lastActiveTime');
    if (lastActiveTime) {
        const currentTime = new Date().getTime();
        if (currentTime - parseInt(lastActiveTime) > 5 * 60 * 1000) {
            // More than 5 minutes of inactivity
            setCookie('animationPlayed', 'false');
        }
    }
}

function checkInactivity() {
    // ... (same as before)
}

function controlAnimation() {
    const animationPlayed = getCookie('animationPlayed');
    const lastActiveTime = getCookie('lastActiveTime');
    const currentTime = new Date().getTime();

    if (animationPlayed === 'true') {
        // Hide animation and login overlay
        document.getElementById('animation-element').style.display = 'none';
        document.getElementById('login-overlay').style.display = 'none';
    } else {
        // Show animation and login overlay
        document.getElementById('animation-element').style.display = 'block';
        document.getElementById('login-overlay').style.display = 'block';
        // Start the animation if necessary
        // Optionally, you can add a class to trigger CSS animations
    }
}

// Call functions on page load
window.onload = function () {
    checkInactivity();
    controlAnimation();
};

// Call checkInactivity when the page loads
window.onload = checkInactivity;