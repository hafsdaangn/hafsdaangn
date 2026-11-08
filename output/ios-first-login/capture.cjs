const fs = require('node:fs/promises');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require('@playwright/test');
const root = process.cwd();
(async () => {
  const model = `const noop=()=>{};const state={viewer:{id:'preview-user',display_name:'미리보기'},profiles:[],posts:[],conversations:[],messages:[],hasMore:false};const model={state,base:'/app',error:'',refresh:async()=>{},mutate:async()=>{},upload:async()=>'',image:()=>'',addPosts:noop,loadMessages:async()=>false};export const useApp=()=>model;`;
  const result = await build({
    stdin: { contents: `import {createRoot} from 'react-dom/client';import {Workspace} from './components/workspace';import {PwaProvider} from './components/pwa-provider';createRoot(document.getElementById('root')).render(<PwaProvider><Workspace/></PwaProvider>);`, resolveDir:root,loader:'tsx' },
    bundle:true,write:false,outfile:'ios.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},
    plugins:[{name:'preview-context',setup(b){
      b.onResolve({filter:/^\.\/provider$/},()=>({path:'context',namespace:'preview'}));
      b.onLoad({filter:/.*/,namespace:'preview'},()=>({contents:model}));
      b.onResolve({filter:/^next\/navigation$/},()=>({path:'nav',namespace:'navigation'}));
      b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:`import{useMemo}from'react';export const usePathname=()=>location.pathname;export const useSearchParams=()=>useMemo(()=>new URLSearchParams(location.search),[]);export const useRouter=()=>({push:p=>location.assign(p),replace:p=>location.replace(p),refresh:()=>location.reload()});`,resolveDir:root}));
      b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'link'}));
      b.onLoad({filter:/.*/,namespace:'link'},()=>({contents:`import{createElement}from'react';export default function Link(p){return createElement('a',p)}`,resolveDir:root}));
    }}]
  });
  const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
  let css='';
  for(const name of await fs.readdir('.next/static/css')) css+=await fs.readFile(path.join('.next/static/css',name),'utf8');
  css+=(await fs.readFile('tokens.css','utf8'))+(await fs.readFile('app/globals.css','utf8')).replace(/^@import.*$/gm,'')+result.outputFiles.find(f=>f.path.endsWith('.css')).text;
  const browser=await chromium.launch({headless:true});
  async function create(standalone){
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 Version/18.4 Mobile/15E148 Safari/604.1'});
    await context.addInitScript(({standalone})=>{
      let permission='default';
      Object.defineProperty(navigator,'platform',{value:'iPhone'});
      Object.defineProperty(navigator,'standalone',{value:standalone});
      const media=window.matchMedia.bind(window);
      window.matchMedia=q=>q.includes('display-mode')?Object.assign(new EventTarget(),{matches:standalone,media:q,onchange:null,addListener(){},removeListener(){}}):media(q);
      Object.defineProperty(window,'Notification',{value:{get permission(){return permission}}});
      Object.defineProperty(window,'PushManager',{value:class{}});
      let subscription=null;
      const registration={pushManager:{getSubscription:async()=>subscription,subscribe:async()=>{permission='granted';subscription={toJSON:()=>({endpoint:'https://push.apple.com/preview',keys:{p256dh:'preview',auth:'preview'}})};return subscription;}}};
      Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration,ready:Promise.resolve(registration)}});
      const original=window.fetch.bind(window);
      window.fetch=async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input.url,location.href);
        let data;
        if(url.pathname==='/api/posts')data={posts:[],hasMore:false};
        else if(url.pathname==='/api/push')data=init?.method==='POST'?{ok:true}:{configured:true,publicKey:'AQ',subscribed:!!subscription};
        else if(url.pathname==='/api/push/chat')data={enabled:true};
        else if(url.pathname==='/api/push/preferences')data=[{section:'giveaway',mode:'off',keywords:[]},{section:'lost',mode:'off',keywords:[]}];
        else return original(input,init);
        return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
      };
    },{standalone});
    const page=await context.newPage();
    page.on('pageerror',e=>{throw e});
    await page.route('**/*',async route=>{
      const p=new URL(route.request().url()).pathname;
      if(p==='/__ios.js')return route.fulfill({contentType:'application/javascript',body:js});
      if(p==='/__ios.css')return route.fulfill({contentType:'text/css',body:css});
      if(p.startsWith('/app'))return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/__ios.css"></head><body><div id="root"></div><script src="/__ios.js"></script></body></html>'});
      let file=p.startsWith('/_next/')?path.join(root,'.next',p.slice(7)):p.startsWith('/media/')?path.join(root,'.next/static',p):path.join(root,'public',p);
      try{return await route.fulfill({path:file});}catch{return route.fulfill({status:404,body:''});}
    });
    return {page,context};
  }
  async function capture(page,name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`output/ios-first-login/${name}.png`});}
  const web=await create(false);
  await web.page.goto('http://127.0.0.1:3299/app');
  await web.page.getByText('아직 올라온 글이 없어요',{exact:true}).waitFor();
  if(await web.page.getByRole('dialog').count())throw Error('Unexpected initial iOS dialog');
  await capture(web.page,'01-browser-after-login');
  await web.page.getByRole('navigation',{name:'하단 메뉴'}).getByRole('link',{name:'내 정보',exact:true}).click();
  await web.page.getByRole('link',{name:'알림 설정',exact:true}).click();
  await web.page.getByText('홈 화면에 추가한 합스당근 아이콘으로 열어 알림을 허용해 주세요.',{exact:false}).waitFor();
  await capture(web.page,'02-browser-notification-settings');
  const app=await create(true);
  await app.page.goto('http://127.0.0.1:3299/app');
  const dialog=app.page.getByRole('dialog');
  await dialog.getByRole('button',{name:'알림 허용',exact:true}).waitFor();
  await capture(app.page,'03-installed-app-permission');
  await dialog.getByRole('button',{name:'알림 허용',exact:true}).click();
  await dialog.getByRole('heading',{name:'알림을 설정했어요',exact:true}).waitFor();
  await capture(app.page,'04-installed-app-enabled');
  await browser.close();
  console.log('Captured four iOS flow screens. Browser/native state and empty account data are simulated.');
})().catch(e=>{console.error(e);process.exit(1)});
