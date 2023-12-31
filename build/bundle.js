var app=function(){"use strict";function t(){}function n(t){return t()}function e(){return Object.create(null)}function o(t){t.forEach(n)}function c(t){return"function"==typeof t}function u(t,n){return t!=t?n==n:t!==n||t&&"object"==typeof t||"function"==typeof t}function r(n){return n&&c(n.destroy)?n.destroy:t}function i(t,n){t.appendChild(n)}function a(t,n,e){t.insertBefore(n,e||null)}function s(t){t.parentNode&&t.parentNode.removeChild(t)}function l(t){return document.createElement(t)}function f(t){return document.createTextNode(t)}function p(){return f(" ")}function d(t,n,e,o){return t.addEventListener(n,e,o),()=>t.removeEventListener(n,e,o)}function $(t,n,e){null==e?t.removeAttribute(n):t.getAttribute(n)!==e&&t.setAttribute(n,e)}function h(t){return""===t?null:+t}function v(t,n){n=""+n,t.data!==n&&(t.data=n)}function m(t,n){t.value=null==n?"":n}let g;function b(t){g=t}function _(){const t=function(){if(!g)throw new Error("Function called outside component initialization");return g}();return(n,e,{cancelable:o=!1}={})=>{const c=t.$$.callbacks[n];if(c){const u=function(t,n,{bubbles:e=!1,cancelable:o=!1}={}){const c=document.createEvent("CustomEvent");return c.initCustomEvent(t,e,o,n),c}(n,e,{cancelable:o});return c.slice().forEach((n=>{n.call(t,u)})),!u.defaultPrevented}return!0}}const x=[],y=[];let k=[];const w=[],E=Promise.resolve();let C=!1;function A(t){k.push(t)}function q(t){w.push(t)}const D=new Set;let O=0;function G(){if(0!==O)return;const t=g;do{try{for(;O<x.length;){const t=x[O];O++,b(t),M(t.$$)}}catch(t){throw x.length=0,O=0,t}for(b(null),x.length=0,O=0;y.length;)y.pop()();for(let t=0;t<k.length;t+=1){const n=k[t];D.has(n)||(D.add(n),n())}k.length=0}while(x.length);for(;w.length;)w.pop()();C=!1,D.clear(),b(t)}function M(t){if(null!==t.fragment){t.update(),o(t.before_update);const n=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,n),t.after_update.forEach(A)}}const S=new Set;let F;function N(t,n){t&&t.i&&(S.delete(t),t.i(n))}function j(t,n,e,o){if(t&&t.o){if(S.has(t))return;S.add(t),F.c.push((()=>{S.delete(t),o&&(e&&t.d(1),o())})),t.o(n)}else o&&o()}function B(t,n,e){const o=t.$$.props[n];void 0!==o&&(t.$$.bound[o]=e,e(t.$$.ctx[o]))}function I(t){t&&t.c()}function L(t,e,u,r){const{fragment:i,after_update:a}=t.$$;i&&i.m(e,u),r||A((()=>{const e=t.$$.on_mount.map(n).filter(c);t.$$.on_destroy?t.$$.on_destroy.push(...e):o(e),t.$$.on_mount=[]})),a.forEach(A)}function P(t,n){const e=t.$$;null!==e.fragment&&(!function(t){const n=[],e=[];k.forEach((o=>-1===t.indexOf(o)?n.push(o):e.push(o))),e.forEach((t=>t())),k=n}(e.after_update),o(e.on_destroy),e.fragment&&e.fragment.d(n),e.on_destroy=e.fragment=null,e.ctx=[])}function T(t,n){-1===t.$$.dirty[0]&&(x.push(t),C||(C=!0,E.then(G)),t.$$.dirty.fill(0)),t.$$.dirty[n/31|0]|=1<<n%31}function U(n,c,u,r,i,a,l,f=[-1]){const p=g;b(n);const d=n.$$={fragment:null,ctx:[],props:a,update:t,not_equal:i,bound:e(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(c.context||(p?p.$$.context:[])),callbacks:e(),dirty:f,skip_bound:!1,root:c.target||p.$$.root};l&&l(d.root);let $=!1;if(d.ctx=u?u(n,c.props||{},((t,e,...o)=>{const c=o.length?o[0]:e;return d.ctx&&i(d.ctx[t],d.ctx[t]=c)&&(!d.skip_bound&&d.bound[t]&&d.bound[t](c),$&&T(n,t)),e})):[],d.update(),$=!0,o(d.before_update),d.fragment=!!r&&r(d.ctx),c.target){if(c.hydrate){const t=function(t){return Array.from(t.childNodes)}(c.target);d.fragment&&d.fragment.l(t),t.forEach(s)}else d.fragment&&d.fragment.c();c.intro&&N(n.$$.fragment),L(n,c.target,c.anchor,c.customElement),G()}b(p)}class z{$destroy(){P(this,1),this.$destroy=t}$on(n,e){if(!c(e))return t;const o=this.$$.callbacks[n]||(this.$$.callbacks[n]=[]);return o.push(e),()=>{const t=o.indexOf(e);-1!==t&&o.splice(t,1)}}$set(t){var n;this.$$set&&(n=t,0!==Object.keys(n).length)&&(this.$$.skip_bound=!0,this.$$set(t),this.$$.skip_bound=!1)}}function H(n){let e,o,c,u,r,h,m,g,b,_=n[0]+n[2]+"";return{c(){e=l("main"),o=l("div"),c=l("h2"),c.textContent="MIDI",u=p(),r=l("h3"),h=f(n[1]),m=f(_),$(o,"class","svelte-49prnq")},m(t,s){var l;a(t,e,s),i(e,o),i(o,c),i(o,u),i(o,r),i(r,h),i(r,m),g||(b=d(window,"keydown",(l=n[3],function(t){return t.preventDefault(),l.call(this,t)})),g=!0)},p(t,[n]){2&n&&v(h,t[1]),5&n&&_!==(_=t[0]+t[2]+"")&&v(m,_)},i:t,o:t,d(t){t&&s(e),g=!1,b()}}}function J(t,n,e){const o=_();let c=4,u="A",r=0,i=440;return[c,u,r,function(t){let n=!1;switch(e(2,r=0),t.keyCode){case 61:c<10&&(e(0,c+=1),i*=2);break;case 173:c>-2&&(e(0,c-=1),i/=2);break;case 90:i=261.63,n=!0,e(1,u="C");break;case 83:i=277.18,n=!0,e(1,u="C#/Db");break;case 88:i=293.66,n=!0,e(1,u="D");break;case 68:i=311.13,n=!0,e(1,u="D#/Eb");break;case 67:i=329.63,n=!0,e(1,u="E");break;case 86:i=349.23,n=!0,e(1,u="F");break;case 71:i=369.99,n=!0,e(1,u="F#/Gb");break;case 66:i=392,n=!0,e(1,u="G");break;case 72:i=415.3,n=!0,e(1,u="G#/Ab");break;case 78:i=440,n=!0,e(1,u="A");break;case 74:i=466.16,n=!0,e(1,u="A#/Bb");break;case 77:i=493.88,n=!0,e(1,u="B");break;case 188:i=523.25,n=!0,e(1,u="C"),e(2,r=1);break;case 76:i=554.37,n=!0,e(1,u="C#/Db"),e(2,r=1);break;case 190:i=587.33,n=!0,e(1,u="D"),e(2,r=1);break;case 59:i=622.25,n=!0,e(1,u="D#/Eb"),e(2,r=1);break;case 191:i=659.25,n=!0,e(1,u="E"),e(2,r=1)}if(n)if(c>4)for(let t=4;t<c;t++)i*=2;else for(let t=4;t>c;t--)i/=2;o("signal",{output:Math.log2(i)})}]}class K extends z{constructor(t){super(),U(this,t,J,H,u,{})}}function Q(n){let e,c,u,h,v,g,b,_,x,y,k,w,E,C,A,q,D,O,G,M,S,F,N,j,B,I,L;return B=function(t){let n;return{p(...e){n=e,n.forEach((n=>t.push(n)))},r(){n.forEach((n=>t.splice(t.indexOf(n),1)))}}}(n[6][0]),{c(){e=l("main"),c=l("div"),u=l("h2"),u.textContent="Oscillator",h=p(),v=l("label"),g=l("input"),b=f("Freq"),_=p(),x=l("section"),y=l("label"),k=l("input"),w=f(" Sine"),E=p(),C=l("label"),A=l("input"),q=f(" Triangle"),D=p(),O=l("label"),G=l("input"),M=f(" Sawtooth"),S=p(),F=l("label"),N=l("input"),j=f(" Square"),$(g,"type","range"),$(g,"min","2.78135971352466"),$(g,"max","14.78135971352466"),$(g,"step","0.0001"),$(k,"type","radio"),k.__value="sine",k.value=k.__value,$(A,"type","radio"),A.__value="triangle",A.value=A.__value,$(G,"type","radio"),G.__value="sawtooth",G.value=G.__value,$(N,"type","radio"),N.__value="square",N.value=N.__value,$(c,"class","svelte-49prnq"),B.p(k,A,G,N)},m(t,o){a(t,e,o),i(e,c),i(c,u),i(c,h),i(c,v),i(v,g),m(g,n[0]),i(v,b),i(c,_),i(c,x),i(x,y),i(y,k),k.checked=k.__value===n[1].type,i(y,w),i(x,E),i(x,C),i(C,A),A.checked=A.__value===n[1].type,i(C,q),i(x,D),i(x,O),i(O,G),G.checked=G.__value===n[1].type,i(O,M),i(x,S),i(x,F),i(F,N),N.checked=N.__value===n[1].type,i(F,j),I||(L=[r(n[2].call(null,window)),d(g,"change",n[4]),d(g,"input",n[4]),d(k,"change",n[5]),d(A,"change",n[7]),d(G,"change",n[8]),d(N,"change",n[9])],I=!0)},p(t,[n]){1&n&&m(g,t[0]),2&n&&(k.checked=k.__value===t[1].type),2&n&&(A.checked=A.__value===t[1].type),2&n&&(G.checked=G.__value===t[1].type),2&n&&(N.checked=N.__value===t[1].type)},i:t,o:t,d(t){t&&s(e),B.r(),I=!1,o(L)}}}function R(t,n,e){let{ctx:o}=n,{voct:c}=n;const u=_();let r=o.createOscillator();r.connect(o.destination),r.start(0);return t.$$set=t=>{"ctx"in t&&e(3,o=t.ctx),"voct"in t&&e(0,c=t.voct)},t.$$.update=()=>{1&t.$$.dirty&&c&&e(1,r.frequency.value=Math.pow(2,c),r)},[c,r,()=>u("signal",{output:r}),o,function(){c=h(this.value),e(0,c)},function(){r.type=this.__value,e(1,r),e(0,c)},[[]],function(){r.type=this.__value,e(1,r),e(0,c)},function(){r.type=this.__value,e(1,r),e(0,c)},function(){r.type=this.__value,e(1,r),e(0,c)}]}class V extends z{constructor(t){super(),U(this,t,R,Q,u,{ctx:3,voct:0})}}function W(n){let e,o,c,u,r,h,m,g;return{c(){e=l("main"),o=l("div"),c=l("h2"),c.textContent="Output",u=p(),r=l("button"),h=f(n[0]),$(o,"class","svelte-49prnq")},m(t,s){a(t,e,s),i(e,o),i(o,c),i(o,u),i(o,r),i(r,h),m||(g=d(r,"click",n[1]),m=!0)},p(t,[n]){1&n&&v(h,t[0])},i:t,o:t,d(t){t&&s(e),m=!1,g()}}}function X(t,n,e){let{ctx:o}=n,{input:c}=n;var u=!1,r="Unmute";return t.$$set=t=>{"ctx"in t&&e(2,o=t.ctx),"input"in t&&e(3,c=t.input)},[r,function(){u?(u=!1,e(0,r="Unmute"),o.suspend()):(u=!0,e(0,r="Mute"),o.resume())},o,c]}class Y extends z{constructor(t){super(),U(this,t,X,W,u,{ctx:2,input:3})}}function Z(n){let e,c,u,h,v,g,b,_,x;return{c(){e=l("main"),c=l("div"),u=l("h2"),u.textContent="Amplifier",h=p(),v=l("label"),g=l("input"),b=f("Gain"),$(g,"type","range"),$(g,"min","-1"),$(g,"max","0"),$(g,"step","0.001"),$(c,"class","svelte-49prnq")},m(t,o){a(t,e,o),i(e,c),i(c,u),i(c,h),i(c,v),i(v,g),m(g,n[0]),i(v,b),_||(x=[r(n[1].call(null,window)),d(g,"change",n[5]),d(g,"input",n[5])],_=!0)},p(t,[n]){1&n&&m(g,t[0])},i:t,o:t,d(t){t&&s(e),_=!1,o(x)}}}function tt(t,n,e){let{cv:o}=n,{ctx:c}=n,{input:u}=n;const r=_();var i=c.createGain();i.connect(c.destination);return t.$$set=t=>{"cv"in t&&e(0,o=t.cv),"ctx"in t&&e(2,c=t.ctx),"input"in t&&e(3,u=t.input)},t.$$.update=()=>{1&t.$$.dirty&&o&&e(4,i.gain.value=o,i),16&t.$$.dirty&&console.log(i.gain.value),24&t.$$.dirty&&u&&u.connect(i)},[o,()=>r("signal",{output:i}),c,u,i,function(){o=h(this.value),e(0,o)}]}class nt extends z{constructor(t){super(),U(this,t,tt,Z,u,{cv:0,ctx:2,input:3})}}function et(t){let n,e,o,c,u,r,f,d,h,v,m,g,b,_,x,k;function w(n){t[8](n)}function E(n){t[9](n)}e=new K({}),e.$on("signal",t[6]);let C={};function A(n){t[10](n)}function D(n){t[11](n)}function O(n){t[12](n)}void 0!==t[0]&&(C.ctx=t[0]),void 0!==t[3]&&(C.voct=t[3]),c=new V({props:C}),y.push((()=>B(c,"ctx",w))),y.push((()=>B(c,"voct",E))),c.$on("signal",t[5]);let G={};function M(n){t[13](n)}function S(n){t[14](n)}void 0!==t[0]&&(G.ctx=t[0]),void 0!==t[4]&&(G.cv=t[4]),void 0!==t[2]&&(G.input=t[2]),d=new nt({props:G}),y.push((()=>B(d,"ctx",A))),y.push((()=>B(d,"cv",D))),y.push((()=>B(d,"input",O))),d.$on("signal",t[7]);let F={};return void 0!==t[0]&&(F.ctx=t[0]),void 0!==t[1]&&(F.input=t[1]),b=new Y({props:F}),y.push((()=>B(b,"ctx",M))),y.push((()=>B(b,"input",S))),{c(){n=l("main"),I(e.$$.fragment),o=p(),I(c.$$.fragment),f=p(),I(d.$$.fragment),g=p(),I(b.$$.fragment),$(n,"class","svelte-1h6otfa")},m(t,u){a(t,n,u),L(e,n,null),i(n,o),L(c,n,null),i(n,f),L(d,n,null),i(n,g),L(b,n,null),k=!0},p(t,[n]){const e={};!u&&1&n&&(u=!0,e.ctx=t[0],q((()=>u=!1))),!r&&8&n&&(r=!0,e.voct=t[3],q((()=>r=!1))),c.$set(e);const o={};!h&&1&n&&(h=!0,o.ctx=t[0],q((()=>h=!1))),!v&&16&n&&(v=!0,o.cv=t[4],q((()=>v=!1))),!m&&4&n&&(m=!0,o.input=t[2],q((()=>m=!1))),d.$set(o);const i={};!_&&1&n&&(_=!0,i.ctx=t[0],q((()=>_=!1))),!x&&2&n&&(x=!0,i.input=t[1],q((()=>x=!1))),b.$set(i)},i(t){k||(N(e.$$.fragment,t),N(c.$$.fragment,t),N(d.$$.fragment,t),N(b.$$.fragment,t),k=!0)},o(t){j(e.$$.fragment,t),j(c.$$.fragment,t),j(d.$$.fragment,t),j(b.$$.fragment,t),k=!1},d(t){t&&s(n),P(e),P(c),P(d),P(b)}}}function ot(t,n,e){window.AudioContext=window.AudioContext||window.webkitAudioContext;var o=new AudioContext;let c,u,r,i;return[o,c,u,r,i,t=>{e(2,u=t.detail.output)},t=>{e(3,r=t.detail.output)},t=>{e(1,c=t.detail.output)},function(t){e(0,o=t)},function(t){r=t,e(3,r)},function(t){e(0,o=t)},function(t){i=t,e(4,i)},function(t){u=t,e(2,u)},function(t){e(0,o=t)},function(t){c=t,e(1,c)}]}return new class extends z{constructor(t){super(),U(this,t,ot,et,u,{})}}({target:document.body,props:{name:"world"}})}();
//# sourceMappingURL=bundle.js.map