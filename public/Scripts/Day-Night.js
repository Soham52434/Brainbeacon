function toggleMode() {
    var body = document.body;
    var navbar = document.querySelector('.navbar');
    var learnMoreBtn = document.querySelector('.learn-more-btn'); // Corrected class selector
    var svgPaths = document.querySelectorAll('path');
    var isChecked = document.getElementById('modeToggle').checked;

    if (isChecked) {
        body.style.backgroundColor = "#1E1E1E";
        body.style.color = "#FFFBF2";
        navbar.style.color = "#FFFBF2";
        navbar.style.backgroundColor = "#000";
        // learnMoreBtn.style.color = "#FFFBF2";
        // learnMoreBtn.style.border = "2px solid #FFFBF2";
        svgPaths.forEach(path => {
            path.setAttribute('stroke', 'white'); // Change stroke to white
        });
    } else {
        body.style.backgroundColor = "#FFFBF2";
        body.style.color = "#000";
        navbar.style.color = "#000";
        navbar.style.backgroundColor = "#FFFBF2";
        // learnMoreBtn.style.color = "#000";
        // learnMoreBtn.style.border = "2px solid #000";
        svgPaths.forEach(path => {
            path.setAttribute('stroke', 'black'); // Change stroke to black
        });
    }
}