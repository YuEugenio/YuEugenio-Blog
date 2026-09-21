precision highp float;
varying vec2 v;
uniform sampler2D prev;
uniform vec2 tx;
uniform vec2 ms;
uniform vec2 msV;
uniform float asp;
void main(){
  vec2 uv=v;
  vec2 f=texture2D(prev,uv).rg;
  vec2 adv=texture2D(prev,uv-f*.001).rg;
  vec2 L=texture2D(prev,uv+vec2(-tx.x,0.)).rg;
  vec2 R=texture2D(prev,uv+vec2(tx.x,0.)).rg;
  vec2 U=texture2D(prev,uv+vec2(0.,tx.y)).rg;
  vec2 D=texture2D(prev,uv+vec2(0.,-tx.y)).rg;
  vec2 LU=texture2D(prev,uv+vec2(-tx.x,tx.y)).rg;
  vec2 RU=texture2D(prev,uv+vec2(tx.x,tx.y)).rg;
  vec2 LD=texture2D(prev,uv+vec2(-tx.x,-tx.y)).rg;
  vec2 RD=texture2D(prev,uv+vec2(tx.x,-tx.y)).rg;
  vec2 diff=(adv*4.+(L+R+U+D)*2.+(LU+RU+LD+RD))/16.;
  float d=length((uv-ms)*vec2(asp,1.));
  vec2 force=msV*exp(-d*d*3.)*.3;
  gl_FragColor=vec4(diff*.99+force,0.,1.);
}
