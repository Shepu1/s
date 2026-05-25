// mobile menu handlers
function openMobile(){ document.getElementById('mobileMenu').style.right='0'; document.getElementById('mobileMenu').setAttribute('aria-hidden','false') }
function closeMobile(){ document.getElementById('mobileMenu').style.right='-100%'; document.getElementById('mobileMenu').setAttribute('aria-hidden','true') }

// hide intro after page load (keeps cube visible briefly)
window.addEventListener('load', () => {
  setTimeout(()=> {
    document.getElementById('intro').classList.add('hidden');
    // animate skill bars after intro hide
    animateSkills();
  }, 900);
});

// ensure profile image centered — if image missing, fallback to placeholder (already set in img onerror)
document.getElementById('profileImage').style.display = 'block';
document.getElementById('profileImage').style.margin = '0 auto';

// animate skill fills reading data-value
function animateSkills(){
  const fills = document.querySelectorAll('.skill-fill');
  fills.forEach(f => {
    const v = f.getAttribute('data-value') || '60%';
    // small delay per bar
    setTimeout(()=> {
      f.style.width = v;
    }, 200 + (Math.random()*600));
  });
}

// Accessibility: close mobile when clicking outside
document.addEventListener('click', (e) => {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('hambBtn');
  if(menu && menu.style.right === '0' && !menu.contains(e.target) && !btn.contains(e.target)){
    closeMobile();
  }
});

// Mouse Movement Glow Effect on about-card
const card = document.getElementById('aboutCard');
if (card) {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        card.style.setProperty('--mouse-x', `${x * 100}%`);
        card.style.setProperty('--mouse-y', `${y * 100}%`);
    });
}
