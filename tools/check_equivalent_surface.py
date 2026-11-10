#!/usr/bin/env python3
"""Independent check of the equivalent-surface statements made on this site.

Needs numpy, scipy and sympy:

    pip install numpy scipy sympy
    python3 tools/check_equivalent_surface.py

It verifies, for n^2(r) = 2 r^(-2+1/B) - r^(-2+2/B):
  (a) the Gaussian curvature of the optical metric (Luneburg is not a sphere,
      Maxwell fish-eye is);
  (b) the closed form s(rho) = B (rho + arcsin rho) against direct quadrature;
  (d) that the Eaton optical path to the origin is 1 + pi/2;
  (e) that the surface height is finite for B = 1/2, 3/4, 1;
  (f) the azimuth B (pi + 2 arccos b) swept by a traced ray;
  (g) that n r sin(psi) is conserved along a ray and n cos(psi) is not.
"""
import numpy as np, sympy as sp
from scipy.integrate import quad, solve_ivp

print("== (a) Gaussian curvature of the optical metric n^2 (dr^2 + r^2 dphi^2)")
r = sp.symbols('r', positive=True)
def K(n):
    f = sp.log(n)
    return sp.simplify(-(sp.diff(f, r, 2) + sp.diff(f, r)/r)/n**2)
print("   Luneburg  n^2=2-r^2      K =", K(sp.sqrt(2-r**2)), " (not constant -> not a sphere)")
print("   Maxwell   n=2/(1+r^2)    K =", K(2/(1+r**2)), " (constant -> unit sphere)")

print("== (b) meridian arc length s(rho) from eq.(4), s' = n/(n + r n'), vs closed form B(rho + asin rho)")
for B in (0.5, 0.75, 1.0):
    p, q = -2+1/B, 1/B
    n  = lambda x: np.sqrt(2*x**p - x**(p+q))
    worst = 0
    for rv in (0.2, 0.5, 0.8, 0.95):
        s_num = quad(n, 0, rv)[0]                      # s = int n dr
        rho = rv*n(rv)
        worst = max(worst, abs(s_num - B*(rho+np.arcsin(rho))))
    print(f"   B={B}: max |s_num - B(rho+asin rho)| = {worst:.2e};  s'(0)=2B={2*B} -> apex half-angle = {np.degrees(np.arcsin(1/(2*B))):.1f} deg")

print("== (c) is the unit sphere the Luneburg surface?  sphere needs s = asin(rho)")
rv=0.6; n=np.sqrt(2-rv**2); rho=rv*n
print(f"   at r=0.6: optical length s = {quad(lambda x: np.sqrt(2-x*x),0,rv)[0]:.6f};  sphere asin(rho) = {np.arcsin(rho):.6f};  Rinehart (rho+asin rho)/2 = {(rho+np.arcsin(rho))/2:.6f}")

print("== (d) Eaton optical path from rim to origin, int_0^1 sqrt(2/r-1) dr")
print(f"   = {quad(lambda x: np.sqrt(2/x-1),0,1)[0]:.8f}   (1+pi/2 = {1+np.pi/2:.8f})  -> finite, does not diverge")

print("== (e) surface height z(1) = int_0^1 sqrt(s'^2-1) drho, s' = B(1+1/sqrt(1-rho^2))")
for B in (0.5, 0.75, 1.0):
    z = quad(lambda x: np.sqrt(max((B*(1+1/np.sqrt(1-x*x)))**2-1,0)),0,1,limit=200)[0]
    print(f"   B={B}: z(1) = {z:.6f}  (finite)")

print("== (f) azimuth swept inside the lens by a ray of impact parameter b:  B(pi + 2 acos b)")
def sweep_grin(b,B,h=1e-3):
    p,q=-2+1/B,1/B
    def gn(x,y):
        rr=np.hypot(x,y)
        if rr>=1: return 1.,0.,0.
        nn=np.sqrt(2*rr**p-rr**(p+q)); dn=(p*rr**(p-1)-0.5*(p+q)*rr**(p+q-1))/nn
        return nn,dn*x/rr,dn*y/rr
    def f(t,u):
        x,y,vx,vy=u; nn,gx,gy=gn(x,y); d=gx*vx+gy*vy
        return [vx,vy,(gx-d*vx)/nn,(gy-d*vy)/nn]
    x0=-np.sqrt(1-b*b)
    ev=lambda t,u: np.hypot(u[0],u[1])-1.0
    ev.terminal=True; ev.direction=1
    sol=solve_ivp(f,[0,40],[x0+1e-9,b,1,0],events=ev,rtol=1e-11,atol=1e-13,max_step=5e-3)
    ang=np.unwrap(np.arctan2(sol.y[1],sol.y[0]))
    return abs(ang[-1]-ang[0])
for B in (0.5,0.75,1.0):
    for b in (0.3,0.7):
        print(f"   B={B} b={b}: traced {sweep_grin(b,B):.6f}   formula {B*(np.pi+2*np.arccos(b)):.6f}   (sphere would give pi = {np.pi:.6f})")

print("== (g) Bouguer invariant n r sin(psi) vs 'n cos(psi)' along a Luneburg ray (b=0.6)")
def f(t,u):
    x,y,vx,vy=u; n2=2-x*x-y*y
    d=x*vx+y*vy
    return [vx,vy,(-x+d*vx)/n2,(-y+d*vy)/n2]
sol=solve_ivp(f,[0,1.2],[-0.8+1e-12,0.6,1,0],rtol=1e-12,atol=1e-14,dense_output=True)
for t in (0.0,0.4,0.8,1.2):
    x,y,vx,vy=sol.sol(t); rr=np.hypot(x,y); nn=np.sqrt(2-rr*rr)
    sinpsi=(x*vy-y*vx)/rr; cospsi=(x*vx+y*vy)/rr
    print(f"   s={t}: n r sin(psi) = {nn*rr*sinpsi:+.8f}    n cos(psi) = {nn*cospsi:+.6f}")
