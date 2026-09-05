import fs from 'node:fs';
const src=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const eng=src.split('// ==ENGINE-START==')[1].replace(/^[^\n]*/,'').split('// ==ENGINE-END==')[0];
const m=new Function(eng+'\nreturn {solve,sweep,pivotForces,stayLoads,dist,circles,chainRun};')();
const defs=src.split('const DEF=')[1].split('};')[0]+'}';
const DEF=new Function('return '+defs)();
const G=structuredClone(DEF.geom), C=structuredClone(DEF.cfg);
let fails=0;
const ok=(name,cond,info='')=>{console.log((cond?'  pass  ':'  FAIL  ')+name+(info?'   '+info:''));if(!cond)fails++};

const r=m.sweep(G,C);
ok('sweep completes without jamming', !r.error, r.error||'');
const f=r.frames, L=f[f.length-1], F0=f[0];

ok('drawn eye-to-eye matches the shock spec', Math.abs(m.dist(G.SE,G.SG)-C.eye)<2,
   m.dist(G.SE,G.SG).toFixed(1)+' vs '+C.eye);
ok('travel matches the Linkage model', Math.abs(L.rise-139)<1.5, L.rise.toFixed(1)+' mm vs 139');
ok('leverage falls through the stroke', F0.lr>L.lr,
   F0.lr.toFixed(2)+' -> '+L.lr.toFixed(2));
const prog=(F0.lr-L.lr)/L.lr*100;
ok('progression matches Linkage', Math.abs(prog-11.3)<0.6, prog.toFixed(1)+'% vs 11.3');
ok('anti-squat matches Linkage', Math.abs(F0.as-113.5)<1.5, F0.as.toFixed(1)+'% vs 113.5');
ok('anti-rise matches Linkage', Math.abs(F0.ar-109.5)<1.5, F0.ar.toFixed(1)+'% vs 109.5');

let mono=true, monoS=true;
for(let i=1;i<f.length;i++){ if(f[i].rise<=f[i-1].rise) mono=false;
                             if(f[i].stroke<=f[i-1].stroke) monoS=false; }
ok('wheel rise increases monotonically', mono);
ok('shock stroke increases monotonically', monoS);
ok('shock reaches exactly full stroke', Math.abs(L.stroke-C.stroke)<0.01, L.stroke.toFixed(3));

// flex demand
const peak=f.map(k=>k.flex).reduce((a,b)=>Math.abs(b)>Math.abs(a)?b:a,0);
const geo={total:534,chord:525.5,emax:30.6,leanStart:364};
const st=m.stayLoads(peak,geo,C.od,C.wall,545,C.bendA,C.dropZ,C.yokeZ);
ok('flex zone rotation stays small', Math.abs(peak)<3, peak.toFixed(2)+' deg');
ok('stay stress accounts for the axial offset', st.sAx>0&&st.sFlex>0,
   'flex '+st.sFlex.toFixed(0)+' MPa, axial '+st.sAx.toFixed(0)+' MPa');
ok('bend and flex are found to oppose', st.oppose===true);
ok('out of plane bending is counted', st.sOop>0, st.sOop.toFixed(0)+' MPa');
ok('resultant exceeds either component alone',
   st.combined>=st.sOop && st.combined>=st.inPlane,
   st.combined.toFixed(0)+' MPa vs in-plane '+st.inPlane.toFixed(0)+', out '+st.sOop.toFixed(0));
ok('P-delta amplification is above unity', st.amp>1&&st.amp<1.3, st.amp.toFixed(3));
ok('Euler load well above the applied load', st.Pcr>5*545, (st.Pcr/1000).toFixed(1)+' kN');
ok('zero flex angle at top out', Math.abs(f[0].flex)<1e-9);

// force solver cross-check: shock force must equal wheel load times leverage
const W=C.mass*9.81*C.bias/100;
const sag=f[Math.round(C.sag/100*(f.length-1))];
const P=m.pivotForces(G,sag,W);
ok('force solver returns a solution', !!P);
ok('shock force equals wheel load times leverage',
   Math.abs(P.shock-W*sag.lr)/(W*sag.lr)<0.02,
   (P.shock/1000).toFixed(3)+' kN vs '+(W*sag.lr/1000).toFixed(3)+' kN');
ok('all pivot loads finite and positive',
   [P.mainPivot,P.flexPivot,P.link].every(v=>Number.isFinite(v)&&v>0),
   'main '+(P.mainPivot/1000).toFixed(2)+' kN, flex '+(P.flexPivot/1000).toFixed(2)+
   ' kN, link '+(P.link/1000).toFixed(2)+' kN');

// chain line must pass over the top of both circles
const cr=m.chainRun({x:0,y:0},C.ring*12.7/(2*Math.PI),G.AX,C.cog*12.7/(2*Math.PI));
ok('chain run is the upper tangent', cr.p1.y>0&&cr.p2.y>G.AX.y,
   'ring '+cr.p1.y.toFixed(1)+', cog '+cr.p2.y.toFixed(1));

// a deliberately impossible link must be rejected, not silently fudged
const bad=structuredClone(G); bad.SP={x:-72,y:196};      // link too short to follow the stay
ok('a link that cannot follow reports a jam', !!m.sweep(bad,C).error);
const over=structuredClone(C); over.stroke=160;          // more stroke than the linkage has
ok('over-long stroke reports a jam', !!m.sweep(G,over).error);
const conc=structuredClone(G); conc.SP={...G.MP};        // degenerate: back to a plain single pivot
const cr2=m.sweep(conc,C);
ok('concentric pivots give near zero stay flex', !cr2.error &&
   Math.max(...cr2.frames.map(k=>Math.abs(k.flex)))<0.05,
   cr2.error?'jammed':Math.max(...cr2.frames.map(k=>Math.abs(k.flex))).toFixed(4)+' deg');

console.log('\ntravel '+L.rise.toFixed(1)+' mm | leverage '+F0.lr.toFixed(2)+' to '+L.lr.toFixed(2)+
  ' | progression '+prog.toFixed(1)+'%');
console.log('anti-squat at top out '+F0.as.toFixed(1)+'% (Linkage 113.5) | anti-rise '+
  F0.ar.toFixed(1)+'% (Linkage 109.5)');
console.log('anti-squat at sag '+sag.as.toFixed(0)+'% | anti-rise '+sag.ar.toFixed(0)+
  '% | chain shortening '+L.kick.toFixed(1)+' deg');
console.log('axle path '+(F0.AX.x-L.AX.x>0?'rearward ':'forward ')+
  Math.abs(F0.AX.x-L.AX.x).toFixed(1)+' mm');
// The first frame used to depend on the sign of floating point noise, which
// differs between JavaScript engines. Jitter every coordinate and confirm the
// sweep is insensitive to it.
let jitterFails=0;
for(let trial=0;trial<400;trial++){
  const g=structuredClone(G);
  for(const k in g){ g[k].x+=(Math.random()-0.5)*2e-3; g[k].y+=(Math.random()-0.5)*2e-3; }
  const rr=m.sweep(g,C,25);
  if(rr.error) jitterFails++;
}
ok('first frame is insensitive to floating point noise', jitterFails===0,
   jitterFails+' of 400 jittered geometries jammed');
// and explicitly: zero compression must return the drawn position
const z=m.sweep(G,C,61).frames[0];
ok('zero compression returns the drawn shock length',
   Math.abs(z.shock-m.dist(G.SE,G.SG))<1e-6, (z.shock-m.dist(G.SE,G.SG)).toExponential(2));

// derailleur cage must stay in range on the defaults and rotate forward as the
// chain path grows, never backwards
const cg=f.map(k=>k.cageDeg);
ok('mech cage stays within its travel', !f.some(k=>k.cageClamp),
   cg[0].toFixed(1)+' to '+cg[cg.length-1].toFixed(1)+' deg');
ok('cage rotates forward as the chain path grows', cg[0]>cg[cg.length-1],
   'swing '+(cg[0]-cg[cg.length-1]).toFixed(1)+' deg');
let cageMono=true;
for(let i=1;i<cg.length;i++) if(cg[i]>cg[i-1]+1e-6) cageMono=false;
ok('cage motion is monotonic through the stroke', cageMono);

console.log(fails? '\n'+fails+' FAILURES' : '\nall checks pass');
process.exit(fails?1:0);
