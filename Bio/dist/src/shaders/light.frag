precision highp float;
varying vec2 v;
uniform sampler2D tex;
uniform sampler2D field;
uniform float T;
uniform float asp;
uniform float iAsp;
uniform float scrl;

vec3 mod289(vec3 x){return x-floor(x/289.)*289.;}
vec2 mod289(vec2 x){return x-floor(x/289.)*289.;}
vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)),x0=v-i+dot(i,C.xx);
  vec2 i1=x0.x>x0.y?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;
  i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
  m=m*m;m=m*m;
  vec3 x=2.*fract(p*C.www)-1.,h=abs(x)-.5,ox=floor(x+.5),a0=x-ox;
  m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}
float fbm(vec2 p){
  float f=0.,a=.5;
  for(int i=0;i<4;i++){f+=a*snoise(p);p*=2.07;a*=.47;}
  return f;
}
vec2 coverUV(vec2 uv,float sA,float iA){
  vec2 s=uv-.5;
  if(sA>iA)s.y*=iA/sA; else s.x*=sA/iA;
  return s+.5;
}

void main(){
  vec2 uv=v;
  float t=T*.08;

  vec2 fd=texture2D(field,uv).rg;

  vec2 p=uv*2.8;
  vec2 q=vec2(fbm(p+t*.8),fbm(p+vec2(5.2,1.3)+t*.65));
  vec2 r=vec2(fbm(p+3.2*q+vec2(1.7,9.2)+t*.22),fbm(p+3.2*q+vec2(8.3,2.8)+t*.32));
  vec2 nd=r*(.01+.003*sin(T*.25));

  vec2 dist=fd*.8+nd;

  float breath=1.+sin(T*.2)*.005;
  vec2 baseUV=coverUV(uv,asp,iAsp);
  baseUV=(baseUV-.5)*breath+.5;

  vec2 caDir=fd*.4+(uv-.5)*.003+r*.002;
  float cr=texture2D(tex,baseUV+dist+caDir*1.3).r;
  float cg=texture2D(tex,baseUV+dist).g;
  float cb=texture2D(tex,baseUV+dist-caDir*1.3).b;
  vec3 col=vec3(cr,cg,cb);

  float hC=fd.x+fd.y+r.x*.3;
  float eps=.008;
  float hR=texture2D(field,uv+vec2(eps,0.)).r+texture2D(field,uv+vec2(eps,0.)).g;
  float hU=texture2D(field,uv+vec2(0.,eps)).r+texture2D(field,uv+vec2(0.,eps)).g;
  hR+=fbm((p+vec2(eps*2.8,0.))+3.2*q+vec2(1.7,9.2)+t*.22)*.3;
  hU+=fbm((p+vec2(0.,eps*2.8))+3.2*q+vec2(1.7,9.2)+t*.22)*.3;
  vec3 N=normalize(vec3((hC-hR)*5./eps,(hC-hU)*5./eps,1.));
  float NdV=max(N.z,0.);

  vec3 L=normalize(vec3(.3,.5,1.));
  col+=vec3(1.,.97,.92)*pow(max(dot(N,normalize(L+vec3(0.,0.,1.))),0.),80.)*.1;
  vec3 L2=normalize(vec3(-.4,.3,.9));
  col+=vec3(.85,.9,1.)*pow(max(dot(N,normalize(L2+vec3(0.,0.,1.))),0.),48.)*.05;

  float fres=pow(1.-NdV,4.)*.3;
  vec3 iri=.5+.5*cos(6.28*(hC*.5+vec3(0.,.33,.67)));
  col+=iri*fres*.12;

  col=pow(col,vec3(1.06,1.02,.97));
  col*=vec3(.95,.97,1.06);

  // Keep the CG texture visible behind the copy, without competing with it.
  col*=mix(1.,.18,smoothstep(0.,.4,scrl));

  vec2 ct=uv-.5;
  col*=1.-dot(ct,ct)*.6;

  col+=(fract(sin(dot(gl_FragCoord.xy+T,vec2(12.9898,78.233)))*43758.5453)-.5)*.01;
  gl_FragColor=vec4(max(col,vec3(0.)),1.);
}
