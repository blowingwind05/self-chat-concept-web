/* Layout and fitting only: app.js and the shared CSS own every animation state. */
(() => {
  "use strict";
  const core=document.getElementById("core-section");
  const canvas=core?.querySelector(".core-canvas");
  const scenes=core?[...core.querySelectorAll(".core-scene")]:[];
  if(!core||!canvas||scenes.length!==4)return;
  const compact=matchMedia("(max-width:760px), (max-height:620px)");
  const chat=core.querySelector(".core-chat");
  let enabled=false,frame=0,destroyed=false;
  const put=(node,key,value)=>{if(node.style.getPropertyValue(key)!==value)node.style.setProperty(key,value);};
  function fit(){
    if(!enabled)return;
    const available=Math.max(1,canvas.clientHeight-44);
    scenes.forEach(scene=>{
      const scale=Math.min(1,available/Math.max(1,scene.offsetHeight));
      put(scene,"--mobile-fit",scale.toFixed(4));
    });
    // The same mini chat occupies the same share of the canvas as on desktop.
    // Its natural phone width is deliberately larger while reading stage one.
    const mini=Math.min(.35,canvas.clientWidth*.16/Math.max(1,chat.offsetWidth));
    put(chat,"--mobile-mini-scale",mini.toFixed(4));
  }
  function update(){
    frame=0;if(destroyed)return;
    const next=compact.matches&&document.documentElement.classList.contains("js-ready")&&!document.body.classList.contains("motion-paused");
    const changed=enabled!==next;enabled=next;
    if(enabled){
      core.dataset.mobileLayout="shared";
      fit();
      const phase=Math.max(0,Math.min(3,Number(core.dataset.stage)||0));
      core.dataset.mobilePhase=String(phase);
      const bounds=canvas.getBoundingClientRect();
      const visible=bounds.bottom>80&&bounds.top<innerHeight-40;
      core.dataset.mobileMotionState=document.hidden?"hidden":visible?"running":"offscreen";
      scenes.forEach((scene,index)=>{
        const shown=index===phase||(index===1&&phase>=2);
        scene.dataset.mobileMotion=shown&&visible&&!document.hidden?"running":"stopped";
        scene.setAttribute("aria-hidden",String(!shown));
      });
    }else{
      delete core.dataset.mobileLayout;
      delete core.dataset.mobilePhase;
      core.dataset.mobileMotionState="inactive";
      scenes.forEach(scene=>{scene.style.removeProperty("--mobile-fit");scene.removeAttribute("aria-hidden");delete scene.dataset.mobileMotion;});
      chat.style.removeProperty("--mobile-mini-scale");
    }
    // app.js recalculates the original scroll stages after the layout switches.
    if(changed)window.dispatchEvent(new Event("resize"));
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  const mutations=new MutationObserver(schedule);
  mutations.observe(core,{attributes:true,attributeFilter:["data-stage"]});
  mutations.observe(document.body,{attributes:true,attributeFilter:["class"]});
  mutations.observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
  const resize=new ResizeObserver(()=>{fit();schedule();});
  resize.observe(canvas);scenes.forEach(scene=>resize.observe(scene));
  compact.addEventListener("change",schedule);
  window.addEventListener("resize",schedule,{passive:true});
  window.addEventListener("scroll",schedule,{passive:true});
  window.addEventListener("pageshow",schedule);
  document.addEventListener("visibilitychange",schedule);
  document.fonts?.ready.then(schedule);
  window.addEventListener("beforeunload",()=>{destroyed=true;mutations.disconnect();resize.disconnect();if(frame)cancelAnimationFrame(frame);},{once:true});
  update();
})();
