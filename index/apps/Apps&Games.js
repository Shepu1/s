// AOS Initialization
        AOS.init({
            duration: 800,
            once: true,
            easing: 'ease-in-out-back'
        });

        // Hide loader with smooth fade-out after 1 second
        window.addEventListener("load", function(){
            setTimeout(() => {
                document.getElementById("shepu-loader").classList.add("fade-out");
            }, 1000);
        });

        // Hamburger Menu Toggle Function
        function toggleMenu() {
            const navLinks = document.getElementById('nav-links');
            navLinks.classList.toggle('active');
        }

        // Auto Close Mobile Menu on Link Click
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                const navLinks = document.getElementById('nav-links');
                if(navLinks.classList.contains('active')){
                    navLinks.classList.remove('active');
                }
            });
        });

        // Search Functionality
        function filterCards() {
            const input = document.getElementById('search-input');
            const filter = input.value.toUpperCase();
            const gallery = document.querySelector('.gallery');
            const cards = gallery.getElementsByClassName('game-card');

            for (let i = 0; i < cards.length; i++) {
                const h2 = cards[i].querySelector("h2");
                const txtValue = h2.textContent || h2.innerText;
                if (txtValue.toUpperCase().indexOf(filter) > -1) {
                    cards[i].style.display = "";
                } else {
                    cards[i].style.display = "none";
                }
            }
        }

        // Custom Cursor JavaScript Logic (Only runs on PC)
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            const neonCursor = document.getElementById('neon-cursor');
            const interactiveElements = document.querySelectorAll('a, button, input, .download-btn, .game-card, .hamburger, #shepu-ai-button');

            document.addEventListener('mousemove', (e) => {
                neonCursor.style.left = e.clientX + 'px';
                neonCursor.style.top = e.clientY + 'px';
            });

            interactiveElements.forEach(el => {
                el.addEventListener('mouseenter', () => {
                    neonCursor.classList.add('hovered');
                });
                el.addEventListener('mouseleave', () => {
                    neonCursor.classList.remove('hovered');
                });
            });
        }

        // PC Tilt effect
        const cards = document.querySelectorAll('.game-card');
        cards.forEach(card => {
            card.addEventListener('mousemove', e => {
                if(window.matchMedia("(hover: hover) and (pointer: fine)").matches){
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    card.style.transform = `rotateY(${(x - rect.width/2)/20}deg) rotateX(${(rect.height/2 - y)/20}deg) translateY(-8px) scale(1.05)`;
                }
            });

            card.addEventListener('mouseleave', () => {
                // Modified to reset smoothly without completely breaking the CSS hover state
                card.style.transform = '';
            });

            // Mobile tap toggle info
            card.addEventListener('click', () => {
                if(window.matchMedia("(hover: none) and (pointer: coarse)").matches){
                    card.classList.toggle('show-info');
                }
            });
        });

        // Click ripple effect
        document.addEventListener('click', function(e){
            const circle = document.createElement('div');
            circle.style.position='absolute';
            circle.style.width=circle.style.height='50px';
            circle.style.left=(e.pageX-25)+'px';
            circle.style.top=(e.pageY-25)+'px';
            circle.style.background='rgba(255,255,255,0.2)';
            circle.style.borderRadius='50%';
            circle.style.pointerEvents='none';
            circle.style.animation='ripple 0.6s ease-out';
            document.body.appendChild(circle);
            setTimeout(()=> circle.remove(),600);
        });

        // Ripple animation
        const style = document.createElement('style');
        style.innerHTML=`@keyframes ripple {0%{transform:scale(0);opacity:1;}100%{transform:scale(2);opacity:0;}}`;
        document.head.appendChild(style);
