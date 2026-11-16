/* Phone-sized motion reuses the original messages and four presentation scenes. */
(() => {
  "use strict";
  const core=document.getElementById("core-section");
  if(!core||!Element.prototype.animate)return;
  const scenes=[...core.querySelectorAll(".core-scene")];
  const purpose=core.querySelector(".core-purpose"), process=core.querySelector(".core-process");
  const canvas=core.querySelector(".core-canvas");
  if(scenes.length!==4||!purpose||!process||!canvas)return;
  const compact=matchMedia("(max-width:760px), (max-height:620px)");
  const pinned=matchMedia("(max-width:760px) and (min-width:360px) and (min-height:740px)");
  const sets=scenes.map(()=>({animations:new Set(),timers:new Set(),running:false,generation:0}));
  const visible=new Set();
  const visibleItems=new Set(),revealedItems=new WeakSet();
  let layout="", frame=0, destroyed=false;
  const ns="http://www.w3.org/2000/svg";
  const entry=document.createElement("div");entry.className="mobile-gather-entry";entry.setAttribute("aria-hidden","true");
  entry.innerHTML='<svg viewBox="0 0 24 24"><use href="#i-message"/></svg><span>给自己发消息</span>';
  purpose.insertBefore(entry,purpose.querySelector(".scene-caption"));
  const flights=document.createElement("div");flights.className="mobile-flight-layer";flights.setAttribute("aria-hidden","true");purpose.appendChild(flights);
  const stream=document.createElementNS(ns,"svg");stream.classList.add("mobile-process-stream");stream.setAttribute("aria-hidden","true");process.appendChild(stream);
  const scan=document.createElement("span");scan.className="mobile-ai-scan";process.querySelector(".ai-node").appendChild(scan);
  const dots=document.createElement("span");dots.className="mobile-processing-dots";dots.setAttribute("aria-hidden","true");dots.innerHTML="<i></i><i></i><i></i>";process.querySelector(".ai-node").appendChild(dots);

  function after(index,fn,delay){
    const group=sets[index],generation=group.generation;
    const id=setTimeout(()=>{group.timers.delete(id);if(group.running&&generation===group.generation)fn();},delay);
    group.timers.add(id);return id;
  }
  function animate(index,node,keys,options){
    const animation=node.animate(keys,options);sets[index].animations.add(animation);
    animation.addEventListener("finish",()=>sets[index].animations.delete(animation),{once:true});
    return animation;
  }
  function stop(index){
    const group=sets[index];group.running=false;group.generation++;
    group.timers.forEach(clearTimeout);group.timers.clear();
    group.animations.forEach(a=>a.cancel());group.animations.clear();
    if(index===0){flights.replaceChildren();purpose.querySelectorAll(".mobile-source-away").forEach(e=>e.classList.remove("mobile-source-away"));}
    if(index===2){stream.replaceChildren();process.querySelectorAll(".mobile-process-packet").forEach(e=>e.remove());}
    if(index===1||index===3)scenes[index].querySelectorAll(index===1?".core-message":".result-item").forEach(e=>revealedItems.delete(e));
    scenes[index].dataset.mobileMotion="stopped";
  }
  function reveal(index,nodes,interval=65){
    nodes.forEach((node,i)=>animate(index,node,[{filter:"opacity(0)",translate:"0 15px"},{filter:"opacity(1)",translate:"0 0"}],
      {duration:290,delay:i*interval,easing:"cubic-bezier(.18,.8,.2,1)",fill:"backwards"}));
  }
  function gather(){
    if(!sets[0].running)return;
    const cards=[...purpose.querySelectorAll(".purpose-item")];
    cards.forEach(e=>e.classList.remove("mobile-source-away"));flights.replaceChildren();
    after(0,()=>{
      const bounds=purpose.getBoundingClientRect(),target=entry.getBoundingClientRect();
      const scale=bounds.width/purpose.offsetWidth||1;
      const end={x:(target.left+target.width*.5-bounds.left)/scale,y:(target.top+target.height*.5-bounds.top)/scale};
      cards.forEach((card,i)=>{
        const r=card.getBoundingClientRect(),x=(r.left-bounds.left)/scale,y=(r.top-bounds.top)/scale;
        const w=r.width/scale,h=r.height/scale;
        const clone=card.cloneNode(true);clone.className="mobile-flying-card";clone.removeAttribute("style");
        clone.style.cssText=`left:${x}px;top:${y}px;width:${w}px;height:${h}px;opacity:0`;
        flights.appendChild(clone);
        after(0,()=>{
          card.classList.add("mobile-source-away");
          const dx=end.x-x-w/2,dy=end.y-y-h/2;
          const a=animate(0,clone,[
            {opacity:1,transform:"translate(0,0) scale(1)",offset:0},
            {opacity:1,transform:`translate(${dx*.6}px,${dy*.55}px) scale(.68)`,offset:.58},
            {opacity:.8,transform:`translate(${dx}px,${dy}px) scale(.16)`,offset:.92},
            {opacity:0,transform:`translate(${dx}px,${dy}px) scale(.08)`,offset:1}],
            {duration:430,easing:"linear",fill:"forwards"});
          a.addEventListener("finish",()=>clone.remove(),{once:true});
          after(0,()=>animate(0,entry,[{boxShadow:"0 0 0 0 #8dac6c35"},{boxShadow:"0 0 0 9px #8dac6c00"}],{duration:300,easing:"ease-out"}),390);
        },i*42);
      });
      after(0,()=>{
        cards.forEach(e=>e.classList.remove("mobile-source-away"));
        reveal(0,cards,25);
        after(0,gather,580);
      },1260);
    },480);
  }
  function relativeCenter(node,bounds,scale){const r=node.getBoundingClientRect();return{x:(r.left+r.width/2-bounds.left)/scale,y:(r.top+r.height/2-bounds.top)/scale};}
  function keyframes(points){
    const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
    const total=lengths.reduce((a,b)=>a+b,0);let distance=0;
    return points.map((p,i)=>{if(i)distance+=lengths[i-1];return{transform:`translate(${p.x}px,${p.y}px)`,opacity:i===0||i===points.length-1?.1:1,offset:total?distance/total:0};});
  }
  function packet(points,delay,duration){
    const dot=document.createElement("i");dot.className="mobile-process-packet";dot.setAttribute("aria-hidden","true");process.appendChild(dot);
    const animation=animate(2,dot,keyframes(points),{duration,delay,easing:"linear",fill:"both"});
    animation.addEventListener("finish",()=>dot.remove(),{once:true});
  }
  function processCycle(){
    if(!sets[2].running)return;
    const bounds=process.getBoundingClientRect(),scale=bounds.width/process.offsetWidth||1;
    const source=relativeCenter(process.querySelector(".original-record"),bounds,scale);
    source.y+=process.querySelector(".original-record").offsetHeight/2;
    const cloud=relativeCenter(process.querySelector(".cloud-node .node-icon"),bounds,scale);
    const ai=relativeCenter(process.querySelector(".ai-node .node-icon"),bounds,scale);
    const first=[source,{x:source.x,y:source.y+17},{x:cloud.x,y:source.y+17},cloud];
    const second=[cloud,{x:cloud.x+24,y:cloud.y},{x:ai.x-24,y:ai.y},ai];
    stream.setAttribute("viewBox",`0 0 ${process.offsetWidth} ${process.offsetHeight}`);stream.replaceChildren();
    for(const points of [first,second]){const path=document.createElementNS(ns,"path");path.setAttribute("d",points.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" "));stream.appendChild(path);}
    for(let i=0;i<3;i++){packet(first,i*110,550);packet(second,610+i*110,480);}
    after(2,processCycle,1750);
  }
  function play(index){
    if(sets[index].running)return;
    sets[index].running=true;scenes[index].dataset.mobileMotion="running";
    if(index===0){reveal(0,[...purpose.querySelectorAll(".purpose-item")],35);gather();}
    if(index===1&&layout==="pinned")reveal(1,[...scenes[1].querySelectorAll(".core-message")],65);
    if(index===2){
      reveal(2,[process.querySelector(".original-record"),...process.querySelectorAll(".process-node")],105);
      animate(2,process.querySelector(".cloud-node .node-icon svg"),[{translate:"0 -3px"},{translate:"0 3px"},{translate:"0 -3px"}],{duration:2000,iterations:Infinity,easing:"ease-in-out"});
      animate(2,process.querySelector(".ai-node .node-icon svg"),[{scale:".93",rotate:"-4deg"},{scale:"1.08",rotate:"4deg"},{scale:".93",rotate:"-4deg"}],{duration:1600,iterations:Infinity,easing:"ease-in-out"});
      animate(2,scan,[{translate:"0 0",opacity:0},{opacity:.6,offset:.25},{translate:"0 100px",opacity:0}],{duration:1300,iterations:Infinity,easing:"linear"});
      [...dots.children].forEach((dot,i)=>animate(2,dot,[{opacity:.15},{opacity:1},{opacity:.15}],{duration:720,delay:i*120,iterations:Infinity}));
      after(2,processCycle,120);
    }
    if(index===3&&layout==="pinned")reveal(3,[...scenes[3].querySelectorAll(".result-item")],65);
  }
  function fitScenes(){
    if(layout!=="pinned")return;
    const maxHeight=canvas.clientHeight-48,maxWidth=canvas.clientWidth-24;
    scenes.forEach(scene=>{
      const fit=Math.min(1,maxHeight/Math.max(1,scene.offsetHeight),maxWidth/Math.max(1,scene.offsetWidth));
      scene.style.setProperty("--mobile-fit",fit.toFixed(4));
    });
  }
  function reconcile(){
    frame=0;if(destroyed)return;
    const next=compact.matches&&!document.body.classList.contains("motion-paused")?(pinned.matches?"pinned":"flow"):"";
    if(next!==layout){
      sets.forEach((_,i)=>stop(i));layout=next;
      if(layout)core.dataset.mobileLayout=layout;else delete core.dataset.mobileLayout;
      scenes.forEach(scene=>scene.style.removeProperty("--mobile-fit"));
      if(layout==="pinned")fitScenes();
    }
    const phase=Math.max(0,Math.min(3,Number(core.dataset.stage)||0));
    core.dataset.mobilePhase=layout==="pinned"?String(phase):"flow";
    const coreBounds=core.getBoundingClientRect();
    const inViewport=coreBounds.bottom>80&&coreBounds.top<innerHeight-40;
    let count=0;
    scenes.forEach((scene,index)=>{
      const active=!!layout&&!document.hidden&&(layout==="pinned"?inViewport&&phase===index:visible.has(scene));
      scene.classList.toggle("mobile-active",layout==="pinned"&&phase===index);
      if(layout==="pinned")scene.setAttribute("aria-hidden",String(phase!==index));else scene.removeAttribute("aria-hidden");
      if(active){play(index);count++;}else if(sets[index].running)stop(index);
    });
    if(layout==="flow"&&!document.hidden){
      for(const index of [1,3]){
        if(!sets[index].running)continue;
        const fresh=[...scenes[index].querySelectorAll(index===1?".core-message":".result-item")].filter(node=>visibleItems.has(node)&&!revealedItems.has(node));
        fresh.forEach(node=>revealedItems.add(node));reveal(index,fresh,index===1?65:55);
      }
    }
    core.dataset.mobileMotionState=!layout?"inactive":document.hidden?"hidden":count?"running":"offscreen";
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(reconcile);}
  const sceneObserver=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting&&e.intersectionRatio>=.12)visible.add(e.target);else visible.delete(e.target);});schedule();},{threshold:[0,.12],rootMargin:"0px 0px -20px 0px"});
  scenes.forEach(scene=>sceneObserver.observe(scene));
  const itemObserver=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting&&e.intersectionRatio>=.15)visibleItems.add(e.target);else if(!e.isIntersecting){visibleItems.delete(e.target);revealedItems.delete(e.target);}});schedule();},{threshold:[0,.15],rootMargin:"0px 0px -18px 0px"});
  core.querySelectorAll(".core-message,.result-item").forEach(node=>itemObserver.observe(node));
  const mutationObserver=new MutationObserver(schedule);mutationObserver.observe(core,{attributes:true,attributeFilter:["data-stage"]});mutationObserver.observe(document.body,{attributes:true,attributeFilter:["class"]});
  const resizeObserver=new ResizeObserver(()=>{fitScenes();schedule();});resizeObserver.observe(canvas);scenes.forEach(scene=>resizeObserver.observe(scene));
  window.addEventListener("scroll",schedule,{passive:true});window.addEventListener("resize",schedule,{passive:true});
  document.addEventListener("visibilitychange",schedule);window.addEventListener("pageshow",schedule);
  compact.addEventListener("change",schedule);pinned.addEventListener("change",schedule);
  document.fonts?.ready.then(()=>{fitScenes();schedule();});
  window.addEventListener("pagehide",()=>sets.forEach((_,i)=>stop(i)));
  window.addEventListener("beforeunload",()=>{destroyed=true;sets.forEach((_,i)=>stop(i));sceneObserver.disconnect();itemObserver.disconnect();mutationObserver.disconnect();resizeObserver.disconnect();if(frame)cancelAnimationFrame(frame);},{once:true});
  reconcile();
})();
