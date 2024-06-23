const starContainer = document.getElementById('star-container');
const stars = [];

for (let i = 0; i < 50; i++) {
    const star = document.createElement('div');
    star.classList.add('star');
    
    const startX = Math.random() * (starContainer.clientWidth - 4);
    const startY = Math.random() * (starContainer.clientHeight - 4);
    star.style.left = `${startX}px`;
    star.style.top = `${startY}px`;

    const speedX = (Math.random() * 2 - 1) * 2;
    const speedY = (Math.random() * 2 - 1) * 2;

    stars.push({ element: star, x: startX, y: startY, speedX, speedY });
    starContainer.appendChild(star);
}

function animateStars() {
    const containerWidth = starContainer.clientWidth;
    const containerHeight = starContainer.clientHeight;

    stars.forEach(star => {
        star.x += star.speedX;
        star.y += star.speedY;

        if (star.x <= 0 || star.x + 4 >= containerWidth) {
            star.speedX *= -1;
        }
        if (star.y <= 0 || star.y + 4 >= containerHeight) {
            star.speedY *= -1;
        }

        star.element.style.left = `${star.x}px`;
        star.element.style.top = `${star.y}px`;
    });

    requestAnimationFrame(animateStars);
}

animateStars();
