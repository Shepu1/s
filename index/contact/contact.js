// Loader
        window.addEventListener("load", function(){
            setTimeout(() => {
                document.getElementById("shepu-loader").classList.add("fade-out");
            }, 1400);
        });

        // Hamburger
        const hamburger = document.querySelector('.hamburger');
        const navLinks = document.querySelector('.nav-links');
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });

        // Formspree + Toast (AJAX)
        const form = document.getElementById('contact-form');
        const toast = document.getElementById('toast');

        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const btn = this.querySelector('.submit-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'পাঠানো হচ্ছে...';
            btn.disabled = true;

            try {
                const formData = new FormData(form);
                const response = await fetch(this.action, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    toast.classList.add('show');
                    form.reset();
                    setTimeout(() => toast.classList.remove('show'), 4500);
                } else {
                    alert('কোনো সমস্যা হয়েছে। আবার চেষ্টা করুন।');
                }
            } catch (error) {
                alert('ইন্টারনেট সমস্যা। পরে চেষ্টা করুন।');
            }

            btn.innerHTML = originalText;
            btn.disabled = false;
        });

        // Smooth scroll
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // Escape key for toast
        document.addEventListener('keydown', (e) => {
            if (e.key === "Escape" && toast.classList.contains('show')) {
                toast.classList.remove('show');
            }
        });
