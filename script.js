const menuBtn=document.querySelector('.menu-btn');
const navLinks=document.querySelector('.nav-links');

if(menuBtn&&navLinks){
  const closeMenu=()=>{
    navLinks.classList.remove('open');
    menuBtn.setAttribute('aria-expanded','false');
  };
  menuBtn.addEventListener('click',()=>{
    const open=navLinks.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded',String(open));
  });
  navLinks.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',e=>{if(e.key==='Escape') closeMenu();});
  document.addEventListener('click',e=>{
    if(!navLinks.contains(e.target)&&!menuBtn.contains(e.target)) closeMenu();
  });
}
