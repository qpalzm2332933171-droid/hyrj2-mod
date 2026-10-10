# -*- coding: utf-8 -*-
"""通用源码检索: python g.py <pattern> [before] [after] [limit] [--file=...]"""
import io,sys,os
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
ROOT=r"C:\Users\qpalz\Desktop\hyrj2_mod"
args=[a for a in sys.argv[1:]]
fname="project.hot.dec.js"
for a in args[:]:
    if a.startswith("--file="):
        fname=a.split("=",1)[1]; args.remove(a)
pat=args[0]
before=int(args[1]) if len(args)>1 else 2
after=int(args[2]) if len(args)>2 else 8
limit=int(args[3]) if len(args)>3 else 20
src=io.open(os.path.join(ROOT,"game-source",fname),encoding="utf-8",errors="replace").read()
lines=src.split("\n")
print("### %r count=%d in %s"%(pat,src.count(pat),fname))
n=0
for i,l in enumerate(lines):
    if pat in l:
        n+=1
        if n>limit:
            print("... (more than %d)"%limit); break
        for j in range(max(0,i-before),min(len(lines),i+after)):
            mark=">>" if j==i else "  "
            print("%s%6d| %s"%(mark,j+1,lines[j][:235]))
        print("-"*54)
