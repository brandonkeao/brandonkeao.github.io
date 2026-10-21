import * as THREE from 'three';

/**
 * Central planet: a dark graphite world that is never still.
 *
 * - The crust turns once every ~90 s around a tilted axis. Its copper fissures
 *   follow contour lines of a domain-warped field whose warp evolves slowly, so
 *   the network reads as convection, not a scrolling texture.
 * - A second, zonal band layer drifts the other way at a different rate.
 * - Energy travels through the fissures and along thin filaments near the rim.
 * - The limb glow breathes on a ~7 s sine (continuous, not a heartbeat).
 * - Speech (envelope 0..1, smoothed here) speeds the bands, flares the
 *   fissures, rim and corona and adds a ~4% volume swell; a copper ripple
 *   travels from the disc centre out to the limb at the text cadence. The
 *   speaking response was doubled on 2026-09-30 (Brandon: "the speaking
 *   digitized motion of the central planet needs to be more pronounced");
 *   SPEECH holds the multipliers. Idle is unchanged.
 *
 * One draw for the body (sphere) and one for the corona (camera-facing quad
 * behind the disc, depth-tested so only the part outside the limb shows).
 * Everything is procedural; no textures.
 */

export type PlanetPalette = {
  /** Unlit graphite. */
  graphite: THREE.ColorRepresentation;
  /** Graphite under the key light. */
  graphiteLit: THREE.ColorRepresentation;
  /** Band and rim copper. */
  copper: THREE.ColorRepresentation;
  /** Hot fissure colour. */
  ember: THREE.ColorRepresentation;
};

export type PlanetLights = { key: THREE.Vector3; fill: THREE.Vector3; rim: THREE.Vector3 };

export type Planet = {
  group: THREE.Group;
  /** The sphere; raycast target and transform owner for the host. */
  body: THREE.Mesh;
  /** The corona quad; the host copies the body's position and scale onto it. */
  glow: THREE.Mesh;
  /**
   * `t` is the planet clock in seconds (advance it only while motion is
   * allowed); `fade` scales the corona (1 in the overview, 0 when shrunk away).
   */
  update(t: number, envelope: number, emphasis: number, dim: number, fade?: number): void;
  /**
   * The overlay title's half width and half height in planet radii, so the
   * speaking response stays calm behind it (defaults fit the 1440 layout).
   */
  setTextZone(halfWidth: number, halfHeight: number): void;
  dispose(): void;
};

export const DEFAULT_PALETTE: PlanetPalette = {
  graphite: 0x0b0c0c,
  graphiteLit: 0x34302c,
  copper: 0xf0a468,
  ember: 0xffa04e,
};

const TAU = Math.PI * 2;
const TILT = 0.24;
/**
 * Speaking response at envelope 1 (idle is envelope 0 and ignores these).
 * Previous values (before 2026-09-30) in comments.
 */
export const SPEECH = {
  /** Band drift speed-up: x(1 + env * k). Was 2.2. */
  bandSpeed: 4.4,
  /** Crust spin speed-up. Was 0.35. */
  spin: 0.5,
  /** Warp flow rate added. Was 0.1. */
  flow: 0.2,
  /** Energy (fissure/filament travel) rate added. Was 0.9. */
  energy: 1.8,
  /** Fissure emission gain. Was 1.7. */
  fissure: 3.4,
  /** Band emission gain. Was 0.65. */
  band: 1.3,
  /** Limb fresnel gain. Was 0.7. */
  rim: 1.4,
  /** Limb filament gain. Was 1.1. */
  filament: 2.2,
  /** Corona gain. Was 0.9. */
  corona: 1.8,
  /** Volume swell. Was 0.02. */
  pulse: 0.04,
  /** Ripple crest travel, phase radians per second at envelope 1. New. */
  rippleSpeed: 11,
  /** Ripple strength. New. */
  ripple: 1,
} as const;

const noise = `float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,v=0.;for(int i=0;i<4;i++){v+=a*noise3(p);p=p*2.03+vec3(1.7,9.2,4.1);a*=.5;}return v;}
vec3 ry(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}`;

const bodyVertex = `uniform float uPulse;varying vec3 vPos;varying vec3 vNormal;varying vec3 vWorld;
void main(){vPos=position;vNormal=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position*uPulse,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;

const bodyFragment = `${noise}
varying vec3 vPos;varying vec3 vNormal;varying vec3 vWorld;
uniform float uSpin;uniform float uDrift;uniform float uFlow;uniform float uEnergy;
uniform float uBreath;uniform float uEnv;uniform float uEmphasis;uniform float uDim;
uniform float uRipple;uniform float uRippleAmp;uniform vec2 uText;
uniform vec3 uKey;uniform vec3 uFill;uniform vec3 uRim;
uniform vec3 uGraphite;uniform vec3 uGraphiteLit;uniform vec3 uCopper;uniform vec3 uEmber;
void main(){
  vec3 n=normalize(vNormal),v=normalize(cameraPosition-vWorld);
  float ndv=max(dot(n,v),0.);
  // Axis-aligned coordinates: undo the axial tilt so latitude is .y.
  vec3 p=normalize(vPos);
  float ct=cos(${TILT.toFixed(3)}),st=sin(${TILT.toFixed(3)});
  vec3 a=vec3(ct*p.x+st*p.y,-st*p.x+ct*p.y,p.z);
  float lat=a.y;

  // Crust: solid rotation; warp field evolves with uFlow (slow convection).
  vec3 c=ry(a,uSpin);
  vec2 w=vec2(fbm(c*1.7+vec3(0.,0.,uFlow)),fbm(c*1.7+vec3(5.2,1.3,-uFlow*.8)));
  float terrain=fbm(c*2.3+vec3(w*2.2,w.x*w.y*2.));
  float detail=noise3(c*15.+vec3(w,0.)*4.)*.5+noise3(c*46.)*.5;

  // Bands: zonal layer drifting the other way, warped along longitude.
  vec3 b=ry(a,uDrift);
  float bw=fbm(b*vec3(1.6,4.8,1.6)+vec3(uFlow*.6,0.,-uFlow*.4));
  float bandWave=lat*26.+bw*2.4+w.x*.7;
  float band=pow(.5+.5*sin(bandWave),14.)+.45*pow(.5+.5*sin(bandWave*2.6+w.y*3.),20.);
  float bandSoft=.5+.5*sin(bandWave*.5+1.3);

  // Lighting on graphite with bump-like normal breakup for specular.
  vec3 nb=normalize(n+vec3(w.x-.5,w.y-.5,terrain-.5)*.35+(detail-.5)*.08);
  float ndl=dot(n,uKey);
  float lit=smoothstep(-.14,.5,ndl);
  float term=exp(-pow((ndl-.02)/.08,2.));
  vec3 base=mix(uGraphite,uGraphiteLit,.35+.5*smoothstep(.3,.7,terrain))*(.72+.56*detail);
  base*=.7+.6*bandSoft;
  vec3 col=base*(.04+1.8*max(ndl,0.)*lit*vec3(1.1,1.,.86));
  col+=uGraphite*vec3(.6,1.,.9)*.5*max(dot(n,uFill),0.);
  col+=uCopper*term*.08*(.4+terrain);
  float gloss=.35+.65*smoothstep(.45,.7,terrain);
  float spec=pow(max(dot(reflect(-uKey,nb),v),0.),90.)*smoothstep(.42,.78,detail);
  col+=vec3(1.,.84,.64)*spec*.26*gloss*lit;

  // Emission is calmer at the centre-front so the label overlay reads.
  float calm=mix(1.,.34,smoothstep(.55,.97,ndv));
  // The speech-driven part is held back harder over the centre-front and
  // over the overlay title's box (uText: half width and half height in planet
  // radii, measured by the host; on phones the title spans nearly the whole
  // disc). Speaking then reads at the limb and outer disc while "Your focus"
  // stays steady.
  vec3 nv=(viewMatrix*vec4(n,0.)).xyz;
  float textZone=(1.-smoothstep(uText.x,uText.x+.22,abs(nv.x)))*(1.-smoothstep(uText.y,uText.y+.18,abs(nv.y)));
  float speechCalm=mix(1.,.15,max(smoothstep(.55,.85,ndv),textZone));
  float env=uEnv*speechCalm;
  float mask=smoothstep(.55,.7,w.x);
  float fis=pow(1.-abs(sin(terrain*12.57)),40.)*mask;
  float flowE=smoothstep(.32,.78,noise3(c*2.8+vec3(uEnergy,-uEnergy*.6,uEnergy*.3)));
  float fisE=fis*(.25+.75*flowE);
  vec3 emit=uEmber*fisE*(.32+${SPEECH.fissure.toFixed(2)}*env)*(.55+.7*(1.-lit));
  float bandE=band*(.35+.65*noise3(b*vec3(3.,9.,3.)+vec3(uEnergy*.7,0.,0.)));
  emit+=uCopper*bandE*(.2+${SPEECH.band.toFixed(2)}*env)*(.35+.65*lit);

  // Speech ripple: soft copper crests travel from the disc centre out to the
  // limb (screen-concentric, bent by the warp field so they are not perfect
  // rings), brightening the bands and fissures they cross. Faded out near
  // the centre-front so the overlay text stays calm; zero at idle.
  float rr=acos(clamp(ndv,0.,1.));
  float crest=pow(.5+.5*sin(rr*8.5-uRipple+(w.x-.5)*2.2),5.);
  float rip=crest*uRippleAmp*smoothstep(.75,1.3,rr)*(1.-.85*textZone);
  emit*=1.+1.6*rip;
  emit+=uCopper*rip*(.07+.18*lit);

  // Limb: copper fresnel that breathes, plus moving filaments just inside it.
  // env is already calmed over the centre-front and the title box.
  float fres=pow(1.-ndv,3.);
  float breath=.82+.18*uBreath;
  col+=uCopper*fres*(.22+.8*max(dot(n,uRim),0.)+.5*lit)*breath*(1.+${SPEECH.rim.toFixed(2)}*env);
  float fil=pow(1.-abs(2.*noise3(c*6.5+vec3(0.,uEnergy*1.6,uFlow*3.))-1.),9.);
  emit+=uEmber*fil*pow(1.-ndv,1.6)*smoothstep(.02,.25,ndv)*(.5+${SPEECH.filament.toFixed(2)}*env)*breath;

  col+=emit*calm;
  col+=uCopper*.2*uEmphasis*(.35+lit);
  gl_FragColor=vec4(col*uDim,1.);
}`;

const glowVertex = `uniform float uSize;varying vec2 vQ;
void main(){float s=length(modelMatrix[0].xyz);vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);vQ=position.xy*uSize;
c.xy+=position.xy*uSize*s*${'RADIUS'};gl_Position=projectionMatrix*c;}`;

const glowFragment = `${noise}
varying vec2 vQ;uniform float uSize;uniform float uFlow;uniform float uBreath;uniform float uEnv;uniform float uAlpha;
uniform vec2 uKeyScreen;uniform vec3 uCopper;uniform vec3 uEmber;
void main(){
  float r=length(vQ);
  if(r>uSize)discard;
  vec2 d=vQ/max(r,1e-4);
  float e=max(r-1.,0.);
  float inside=smoothstep(.97,1.005,r);
  float halo=exp(-e*22.)*inside;
  float corona=exp(-e*4.2)*inside;
  float streak=noise3(vec3(d*2.6,e*1.8-uFlow*1.6))*.65+noise3(vec3(d*6.,e*4.-uFlow*2.4))*.35;
  float side=.45+.55*max(dot(d,uKeyScreen),0.)+.2*max(dot(d,-uKeyScreen),0.);
  float breath=.8+.2*uBreath;
  vec3 col=uCopper*halo*.55+uCopper*corona*(.035+.08*streak)*(.6+.8*streak);
  col*=side*breath*(1.+${SPEECH.corona.toFixed(2)}*uEnv)*smoothstep(uSize,uSize*.7,r);
  gl_FragColor=vec4(col*uAlpha,1.);
}`;

export function createPlanet(opts: {
  radius: number;
  palette?: Partial<PlanetPalette>;
  lights: PlanetLights;
}): Planet {
  const palette = { ...DEFAULT_PALETTE, ...opts.palette };
  const color = (c: THREE.ColorRepresentation) => new THREE.Color(c);
  const bodyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSpin: { value: 0 },
      uDrift: { value: 0 },
      uFlow: { value: 0 },
      uEnergy: { value: 0 },
      uBreath: { value: 0 },
      uEnv: { value: 0 },
      uRipple: { value: 0 },
      uRippleAmp: { value: 0 },
      uText: { value: new THREE.Vector2(0.62, 0.18) },
      uPulse: { value: 1 },
      uEmphasis: { value: 0 },
      uDim: { value: 1 },
      uKey: { value: opts.lights.key.clone().normalize() },
      uFill: { value: opts.lights.fill.clone().normalize() },
      uRim: { value: opts.lights.rim.clone().normalize() },
      uGraphite: { value: color(palette.graphite) },
      uGraphiteLit: { value: color(palette.graphiteLit) },
      uCopper: { value: color(palette.copper) },
      uEmber: { value: color(palette.ember) },
    },
    vertexShader: bodyVertex,
    fragmentShader: bodyFragment,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(opts.radius, 128, 96), bodyMaterial);

  // Screen-space direction toward the key light (upper-left in the default view).
  const keyScreen = new THREE.Vector2(opts.lights.key.x, opts.lights.key.y).normalize();
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: 2.1 },
      uFlow: { value: 0 },
      uBreath: { value: 0 },
      uEnv: { value: 0 },
      uAlpha: { value: 1 },
      uKeyScreen: { value: keyScreen },
      uCopper: { value: color(palette.copper) },
      uEmber: { value: color(palette.ember) },
    },
    vertexShader: glowVertex.replace('RADIUS', opts.radius.toFixed(4)),
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMaterial);
  glow.frustumCulled = false;
  // Draw after the body so the depth test hides the part behind the disc.
  glow.renderOrder = 1;

  const group = new THREE.Group();
  group.add(body, glow);

  const bu = bodyMaterial.uniforms,
    gu = glowMaterial.uniforms;
  let last = -1,
    env = 0,
    spin = 0,
    drift = 0,
    flow = 0,
    energy = 0,
    ripple = 0,
    rippleAmp = 0;
  return {
    group,
    body,
    glow,
    update(t, envelope, emphasis, dim, fade = 1) {
      const dt = last < 0 ? 0 : Math.min(Math.max(t - last, 0), 0.05);
      last = t;
      // Low-pass the syllable-rate envelope so brightness swells, never flickers.
      // A frozen clock (paused, reduced motion) renders the settled state.
      env = dt === 0 ? envelope : env + (envelope - env) * (1 - Math.exp(-dt / 0.32));
      // The ripple follows the text cadence more closely (0.14 s), still
      // low-passed so crests swell rather than blink.
      rippleAmp =
        dt === 0 ? envelope : rippleAmp + (envelope - rippleAmp) * (1 - Math.exp(-dt / 0.14));
      spin += dt * (TAU / 90) * (1 + env * SPEECH.spin);
      drift -= dt * (TAU / 150) * (1 + env * SPEECH.bandSpeed);
      flow += dt * (0.045 + env * SPEECH.flow);
      energy += dt * (0.22 + env * SPEECH.energy);
      ripple += dt * SPEECH.rippleSpeed * rippleAmp;
      const breath = Math.sin((t * TAU) / 7);
      bu.uSpin.value = spin;
      bu.uDrift.value = drift;
      bu.uFlow.value = flow;
      bu.uEnergy.value = energy;
      bu.uBreath.value = breath;
      bu.uEnv.value = env;
      bu.uRipple.value = ripple;
      bu.uRippleAmp.value = rippleAmp * SPEECH.ripple;
      bu.uPulse.value = 1 + env * SPEECH.pulse;
      bu.uEmphasis.value = emphasis;
      bu.uDim.value = dim;
      gu.uFlow.value = flow;
      gu.uBreath.value = breath;
      gu.uEnv.value = env;
      gu.uAlpha.value = fade * dim;
      gu.uSize.value = 2.1;
    },
    setTextZone(halfWidth, halfHeight) {
      bu.uText.value.set(Math.min(halfWidth, 1.2), Math.min(halfHeight, 0.6));
    },
    dispose() {
      body.geometry.dispose();
      bodyMaterial.dispose();
      glow.geometry.dispose();
      glowMaterial.dispose();
    },
  };
}
