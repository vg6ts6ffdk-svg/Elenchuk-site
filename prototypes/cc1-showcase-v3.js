(() => {
  const track=document.getElementById('track');
  const robot=document.getElementById('robot');
  const top=robot.querySelector('.photo-part.top');
  const front=robot.querySelector('.photo-part.front');
  const rear=robot.querySelector('.rear-panel');
  const frontGhost=robot.querySelector('.front-ghost');
  const core=robot.querySelector('.core');
  const boards=[...robot.querySelectorAll('.board')];
  const turbine=robot.querySelector('.turbine');
  const hose=robot.querySelector('.hose');
  const water=robot.querySelector('.water');
  const drain=robot.querySelector('.drain');
  const wheelL=robot.querySelector('.wheel.left');
  const wheelR=robot.querySelector('.wheel.right');
  const brush=robot.querySelector('.brush-module');
  const annotations=[...document.querySelectorAll('.annotation')];
  const phase=document.getElementById('phase');
  const statusTitle=document.getElementById('statusTitle');
  const statusSub=document.getElementById('statusSub');

  const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
  const smooth=t=>t*t*(3-2*t);
  const seg=(p,a,b)=>smooth(clamp((p-a)/(b-a)));

  function setTransform(el,x,y,r=0,s=1){
    el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})`;
  }

  function render(){
    const rect=track.getBoundingClientRect();
    const total=Math.max(1,track.offsetHeight-innerHeight);
    const p=clamp((-rect.top)/total);
    document.documentElement.style.setProperty('--p',p.toFixed(4));

    const topP=seg(p,.06,.18);
    const rearP=seg(p,.17,.32);
    const frontP=seg(p,.29,.43);
    const coreP=seg(p,.39,.55);
    const serviceP=seg(p,.52,.70);
    const wheelP=seg(p,.73,.87);
    const brushP=seg(p,.86,.98);

    robot.style.setProperty('--scene-scale',(1-.028*seg(p,.18,.76)).toFixed(4));
    robot.style.setProperty('--full-opacity',Math.max(0,1-seg(p,.08,.27)*1.12).toFixed(4));
    robot.style.setProperty('--core-opacity',coreP.toFixed(4));
    robot.style.setProperty('--core-scale',(.91+.09*coreP).toFixed(4));

    setTransform(top,0,-115*topP,-1.2*topP,1+.012*topP);

    rear.style.opacity=(rearP*.96).toFixed(3);
    setTransform(rear,115*rearP,-4*rearP,6.5*rearP,1+.025*rearP);

    front.style.opacity=(.18+.82*frontP).toFixed(3);
    setTransform(front,-145*frontP,2*frontP,-5*frontP,1+.012*frontP);

    frontGhost.style.opacity=(frontP*.72).toFixed(3);
    setTransform(frontGhost,-88*frontP,3*frontP,-3.5*frontP,1+.018*frontP);

    boards.forEach((board,i)=>{
      const spread=(i-2)*13*serviceP;
      setTransform(board,spread,-22*serviceP,(i-2)*.7*serviceP,1+.025*serviceP);
    });
    setTransform(turbine,-34*serviceP,34*serviceP,-5*serviceP,1);
    setTransform(hose,9*serviceP,42*serviceP,7*serviceP,1);
    setTransform(water,38*serviceP,30*serviceP,4*serviceP,1);
    setTransform(drain,50*serviceP,36*serviceP,5*serviceP,1);

    wheelL.style.opacity=wheelP.toFixed(3);
    wheelR.style.opacity=wheelP.toFixed(3);
    setTransform(wheelL,-105*wheelP,84*wheelP,-16*wheelP,1);
    setTransform(wheelR,105*wheelP,84*wheelP,16*wheelP,1);

    brush.style.opacity=brushP.toFixed(3);
    setTransform(brush,0,145*brushP,0,1+.02*brushP);

    annotations[0].classList.toggle('active',p>.09&&p<.48);
    annotations[1].classList.toggle('active',p>.20&&p<.59);
    annotations[2].classList.toggle('active',p>.43&&p<.82);
    annotations[3].classList.toggle('active',p>.72&&p<.995);

    let phaseText='01 / СОБРАН', title='СОБРАН', sub='Сервисный робот PUDU CC1';
    if(p>.08){phaseText='02 / ВЕРХНЯЯ КРЫШКА';title='ОТКРЫВАЕМ КОРПУС';sub='Сначала верхняя крышка';}
    if(p>.20){phaseText='03 / ЗАДНЯЯ ЧАСТЬ';title='ЗАДНЯЯ ЧАСТЬ';sub='Салатовый корпус отходит первым';}
    if(p>.33){phaseText='04 / ПЕРЕДНЯЯ ЧАСТЬ';title='ПЕРЕДНЯЯ ЧАСТЬ';sub='Серая часть корпуса — следом';}
    if(p>.48){phaseText='05 / ВНУТРЕННИЕ УЗЛЫ';title='ВНУТРИ CC1';sub='Баки, платы и сервисные узлы';}
    if(p>.74){phaseText='06 / МОТОР-КОЛЁСА';title='ХОДОВАЯ ЧАСТЬ';sub='Два мотор-колеса — почти в конце';}
    if(p>.88){phaseText='07 / ЩЁТОЧНЫЙ УЗЕЛ';title='ЩЁТОЧНЫЙ УЗЕЛ';sub='Финальный акцент exploded-view';}

    phase.textContent=phaseText;
    statusTitle.textContent=title;
    statusSub.textContent=sub;
  }

  let raf=0;
  const request=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;render()})};
  addEventListener('scroll',request,{passive:true});
  addEventListener('resize',request);
  render();
})();