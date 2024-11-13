let searchData = ""; // Variable to store search data

function toggleSearch() {
    const searchBox = document.getElementById('search-box');
    const searchInput = document.getElementById('search-input');

    // Toggle the 'show' class on the search box
    if (searchBox.classList.contains('show')) {
        // Hide search box and save data
        searchData = searchInput.value;
        console.log("Search Data Saved:", searchData);
        searchBox.classList.remove('show');
    } else {
        // Show search box and focus on input
        searchBox.classList.add('show');
        searchInput.focus();
    }
}

// Hide the search box when clicking outside
document.addEventListener('click', function (event) {
    const searchBox = document.getElementById('search-box');
    const searchToggle = document.getElementById('search-toggle');

    // Check if the click is outside the search box and icon
    if (!searchBox.contains(event.target) && !searchToggle.contains(event.target)) {
        // Save input data
        searchData = document.getElementById('search-input').value;
        console.log("Search Data Saved:", searchData);

        // Hide the search box
        searchBox.classList.remove('show');
    }
});
