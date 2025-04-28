setTimeout(() => {
    // get all the buttons
const buttons = document.querySelectorAll('button');

// Save the original content of each button only once
buttons.forEach((button) => {
    if (!button.dataset.originalContent) {
        button.dataset.originalContent = button.innerHTML;
    }
});

// when hovering, add the loader without removing contents
buttons.forEach((button) => {
    button.addEventListener('mouseover', () => {
        if (!button.querySelector('.loader')) {
            const loader = document.createElement('div');
            loader.classList.add('loader');
            button.appendChild(loader);
        }
    });
    
    // when not hovering, remove the loader
    button.addEventListener('mouseout', () => {
        const loader = button.querySelector('.loader');
        if (loader) {
            button.removeChild(loader);
        }
    });
});
},);