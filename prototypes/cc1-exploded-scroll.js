(() => {
  const track = document.getElementById('track');
  const robot = document.getElementById('robot');
  const phase = document.getElementById('phase');
  const callouts = [...document.querySelectorAll('.callout')];
  const clamp = (n,a=0,b=1)=>Math.min(b,Math.max(a,n));
  const smooth = t => t*t*(3-2*t);

  function render(){
    const r = track.getBoundingClientRect();
    const total = track.offsetHeight - innerHeight;
    const raw = clamp((-r.top)/Math.max(1,total));
    const p = smooth(raw);
    const explode = clamp((p-.06)/.70);
    robot.style.setProperty('--explode', explode.toFixed(4));
    document.documentElement.style.setProperty('--p', raw.toFixed(4));

    const active = raw > .24 && raw < .90;
    callouts.forEach((el,i)=>{
      const gate = .24 + i*.075;
      el.classList.toggle('active', active && raw > gate);
    });

    let label = '01 · СОБРАН';
    if(raw>.13) label='02 · СНЯТИЕ КОРПУСА';
    if(raw>.36) label='03 · ОТКРЫТИЕ УЗЛОВ';
    if(raw>.68) label='04 · EXPLODED VIEW';
    if(raw>.92) label='05 · ФИКСАЦИЯ';
    phase.textContent = label;
  }

  let ticking=false;
  const request=()=>{if(!ticking){requestAnimationFrame(()=>{render();ticking=false});ticking=true}};
  addEventListener('scroll',request,{passive:true});
  addEventListener('resize',request);
  render();
})();