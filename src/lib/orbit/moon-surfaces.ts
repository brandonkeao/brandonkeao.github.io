import * as THREE from 'three';

/**
 * Procedural moon surfaces for the `spheres` and `detailed` moon styles
 * (lib/moon-style.ts). Each is a MeshPhysicalMaterial patched in
 * onBeforeCompile, so the moons keep three's lights, environment, fog, bloom
 * and tone mapping, and stay one mesh / one draw each.
 *
 * The surface is evaluated in object space (normalised by the body's size),
 * like the planet's crust in lib/planet.ts, so it is seamless on any geometry
 * and stays sharp when the body is enlarged in a collection. Relief comes
 * from an object-space height field: its gradient (finite differences for
 * the noise part, analytic for craters) tilts the shading normal. Albedo, roughness, metalness and a faint
 * copper emission in recesses/veins come from the same fields.
 *
 * Kinds:
 * - basalt  (Portfolio sphere): graphite/basalt, ridges and craters, cool-grey
 *   highlights, faint copper veins.
 * - ivory   (Approach sphere): pale warm ivory with copper dust, dense small
 *   craters.
 * - hewn    (Portfolio cube): hewn graphite block, chisel relief, glowing
 *   fissures, worn bright edges.
 * - crystal (Approach octahedron): smoky faceted crystal, conchoidal ripples,
 *   frosted edges, copper veins seen beneath the surface (parallax layers).
 */
export type SurfaceKind = 'basalt' | 'ivory' | 'hewn' | 'crystal';
const KIND_ID: Record<SurfaceKind, number> = { basalt: 0, ivory: 1, hewn: 2, crystal: 3 };

export type SurfaceUniforms = {
  uMsScale: { value: number };
  uMsVein: { value: number };
  uMsBump: { value: number };
  uMsEmber: { value: THREE.Color };
};

const common = /* glsl */ `
uniform float uMsScale;uniform float uMsVein;uniform float uMsBump;uniform vec3 uMsEmber;
varying vec3 vMsObj;varying vec3 vMsBx;varying vec3 vMsBy;varying vec3 vMsBz;varying vec3 vMsCam;
float msHash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
vec3 msHash3(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float msNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(msHash(i),msHash(i+vec3(1,0,0)),f.x),mix(msHash(i+vec3(0,1,0)),msHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(msHash(i+vec3(0,0,1)),msHash(i+vec3(1,0,1)),f.x),mix(msHash(i+vec3(0,1,1)),msHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float msFbm(vec3 p){float a=.5,v=0.;for(int i=0;i<4;i++){v+=a*msNoise(p);p=p*2.03+vec3(1.7,9.2,4.1);a*=.5;}return v;}
float msRidge(vec3 p){float a=.5,v=0.;for(int i=0;i<3;i++){float n=1.-abs(2.*msNoise(p)-1.);v+=a*n*n;p=p*2.11+vec3(4.3,1.1,7.7);a*=.5;}return v;}
// Craters from a jittered 3D cell grid: a bowl inside radius r and a raised
// rim. Returns (height, gradient wrt p) analytically, so the relief normal
// needs no extra 27-cell searches.
vec4 msCraters(vec3 p,float density){
  vec3 i=floor(p),f=fract(p);vec4 h=vec4(0.);
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec3 g=vec3(float(x),float(y),float(z));vec3 o=msHash3(i+g);
    if(o.z>density)continue;
    float r=mix(.22,.48,o.x);vec3 v=g+o-f;float l=length(v);float d=l/r;
    if(d>1.6)continue;
    float k=mix(.6,1.,o.y);
    float bowl=d<1.?(d*d-1.)*.9:0.,dbowl=d<1.?1.8*d:0.;
    float rim=exp(-pow((d-1.)*3.2,2.))*.45,drim=rim*(-20.48*(d-1.));
    h+=k*vec4(bowl+rim,-(dbowl+drim)*v/(max(l,1e-4)*r));
  }
  return h;
}
// Thin bright lines along contours of a warped field (like the planet's fissures).
float msVeins(vec3 p,float sharp){float n=msFbm(p+vec3(msNoise(p*1.7),msNoise(p*1.7+4.1),0.)*.9);return pow(1.-abs(sin(n*12.566)),sharp);}
float msEdgeCube(vec3 q){vec3 a=abs(q);float mx=max(a.x,max(a.y,a.z)),mn=min(a.x,min(a.y,a.z));return a.x+a.y+a.z-mx-mn;}
struct MsSurf{float h;vec3 grad;vec3 albedo;float rough;float metal;float glow;};
// Noise part of the height field; its gradient is taken by finite differences.
float msHeightN(vec3 q){
#if MS_KIND == 0
  return .45*msFbm(q*2.2)+.42*msRidge(q*3.8)+.05*msNoise(q*30.)-.18*msVeins(q*1.4,40.)-.3*smoothstep(.42,.58,msFbm(q*1.1+9.))+.1*msRidge(q*11.);
#elif MS_KIND == 1
  return .3*msFbm(q*2.)+.04*msNoise(q*34.);
#elif MS_KIND == 2
  vec3 w=vec3(msFbm(q*1.3),msFbm(q*1.3+5.2),0.);
  float c=msFbm(q*1.6+w*1.4);
  float crack=pow(1.-abs(sin(c*13.)),46.)*smoothstep(.42,.6,w.x);
  float edge=smoothstep(.78,.98,msEdgeCube(q));
  return .42*msFbm(q*3.1)+.22*msRidge(q*7.5)+.05*msNoise(q*34.)-.8*crack-.35*edge*msNoise(q*9.);
#else
  float c=msFbm(q*1.8);
  float frac=pow(1.-abs(sin(c*9.)),40.)*smoothstep(.45,.62,msFbm(q*1.1+2.7));
  return .12*msFbm(q*3.4)+.07*sin(msFbm(q*2.3)*34.)+.03*msNoise(q*40.)-.25*frac;
#endif
}
// Crater part (spheres only), with its analytic gradient wrt q.
vec4 msHeightC(vec3 q){
#if MS_KIND == 0
  vec4 a=msCraters(q*2.3,.35),b=msCraters(q*5.9+3.1,.3);
  return vec4(.35*a.x+.12*b.x,.35*2.3*a.yzw+.12*5.9*b.yzw);
#elif MS_KIND == 1
  vec4 a=msCraters(q*3.4,.7),b=msCraters(q*7.8+5.3,.62),c=msCraters(q*16.+1.7,.55);
  return vec4(.5*a.x+.3*b.x+.14*c.x,.5*3.4*a.yzw+.3*7.8*b.yzw+.14*16.*c.yzw);
#else
  return vec4(0.);
#endif
}
// Colours are authored as display values and converted to linear at the end.
MsSurf msEval(vec3 q){
  MsSurf s;
  float hn=msHeightN(q),e=.004;
  vec3 gn=(vec3(msHeightN(q+vec3(e,0.,0.)),msHeightN(q+vec3(0.,e,0.)),msHeightN(q+vec3(0.,0.,e)))-hn)/e;
  vec4 hc=msHeightC(q);
  s.h=hn+hc.x;s.grad=gn+hc.yzw;
  // Screen footprint of one unit of q: fade pixel-scale detail so small moons do not glitter.
  float fw=length(fwidth(q));
  float msFine=1.-smoothstep(.012,.05,fw);
  float msFineSoft=1.-.5*smoothstep(.02,.08,fw);
#if MS_KIND == 0
  float ridge=msRidge(q*3.8),n=msFbm(q*2.2),micro=msNoise(q*46.);
  float mare=smoothstep(.42,.58,msFbm(q*1.1+9.));
  float vein=msVeins(q*1.4,40.)*smoothstep(.5,.66,msFbm(q*.9+7.1));
  vec3 basalt=mix(vec3(.17,.188,.212),vec3(.3,.318,.345),smoothstep(.3,.75,n));
  basalt=mix(basalt,vec3(.085,.092,.108),mare*.85);
  basalt=mix(basalt,vec3(.5,.54,.59),smoothstep(.55,.9,ridge)*.75*(1.-mare*.6));
  basalt*=1.+.28*(micro-.5)*msFine;
  basalt*=1.-.3*smoothstep(-.1,-.45,s.h);
  s.albedo=pow(mix(basalt,vec3(.66,.4,.22),vein*.4),vec3(2.2));
  s.rough=mix(.74,.46,smoothstep(.55,.9,ridge))-.1*(micro-.5)*msFine-.25*vein;
  s.metal=mix(.1,.7,vein)+.15*smoothstep(.55,.9,ridge);
  s.glow=vein*.28;
#elif MS_KIND == 1
  float n=msFbm(q*1.6),dust=msFbm(q*3.7+2.),micro=msNoise(q*52.);
  vec3 ivory=mix(vec3(.47,.4,.325),vec3(.64,.57,.475),smoothstep(.3,.7,n));
  ivory=mix(ivory,vec3(.58,.4,.27),smoothstep(.55,.8,dust)*.5);
  ivory*=1.+.2*(micro-.5)*msFine;
  ivory*=1.-.22*smoothstep(-.05,-.5,s.h);
  ivory=mix(ivory,vec3(.74,.68,.58),smoothstep(.18,.4,s.h)*.45);
  s.albedo=pow(ivory,vec3(2.2));
  s.rough=.84-.1*(micro-.5)*msFine;
  s.metal=.02+.12*smoothstep(.55,.8,dust);
  s.glow=0.;
#elif MS_KIND == 2
  vec3 w=vec3(msFbm(q*1.3),msFbm(q*1.3+5.2),0.);
  float c=msFbm(q*1.6+w*1.4);
  float mask=smoothstep(.56,.7,w.x);
  float crack=pow(1.-abs(sin(c*13.)),60.)*mask;
  float halo=pow(1.-abs(sin(c*13.)),12.)*mask;
  float n=msFbm(q*3.1),micro=msNoise(q*44.)-.5,grain=msNoise(q*vec3(90.,9.,90.))-.5;
  float edge=smoothstep(.74,.96,msEdgeCube(q))*(.5+.5*msNoise(q*11.));
  vec3 graphite=mix(vec3(.19,.198,.21),vec3(.34,.35,.36),smoothstep(.25,.75,n))*(1.+.3*micro*msFine)*(1.+.14*grain*msFine);
  graphite=mix(graphite,vec3(.78,.76,.72),edge);
  s.albedo=pow(mix(graphite,vec3(.09,.075,.065),halo*.55),vec3(2.2));
  s.rough=mix(.62,.24,edge)-.16*micro*msFine+.1*grain*msFine+.15*halo;
  s.metal=mix(.42,.92,edge)-.25*halo;
  s.glow=crack*.8+halo*.06;
#else
  float micro=msNoise(q*56.)-.5,cloud=msFbm(q*2.6);
  float edge=1.-smoothstep(.0,.07,min(abs(q.x),min(abs(q.y),abs(q.z))));
  edge*=.55+.45*msNoise(q*14.);
  vec3 smoke=mix(vec3(.08,.095,.1),vec3(.19,.21,.215),smoothstep(.3,.75,cloud));
  // Veins below the surface: sample one sparse vein field along the view
  // ray; deeper layers are dimmer and softer.
  vec3 dir=normalize(vMsObj-vMsCam);
  float inner=0.;
  for(int k=1;k<=4;k++){float fk=float(k);vec3 p=q+dir*fk*.13;
    inner+=msVeins(p*1.3+1.3,mix(48.,14.,fk/4.))*smoothstep(.34,.52,msFbm(p*.8+3.3))*exp(-fk*.5);}
  float surf=msVeins(q*1.3+1.3,70.)*smoothstep(.34,.52,msFbm(q*.8+3.3));
  s.albedo=mix(smoke,vec3(.74,.7,.64),edge*.75);
  s.albedo=pow(mix(s.albedo,vec3(.62,.38,.22),surf*.35),vec3(2.2));
  s.rough=mix(.1,.42,edge)+.1*micro*msFine;
  s.metal=.18+.4*surf;
  s.glow=inner*1.1*msFineSoft+surf*.3;
#endif
  return s;
}`;

export function surfaceMaterial(
  kind: SurfaceKind,
  size: number,
  params: THREE.MeshPhysicalMaterialParameters,
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...params });
  const uniforms: SurfaceUniforms = {
    uMsScale: { value: size },
    uMsVein: { value: 1 },
    uMsBump: {
      value: { basalt: 0.14, ivory: 0.11, hewn: 0.22, crystal: 0.065 }[kind],
    },
    uMsEmber: { value: new THREE.Color(0xff8a3c) },
  };
  material.defines = { ...material.defines, MS_KIND: KIND_ID[kind] };
  material.userData.surface = uniforms;
  material.customProgramCacheKey = () => `moon-surface-${kind}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vMsObj;varying vec3 vMsBx;varying vec3 vMsBy;varying vec3 vMsBz;varying vec3 vMsCam;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vMsObj=position;
vMsBx=normalize(normalMatrix*vec3(1.,0.,0.));vMsBy=normalize(normalMatrix*vec3(0.,1.,0.));vMsBz=normalize(normalMatrix*vec3(0.,0.,1.));
vMsCam=(inverse(modelMatrix)*vec4(cameraPosition,1.)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${common}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 msQ=vMsObj/uMsScale;
MsSurf msS=msEval(msQ);
diffuseColor.rgb*=msS.albedo;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor=clamp(msS.rough,.05,1.);',
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor=clamp(msS.metal,0.,1.);',
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{vec3 g=msS.grad.x*vMsBx+msS.grad.y*vMsBy+msS.grad.z*vMsBz;
float lod=1.-smoothstep(.015,.06,length(fwidth(msQ)));
normal=normalize(normal-uMsBump*mix(.35,1.,lod)*(g-dot(g,normal)*normal));}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{float emph=max(emissive.r,max(emissive.g,emissive.b))/.258;
totalEmissiveRadiance+=uMsEmber*msS.glow*(uMsVein+2.4*emph);}`,
      );
  };
  return material;
}
