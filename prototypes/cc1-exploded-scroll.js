(() => {
  const track = document.getElementById('track');
  const robot = document.getElementById('robot');
  const core = robot.querySelector('.core');
  const phase = document.getElementById('phase');
  const callouts = [...document.querySelectorAll('.callout')];
  const clamp = (n,a=0,b=1)=>Math.min(b,Math.max(a,n));
  const smooth = t => t*t*(3-2*t);
  const parts = [
    ['.top',0,-116,-1.5,.012],
    ['.display',0,-176,1,.018],
    ['.left',-185,-18,-7,.018],
    ['.center',0,-42,0,.01],
    ['.right',198,-10,8,.02],
    ['.base',0,126,0,.012],
    ['.cleaning',0,220,0,.03]
  ].map(([selector,tx,ty,rot,zoom])=>({el:robot.querySelector(selector),tx,ty,rot,zoom}));

  function render(){
    const r = track.getBoundingClientRect();
    const total = track.offsetHeight - innerHeight;
    const raw = clamp((-r.top)/Math.max(1,total));
    const p = smooth(raw);
    const explode = clamp((p-.06)/.70);

    robot.style.setProperty('--stage-scale',(1-explode*.045).toFixed(4));
    robot.style.setProperty('--full-opacity',Math.max(0,1-explode*1.7).toFixed(4));
    robot.style.setProperty('--shadow-opacity',Math.max(.08,.35-explode*.22).toFixed(4));
    robot.style.setProperty('--core-opacity',clamp((explode-.24)*1.7).toFixed(4));
    robot.style.setProperty('--core-scale',(.88+explode*.12).toFixed(4));
    document.documentElement.style.setProperty('--p',raw.toFixed(4));

    for(const part of parts){
      const x=part.tx*explode, y=part.ty*explode, rot=part.rot*explode, scale=1+part.zoom*explode;
      part.el.style.transform=`translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
    }

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