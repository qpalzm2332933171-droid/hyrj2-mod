import io,re,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
lines=io.open(r"C:\Users\qpalz\Desktop\hyrj2_mod\work\analysis\d5_player.out.txt",encoding="utf-8").read().split("\n")
for l in lines:
    s=l.split("| ",1)[1] if "| " in l else ""
    if re.match(r'^[A-Za-z_$][A-Za-z0-9_$]*: function', s) or re.match(r'^(get|set)[A-Z]', s):
        print(l[:150])
