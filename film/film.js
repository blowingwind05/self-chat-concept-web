(() => {
  "use strict";
  const canvas = document.getElementById("film-canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const screen = document.getElementById("film-screen");
  const PHOTO_SOURCE = "assets/reference-architecture.png";
  const photo = new Image();
  photo.src = PHOTO_SOURCE;
  const C = {paper:"#f3f3ed",ink:"#23372c",green:"#1c523b",muted:"#718367",line:"#ccd6bf",pale:"#e6eddc",lime:"#cfe397",dark:"#1e3d2d",white:"#f7faee"};
  const FONT = '"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
  let W=1600, H=900, portrait=false, lastTime=2.1, pixelWidth=0, pixelHeight=0;
  let activeScene=null,motionLocalTime=0,pageChange=null;
  const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
  const lerp=(a,b,p)=>a+(b-a)*p;
  const ease=x=>1-Math.pow(1-clamp(x),3);
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
  const enter=(t,delay=0,duration=.9)=>ease((t-delay)/duration);
  const pathCache={};
  const paths={
    chat:"M20 11.5a8 8 0 0 1-8.5 8H8l-5 2 1.5-5A8.5 8.5 0 1 1 20 11.5ZM8 9h7M8 13h4",
    light:"M9 18h6m-5 4h4m-4-4a6 6 0 0 0-2-4 6 6 0 1 1 8 0 6 6 0 0 0-2 4",
    book:"M12 6v15M3 4c3-1 6 0 9 2 3-2 6-3 9-2v15c-3-1-6 0-9 2-3-2-6-3-9-2Z",
    file:"M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8m-8 4h5",
    image:"M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM3 18l6-6 4 4 3-3 5 5M9.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 1 1 3 0",
    film:"M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM7 3v18M17 3v18M3 8h4m-4 8h4M17 8h4m-4 8h4",
    list:"M3 6l2 2 3-4m3 2h10M3 13h4m4 0h10M3 20h4m4 0h10",
    history:"M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2",
    link:"M10 14l4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1",
    folder:"M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3 9h18",
    cloud:"M6 18a4.5 4.5 0 0 1-.5-9 6.5 6.5 0 0 1 12.5-1A5 5 0 0 1 18 18Z",
    spark:"M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4",
    search:"M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 1 1 13 0ZM16 16l5 5",
    server:"M5 3h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM5 13h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2ZM7 7h.1M7 17h.1M11 7h6m-6 10h6",
    arrow:"M4 12h16m-6-6 6 6-6 6",
    check:"M5 12l4 4L19 6",
    shield:"M12 2l8 3v7c0 6-8 10-8 10S4 18 4 12V5ZM8 12l3 3 5-6"
  };
  function font(size,weight=400,family=FONT){ctx.font=weight+" "+size+"px "+family}
  function text(value,x,y,size=24,color=C.ink,weight=400,align="left",family=FONT){
    font(size,weight,family);ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline="top";ctx.fillText(value,x,y);
  }
  // Center the visible glyph bounds, not the font's em box or top baseline.
  function centeredLabel(value,cx,cy,size,color,weight=400,family="Consolas,monospace"){
    const previousFill=ctx.fillStyle;
    ctx.save();
    ctx.font=weight+" "+size+"px "+family;
    ctx.fillStyle=color;
    ctx.textAlign="left";
    ctx.textBaseline="alphabetic";
    const content=String(value),metrics=ctx.measureText(content);
    const left=metrics.actualBoundingBoxLeft,right=metrics.actualBoundingBoxRight;
    const ascent=metrics.actualBoundingBoxAscent,descent=metrics.actualBoundingBoxDescent;
    if([left,right,ascent,descent].every(Number.isFinite)&&right+left>0&&ascent+descent>0){
      ctx.fillText(content,cx+(left-right)/2,cy+(ascent-descent)/2);
    }else{
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText(content,cx,cy);
    }
    ctx.restore();
    // Some offline Canvas bindings cache the fillStyle getter independently of
    // their saved state; keep that property consistent with the restored paint.
    if(ctx.fillStyle!==previousFill)ctx.fillStyle=previousFill;
  }

  function lines(values,x,y,size=24,color=C.ink,weight=400,lineHeight=1.55,align="left"){
    values.forEach((v,i)=>text(v,x,y+i*size*lineHeight,size,color,weight,align));
  }
  function paragraph(value,x,y,maxWidth,size=24,color=C.muted,lineHeight=1.8,weight=400){
    font(size,weight);let line="",row=0;
    for(const char of value){if(char==="\n"||(ctx.measureText(line+char).width>maxWidth&&line)){text(line,x,y+row*size*lineHeight,size,color,weight);row++;line=char==="\n"?"":char}else line+=char}
    if(line)text(line,x,y+row*size*lineHeight,size,color,weight);
    return (row+1)*size*lineHeight;
  }
  function rr(x,y,w,h,r=15,fill=C.white,stroke=null,lw=1){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}
  }
  function line(x1,y1,x2,y2,color=C.line,lw=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.stroke()}
  function circle(x,y,r,fill=null,stroke=null,lw=1){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
  function icon(name,x,y,size=34,color=C.green,lw=1.6){
    if(!paths[name])return;pathCache[name]??=new Path2D(paths[name]);
    ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke(pathCache[name]);ctx.restore();
  }
  function group(alpha,dx,dy,draw,scale=1,cx=0,cy=0,rotation=0){
    if(alpha<=0)return;ctx.save();ctx.globalAlpha*=clamp(alpha);ctx.translate(dx,dy);ctx.translate(cx,cy);ctx.rotate(rotation);ctx.scale(scale,scale);ctx.translate(-cx,-cy);draw();ctx.restore();
  }
  function pagePart(kind,index,draw){
    if(!pageChange){draw();return}
    if(kind==="header")return;
    const incoming=pageChange.mode==="in";
    const delay=incoming
      ? {title:.18,description:.26,card:.235+index*.07,footer:.33}[kind]
      : {title:0,description:0,card:.025+index*.07,footer:.08}[kind];
    const progress=clamp((pageChange.time-delay)/(incoming?.22:.18));
    if(incoming?progress<=0:progress>=1)return;
    let box;
    if(kind==="card")box=incoming
      ? {x:131+(index%3)*454,y:340+Math.floor(index/3)*150,w:430,h:126}
      : {x:167.5+(index%3)*430,y:310+Math.floor(index/3)*182,w:405,h:157};
    else box={title:{x:95,y:147,w:1410,h:105},description:{x:105,y:249,w:1390,h:58},footer:{x:95,y:710,w:1410,h:140}}[kind];
    const padding=kind==="card"?11:0,distance=box.h+padding*2;
    ctx.save();ctx.beginPath();ctx.rect(box.x-padding,box.y-padding,box.w+padding*2,box.h+padding*2);ctx.clip();
    group(1,0,incoming?distance*(1-ease(progress)):-distance*ease(progress),draw);
    ctx.restore();
  }
  function cardEnter(t,delay,draw,dx=0,dy=18,duration=.26){
    if(t<=delay)return;
    const p=enter(t,delay,duration);
    group(Math.min(1,p*2),(1-p)*dx,(1-p)*dy,draw);
  }
  function reveal(t,delay,draw,dy=32,duration=.9){
    const p=delay<=.15?1:enter(t,delay,duration);group(p,0,(1-p)*dy,draw);
  }
  function photoCrop(x,y,w,h,r=12){
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();
    if(photo.complete&&photo.naturalWidth){const sw=photo.naturalWidth,sh=photo.naturalHeight;const scale=Math.max(w/sw,h/sh);ctx.drawImage(photo,x+(w-sw*scale)/2,y+(h-sh*scale)/2,sw*scale,sh*scale)}
    else{ctx.fillStyle="#8d9585";ctx.fillRect(x,y,w,h)}
    ctx.restore();
  }
  function shadow(draw,color="#203a2620",blur=40,dy=18){ctx.save();ctx.shadowColor=color;ctx.shadowBlur=blur;ctx.shadowOffsetY=dy;draw();ctx.restore()}
  function background(dark,t=0){
    if(pageChange)return;
    ctx.fillStyle=dark?C.dark:C.paper;ctx.fillRect(0,0,W,H);
    const grad=ctx.createRadialGradient(W*.85,H*.25,0,W*.6,H*.5,W*.7);
    grad.addColorStop(0,dark?"#3e604b55":"#dbe6ce65");grad.addColorStop(1,dark?"#1e3d2d00":"#f3f3ed00");
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=dark?.12:.15;ctx.fillStyle=dark?"#a5c08b":"#a4b494";
    for(let x=portrait?30:44;x<W;x+=38)for(let y=35;y<H;y+=38)if(x>W*.44||y>H*.72)ctx.fillRect(x,y,1.1,1.1);
    ctx.restore();
  }
  function head(index,label,dark=false){
    const m=portrait?60:70,fg=dark?"#b5c99c":"#6e825e",fs=portrait?17:14;
    text("一个只和自己聊天的 App",m,portrait?48:42,fs,fg);
    text(String(scenes.indexOf(activeScene)+1).padStart(2,"0")+" / "+String(scenes.length).padStart(2,"0"),W-m,portrait?48:42,fs,dark?"#739269":"#9baa8a",400,"right","Consolas,monospace");
    line(m,portrait?90:78,W-m,portrait?90:78,dark?"#4a6341":"#d3dcc8");
    if(label)text(label,m,portrait?119:108,portrait?17:14,fg);
  }
  function subtitle(values,dark=false){
    if(typeof values==="string")values=[values];
    const size=portrait?25:22;
    lines(values,W/2,H-(portrait?115:90),size,dark?"#c2d2ad":"#6f825d",400,1.65,"center");
  }
  function dotLine(points,progress,color="#9bb981",width=1.8){
    const seg=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));let remaining=seg.reduce((a,b)=>a+b,0)*clamp(progress);
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...points[0]);
    for(let i=0;i<seg.length;i++){const p=clamp(remaining/seg[i]);ctx.lineTo(lerp(points[i][0],points[i+1][0],p),lerp(points[i][1],points[i+1][1],p));remaining-=seg[i];if(remaining<=0)break}ctx.stroke();
  }
  function packet(points,t,color=C.lime){
    const seg=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));let dist=(t%1)*seg.reduce((a,b)=>a+b,0);
    for(let i=0;i<seg.length;i++){if(dist<=seg[i]){const p=dist/seg[i];circle(lerp(points[i][0],points[i+1][0],p),lerp(points[i][1],points[i+1][1],p),3.5,color);break}dist-=seg[i]}
  }
  function pathPoint(points,progress){
    const segments=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
    let remaining=clamp(progress)*segments.reduce((sum,length)=>sum+length,0);
    for(let i=0;i<segments.length;i++){
      if(remaining<=segments[i]){
        const p=segments[i]?remaining/segments[i]:1;
        return {x:lerp(points[i][0],points[i+1][0],p),y:lerp(points[i][1],points[i+1][1],p)};
      }
      remaining-=segments[i];
    }
    const last=points[points.length-1];return {x:last[0],y:last[1]};
  }
  // Content timing may skip ahead to shorten a hold. Moving transfers use the
  // real playhead instead, so that edit never changes their velocity mid-path.
  function editedTimeAt(source){
    const points=activeScene.sourceTimes;
    for(let i=1;i<points.length;i++){
      const before=points[i-1],after=points[i];
      if(source<=after[1])return lerp(before[0],after[0],clamp((source-before[1])/(after[1]-before[1])));
    }
    return points[points.length-1][0];
  }
  function transferPhase(sourceStart,cyclesPerSecond,offset=0){
    return Math.max(0,motionLocalTime-editedTimeAt(sourceStart))*cyclesPerSecond+offset;
  }
  function transferProgress(sourceStart,duration){
    const start=editedTimeAt(sourceStart),end=editedTimeAt(sourceStart+duration);
    return clamp((motionLocalTime-start)/(end-start));
  }
  function smallCard(x,y,w,h,type,title,detail="",rotation=0,t=0){
    group(1,0,Math.sin(t*.65+x*.01)*4,()=>{
      shadow(()=>rr(x,y,w,h,16,C.white,"#d9e2cd"));
      rr(x+20,y+22,42,45,10,C.pale);icon(type,x+28,y+31,26,"#6d8b54");
      text(title,x+80,y+24,22,C.ink,500);
      if(detail)text(detail,x+80,y+58,15,"#8b9b7b");
    },1,x+w/2,y+h/2,rotation);
  }
  function miniChat(x,y,w,h,t=0,dark=false){
    shadow(()=>rr(x,y,w,h,18,C.white,"#d6e0c8"),"#0d241d25",35,20);
    rr(x+18,y+18,34,34,10,C.pale);icon("chat",x+24,y+24,22);
    text("给自己发消息",x+65,y+20,18,C.ink,500);text("我的聊天记录",x+65,y+46,11,"#94a183");
    line(x+15,y+72,x+w-15,y+72,"#e1e7d8");
    let yy=y+94;
    ["想看《布达佩斯大饭店》","明早给老师发邮件"].forEach((s,i)=>{const bw=Math.min(w-46,i?175:230);rr(x+w-bw-20,yy,bw,36,9,C.pale);text(s,x+w-bw-7,yy+10,i?12:11,"#4e6b3c");yy+=49});
    const ph=Math.min(h*.27,150),pw=ph*1.16;photoCrop(x+w-pw-24,yy,pw,ph,7);yy+=ph+14;
    if(yy+35<y+h-50){rr(x+w-220,yy,200,33,9,C.pale);text("今天终于把实验跑通了",x+w-208,yy+10,11,"#4e6b3c")}
    rr(x+15,y+h-42,w-30,27,7,"#edf2e6");text("给自己发消息…",x+26,y+h-36,10,"#9ba98e");
  }

  const purposes=[["light","灵感创意"],["book","学习工作"],["file","文案与稿件"],["image","审美积累"],["film","书影音清单"],["history","生活回顾"],["list","待办与日程"],["link","网页收藏"],["folder","文件传输"]];
  const results=[["film","书单影单番单"],["list","待办与提醒"],["image","审美素材库"],["book","学习与笔记"],["history","生活回顾"],["search","智能检索"]];
  const CHAT_ITEMS=[
    {text:"想看《布达佩斯大饭店》",h:34,w:300},
    {text:"明早给老师发邮件",h:34,w:236},
    {lines:["各位老师好，我今天汇报的题目是……","首先介绍一下课题的研究背景……"],h:55,w:435},
    {file:"讲稿_v3.pdf",detail:"PDF · 1.8 MB",h:48,w:228,type:"file"},
    {photo:true,h:104,w:174},
    {text:"想补《冰菓》",h:34,w:182},
    {word:true,h:48,w:350},
    {text:"今天终于把实验跑通了",h:34,w:280},
    {file:"project-files.zip",detail:"128 MB",h:48,w:256,type:"folder"}
  ];
  const CHAT_SOURCE_ORDER=[2,5,8,1,4,7,0,3,6];
  // Both shots use these same slots. The body scales with the window; revealing
  // the actual message contents never moves or resizes a bubble afterward.
  function chatSlots(x,y,w,h=720,pad=22,header=77){
    const bodyTop=y+header+13,bodyHeight=h-header-72;
    const sx=(w-pad*2)/536,sy=bodyHeight/571;
    let offset=5;
    return CHAT_ITEMS.map((item,index)=>{
      const slot={x:x+w-pad-item.w*sx,y:bodyTop+offset*sy,
        w:item.w*sx,h:item.h*sy,sx,sy,r:10*Math.min(sx,sy),index};
      offset+=item.h+8;return slot;
    });
  }
  function chatBubbleFrame(slot){rr(slot.x,slot.y,slot.w,slot.h,slot.r,"#e6eedc")}
  function chatPlaceholder(slot,purpose){
    const {x,y,w,h,sx,sy}=slot,is=22*Math.min(sx,sy);
    icon(purposes[purpose][0],x+10*sx,y+(h-is)/2,is,"#7c9b61");
    rr(x+44*sx,y+h*.34,w*.47,3.5*sy,2*sy,"#b4c79f");
    rr(x+44*sx,y+h*.62,w*.29,3.5*sy,2*sy,"#c8d6b8");
  }
  function chatContent(slot){
    const m=CHAT_ITEMS[slot.index];
    ctx.save();ctx.translate(slot.x,slot.y);ctx.scale(slot.sx,slot.sy);
    ctx.beginPath();ctx.roundRect(0,0,m.w,m.h,10);ctx.clip();
    if(m.photo)photoCrop(4,4,m.w-8,m.h-8,7);
    else if(m.file){
      icon(m.type,12,10,26,"#7f9a65");text(m.file,50,6,17,C.ink,500);text(m.detail,50,28,11,"#8c9e77");
    }else if(m.word){
      text("serendipity",13,6,22,C.ink,400,"left","Georgia,serif");
      text("偶然发现美好事物的机缘",13,30,11,"#788e63");
    }else if(m.lines)lines(m.lines,13,7,15,"#4d663d",400,1.5);
    else text(m.text,13,8,17,"#4d663d");
    ctx.restore();
  }
  function sceneTitle(t){
    background(false,t);head(0,"一段关于记录、保存与整理的设想");
    const x=portrait?65:115, y=portrait?205:240, fs=portrait?71:84;
    reveal(t,.1,()=>{rr(x,y-66,44,44,13,C.green);icon("chat",x+9,y-57,26,C.white);text("一个项目设想",x+60,y-56,21,"#6b8259",400)});
    reveal(t,.45,()=>lines(["一个只和自己","聊天的 App。"],x,y,fs,C.ink,600,1.35),70,1.1);
    reveal(t,1.4,()=>lines(portrait?["一个纯粹而且足够好用的","「文件传输助手」。"]:["一个纯粹而且足够好用的「文件传输助手」。"],x,y+fs*2.95,portrait?26:25,"#7a896d",400,1.75));
    const mx=portrait?365:1115,my=portrait?685:400,mw=portrait?310:350,mh=portrait?350:485;
    const p=enter(t,.9,1.4);
    group(p,0,(1-p)*70,()=>{
      ctx.save();ctx.strokeStyle="#d0dcc2";ctx.lineWidth=1;
      for(const r of [235,305]){ctx.beginPath();ctx.ellipse(mx+mw/2,my+mh/2,r,r*.9,-.22,0,Math.PI*2);ctx.stroke()}ctx.restore();
      group(1,0,0,()=>miniChat(mx-mw/2,my-75,mw,mh,t),1,mx,my+100,-.06+Math.sin(t*.25)*.012);
      if(portrait){smallCard(100,780,340,100,"file","讲稿_v3.pdf","PDF · 1.8 MB",-.08,t)}
      else{smallCard(1200,295,315,105,"file","讲稿_v3.pdf","PDF · 1.8 MB",.07,t);group(1,0,0,()=>{shadow(()=>rr(815,610,290,118,15,C.white,"#d9e2cd"));text("随手记下的单词",838,629,12,"#9aa58a");text("serendipity",838,654,39,C.ink,400,"left","Georgia,serif");text("偶然发现美好事物的机缘",838,701,12,"#8c9d77")},1,960,668,-.07)}
    });
  }
  function storyPanel(title,t){
    shadow(()=>rr(840,205,650,515,20,C.white,"#d3dfc7"),"#23472e12",30,15);
    rr(864,229,42,42,12,C.pale);icon("chat",873,238,24);
    text(title,922,233,25,C.green,500);
    text("原案示例",1459,242,14,"#96a785",400,"right");
    line(865,292,1464,292,"#e0e7d7");
  }

  function clipSwap(t,starts,box,draw,axis="cut",span=.5,lead=0){
    const clipDraw=(index,q,dx=0,dy=0)=>{
      ctx.save();ctx.beginPath();ctx.rect(box.x,box.y,box.w,box.h);ctx.clip();
      ctx.translate(dx,dy);draw(index,Math.max(0,q));ctx.restore();
    };
    if(axis==="cut"){
      let active=0;for(let i=1;i<starts.length;i++)if(t>=starts[i])active=i;
      clipDraw(active,t-starts[active]+(active>0?lead:0));return;
    }
    for(let index=1;index<starts.length;index++){
      const cut=starts[index];
      if(t>=cut-span/2&&t<cut+span/2){
        const p=smooth((t-cut+span/2)/span),distance=axis==="x"?box.w:box.h;
        clipDraw(index-1,t-starts[index-1]+(index>1?lead:0),axis==="x"?-p*distance:0,axis==="y"?-p*distance:0);
        clipDraw(index,t-cut+lead,axis==="x"?(1-p)*distance:0,axis==="y"?(1-p)*distance:0);
        return;
      }
    }
    let active=0;for(let i=1;i<starts.length;i++)if(t>=starts[i])active=i;
    clipDraw(active,t-starts[active]+(active>0?lead:0));
  }

  function slideReveal(t,delay,draw,dx=32,dy=0,duration=.55){
    if(t<delay)return;
    const p=enter(t,delay,duration);
    group(1,(1-p)*dx,(1-p)*dy,draw);
  }

  function storyContents(beat,q){
    if(beat===0){
      slideReveal(q,.8,()=>{rr(940,330,475,110,14,C.pale);icon("file",964,359,38,"#75975b");text("讲稿_v3.pdf",1024,351,30,C.ink,500);text("PDF · 1.8 MB",1026,397,18,"#8b9f77")});
      slideReveal(q,2.2,()=>{rr(915,483,500,110,14,C.pale);icon("folder",941,513,38,"#75975b");text("project-files.zip",1002,505,29,C.ink,500);text("128 MB",1004,550,18,"#8b9f77")});
      text("在不同设备之间传递文字和文件",1165,652,22,"#849c6e",400,"center");
    }else if(beat===1){
      storyBubble("明早给老师发邮件",1020,342,395,"待办与日程",q,.3);
      storyBubble("今天终于把实验跑通了",942,485,473,"学习工作中的记录",q,1);
      text("灵感 · 学习工作 · 生活中要记住的事",1165,652,20,"#849c6e",400,"center");
    }else{
      slideReveal(q,.3,()=>{
        rr(888,325,563,187,15,C.pale);text("汇报稿",912,346,17,"#94a47f");
        lines(["各位老师好，我今天汇报的题目是……","首先介绍一下课题的研究背景……"],912,388,24,"#5c754c",400,1.8);
      });
      slideReveal(q,1,()=>{rr(1031,541,420,116,14,C.pale);text("serendipity",1055,557,33,C.green,400,"left","Georgia,serif");text("偶然发现美好事物的机缘",1057,613,21,"#7b9664")});
      text("像发消息一样写、读和回看",1165,682,20,"#849c6e",400,"center");
    }
  }

  function storyBubble(value,x,y,w,kind,t,delay=0){
    slideReveal(t,delay,()=>{
      rr(x,y,w,87,13,C.pale);text(value,x+20,y+18,27,C.ink,500);
      if(kind)text(kind,x+21,y+58,16,"#839a6b");
    },42,0);
  }

  function secureIdentity(x,y,w,h){
    rr(x,y,w,h,18,"#2e513b","#6e8d59");
    circle(x+62,y+49,17,null,"#c6dda6",2);
    ctx.beginPath();ctx.arc(x+62,y+96,27,Math.PI,0);ctx.strokeStyle="#c6dda6";ctx.lineWidth=2;ctx.stroke();
    text("账号身份",x+111,y+39,29,"#dbe9cb",500);
    text("身份验证",x+113,y+81,18,"#93b479");
  }

  function secureFocusList(items,active,y){
    items.forEach((item,i)=>{
      const fg=i===active?"#e3efd3":"#729569";
      text(String(i+1).padStart(2,"0"),114,y+i*73,19,i===active?"#afcc8a":"#55794a",400,"left","Consolas,monospace");
      text(item,159,y-3+i*73,30,fg,i===active?500:400);
      if(i===active)line(115,y+44+i*73,156,y+44+i*73,"#b1cf88",2);
    });
  }

  function sceneOrigin(t){
    background(false,t);head(1,"我和文件传输助手的故事");
    // These anchors never restart when a story beat changes.
    lines(["不知道你有没有","这样的习惯。"],110,205,64,C.ink,600,1.4);
    storyPanel("",t);
    const cuts=[0,8.5,17.5];
    const scripts=[
      ["我经常用微信的文件传输助手，","或者给自己的 QQ 账号发消息，","在不同设备之间传递文字和文件。"],
      ["突然想到的灵感、学习工作中的记录，","生活中需要记住的事情，都会发进去，","当成备忘录、日程提醒或者 To-do List。"],
      ["偶尔会在里面写文案、看面试和汇报稿，","甚至顺手记下不认识的单词。"]
    ];
    const titles=["文件传输助手 / 给自己发消息","随手留下的记录","文案和讲稿，直接发成消息"];
    clipSwap(t,cuts,{x:108,y:487,w:700,h:145},i=>lines(scripts[i],114,499,26,C.muted,400,1.8));
    clipSwap(t,cuts,{x:109,y:677,w:650,h:39},i=>text(["文字与文件","备忘与记录","稿件与单词"][i],114,685,21,"#8ba171"));
    clipSwap(t,cuts,{x:919,y:228,w:475,h:49},i=>text(titles[i],922,233,25,C.green,500));
    clipSwap(t,cuts,{x:856,y:307,w:618,h:404},storyContents,"x",.55,1.9);
  }

  function deviceScreenContent(x, y, w, h, accent = false) {
    const inset = Math.max(3, Math.min(w, h) * .055);
    const sidebar = w * .22;
    const tint = accent ? "#c8d9b6" : "#d8e4cc";
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    rr(x, y, w, h, Math.max(2, inset * .7), "#edf2e7");
    rr(x, y, sidebar, h, 0, "#e0e9d5");
    for (let i = 0; i < 3; i++) {
      rr(x + inset, y + inset * (1.4 + i * 2.3), sidebar - inset * 2,
        Math.max(2, inset * .55), 1.5, "#b8cba5");
    }
    const conversationX = x + sidebar + inset;
    const conversationW = w - sidebar - inset * 2;
    const bubbleH = Math.max(4, h * .12);
    const gap = h * .09;
    [ .84, .66, .77 ].forEach((fraction, i) => {
      const bw = conversationW * fraction;
      rr(x + w - inset - bw, y + inset * 1.4 + i * (bubbleH + gap),
        bw, bubbleH, Math.max(2, bubbleH * .28), tint);
    });
    rr(conversationX, y + h - inset * 1.5 - bubbleH * .65,
      conversationW, bubbleH * .65, Math.max(2, bubbleH * .2), "#dfe8d5");
    ctx.restore();
  }

  function deviceCloudNode(x, y, w, h, title, detail) {
    shadow(() => rr(x, y, w, h, 19, "#f8fbf1", "#c7d8b7"),
      "#2a4f2510", 25, 10);
    rr(x + 22, y + 25, 61, 61, 17, "#e0ebd2");
    icon("cloud", x + 34, y + 37, 37, "#608b46");
    text(title, x + 108, y + 24, 30, C.ink, 500);
    text(detail, x + 109, y + 70, 19, "#7a9067");
  }

  function deviceIndependentLink(points, t, delay, finishAt = 5.25) {
    // Each path has one cloud port and one client. There is no client-to-client
    // segment and no shared horizontal bus that can look like device chaining.
    const p = enter(t, delay, 1.15);
    dotLine(points, p, "#9eb98a", 1.7);
    const start=editedTimeAt(delay+1.3);
    if (motionLocalTime >= start) {
      const progress=clamp((motionLocalTime-start)/(finishAt-start));
      const point=pathPoint(points.slice().reverse(),progress);
      circle(point.x,point.y,3.5,"#739c55");
      if(progress===1){
        const settled=clamp((motionLocalTime-finishAt)/.32);
        group(1-settled,0,0,()=>circle(point.x,point.y,4+settled*8,null,"#8caa70",1.2));
      }
    }
  }

  function drawDevice(x, y, w, h, name, type = "desktop", accent = false) {
    // w × h is an allocation, including an optional platform label. Screens keep
    // their proportions; shrinking the allocation never stretches a device.
    const labelSpace = name ? 36 : 0;
    const availableH = Math.max(24, h - labelSpace);
    const frame = accent ? "#9db88b" : "#b8cba8";
    const body = accent ? "#e3ecd6" : "#f8faf2";
    const cx = x + w / 2;
    let actualW, actualH;

    if (type === "phone") {
      // The complete phone body is 9:18, not a tall screen inside a wide frame.
      actualW = Math.min(w * .46, availableH / 2);
      actualH = actualW * 2;
      const left = cx - actualW / 2;
      const radius = actualW * .15;
      rr(left, y, actualW, actualH, radius, body, frame, 1.8);
      const bezel = Math.max(4, actualW * .065);
      const top = Math.max(11, actualH * .105);
      deviceScreenContent(left + bezel, y + top, actualW - bezel * 2,
        actualH - top - bezel * 1.8, accent);
      rr(cx - actualW * .16, y + actualH * .043, actualW * .32,
        Math.max(2.5, actualW * .035), 2, "#a5ba92");
    } else if (type === "web" || type === "browser") {
      // A browser window has its own chrome and a 16:10 outer ratio.
      actualW = Math.min(w, availableH * 1.6);
      actualH = actualW / 1.6;
      const left = cx - actualW / 2;
      const bar = Math.max(15, actualH * .18);
      rr(left, y, actualW, actualH, 9, body, frame, 1.8);
      rr(left + 1, y + 1, actualW - 2, bar, [8, 8, 0, 0], "#dfe8d4");
      for (let i = 0; i < 3; i++) {
        circle(left + 9 + i * 7, y + bar / 2, 1.8, "#a4b98f");
      }
      rr(left + actualW * .27, y + bar * .28, actualW * .59,
        bar * .4, 3, "#f2f6e9");
      const inset = Math.max(5, actualW * .028);
      deviceScreenContent(left + inset, y + bar + inset,
        actualW - inset * 2, actualH - bar - inset * 2, accent);
    } else if (type === "laptop") {
      // The display is 16:10; the keyboard base adds only a shallow strip.
      actualW = Math.min(w / 1.06, availableH / .7);
      const screenH = actualW / 1.6;
      const baseH = actualW * .055;
      actualH = screenH + baseH;
      const left = cx - actualW / 2;
      rr(left, y, actualW, screenH, actualW * .035, body, frame, 1.8);
      const bezel = Math.max(6, actualW * .035);
      deviceScreenContent(left + bezel, y + bezel,
        actualW - bezel * 2, screenH - bezel * 2, accent);
      ctx.beginPath();
      ctx.moveTo(left - actualW * .03, y + screenH - 1);
      ctx.lineTo(left + actualW * 1.03, y + screenH - 1);
      ctx.lineTo(left + actualW * .985, y + screenH + baseH);
      ctx.lineTo(left + actualW * .015, y + screenH + baseH);
      ctx.closePath();
      ctx.fillStyle = "#c4d4b5";
      ctx.fill();
      rr(cx - actualW * .105, y + screenH + 1,
        actualW * .21, Math.max(2, baseH * .28), 2, "#9eb68a");
    } else {
      // A desktop display is 16:10, with a short stand outside the screen.
      actualW = Math.min(w, availableH / .738);
      const screenH = actualW / 1.6;
      const neckH = actualW * .095;
      const baseH = actualW * .018;
      actualH = screenH + neckH + baseH;
      const left = cx - actualW / 2;
      rr(left, y, actualW, screenH, actualW * .035, body, frame, 1.8);
      const bezel = Math.max(6, actualW * .035);
      deviceScreenContent(left + bezel, y + bezel,
        actualW - bezel * 2, screenH - bezel * 2, accent);
      rr(cx - actualW * .035, y + screenH, actualW * .07,
        neckH, 1, "#b0c59a");
      rr(cx - actualW * .22, y + screenH + neckH,
        actualW * .44, Math.max(3, baseH), 2, "#9fb78b");
    }

    if (name) {
      text(name, cx, y + availableH + 11, 22, "#657f53", 400, "center");
    }
    return { cx, top: y, width: actualW, height: actualH };
  }

  function loginState(t){
    const step=Math.min(8,Math.max(0,t-.5)/.78),phase=step%4;
    return {current:[0,1,2,1][Math.floor(step+1e-9)%4],cx:918+218*(phase<=2?phase:4-phase)};
  }
  function sceneFriction(t){
    background(false,t);head(3,"为什么想自己做一个 / 现有方案的不便");
    const q=t-7;
    if(t<7){
      lines(["多台电脑来回切换，","记录也未必能一直留下。"],110,188,53,C.ink,600,1.4);
      lines(["我常在 Mac、Windows 和 Linux 之间传文件。","用微信、QQ 时，同一个账号","只能同时登录一台电脑，只好来回切换。"],114,400,25,C.muted,400,1.8);
      lines(["微信要自己保留、备份和迁移本地记录；","QQ 的云端漫游，也有期限和内容范围。"],114,549,23,C.muted,400,1.9);
      text("即使是飞书，免费版也只能查看最近 18 个月的记录。",114,699,18,"#8b9b7b");
      const names=["macOS","Windows","Linux"],centres=[918,1136,1354];
      const {current,cx:sliderX}=loginState(t);
      text("微信 / QQ · 同一账号，电脑端仅一台在线",1136,247,21,C.green,500,"center");
      centres.forEach((cx,i)=>cardEnter(t,.05+i*.08,()=>{
        drawDevice(cx-92,306,184,171,names[i],i===0?"laptop":"desktop",i===current);
        rr(cx-76,513,152,43,10,i===current?C.green:"#e6ecdd");
        text(i===current?"当前登录":"已下线",cx,524,18,i===current?"#edf5df":"#8a9d79",400,"center");
      }));
      line(918,601,1354,601,"#cbd8bd",1.5);
      circle(sliderX,601,5,"#668e4e");
      text("本地留存 · 备份迁移 · 漫游期限",1136,657,22,C.green,500,"center");
    }else{
      lines(["想到什么就想发条消息，","不想先建文档、再分类。"],110,188,53,C.ink,600,1.4);
      paragraph("我本来就比较懒。想到什么直接发条消息，总比打开笔记软件、新建文档、考虑怎么分类方便得多。",114,410,630,26,C.muted,1.85);
      // A single editorial illustration: one sentence inside a new document,
      // with the choice of a folder interrupting the otherwise simple action.
      cardEnter(q,0,()=>{
      shadow(()=>rr(840,223,646,491,18,"#fafbf6","#d1dbc7"),"#25452314",32,16);
      rr(841,224,644,48,[17,17,0,0],"#edf1e6");
      for(let i=0;i<3;i++)circle(863+i*12,248,3,"#bac8ae");
      text("笔记软件 / 新建文档",1163,238,18,"#8b9b7a",400,"center");
      rr(841,273,154,440,[0,0,0,17],"#eff3e9");
      text("我的笔记",864,304,20,C.green,500);
      ["设计","摄影","未分类"].forEach((label,i)=>{
        if(i===2)rr(851,460,134,42,8,"#e2ead8");
        icon("folder",865,363+i*54,20,"#95aa81");text(label,898,362+i*54,18,"#82946f");
      });
      text("未命名文档",1033,320,32,C.ink,500);
      line(1033,381,1446,381,"#e0e7d8");
      reveal(q,.24,()=>lines(["海报试试只用黑白，","让标题沿楼梯的方向排。"],1034,411,24,C.ink,400,1.65),0,.18);
      group(1-smooth((q-.9)/.2),0,0,()=>line(1303,450,1303,479,"#7a985c",2));
      reveal(q,.95,()=>{
        shadow(()=>rr(1167,489,284,196,13,"#fffef8","#cbd7bc"),"#30452220",24,12);
        text("保存到哪个分类",1188,508,19,C.green,500);
        ["设计","摄影","其他"].forEach((label,i)=>{
          icon("folder",1189,551+i*38,19,"#91a879");
          text(label,1220,550+i*38,18,"#81936e");
        });
      },10,.22);
      const crossA=clamp((q-1.32)/.13),crossB=clamp((q-1.45)/.13);
      ctx.save();ctx.lineCap="round";
      if(crossA>0)line(1056,541,lerp(1056,1144,crossA),lerp(541,629,crossA),"#bb6656",7);
      if(crossB>0)line(1144,541,lerp(1144,1056,crossB),lerp(541,629,crossB),"#bb6656",7);
      ctx.restore();
      text("记录示意",1465,689,11,"#a1ae94",400,"right");
      },18,0);
    }
  }

  function sceneNeed(t) {
    background(false, t);
    head(3, "原案中的需求");
    reveal(t, .1, () => lines([
      "我希望所有消息和文件，",
      "都能长期保存在云端。"
    ], 110, 165, 54, C.ink, 600, 1.36));

    const clients = [
      { cx: 350, name: "macOS", type: "laptop" },
      { cx: 800, name: "Windows", type: "desktop" },
      { cx: 1250, name: "Linux", type: "desktop" }
    ];
    const paths = [
      [[690, 460], [690, 505], [350, 505], [350, 580]],
      [[800, 460], [800, 580]],
      [[910, 460], [910, 505], [1250, 505], [1250, 580]]
    ];

    paths.forEach((points, i) => deviceIndependentLink(points, t, 3.2 + i * .3));
    reveal(t, 1.05, () => {
      deviceCloudNode(570, 340, 460, 120,
        "云端长期存储", "消息与附件 · 完整历史记录");
      text("设想", 1006, 357, 13, "#93a47f", 400, "right");
    });
    clients.forEach((client, i) => reveal(t, 1.8 + i * .4, () => {
      drawDevice(client.cx - 145, 580, 290, 200,
        client.name, client.type, false);
    }, 24));

    reveal(t, 5.25, () => subtitle([
      t < 11
        ? "换了设备，也能找回完整的历史记录。"
        : "历史记录不需要依赖旧设备在线。"
    ]));
  }

  function fusionBezier(a,b,c,d,p){
    const q=1-p;
    return {x:q*q*q*a.x+3*q*q*p*b.x+3*q*p*p*c.x+p*p*p*d.x,y:q*q*q*a.y+3*q*q*p*b.y+3*q*p*p*c.y+p*p*p*d.y};
  }
  const fusionArcCache=new Map();
  function fusionParameterAtDistance(points,progress){
    const key=JSON.stringify(points);
    let arc=fusionArcCache.get(key);
    if(!arc){
      const samples=192,lengths=[0];let previous=points[0];
      for(let i=1;i<=samples;i++){
        const point=fusionBezier(...points,i/samples);
        lengths.push(lengths[i-1]+Math.hypot(point.x-previous.x,point.y-previous.y));
        previous=point;
      }
      arc={samples,lengths};fusionArcCache.set(key,arc);
    }
    const target=clamp(progress)*arc.lengths[arc.samples];
    let low=0,high=arc.samples;
    while(high-low>1){const middle=(low+high)>>>1;if(arc.lengths[middle]<target)low=middle;else high=middle}
    return (low+(target-arc.lengths[low])/(arc.lengths[high]-arc.lengths[low]))/arc.samples;
  }
  function fusionPath(points,p,color,alpha=1){
    ctx.save();ctx.globalAlpha*=alpha;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    const count=40,stop=Math.max(1,Math.ceil(clamp(p)*count));
    for(let j=1;j<=stop;j++){const s=clamp(p)*j/stop,v=fusionBezier(...points,s);ctx.lineTo(v.x,v.y)}
    ctx.strokeStyle=color;ctx.lineWidth=1.25;ctx.stroke();ctx.restore();
  }
  function fusionLayout(t){
    const zoom=clamp((t-1.05)/.55);
    return {zoom,x:lerp(1168,830,zoom),y:lerp(290,112,zoom),w:lerp(310,580,zoom),h:lerp(460,720,zoom)};
  }
  function fusionFlightPoints(index,arrive){
    const a={x:276+(index%3)*302,y:340+Math.floor(index/3)*130};
    const target=fusionLayout(arrive),row=CHAT_SOURCE_ORDER.indexOf(index);
    const slot=chatSlots(target.x,target.y,target.w,target.h,lerp(16,22,target.zoom),lerp(67,77,target.zoom))[row];
    const port={x:slot.x+slot.w/2,y:slot.y+slot.h/2};
    return [a,{x:Math.min(a.x+205,port.x-120),y:a.y},{x:port.x-120,y:port.y},port];
  }
  function fusionThread(x,y,w,h,t,events,zoom){
    const enterWindow=enter(t,.18,.42);
    group(enterWindow,0,(1-enterWindow)*22,()=>{
      shadow(()=>rr(x,y,w,h,lerp(17,20,zoom),C.white,"#cfddbf"),"#2545231c",40,20);
      const pad=lerp(16,22,zoom),header=lerp(67,77,zoom),avatar=lerp(29,40,zoom),fs=lerp(15,21,zoom);
      rr(x+pad,y+18,avatar,avatar,lerp(9,12,zoom),C.pale);
      icon("chat",x+pad+avatar*.2,y+18+avatar*.2,lerp(17.4,25,zoom));
      text("给自己发消息",x+pad+lerp(41,55,zoom),y+17,fs,C.ink,600);
      text("我的聊天记录",x+pad+lerp(41,55,zoom),y+lerp(41,45,zoom),lerp(10,13,zoom),"#92a27e");
      group(zoom,0,0,()=>text("概念示意",x+w-pad,y+26,12,"#94a780",400,"right"));
      line(x+pad,y+header,x+w-pad,y+header,"#e0e7d5");
      const bodyTop=y+header+13,bodyBottom=y+h-59,slots=chatSlots(x,y,w,h,pad,header);
      ctx.save();ctx.beginPath();ctx.rect(x+pad,bodyTop,w-pad*2,bodyBottom-bodyTop+1);ctx.clip();
      const received=events.filter(e=>t>=e.arrive);
      received.forEach((e,k)=>{
        const slot=slots[k],visible=enter(t,e.arrive+.04,.14);
        chatBubbleFrame(slot);
        group(1-visible,0,0,()=>chatPlaceholder(slot,e.index));
        group(visible,0,0,()=>chatContent(slot));
      });
      canvas.dataset.messages=String(received.filter(e=>t>=e.arrive+.18).length);
      ctx.restore();
      rr(x+pad,y+h-38,w-pad*2,24,6,"#edf2e6");
      text("给自己发消息…",x+pad+lerp(10,12,zoom),y+h-33,lerp(9,10,zoom),"#98a98a");
    });
  }
  function chatExplanation(){
    lines(["所有信息先作为普通消息，","进入同一条时间线。"],114,475,25,C.muted,400,1.95);
    line(115,625,173,625,"#91ac74",2);
    text("不需要提前判断它属于哪个分类。",115,661,19,"#8a9c77");
  }
  function scenePurposes(){
    // This whole sequence is choreographed in real playback seconds. Its
    // Departures and window growth share the same real-time interval.
    const t=motionLocalTime;
    background(false,t);head(4,"核心理念");
    const order=CHAT_SOURCE_ORDER;
    const events=order.map((index,n)=>({index,start:.55+n*.22,arrive:.55+n*.22+1.12}));
    const {zoom,x,y,w,h}=fusionLayout(t);
    const initialTitle=1-smooth((t-1.0)/.3);
    group(initialTitle,0,0,()=>text("多种用途，一个聊天入口。",800,157,60,C.ink,600,"center"));
    const source={x:136,y:286,w:280,h:108,gap:22};
    const positions=purposes.map((_,i)=>({x:source.x+(i%3)*(source.w+source.gap),y:source.y+Math.floor(i/3)*(source.h+source.gap)}));
    purposes.forEach(([name,label],i)=>{
      const e=events.find(v=>v.index===i),p=positions[i],ready=enter(t,.06+i*.035,.4);
      const gone=smooth((t-e.start)/.12),a=ready*(1-gone);
      group(a,0,(1-ready)*20,()=>{
        rr(p.x,p.y,source.w,source.h,15,"#f8fbf2","#d5e1c8");
        icon(name,p.x+source.w/2-16,p.y+21,32,"#729454");
        text(label,p.x+source.w/2,p.y+71,23,"#4b653d",400,"center");
      });
    });
    // Paint the receiving surface before the flights, so a card crosses its
    // border visibly and lands in its own row instead of vanishing at an edge.
    fusionThread(x,y,w,h,t,events,zoom);
    // Right column leaves first, so later rows cross vacated cells rather than
    // covering labels that are still being read. At most two pieces share a lane.
    events.forEach(e=>{
      const flight=clamp((t-e.start-.12)/1.0);
      if(t<e.start+.12||t>=e.arrive)return;
      const s=positions[e.index],points=fusionFlightPoints(e.index,e.arrive);
      const curveProgress=fusionParameterAtDistance(points,flight),p=fusionBezier(...points,curveProgress);
      const row=order.indexOf(e.index),target=fusionLayout(e.arrive);
      const targetSlot=chatSlots(target.x,target.y,target.w,target.h,lerp(16,22,target.zoom),lerp(67,77,target.zoom))[row];
      const morph=smooth((flight-.7)/.3),appearance=enter(t,e.start+.12,.12);
      const width=lerp(202,targetSlot.w,morph),height=lerp(51,targetSlot.h,morph);
      const slot={x:p.x-width/2,y:p.y-height/2,w:width,h:height,r:lerp(9,targetSlot.r,morph),sx:width/CHAT_ITEMS[row].w,sy:height/CHAT_ITEMS[row].h,index:row};
      group(appearance,0,0,()=>{
        if(t<2.8)fusionPath(points,curveProgress,"#a2bd89",.45);
        rr(slot.x,slot.y,width,height,slot.r,C.white);
        group(1-morph,0,0,()=>{
          shadow(()=>rr(slot.x,slot.y,width,height,slot.r,null,"#b8cea1"),"#62804312",12,6);
          icon(purposes[e.index][0],slot.x+13,p.y-11,22,"#719650");
          rr(slot.x+47,p.y-4,width*.45,3.5,2,"#b0c49b");
          rr(slot.x+47,p.y+5,width*.28,3.5,2,"#cedbbf");
        });
        group(morph,0,0,()=>{chatBubbleFrame(slot);chatPlaceholder(slot,e.index)});
      },1,p.x,p.y,(flight<.8?Math.sin(flight*Math.PI)*.035:0)*(s.y<500?1:-1));
    });
    group(enter(t,.35,.25)*(1-smooth((t-2.3)/.3)),0,0,()=>subtitle(["不需要提前分类，直接发送。"]));
    const finalTitle=enter(t,2.8,.3);
    group(finalTitle,0,(1-finalTitle)*25,()=>{
      lines(["多种用途，","一个聊天入口。"],110,258,58,C.ink,600,1.4);
      chatExplanation();
    });
  }

  const messageDelays=[0.15,0.49,0.83,1.17,1.51,1.85,2.19,2.53,2.87];
  function fullChat(x,y,w,t,itemOpacity=null){
    const s=portrait?1.18:1,h=720*s;
    shadow(()=>rr(x,y,w,h,20,C.white,"#cfddbf"),"#2545231c",40,20);
    const pad=22*s;rr(x+pad,y+18*s,40*s,40*s,12*s,C.pale);icon("chat",x+pad+8*s,y+26*s,25*s);
    text("给自己发消息",x+pad+55*s,y+17*s,21*s,C.ink,600);text("我的聊天记录",x+pad+55*s,y+45*s,13*s,"#92a27e");
    text("概念示意",x+w-pad,y+26*s,12*s,"#94a780",400,"right");line(x+pad,y+77*s,x+w-pad,y+77*s,"#e0e7d5");
    const items=CHAT_ITEMS,slots=chatSlots(x,y,w,h,pad,77*s);
    ctx.save();
    ctx.beginPath();ctx.rect(x+pad-3,y+87*s,w-pad*2+6,h-139*s);ctx.clip();
    let count=0;
    items.forEach((m,i)=>{
      const p=enter(t,messageDelays[i],.16),slot=slots[i];
      if(p>.8)count++;
      group(itemOpacity?itemOpacity(i):1,0,0,()=>{
        chatBubbleFrame(slot);
        if(p<1)group(1-p,0,0,()=>chatPlaceholder(slot,CHAT_SOURCE_ORDER[i]));
        group(p,0,0,()=>chatContent(slot));
      });
    });
    ctx.restore();
    rr(x+pad,y+h-38*s,w-pad*2,24*s,6*s,"#edf2e6");text("给自己发消息…",x+pad+12*s,y+h-33*s,10*s,"#98a98a");
    canvas.dataset.messages=String(count);
  }
  function chatTitleWave(t){
    const old=["多种用途，","一个聊天入口。"];
    old.forEach((value,row)=>{
      const y=258+row*58*1.4,p=enter(t,row*.035,.19);
      if(p>=1)return;
      ctx.save();ctx.beginPath();ctx.rect(105,y-3,700,85);ctx.clip();
      text(value,110,y-90*p,58,C.ink,600);ctx.restore();
    });
    let order=0;
    ["想到什么，","直接发条消息。"].forEach((value,row)=>{
      const y=258+row*84;let x=110;
      ctx.save();ctx.beginPath();ctx.rect(105,y-4,700,88);ctx.clip();
      for(const char of value){
        font(60,600);const width=ctx.measureText(char).width;
        const p=clamp((t-.16-order*.026)/.30);
        if(p>0){const dy=(1-ease(p))*36+Math.sin(p*Math.PI*2)*(1-p)*3;group(Math.min(1,p*2),0,0,()=>text(char,x,y+dy,60,C.ink,600))}
        x+=width;order++;
      }
      ctx.restore();
    });
  }
  function sceneChat(t){
    background(false,t);head(5,"同一个聊天入口");
    if(portrait){
      reveal(t,.1,()=>text("给自己发消息。",65,190,61,C.ink,600));
      reveal(t,.6,()=>text("我的聊天记录 · 先留下来，再慢慢整理",67,285,25,C.muted));
      reveal(t,0,()=>fullChat(90,360,720,4),35,.9);
    }else{
      chatTitleWave(t);
      chatExplanation();
      reveal(t,0,()=>fullChat(830,112,580,4),35,.9);
    }
  }
  // One continuous shot: the same messages are retained, processed and reused.
  function flowPart(kind,index,box,draw){
    if(!pageChange){draw();return}
    if(pageChange.mode!=="out")return;
    const delay=kind==="card"?.04+index*.055:kind==="node"?.02+index*.055:kind==="footer"?.08:0;
    const p=clamp((pageChange.time-delay)/.22);
    if(p>=1)return;
    ctx.save();ctx.beginPath();ctx.rect(box.x-12,box.y-12,box.w+24,box.h+24);ctx.clip();
    group(1,0,-(box.h+24)*ease(p),draw);ctx.restore();
  }
  function flowNode(x,name,title,detail,t,start){
    cardEnter(t,start,()=>{
      const deep=name==="spark",fg=deep?"#f0f5e7":C.ink;
      shadow(()=>rr(x,402,230,206,18,deep?C.green:C.white,deep?C.green:"#cedbbf"),"#244c2f0c",20,8);
      rr(x+23,423,45,45,13,deep?"#386a4b":"#e5eed8");
      if(deep){
        const pulse=1+.055*Math.sin((t-start)*Math.PI*2/1.7);
        group(1,0,0,()=>icon(name,x+31,431,29,"#d0e4ab"),pulse,x+45.5,445.5);
        for(let i=0;i<3;i++)group(.28+.65*(.5+.5*Math.sin((t-start)*5-i*.9)),0,0,()=>circle(x+180+i*10,500,2.4,C.lime));
      }else{
        icon(name,x+31,431+cloudBob(t),29,"#719450");
        for(const e of cloudEvents()){
          const p=(t-e.arrive)/.3;
          if(p>=0&&p<1)group((1-p)*.36,0,0,()=>circle(x+45.5,445.5+cloudBob(t),17+p*10,null,"#739b55",1.3));
        }
      }
      text(title,x+23,483,25,fg,500);
      lines(detail,x+23,527,17,deep?"#bed0aa":"#7b906a",400,1.75);
      if(deep&&t>4.92){
        const q=((t-4.92)%1.85)/1.85;ctx.save();ctx.beginPath();ctx.roundRect(x+1,403,228,204,17);ctx.clip();
        group(Math.sin(q*Math.PI)*.22,0,0,()=>line(x+12,lerp(522,590,q),x+218,lerp(522,590,q),"#cfe397",1.3));ctx.restore();
      }
    },0,14,.28);
  }
  function flowPacket(points,t,start,duration,type){
    if(t<start||t>=start+duration)return;
    const p=pathPoint(points,(t-start)/duration);
    rr(p.x-13,p.y-13,26,26,8,C.white,"#a7bd8e");icon(type,p.x-8,p.y-8,16,"#6e9451");
  }
  function cloudBob(t){return Math.sin((t-.95)*Math.PI*2/2.8)*3.2}
  function cloudEvents(){
    return [1.65,5.8].flatMap((round,cycle)=>CHAT_ITEMS.map((_,index)=>({index,cycle,start:round+index*.32,arrive:round+index*.32+.62,restore:round+3.53})));
  }
  function cloudSourceOpacity(index,t){
    for(const e of cloudEvents()){
      if(e.index!==index||t<e.start||t>=e.restore+.2)continue;
      if(t<e.restore)return lerp(1,.18,clamp((t-e.start)/.12));
      return lerp(.18,1,smooth((t-e.restore)/.2));
    }
    return 1;
  }
  function cloudMessageFlights(t){
    const slots=chatSlots(0,0,580);
    for(const e of cloudEvents()){
      if(t<e.start||t>=e.arrive)continue;
      const source=slots[e.index],p=(t-e.start)/.62;
      const start={x:85+(source.x+source.w/2)*.52,y:317.8+(source.y+source.h/2)*.52};
      const end={x:505.5,y:445.5+cloudBob(e.arrive)};
      const points=[start,{x:start.x+92,y:start.y},{x:435,y:397},end];
      const u=fusionParameterAtDistance(points,p),pos=fusionBezier(...points,u),morph=smooth((p-.35)/.65);
      const w=lerp(source.w*.52,28,morph),h=lerp(source.h*.52,28,morph),m=CHAT_ITEMS[e.index];
      const slot={x:pos.x-w/2,y:pos.y-h/2,w,h,r:lerp(source.r*.52,8,morph),sx:w/m.w,sy:h/m.h,index:e.index};
      rr(slot.x,slot.y,w,h,slot.r,C.pale,"#c5d5b3");
      group(1-morph,0,0,()=>chatContent(slot));
      const type=m.photo?"image":m.file?m.type:m.word?"book":m.lines?"file":e.index===0||e.index===5?"film":e.index===1?"list":"history";
      group(morph,0,0,()=>icon(type,pos.x-9,pos.y-9,18,"#70944f"));
    }
  }
  function flowResult(index,x,y,t){
    const start=6.53+index*.36;
    cardEnter(t,start,()=>{
      rr(x,y,218,126,12,C.white,"#d2dfc3");
      icon(results[index][0],x+14,y+14,19,"#739759");
      text(results[index][1],x+42,y+15,16,"#577148",500);
      if(index===0){
        text("布达佩斯大饭店",x+15,y+48,18,C.ink,500);
        text("电影 · 想看",x+15,y+76,13,"#839573");
        text("冰菓 · 想补",x+15,y+100,13,"#657e53");
      }else if(index===1){
        rr(x+16,y+50,17,17,4,null,"#a0b68c",1.3);
        text("给老师发邮件",x+43,y+48,18,C.ink);
        rr(x+43,y+79,49,24,5,C.pale);text("明早",x+53,y+83,13,"#68874e");
      }else if(index===2){
        photoCrop(x+15,y+48,70,62,5);
        text("黑白建筑摄影",x+96,y+51,16,C.ink);
        text("建筑 · 构图",x+96,y+82,12,"#80936f");
      }else if(index===3){
        text("serendipity",x+15,y+46,24,C.ink,400,"left","Georgia,serif");
        text("偶然发现美好事物的机缘",x+15,y+78,13,"#80936f");
        text("讲稿_v3.pdf",x+15,y+102,12,"#80936f");
      }else if(index===4){
        text("“",x+13,y+47,30,"#b0c296",400,"left","Georgia,serif");
        lines(["今天终于把实验","跑通了"],x+33,y+52,18,C.ink,400,1.6);
      }else{
        rr(x+14,y+47,190,25,5,"#edf2e6");icon("search",x+21,y+53,13,"#91a17f");
        text("之前存的楼梯照片",x+41,y+52,13,"#6c805c");
        photoCrop(x+15,y+84,34,27,3);text("黑白建筑摄影",x+58,y+90,14,C.ink);
      }
    },0,12,.24);
  }
  function sceneProcess(t){
    background(false,t);
    if(!pageChange)head(7,"从消息到信息");
    flowPart("title",0,{x:100,y:150,w:1400,h:85},()=>cardEnter(t,.15,()=>{
      text("原始内容完整保存，AI 负责理解和整理。",105,162,48,C.ink,600);
    },0,15,.35));

    const zoom=smooth(t/.58),scale=lerp(1,.52,zoom),x=lerp(830,85,zoom),y=lerp(112,317.8,zoom);
    flowPart("node",0,{x:75,y:275,w:325,h:435},()=>{
      ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);fullChat(0,0,580,4,index=>cloudSourceOpacity(index,t));ctx.restore();
      cardEnter(t,.7,()=>text("原始消息与附件",235.8,277,20,"#718565",400,"center"),0,9,.22);
    });
    flowPart("node",1,{x:450,y:392,w:250,h:285},()=>{
      flowNode(460,"cloud","云端存储",["消息与附件","完整历史记录"],t,.95);
      cardEnter(t,4.85,()=>{rr(460,632,230,34,8,"#e4edd7");icon("check",477,640,18,"#70954e");text("原始记录完整保存",505,642,16,"#63824d")},0,8,.22);
    });
    flowPart("node",2,{x:745,y:392,w:250,h:285},()=>{
      flowNode(755,"spark","AI 处理",["识别 · 提取 · 关联","整理结果单独保存"],t,3.5);
      cardEnter(t,8.7,()=>text("可修改、纠正或重新生成",870,641,16,"#7d906b",400,"center"),0,8,.22);
    });

    flowPart("connection",0,{x:75,y:300,w:974,h:410},()=>{
      const paths2=[[[386.6,505],[460,505]],[[690,505],[755,505]],[[985,505],[1045,505]]];
      const starts=[1.5,3.75,5.75];
      paths2.forEach((p,i)=>{
        const q=clamp((t-starts[i])/.27);if(q<=0)return;
        dotLine(p,q,"#9bb785",1.6);
        if(q===1){const end=p[p.length-1];line(end[0]-7,end[1]-4,end[0],end[1],"#9bb785",1.6);line(end[0]-7,end[1]+4,end[0],end[1],"#9bb785",1.6)}
      });
      cloudMessageFlights(t);
      ["film","list","image"].forEach((type,i)=>flowPacket(paths2[1],t,4.92+i*.22,.66,type));
      results.forEach(([type],i)=>flowPacket(paths2[2],t,6.05+i*.36,.48,type));
    });
    flowPart("board",0,{x:1038,y:275,w:498,h:504},()=>cardEnter(t,5.7,()=>{
      rr(1045,282,485,490,18,"#eaf0e1","#cfdcc1");
      icon("folder",1065,302,24,"#79965e");text("整理后的信息",1101,304,24,C.ink,500);
    },0,12,.26));
    results.forEach((_,index)=>{
      const rx=1063+(index%2)*231,ry=346+Math.floor(index/2)*138;
      flowPart("card",index,{x:rx,y:ry,w:218,h:126},()=>flowResult(index,rx,ry,t));
    });
    flowPart("footer",0,{x:100,y:795,w:1400,h:48},()=>cardEnter(t,9.2,()=>{
      text("整理结果可以修改、纠正或重新生成，不影响原始消息。",800,810,22,"#6f825d",400,"center");
    },0,10,.3));
  }

  function sceneDevices(t) {
    background(false, t);
    head(9, "计划中的使用形态");
    reveal(t, .1, () => lines([
      "六平台客户端",
      "与多设备同时登录。"
    ], 110, 165, 54, C.ink, 600, 1.36));

    const clients = [
      { cx: 175, name: "Windows", type: "desktop" },
      { cx: 425, name: "macOS", type: "laptop" },
      { cx: 675, name: "Linux", type: "desktop" },
      { cx: 925, name: "Android", type: "phone" },
      { cx: 1175, name: "iOS", type: "phone" },
      { cx: 1425, name: "Web", type: "browser" }
    ];
    const ports = [650, 710, 770, 830, 890, 950];

    // Ordered fan-out ports preserve the same left-to-right order as the six
    // clients, so none of these independent cloud paths crosses another one.
    clients.forEach((client, i) => {
      deviceIndependentLink([
        [ports[i], 450],
        [client.cx, 552],
        [client.cx, 580]
      ], t, 4.25 + i * .15, 6.0);
    });

    reveal(t, 1.05, () => {
      deviceCloudNode(580, 340, 440, 110,
        "统一服务端", "同一账号体系");
      text("计划支持", 996, 357, 13, "#93a47f", 400, "right");
    });
    clients.forEach((client, i) => reveal(t, 1.8 + i * .38, () => {
      drawDevice(client.cx - 95, 580, 190, 180,
        client.name, client.type, false);
    }, 23));

    reveal(t, 8.0, () => {
      rr(1130, 340, 360, 110, 17, C.green);
      icon("server", 1155, 361, 33, "#c8dfa1");
      text("初期自托管", 1210, 363, 25, "#e5efd7", 500);
      text("计划", 1466, 357, 12, "#a9c48d", 400, "right");
      text("公网服务器 · VPS · NAS", 1157, 410, 19, "#c1d5ab");
    }, 22);

    reveal(t, 5.9, () => subtitle([
      t < 9.3
        ? "同一账号体系，多台设备可以同时在线。"
        : "初期支持自行管理消息、附件及备份。"
    ]));
  }

  const milestones=["基础消息系统与自托管","AI 整理与归纳","六平台客户端与个人信息管理","长期可靠性与安全体系研究","公开测试与官方托管"];
  function sceneRoadmap(t){
    background(true,t);head(13,"开发阶段规划",true);
    reveal(t,.1,()=>{text("一步一步，",portrait?65:110,portrait?195:205,portrait?68:71,"#e5efda",500);text("做成能长期用的样子。",portrait?65:110,portrait?294:312,portrait?53:46,"#a7c48d",400)});
    if(!portrait)reveal(t,1.1,()=>{text("01",110,455,210,"#355b3c",400,"left","Georgia,serif");text("— 05",120,680,45,"#668b54",400,"left","Georgia,serif")});
    const x=portrait?85:740,y=portrait?470:183,row=portrait?128:107;
    milestones.forEach((label,i)=>{
      const p=enter(t,.6+i*1.1,.8);
      if(i<4)dotLine([[x+22,y+i*row+50],[x+22,y+(i+1)*row]],enter(t,.7+i*1.1,1),"#557a48",1);
      group(p,(1-p)*30,0,()=>{
        circle(x+22,y+i*row+22,23,"#294b33","#6c8b56",1);
        centeredLabel(String(i+1).padStart(2,"0"),x+22,y+i*row+22,19,"#b9d49b");
        text(label,x+67,y+i*row+7,portrait?28:26,"#d1e2bf",400);
        const detail=["消息、文件、历史、基本搜索与基础安全","分类、提取、关联、语义检索与隐私控制","离线缓存、消息漫游、预览与个人信息视图","备份恢复、完整导出、安全调研与测试","版本稳定、经过必要安全验证后，再扩大测试"];
        text(detail[i],x+67,y+i*row+47,18,"#8eae79");
        if(i<4)line(x+67,y+i*row+73,portrait?810:1480,y+i*row+73,"#3d603d");
      });
    });
    reveal(t,6.3,()=>subtitle(portrait?["阶段顺序不代表重要性的排序。","基础安全从第一阶段开始建设。"]:["阶段顺序不代表重要性的排序。基础安全从第一阶段开始建设。"],true));
  }
  function sceneEnd(t){
    background(false,t);head(14,"最后想做成的样子");
    const cx=W/2,cy=portrait?235:170,p=enter(t,.15,1);
    group(p,0,(1-p)*25,()=>{rr(cx-34,cy,68,68,20,C.green);icon("chat",cx-21,cy+13,42,C.white)});
    const yy=portrait?440:333,fs=portrait?63:73;
    reveal(t,.1,()=>lines(portrait?["一个真正能","长期用下去的","「文件传输助手」。"]:["一个真正能长期用下去的","「文件传输助手」。"],cx,yy,fs,C.ink,500,1.48,"center"),50,1.1);
    reveal(t,2,()=>text("想到什么，就直接发给自己。",cx,portrait?812:592,portrait?31:28,"#71865d",400,"center"));
    reveal(t,3.4,()=>{const yy2=portrait?950:704;line(cx-50,yy2,cx+50,yy2,"#a6be8a",1.5);text("目前仍处于项目构想阶段",cx,yy2+31,portrait?23:19,"#849c6c",400,"center");text("具体功能、技术方案与开发顺序都有调整空间。",cx,yy2+74,portrait?19:16,"#96a485",400,"center")});
    reveal(t,.3,()=>{text("Music: Origami — Scott Buckley · CC BY 4.0 · scottbuckley.com.au",cx,844,12,"#7e8e70",400,"center");text("为本片剪辑并与动作音效混音",cx,867,11,"#8a9a7c",400,"center")},0,.3);
  }


  function sceneMemory(t){
    background(false,t);head(2,"我和文件传输助手的故事");
    const cuts=[0,7,14];
    const titles=[["积攒喜欢的","作品和创意。"],["想看的书、电影，","和想补的番。"],["零零碎碎的消息，","也留下生活的记录。"]];
    const scripts=[
      ["看到好看的摄影、绘画、设计作品，","也会顺手发进去，积攒审美，方便以后学习模仿。"],
      ["想看的书、电影和想补的番也会记下来，","免得之后忘了。"],
      ["不用专门写日记，也能回顾过去的日子。","到了大四，要记住的事情越来越多，","也就更加依赖这种外置的记录。"]
    ];
    clipSwap(t,cuts,{x:105,y:192,w:715,h:196},i=>lines(titles[i],110,205,59,C.ink,600,1.4),"cut",.5);
    clipSwap(t,cuts,{x:109,y:450,w:690,h:157},i=>lines(scripts[i],114,459,25,C.muted,400,1.95));
    clipSwap(t,cuts,{x:830,y:196,w:671,h:530},(i,q)=>{
      if(i===0){
        cardEnter(q,.02,()=>{
        shadow(()=>rr(945,210,480,502,18,C.white,"#d4dfc7"));photoCrop(965,230,440,401,10);
        text("黑白建筑摄影",975,655,23,C.green,500);text("原案中的审美素材示例",975,691,15,"#90a27d");
        },0,16,.35);
      }else if(i===1){
        storyPanel("书影音清单",q);storyBubble("想看《布达佩斯大饭店》",918,350,497,"电影 · 想看",q,0);
        storyBubble("想补《冰菓》",1060,493,355,"想补的番",q,.5);
      }else{
        storyPanel("翻一翻自己的消息",q);line(908,337,908,641,"#c5d7b1",2);
        [[369,"今天终于把实验跑通了","学习与工作"],[481,"明早给老师发邮件","需要记住的事情"],[594,"想看《布达佩斯大饭店》","随手留下的生活记录"]].forEach(([y,label,detail])=>{
          circle(908,y,5,"#87a36b");text(label,941,y-21,26,C.green,500);text(detail,942,y+20,17,"#91a67d");
        });
      }
    },"x",.55,1.2);
  }

  function capabilityGrid(items,t,y=330,dark=false,stable=false,previous=null){
    const bw=430,bh=126,gap=24,x0=131;
    items.forEach((label,i)=>pagePart("card",i,()=>{
      const x=x0+(i%3)*(bw+gap),yy=y+Math.floor(i/3)*(bh+24);
      const frame=()=>{
        rr(x,yy,bw,bh,15,dark?"#2b4c34":"#f8faf2",dark?"#5b7849":"#d2dfc3");
        circle(x+45,yy+45,20,null,dark?"#8ba871":"#adbf99");
        centeredLabel(String(i+1).padStart(2,"0"),x+45,yy+45,17,dark?"#b7ce9d":"#839f6a");
      };
      if(!stable){reveal(t,.8+i*.7,()=>{frame();text(label,x+24,yy+79,25,dark?"#d9e7c8":"#426438",500)},24);return}
      frame();
      ctx.save();ctx.beginPath();ctx.rect(x+22,yy+75,bw-42,38);ctx.clip();
      const p=previous?enter(t,0,.45):1;
      if(previous&&p<1)text(previous[i],x+24,yy+79-p*38,25,dark?"#d9e7c8":"#426438",500);
      text(label,x+24,yy+79+(1-p)*38,25,dark?"#d9e7c8":"#426438",500);
      ctx.restore();
    }));
  }

  function sceneFeatures(t){
    background(false,t);pagePart("header",0,()=>head(8,"希望完善的常用操作"));
    const cuts=[0,10],phase=t<10?0:1,q=phase?t-10:t;
    const items=[["截图粘贴","文件拖放","上传进度","文件预览","复制粘贴","消息搜索"],["增量拉取","手动刷新","离线缓存","历史检索","备份恢复","完整数据导出"]];
    pagePart("title",0,()=>clipSwap(t,cuts,{x:105,y:148,w:1390,h:100},i=>text(["消息与文件传输","完整历史漫游与长期保存"][i],110,165,i?57:61,C.ink,600),"y",.35));
    pagePart("description",0,()=>clipSwap(t,cuts,{x:110,y:252,w:1380,h:52},i=>text(["文字、图片、截图、链接与各类文件。","新设备登录，找回全部历史内容，不依赖旧设备在线。"][i],114,260,i?26:27,C.muted),"y",.35));
    capabilityGrid(items[phase],q,340,false,true,phase?items[0]:null);
    pagePart("footer",0,()=>clipSwap(t,cuts,{x:100,y:711,w:1400,h:131},i=>{
      if(i===0){
        lines(["文案、面试稿、Presentation 稿件和代码片段，","也希望提供方便的编辑、阅读和跨设备使用体验。"],800,722,23,"#7d936a",400,1.8,"center");
        text("尤其重视桌面端的输入、文件操作、系统集成和 UI 渲染质量。",800,812,20,"#879d74",400,"center");
      }else subtitle(["数据完整性优先于毫秒级即时同步。"]);
    },"y",.35));
  }

  // One account shares a centred trunk with three distinct client sessions.
  function secureSessionDevice(cx,type,label){
    const frame="#a5c488",body="#294b33",detail="#71965b",ink="#c8dfac";
    if(type==="desktop"){
      // 16:10 display, with a short neck and foot outside the screen.
      rr(cx-80,500,160,100,9,body,frame,1.8);
      rr(cx-69,512,138,76,4,"#33583c");
      rr(cx-56,526,58,4,2,detail);
      rr(cx-56,540,100,4,2,"#587d47");
      rr(cx-56,554,79,4,2,"#587d47");
      line(cx,600,cx,611,frame,2);
      line(cx-31,614,cx+31,614,frame,2);
    }else if(type==="phone"){
      // One narrow phone silhouette; it is not another wide empty screen card.
      rr(cx-28,504,56,112,10,body,frame,1.8);
      line(cx-7,513,cx+7,513,frame,1.5);
      rr(cx-21,524,42,77,4,"#33583c");
      rr(cx-14,535,28,4,2,detail);
      rr(cx-14,548,22,4,2,"#587d47");
      rr(cx-14,561,26,4,2,"#587d47");
      line(cx-7,608,cx+7,608,frame,1.5);
    }else{
      // Browser window with a clear chrome strip and a small content hierarchy.
      rr(cx-80,514,160,100,9,body,frame,1.8);
      line(cx-79,535,cx+79,535,"#6a8c53",1);
      for(let i=0;i<3;i++)circle(cx-66+i*9,524.5,2,"#9cbb7d");
      rr(cx-29,521,93,6,3,"#426843");
      rr(cx-66,548,30,51,4,"#3b6241");
      rr(cx-24,549,86,5,2,detail);
      rr(cx-24,564,71,4,2,"#587d47");
      rr(cx-24,578,81,4,2,"#587d47");
    }
    text(label,cx,641,23,ink,500,"center");
  }

  function secureSessionDiagram(q){
    const cx=1168,busY=445;
    const nodes=[
      {cx:910,top:500,type:"desktop",label:"电脑"},
      {cx:1168,top:504,type:"phone",label:"手机"},
      {cx:1426,top:514,type:"browser",label:"Web"}
    ];
    const trunk=clamp(q/.4),bus=clamp((q-.3)/.45);
    const ink="#779c5f",stroke=1.7;
    // The common trunk is drawn once, and each arm occupies a different segment.
    // All three columns are centred on x = 1168; there is no staggered overdraw.
    dotLine([[cx,389],[cx,busY]],trunk,ink,stroke);
    if(bus>0){
      line(cx,busY,lerp(cx,nodes[0].cx,bus),busY,ink,stroke);
      line(cx,busY,lerp(cx,nodes[2].cx,bus),busY,ink,stroke);
    }
    nodes.forEach((node,i)=>{
      const leg=clamp((q-.7)/.4);
      dotLine([[node.cx,busY],[node.cx,node.top]],leg,ink,stroke);
      const appear=enter(q,.65+i*.15,.55);
      group(appear,0,(1-appear)*12,()=>secureSessionDevice(node.cx,node.type,node.label));
    });
    group(enter(q,.25,.35),0,0,()=>text("会话",cx+20,405,18,"#91b379"));
  }

  function sceneBasicSecurity(t){
    background(true,t);head(10,"身份验证与网络安全 / 初期基本保障",true);
    if(t<15){
      reveal(t,.1,()=>lines(["身份验证","与设备会话管理"],110,182,61,"#e5efd8",600,1.36));
      secureFocusList(["安全身份认证","设备与会话管理"],t<7?0:1,413);
      reveal(t,1.2,()=>lines(["后续研究","多因素身份验证 · 多设备信任机制"],114,661,20,"#91b379",400,1.9));
      reveal(t,.5,()=>secureIdentity(999,259,338,130));
      if(t>=7){
        secureSessionDiagram(t-7);
      }else{
        reveal(t,1.7,()=>{rr(1013,469,310,134,15,"#264931","#527b45");icon("shield",1043,510,39,"#91b873");text("安全身份认证",1104,518,25,"#c6dda9",500)});
      }
      subtitle(["长期保存个人信息，账号安全从最初的设计开始考虑。"],true);
    }else{
      const q=t-15,active=q<5?0:q<10?1:2;
      reveal(q,.1,()=>lines(["传输加密","与访问防护"],110,182,64,"#e5efd8",600,1.36));
      secureFocusList(["HTTPS 传输加密","数据访问控制","基本限流与防护"],active,410);
      reveal(q,.7,()=>text("后续研究：安全测试及漏洞审查",114,686,20,"#91b379"));
      reveal(q,.3,()=>{rr(810,389,180,145,15,"#2b4f37","#64854f");icon("chat",878,414,43,"#bad49b");text("客户端",900,481,25,"#d7e8c4",500,"center")});
      reveal(q,.3,()=>{rr(1170,280,325,365,20,"#294a33","#64854f");icon("server",1196,307,35,"#adce8d");text("服务端",1249,312,28,"#d7e8c4",500)});
      const path=[[990,461],[1170,461]];dotLine(path,enter(q,.6,1),active===0?"#c7df9d":"#688f52",active===0?3:1.5);
      if(q>1.4)packet(path,transferPhase(16.4,.65),"#b6d48b");
      reveal(q,.7,()=>{text("HTTPS",1080,403,23,active===0?"#d5e7b6":"#87ac6d",500,"center");text("传输加密",1080,494,17,"#8eb475",400,"center")});
      const modules=[{y:382,label:"访问控制",focus:active===1},{y:508,label:"限流与防护",focus:active===2}];
      modules.forEach((m,i)=>cardEnter(q,.65+i*.18,()=>{rr(1195,m.y,275,88,12,m.focus?"#50713e":"#35563a",m.focus?"#b4d18b":"#5c7d48",m.focus?2:1);text(m.label,1332,m.y+27,25,m.focus?"#ebf3d8":"#9fbe87",m.focus?500:400,"center")},16,0,.3));
      subtitle(["基础安全从第一阶段建设，具体方案需要专门研究与验证。"],true);
    }

  }



  function scenePrivacy(t){
    background(false,t);head(11,"AI 与隐私 / 补充说明");
    reveal(t,.1,()=>text("知道哪些数据被处理，并能控制范围。",110,166,51,C.ink,600));
    const parts=[{x:110,title:"原始记录",small:"消息 · 文档 · 图片",name:"folder"},{x:593,title:"处理范围",small:"由用户控制",name:"list"},{x:1075,title:"模型服务",small:"可配置 API / 自托管模型",name:"spark"}];
    parts.forEach((p,i)=>reveal(t,.6+i*.4,()=>{rr(p.x,363,415,240,18,i===1?C.green:C.white,i===1?"#537c41":"#d1dec2");icon(p.name,p.x+28,394,38,i===1?C.lime:"#7d9b62");text(p.title,p.x+28,467,31,i===1?"#e4efd5":C.green,500);text(p.small,p.x+28,534,21,i===1?"#accb8f":"#8a9e77")}));
    dotLine([[525,480],[581,480]],enter(t,1.2,.8),"#9ab47c",2);dotLine([[1008,480],[1063,480]],enter(t,1.8,.8),"#9ab47c",2);
    reveal(t,1.7,()=>lines(["用户应当知道哪些数据会送往外部模型服务。","并能控制 AI 的处理范围。"],800,715,25,C.muted,400,1.9,"center"));
  }



  function archBox(x,y,w,h,title,detail,type,dark=false){
    rr(x,y,w,h,14,dark?C.green:C.white,dark?"#547943":"#d1dfc1");icon(type,x+25,y+22,34,dark?C.lime:"#739b55");text(title,x+82,y+20,25,dark?"#e3edd4":C.green,500);text(detail,x+82,y+57,17,dark?"#a2c18a":"#899f74");
  }
  function sceneArchitecture(t){
    background(false,t);head(12,"初步技术设想 / 尚未最终确定");
    if(t<12){
      reveal(t,.1,()=>text("先可靠保存，再由 AI 独立处理。",110,158,54,C.ink,600));
      reveal(t,.7,()=>archBox(450,285,700,91,"跨平台客户端","聊天界面 · 文件操作 · 本地缓存 · AI 整理视图","chat"));
      dotLine([[800,376],[800,452]],enter(t,1.2,1),"#a4bd88",2);
      text("HTTPS / HTTP API",822,407,15,"#94a77f");
      reveal(t,1.8,()=>archBox(450,452,700,91,"统一服务端","身份认证 · 消息管理 · 文件管理 · 同步 · AI 任务","server",true));
      const boxes=[{x:110,title:"消息数据库",detail:"PostgreSQL",type:"file"},{x:593,title:"文件存储",detail:"本地文件系统 / S3 兼容存储",type:"folder"},{x:1075,title:"AI 处理",detail:"分类 · 提取 · 关联 · 语义检索",type:"spark"}];
      boxes.forEach((b,i)=>{dotLine([[800,543],[800,583],[b.x+207,583],[b.x+207,625]],enter(t,2.5+i*.25,1),"#b0c599",1.5);reveal(t,3.1+i*.3,()=>archBox(b.x,625,415,105,b.title,b.detail,b.type))});
      reveal(t,4.6,()=>subtitle(["模型可以更换，索引和整理结果也可以重新生成，不把长期数据绑定到某一种模型。"]));
    }else{
      const q=t-12;
      reveal(q,.1,()=>text("初步考虑的技术方案",110,157,59,C.ink,600));
      const pairs=[["客户端 GUI","Flutter / Qt 等"],["Web 客户端","Flutter Web / React"],["服务端 / 数据库","Go / PostgreSQL"],["本地缓存","SQLite"],["文件存储","本地文件系统 / S3 兼容存储"],["同步","HTTP API + 增量同步"],["实时推送","后续按需加入 WebSocket"],["AI 模块","可配置 API / 自托管模型"],["部署","Docker Compose"],["架构","初期采用模块化单体"]];
      pairs.forEach(([label,value],i)=>{const x=i<5?110:865,y=280+(i%5)*76;reveal(q,.4+(i%5)*.18,()=>{line(x,y+65,x+625,y+65,"#d2dec5");text(label,x,y+10,20,"#8b9c7a");text(value,x+205,y+10,21,"#4c6e3b")},18)});
      reveal(q,2,()=>lines(["服务端完成持久化确认后，才标记为已保存到云端；附件也需要完整性校验。","备份、恢复与完整数据导出，是长期保存的一部分。"],800,732,23,"#6b8458",400,1.9,"center"));
    }

  }
  const scenes=[
    {start:0,end:3,label:"开篇",description:"这是对一个项目设想的描述，不是项目名称。",sourceTimes:[[0.0,0],[2.175,2.9],[3,9]],draw:sceneTitle},
    {start:3,end:14,label:"我和文件传输助手",description:"我经常给自己发消息。除了文件，还会直接发送备忘、记录、文案、讲稿和单词。",sourceTimes:[[0.0,0],[3.006667,4.1],[3.373333,8.1],[3.666667,8.5],[6.673333,12.6],[7.04,17.1],[7.333333,17.5],[10.34,21.6],[11,27]],draw:sceneOrigin},
    {start:14,end:23,label:"零碎的生活记录",description:"我会留下喜欢的摄影作品、想看的书和电影、想补的番；零碎消息也成了生活记录。",sourceTimes:[[0.0,0],[2.3625,4.35],[3.0,7],[5.3625,11.35],[6.0,14],[8.3625,18.35],[9,21]],draw:sceneMemory},
    {start:23,end:34,label:"现有方案的不便",description:"我用微信、QQ 时同一账号只能同时登录一台电脑、本地记录需要保留与迁移、云端漫游有期限和范围；飞书仅作补充例子。记录灵感时，希望少一些新建文档与分类的步骤。",sourceTimes:[[0,0],[11,11]],draw:sceneFriction},
    {start:34,end:40,label:"想自己做一个",description:"macOS、Windows 和 Linux 分别连接云端，找回完整历史记录。",sourceTimes:[[0.0,0],[3.75,5],[4.65,11.5],[6,18]],draw:sceneNeed},
    {start:40,end:44.5,label:"核心理念",description:"九种用途沿各自路径成为消息，共同进入唯一聊天入口，保留在同一条时间线。",sourceTimes:[[0,0],[4.5,4.5]],draw:scenePurposes},
    {start:44.5,end:47,label:"给自己发消息",description:"原案中的八条文字和文件消息，以及建筑摄影。",sourceTimes:[[0,0],[2.5,2.5]],draw:sceneChat},
    {start:47,end:58,label:"从消息到信息",description:"同一画面展示消息逐条进入云端完整保存，再进行 AI 处理，形成带有原案例子的六种信息视图。整理结果单独保存，可以修改或重新生成。",sourceTimes:[[0,0],[11,11]],draw:sceneProcess},
    {start:58,end:67,label:"常用操作",description:"消息与文件传输、编辑、预览、搜索，以及离线缓存、备份恢复和完整导出。",sourceTimes:[[0.0,0],[3.375,6],[4.2,9.6],[4.5,10],[7.875,16],[9,20]],draw:sceneFeatures},
    {start:67,end:74,label:"六平台与自托管",description:"六个平台各自使用客户端或浏览器，连接同一服务端；初期计划支持自托管。",sourceTimes:[[0.0,0],[4.34,6.2],[5.04,8],[5.67,8.9],[7,18]],draw:sceneDevices},
    {start:74,end:85,label:"身份验证与网络安全",description:"安全身份认证、设备与会话管理、HTTPS 传输加密、数据访问控制、基本限流与防护。",sourceTimes:[[0.0,0],[1.7875,2.6],[2.75,7],[5.5,15],[11,30]],draw:sceneBasicSecurity},
    {start:85,end:89,label:"AI 与隐私",description:"用户应知道哪些数据会送往外部模型服务，并控制 AI 处理范围。",sourceTimes:[[0.0,0],[2.16,2.7],[4,8]],draw:scenePrivacy},
    {start:89,end:97,label:"初步技术设想",description:"候选技术方案尚未确定，先可靠保存，再由独立任务进行 AI 处理。",sourceTimes:[[0.0,0],[3.854545,5.8],[4.363636,11.6],[4.654545,12],[6.909091,15.1],[8,24]],draw:sceneArchitecture},
    {start:97,end:103,label:"开发规划",description:"五个开发阶段，基础安全从第一阶段开始。",sourceTimes:[[0.0,0],[4.8,7.2],[6,20]],draw:sceneRoadmap},
    {start:103,end:108,label:"最后想做成的样子",description:"一个真正能长期用下去的文件传输助手。相关功能尚待开发。",sourceTimes:[[0.0,0],[3.583333,4.3],[5,13]],draw:sceneEnd}
  ];
  function sourceTime(scene,local){
    const points=scene.sourceTimes;
    for(let i=1;i<points.length;i++){
      const before=points[i-1],after=points[i];
      if(local<=after[0])return lerp(before[1],after[1],clamp((local-before[0])/(after[0]-before[0])));
    }
    return points[points.length-1][1];
  }

  function resize(){
    const rect=screen.getBoundingClientRect();
    portrait=false;W=1600;H=900;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const pw=Math.max(1,Math.round(rect.width*dpr)),ph=Math.max(1,Math.round(rect.height*dpr));
    if(pw!==pixelWidth||ph!==pixelHeight){canvas.width=pw;canvas.height=ph;pixelWidth=pw;pixelHeight=ph}
    ctx.setTransform(pw/W,0,0,ph/H,0,0);
    return {width:W,height:H,portrait};
  }
  function openingMask(x,y,w,h,dx,dy,draw){
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.translate(dx,dy);draw();ctx.restore();
  }
  function renderOpeningTransition(time){
    const start=2.65,end=3.40;
    if(time<start||time>=end)return false;
    const oldScene=scenes.find(s=>s.draw===sceneTitle),next=scenes.find(s=>s.draw===sceneOrigin);
    const oldTime=sourceTime(oldScene,Math.min(time,oldScene.end)-oldScene.start);
    const nextTime=sourceTime(next,Math.max(0,time-next.start));
    const q=time-start,p=smooth(q/.65),oldAngle=-.06+Math.sin(oldTime*.25)*.012;
    background(false,time);head(0,time<2.97?"一段关于记录、保存与整理的设想":"我和文件传输助手的故事");

    // The title rolls out through its own rows. The page and header stay still.
    openingMask(105,165,710,69,0,-84*enter(q,0,.24),()=>{
      rr(115,174,44,44,13,C.green);icon("chat",124,183,26,C.white);text("一个项目设想",175,184,21,"#6b8259");
    });
    ["一个只和自己","聊天的 App。"].forEach((s,i)=>{
      const y=240+i*84*1.35;
      openingMask(104,y-2,725,118,0,-124*enter(q,i*.045,.30),()=>text(s,115,y,84,C.ink,600));
    });
    openingMask(104,483,730,100,0,-105*enter(q,.03,.27),()=>text("一个纯粹而且足够好用的「文件传输助手」。",115,487.8,25,"#7a896d"));

    ["不知道你有没有","这样的习惯。"].forEach((s,i)=>{
      const y=205+i*64*1.4,step=enter(q,.10+i*.055,.30);
      openingMask(104,y-3,715,91,0,98*(1-step),()=>text(s,110,y,64,C.ink,600));
    });
    const body=enter(q,.34,.32);
    openingMask(108,487,700,145,0,152*(1-body),()=>lines(["我经常用微信的文件传输助手，","或者给自己的 QQ 账号发消息，","在不同设备之间传递文字和文件。"],114,499,26,C.muted,400,1.8));
    openingMask(109,677,650,39,0,43*(1-enter(q,.44,.25)),()=>text("文字与文件",114,685,21,"#8ba171"));

    // Decorations leave independently while the original chat becomes the story panel.
    const away=enter(q,0,.30);
    group(1-away,0,0,()=>{
      ctx.save();ctx.strokeStyle="#d0dcc2";ctx.lineWidth=1;
      for(const r of [235,305]){ctx.beginPath();ctx.ellipse(1290,642.5,r,r*.9,-.22,0,Math.PI*2);ctx.stroke()}ctx.restore();
    });


    const x=lerp(940,840,p),y=lerp(325,205,p),w=lerp(350,650,p),h=lerp(485,515,p);
    const pivotX=lerp(1115,1165,p),pivotY=lerp(500,462.5,p),switchHeader=enter(q,.22,.22);
    group(1,0,0,()=>{
      shadow(()=>rr(x,y,w,h,lerp(18,20,p),C.white,p>.7?"#d3dfc7":"#d6e0c8"),p>.7?"#23472e12":"#0d241d25",lerp(35,30,p),lerp(20,15,p));
      const pad=lerp(18,24,p),is=lerp(34,42,p);
      rr(x+pad,y+pad,is,is,lerp(10,12,p),C.pale);icon("chat",x+pad+lerp(6,9,p),y+pad+lerp(6,9,p),lerp(22,24,p));
      group(1-switchHeader,0,-switchHeader*12,()=>{
        text("给自己发消息",x+65,y+20,18,C.ink,500);text("我的聊天记录",x+65,y+46,11,"#94a183");
      });
      group(switchHeader,0,(1-switchHeader)*12,()=>{
        text("文件传输助手 / 给自己发消息",x+82,y+28,25,C.green,500);
        text("原案示例",x+w-31,y+37,14,"#96a785",400,"right");
      });
      const divider=lerp(72,87,p),side=lerp(15,25,p);
      line(x+side,y+divider,x+w-side,y+divider,p>.7?"#e0e7d7":"#e1e7d8");
      ctx.save();ctx.beginPath();ctx.rect(x+15,y+divider+1,w-30,h-divider-2);ctx.clip();
      group(1-enter(q,.04,.18),0,0,()=>{
        // Clip out the old frame and header; only its existing contents move.
        miniChat(x,y,w,h,oldTime);
      });
      group(enter(q,.31,.26),0,0,()=>{
        ctx.save();ctx.translate(x,y);ctx.scale(w/650,h/515);ctx.translate(-840,-205);storyContents(0,nextTime);ctx.restore();
      });
      ctx.restore();
    },1,pivotX,pivotY,oldAngle*(1-p));
    openingMask(1180,270,420,170,450*away,-36*away,()=>smallCard(1200,295,315,105,"file","讲稿_v3.pdf","PDF · 1.8 MB",.07,oldTime));
    openingMask(780,580,380,225,-50*away,235*away,()=>group(1,0,0,()=>{
      shadow(()=>rr(815,610,290,118,15,C.white,"#d9e2cd"));text("随手记下的单词",838,629,12,"#9aa58a");
      text("serendipity",838,654,39,C.ink,400,"left","Georgia,serif");text("偶然发现美好事物的机缘",838,701,12,"#8c9d77");
    },1,960,668,-.07));
    return true;
  }

  function renderPageChange(time){
    const next=scenes.find(s=>s.draw===sceneFeatures),previous=scenes[scenes.indexOf(next)-1];
    const start=next.start-.45;
    if(time<start||time>=start+.90)return false;
    const savedScene=activeScene,savedLocal=motionLocalTime;
    background(false,time);
    head(0,time<next.start?previous.label:"希望完善的常用操作");
    ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();
    try{
      pageChange={mode:"out",time:time-start};
      activeScene=previous;motionLocalTime=previous.end-previous.start;
      previous.draw(sourceTime(previous,motionLocalTime));
      pageChange={mode:"in",time:time-start};
      activeScene=next;motionLocalTime=0;
      next.draw(sourceTime(next,0));
    }finally{
      pageChange=null;activeScene=savedScene;motionLocalTime=savedLocal;ctx.restore();
    }
    return true;
  }
  function brushGrain(index,salt=0){
    const value=Math.sin(index*127.1+salt*311.7)*43758.5453;
    return value-Math.floor(value);
  }
  function brushEdge(y,progress,fromRight){
    const row=y/H;
    // Fixed bristle lengths make the paint edge travel without frame-to-frame noise.
    const bristles=Math.sin(y*.037)*12+Math.sin(y*.131+.8)*5+Math.sin(y*.71)*2.1;
    const sweep=(row-.5)*30+Math.sin(row*Math.PI)*11;
    const x=-92+(W+184)*progress+bristles+sweep;
    return fromRight?W-x:x;
  }
  function brushMask(progress,fromRight){
    const side=fromRight?W:0;
    ctx.beginPath();ctx.moveTo(side,0);ctx.lineTo(brushEdge(0,progress,fromRight),0);
    for(let y=5;y<H;y+=5)ctx.lineTo(brushEdge(y,progress,fromRight),y);
    ctx.lineTo(brushEdge(H,progress,fromRight),H);ctx.lineTo(side,H);ctx.closePath();
    // Thin dry-brush gaps are confined to the advancing edge and get painted in
    // as it passes; the finished frame is entirely the next scene.
    if(progress>0&&progress<1){
      for(let i=0,y=13;y<H;y+=13+brushGrain(i,1)*26,i++){
        const length=5+brushGrain(i,2)*14;
        const inset=8+brushGrain(i,3)*12;
        const edge=brushEdge(y,progress,fromRight);
        ctx.rect(fromRight?edge+inset:edge-inset-length,y,length,.6+brushGrain(i,4)*.7);
      }
    }
  }
  function renderBrushTransition(time){
    const targets=[
      {draw:sceneBasicSecurity,dark:true},
      {draw:scenePrivacy,dark:false},
      {draw:sceneRoadmap,dark:true},
      {draw:sceneEnd,dark:false}
    ];
    const target=targets.find(item=>{
      const scene=scenes.find(s=>s.draw===item.draw);
      return time>=scene.start-.28&&time<scene.start+.36;
    });
    if(!target)return false;
    const next=scenes.find(s=>s.draw===target.draw),previous=scenes[scenes.indexOf(next)-1];
    const start=next.start-.28,progress=clamp((time-start)/.64),fromRight=!target.dark;
    const savedScene=activeScene,savedLocal=motionLocalTime;
    const drawAt=(scene)=>{
      activeScene=scene;motionLocalTime=clamp(time-scene.start,0,scene.end-scene.start);
      ctx.save();try{scene.draw(sourceTime(scene,motionLocalTime))}finally{ctx.restore()}
    };
    ctx.save();
    try{
      drawAt(previous);
      if(progress>0){
        ctx.save();brushMask(progress,fromRight);ctx.clip("evenodd");drawAt(next);ctx.restore();
        // A few leading fibres sell the brush contact without a full-screen flash.
        const direction=fromRight?-1:1,paint=target.dark?C.dark:C.paper;
        ctx.save();ctx.strokeStyle=paint;ctx.lineCap="round";
        for(let i=0,y=6;y<H;y+=3+brushGrain(i,5)*4,i++){
          const edge=brushEdge(y,progress,fromRight),reach=3+brushGrain(i,6)*12;
          ctx.lineWidth=.5+brushGrain(i,7)*.9;
          ctx.beginPath();ctx.moveTo(edge-direction*3,y);ctx.lineTo(edge+direction*reach,y);ctx.stroke();
        }
        // Low-contrast wet streaks sit immediately behind the edge, then leave
        // the revealed typography and illustrations completely clean.
        ctx.globalAlpha=.06;
        ctx.strokeStyle=target.dark?"#719466":"#ffffff";
        for(let i=0,y=21;y<H;y+=20+brushGrain(i,8)*40,i++){
          const edge=brushEdge(y,progress,fromRight),tail=18+brushGrain(i,9)*22;
          ctx.lineWidth=.6+brushGrain(i,10)*.4;
          ctx.beginPath();ctx.moveTo(edge-direction*13,y);ctx.lineTo(edge-direction*tail,y);ctx.stroke();
        }
        ctx.restore();
      }
    }finally{
      activeScene=savedScene;motionLocalTime=savedLocal;ctx.restore();
    }
    return true;
  }
  function render(time){
    lastTime=clamp(time,0,108);resize();
    const index=scenes.findIndex(s=>lastTime>=s.start&&lastTime<s.end),i=index<0?scenes.length-1:index,scene=scenes[i];
    activeScene=scene;motionLocalTime=lastTime-scene.start;
    ctx.save();ctx.globalAlpha=1;
    if(!renderOpeningTransition(lastTime)&&!renderPageChange(lastTime)&&!renderBrushTransition(lastTime))scene.draw(sourceTime(scene,lastTime-scene.start));
    ctx.restore();
    canvas.dataset.scene=String(i);canvas.dataset.time=lastTime.toFixed(2);
    return scene;
  }
  window.InboxConceptFilm={duration:108,posterTime:2.1,render,resize,scenes:scenes.map(({draw,...rest})=>rest)};
  photo.addEventListener("load",()=>render(lastTime));
  if("ResizeObserver" in window)new ResizeObserver(()=>render(lastTime)).observe(screen);
  window.addEventListener("resize",()=>render(lastTime),{passive:true});
  render(2.1);
})();
