// Get references to carousel elements
const carouselInner = document.getElementById('carouselInner');
const leftArrow = document.querySelector('.left-arrow');
const rightArrow = document.querySelector('.right-arrow');

// Variables to track carousel state
let currentIndex = 0;
let totalCards = carouselInner.querySelectorAll('.card').length;
let visibleCardsCount = 1;
let totalPages = 1;
let cardWidth = 0;
let pageWidth = 0;

// Function to update carousel dimensions and calculate pagination
function adjustCarousel() {
  const containerWidth = document.querySelector('.carousel-outer').offsetWidth;
  const card = carouselInner.querySelector('.card');

  if (card) {
    cardWidth = card.offsetWidth + parseInt(getComputedStyle(card).marginLeft) + parseInt(getComputedStyle(card).marginRight);
    visibleCardsCount = Math.floor(containerWidth / cardWidth) || 1;
    pageWidth = cardWidth * visibleCardsCount;
    totalPages = Math.ceil(totalCards / visibleCardsCount);

    // Ensure carouselInner has sufficient width
    carouselInner.style.width = `${cardWidth * totalCards}px`;

    // Reset currentIndex if necessary
    if (currentIndex >= totalPages) {
      currentIndex = totalPages - 1;
    }

    // Apply the calculated scroll position
    carouselInner.style.transform = `translateX(-${currentIndex * pageWidth}px)`;
  }
}

// Function to handle arrow navigation
function scrollCarousel(direction) {
  if (direction === 'next') {
    if (currentIndex < totalPages - 1) {
      currentIndex++;
    }
  } else {
    if (currentIndex > 0) {
      currentIndex--;
    }
  }

  // Apply the calculated scroll position
  carouselInner.style.transform = `translateX(-${currentIndex * pageWidth}px)`;
}

// Event listeners for arrow clicks
leftArrow.addEventListener('click', () => scrollCarousel('prev'));
rightArrow.addEventListener('click', () => scrollCarousel('next'));

// Event listener for window resize
window.addEventListener('resize', adjustCarousel);

// Initial setup
adjustCarousel();



// Get references to carousel elements
const initiativeCarousel = document.getElementById('carouselInner');
const initiativePrevButton = document.querySelector('.left-arrow');
const initiativeNextButton = document.querySelector('.right-arrow');

// Variables to track carousel state
let currentPageIndex = 0;
let totalCardCount = initiativeCarousel.querySelectorAll('.card').length;
let cardsVisiblePerPage = 1;
let maxPageCount = 1;
let individualCardWidth = 0;
let totalVisibleWidth = 0;

// Function to update carousel dimensions and calculate pagination
function updateInitiativeCarousel() {
  const carouselOuterWidth = document.querySelector('.carousel-outer').offsetWidth;
  const singleCard = initiativeCarousel.querySelector('.card');

  if (singleCard) {
    individualCardWidth = singleCard.offsetWidth + parseInt(getComputedStyle(singleCard).marginLeft) + parseInt(getComputedStyle(singleCard).marginRight);
    cardsVisiblePerPage = Math.floor(carouselOuterWidth / individualCardWidth) || 1;
    totalVisibleWidth = individualCardWidth * cardsVisiblePerPage;
    maxPageCount = Math.ceil(totalCardCount / cardsVisiblePerPage);

    // Ensure initiativeCarousel has sufficient width
    initiativeCarousel.style.width = `${individualCardWidth * totalCardCount}px`;

    // Reset currentPageIndex if necessary
    if (currentPageIndex >= maxPageCount) {
      currentPageIndex = maxPageCount - 1;
    }

    // Apply the calculated scroll position
    initiativeCarousel.style.transform = `translateX(-${currentPageIndex * totalVisibleWidth}px)`;
  }
}

// Function to handle arrow navigation
function handleInitiativeNavigation(direction) {
  if (direction === 'next') {
    if (currentPageIndex < maxPageCount - 1) {
      currentPageIndex++;
    }
  } else {
    if (currentPageIndex > 0) {
      currentPageIndex--;
    }
  }

  // Apply the calculated scroll position
  initiativeCarousel.style.transform = `translateX(-${currentPageIndex * totalVisibleWidth}px)`;
}

// Event listeners for arrow clicks
initiativePrevButton.addEventListener('click', () => handleInitiativeNavigation('prev'));
initiativeNextButton.addEventListener('click', () => handleInitiativeNavigation('next'));

// Event listener for window resize
window.addEventListener('resize', updateInitiativeCarousel);

// Initial setup
updateInitiativeCarousel();