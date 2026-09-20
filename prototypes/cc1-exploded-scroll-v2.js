(() => {
  const track=document.getElementById('track');
  const robot=document.getElementById('robot');
  const phase=document.getElementById('phase');
  const rear=robot.querySelector('.rear');
  const front=robot.querySelector('.front');
  const top=robot.querySelector('.top');
  const brush=robot.querySelector('.brush');
  const core=robot.querySelector('.core');
  const nodes=[...robot.querySelectorAll('.node')];
  const callouts=[...document.querySelectorAll('.callout')];
  const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
  const smooth=t=>t*t*(3-2*t);
  const segment=(p,a,b)=>smooth(clamp((p-a)/(b-a)));

  function render(){
    const r=track.getBoundingClientRect();
    const total=Math.max(1,track.offsetHeight-innerHeight);
    const p=clamp((-r.top)/total);
    document.documentElement.style.setProperty('--p',p.toFixed(4));

    const rearP=segment(p,.08,.25);
    const frontP=segment(p,.22,.40);
    const coreP=segment(p,.34,.52);
    const systemsP=segment(p,.48,.76);
    const brushP=segment(p,.70,.90);

    robot.style.setProperty('--scale',(1-.035*segment(p,.1,.75)).toFixed(4));
    robot.style.setProperty('--full',Math.max(0,1-segment(p,.06,.22)*1.18).toFixed(4));
    robot.style.setProperty('--core',coreP.toFixed(4));
    robot.style.setProperty('--core-scale',(.9+.1*coreP).toFixed(4));

    rear.style.transform=`translate(${(195*rearP).toFixed(1)}px,${(16*rearP).toFixed(1)}px) rotate(${(7*rearP).toFixed(2)}deg)`;
    rear.style.opacity=(.25+.75*rearP).toFixed(3);

    front.style.transform=`translate(${(-180*frontP).toFixed(1)}px,${(-6*frontP).toFixed(1)}px) rotate(${(-6*frontP).toFixed(2)}deg)`;
    front.style.opacity=(.2+.8*frontP).toFixed(3);

    top.style.transform=`translate(0,${(-128*frontP).toFixed(1)}px) rotate(${(-1.5*frontP).toFixed(2)}deg)`;
    top.style.opacity=(.18+.82*frontP).toFixed(3);

    const offsets=[
      [-36,-8,-2],[32,-4,2],[0,26,0],[-54,44,-5],[-18,58,-2],
      [18,56,4],[55,42,4],[70,48,6]
    ];
    nodes.forEach((el,i)=>{
      const [x,y,rot]=offsets[i]||[0,35,0];
      const local=segment(systemsP,Math.min(.55,i*.04),1);
      el.style.transform=`translate(${(x*local).toFixed(1)}px,${(y*local).toFixed(1)}px) rotate(${(rot*local).toFixed(2)}deg)`;
    });

    brush.style.transform=`translate(0,${(210*brushP).toFixed(1)}px) scale(${(1+.02*brushP).toFixed(4)})`;

    callouts[0].classList.toggle('active',p>.12&&p<.92);
    callouts[1].classList.toggle('active',p>.27&&p<.92);
    callouts[2].classList.toggle('active',p>.43&&p<.92);
    callouts[3].classList.toggle('active',p>.62&&p<.96);

    let label='01 · СОБРАН';
    if(p>.10) label='02 · ЗАДНЯЯ ЧАСТЬ КОРПУСА';
    if(p>.27) label='03 · ПЕРЕДНЯЯ ЧАСТЬ КОРПУСА';
    if(p>.45) label='04 · БАКИ И ПЛАТЫ';
    if(p>.62) label='05 · ОСНОВНЫЕ УЗЛЫ';
    if(p>.80) label='06 · ЩЁТОЧНЫЙ УЗЕЛ';
    phase.textContent=label;
  }

  let raf=0;
  const request=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;render()})};
  addEventListener('scroll',request,{passive:true});
  addEventListener('resize',request);
  render();
})();