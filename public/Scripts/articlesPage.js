
    document.addEventListener('DOMContentLoaded', function () {
        const pageInput = document.getElementById('pageInput');
        const goToPageBtn = document.getElementById('goToPageBtn');
        
        // Ensure maxPages is defined correctly
        const maxPages = parseInt(pageInput.getAttribute('max'), 10);

        // Event listener for page input validation
        pageInput.addEventListener('input', () => {
            const pageValue = parseInt(pageInput.value, 10);
            if (isNaN(pageValue) || pageValue < 1 || pageValue > maxPages) {
                pageInput.classList.add('invalid');
            } else {
                pageInput.classList.remove('invalid');
            }
        });

        // Event listener for the Go button click
        goToPageBtn.addEventListener('click', () => {
            const pageValue = parseInt(pageInput.value, 10);
            if (!isNaN(pageValue) && pageValue >= 1 && pageValue <= maxPages) {
                window.location.href = `/article?page=${pageValue}`;
            } else {
                alert('Please enter a valid page number.');
            }
        });
    });