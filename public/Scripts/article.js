// Fetching and rendering data for cards and articles
fetch('/')
    .then(response => response.json())
    .then(data => {
        const articlesContainer = document.getElementById("articlesContainer");

        // Render articles
        data.articles.forEach((article, index) => {
            const articleRow = document.createElement("div");
            articleRow.classList.add("article-row");

            const articleCard = document.createElement("div");
            articleCard.classList.add("article-card");

            articleCard.innerHTML = `
                <div class="article-image" style="background-image: url(${article.image});"></div>
                <div class="article-content">
                    <div class="article-title">${article.title}</div>
                    <div class="article-description">${article.description}</div>
                    <button class="read-more">Read More</button>
                </div>
            `;

            articleRow.appendChild(articleCard);
            articlesContainer.appendChild(articleRow);
        });
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });