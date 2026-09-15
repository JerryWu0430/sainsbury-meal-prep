import json

import typer
from rich import box
from rich.console import Console
from rich.table import Table

from rich.markdown import Markdown

from . import api, mealprep, products, store
from .config import MODEL, STORE_CODE

app = typer.Typer(help="Sainsbury's Elephant & Castle: offers, new-in, meal prep.", no_args_is_help=True, add_completion=False)
con = Console()
state = {"json": False}

STAPLES = ["chicken", "salmon", "mince", "eggs", "rice", "pasta", "vegetables", "yogurt", "cheese", "bread"]
NEW_KWS = ["meal", "chicken", "snack", "ready meal", "pasta", "salad", "sauce", "dessert"]


@app.callback()
def _main(json_: bool = typer.Option(False, "--json", help="Raw JSON output")):
    state["json"] = json_


def emit(items: list[dict], title: str):
    if state["json"]:
        print(json.dumps(items, indent=1)); return
    t = Table(title=f"{title} ({len(items)})", header_style="bold", box=box.SIMPLE, expand=True)
    t.add_column("uid", no_wrap=True, style="dim")
    t.add_column("name", ratio=5, min_width=24)
    t.add_column("price", no_wrap=True, justify="right")
    t.add_column("was", no_wrap=True, justify="right", style="dim")
    t.add_column("off", no_wrap=True, justify="right")
    t.add_column("unit", no_wrap=True, style="dim")
    t.add_column("promo", ratio=3, min_width=14)
    t.add_column("ends", no_wrap=True, style="dim")
    for i in items:
        t.add_row(i["uid"], i["name"] + (f"  [dim]{i['life']}[/]" if i["life"] else ""),
                  f"£{i['price']:.2f}" if i["price"] else "-", f"£{i['was']:.2f}" if i["was"] else "",
                  f"[green]{i['pct']}%[/]" if i["pct"] else "", i["unit"],
                  ("[magenta]N[/] " if i["nectar"] else "") + i["promo"], i["ends"][5:])
    con.print(t)


def _multi(kws: list[str], **kw) -> list[dict]:
    seen, out = set(), []
    with con.status("") as st:
        for k in kws:
            st.update(f"searching [bold]{k}[/]…")
            for i in products.search(k, **kw):
                if i["uid"] not in seen:
                    seen.add(i["uid"]); out.append(i)
    return out


@app.command()
def search(keyword: str, offers: bool = typer.Option(False, "--offers", "-o"), new: bool = typer.Option(False, "--new", "-n"),
           sort: str = typer.Option("relevance", help="relevance|price|-price|rating"), pages: int = typer.Option(1, "--pages", "-p", max=5)):
    """Keyword search (add -o for offers only, -n for new-in)."""
    emit(products.search(keyword, offers=offers, new=new, sort=sort, max_pages=pages), f"'{keyword}'")


@app.command()
def offers(keywords: list[str] = typer.Argument(None), min_pct: int = typer.Option(0, "--min", help="min % off")):
    """Discounted items, best % off first. Default: meal-prep staples."""
    items = [i for i in _multi(keywords or STAPLES, offers=True, max_pages=1) if i["pct"] >= min_pct]
    items.sort(key=lambda i: (-i["pct"], i["price"] or 0))
    emit(items, "offers")


@app.command()
def new(keywords: list[str] = typer.Argument(None)):
    """New-in items."""
    emit(_multi(keywords or NEW_KWS, new=True, max_pages=1), "new in")


@app.command()
def item(uid: str):
    """Full product detail JSON."""
    print(json.dumps(products.detail(uid), indent=1))


@app.command()
def stores(query: str, limit: int = 8):
    """Nearest Sainsbury's to a postcode, outcode or place (e.g. "SE1 6TJ", "SW9", "Brixton")."""
    try:
        r = store.find(query, limit)
    except LookupError as e:
        raise typer.BadParameter(str(e))
    if state["json"]:
        print(json.dumps(r, indent=1)); return
    t = Table(title=f"near {r['label']}", header_style="bold", box=box.SIMPLE)
    for c in ("code", "name", "type", "km", "address", "open"):
        t.add_column(c, no_wrap=c != "address")
    for s in r["stores"]:
        t.add_row(s["code"], s["name"], s["type"], f"{s['km']:.1f}", s["address"],
                  f"[green]until {s['open_until']}[/]" if s["open_now"] else "[red]closed[/]")
    con.print(t)
    con.print(f"[dim]use: sains store <code> · SAINS_STORE=<code> · sains ask --store <code>[/]")


@app.command(name="store")
def store_cmd(code: str = typer.Argument(None, help=f"store code (default {STORE_CODE}, or SAINS_STORE)")):
    """A store's hours, facilities, status."""
    s = store.summary(store.info(code or STORE_CODE))
    if state["json"]:
        print(json.dumps(s, indent=1)); return
    con.print(f"[bold]{s['name']}[/] (#{s['code']}, {s['type']}/{s['cluster']})\n{s['address']} · {s['tel']}")
    con.print(f"[{'green' if s['open_now'] else 'red'}]{s['status'] or ('open' if s['open_now'] else 'closed')}[/]")
    t = Table(show_header=False, box=None)
    for d, h in s["hours"]:
        t.add_row(d, h)
    con.print(t)
    con.print("[dim]facilities:[/] " + ", ".join(s["facilities"]))
    if (s["fsa"] or {}).get("score"):
        con.print(f"[dim]FSA hygiene:[/] {s['fsa']['score']}")
    con.print("[dim]NB: online API = delivery range; per-store stock isn't public.[/]")


@app.command(name="mealprep")
def mealprep_cmd(full: bool = typer.Option(False, "--full", help="search all keywords (more requests, slower)")):
    """Batch-cook ideas built from current offers."""
    with con.status("") as st:
        res = mealprep.plan(full=full, on_progress=lambda k: st.update(f"searching [bold]{k}[/]…"))
    if state["json"]:
        print(json.dumps(res, indent=1)); return
    for g, items in res["picks"].items():
        emit(items, g)
    for n, idea in enumerate(res["ideas"], 1):
        con.print(f"\n[bold]{n}. {idea['idea']}[/]  ≈ £{idea['cost']} → £{idea['per_portion']}/portion ×{mealprep.PORTIONS}")
        for i in idea["items"]:
            con.print(f"   • {i['name']} £{i['price']:.2f}" + (f" [green]({i['promo']})[/]" if i["promo"] else ""))


@app.command()
def ask(question: list[str], store_code: str = typer.Option(STORE_CODE, "--store", "-s"), model: str = typer.Option(MODEL, "--model", "-m", help="pydantic-ai model string")):
    """Ask the grocery agent (needs an API key for the chosen model, see .env.example)."""
    from . import agent  # lazy: pydantic-ai import is slow
    try:
        with con.status("thinking…"):
            res = agent.ask(" ".join(question), store_code, model=model)
    except agent.ConfigError as e:
        raise typer.BadParameter(str(e))
    print(res.output) if state["json"] else con.print(Markdown(res.output))


@app.command()
def chat(store_code: str = typer.Option(STORE_CODE, "--store", "-s"), model: str = typer.Option(MODEL, "--model", "-m")):
    """Multi-turn chat with the grocery agent. Empty line or 'q' to quit."""
    from . import agent
    try:
        agent.check_model(model)
    except agent.ConfigError as e:
        raise typer.BadParameter(str(e))
    history = None
    con.print(f"[dim]{model} · store {store_code} · q to quit[/]")
    while (q := con.input("[bold]you>[/] ").strip()) and q.lower() not in ("q", "quit", "exit"):
        with con.status("thinking…"):
            res = agent.ask(q, store_code, history=history, model=model)
        history = res.all_messages()
        con.print(Markdown(res.output))


@app.command()
def plan(cuisine: str = typer.Option(None, "--cuisine", "-c"), sort: str = typer.Option("per_portion", help="per_portion|protein|offers"), top: int = 12):
    """Dishes from the bank priced against today's range: £/portion, macros, offers."""
    from . import dishes
    bank = dishes.load()
    with con.status("") as st:
        cat = dishes.catalogue_for(bank, on_progress=lambda kw: st.update(f"pricing [bold]{kw}[/]…"))
    ranked = dishes.rank(bank, cat, cuisine, sort)[:top]
    if state["json"]:
        print(json.dumps(ranked, indent=1)); return
    t = Table(title=f"plan · sort {sort}", header_style="bold", box=box.SIMPLE, expand=True)
    for c, j in (("£/pt", "right"), ("dish", "left"), ("cuisine", "left"), ("kcal", "right"), ("P", "right"), ("C", "right"), ("F", "right"), ("P/£", "right"), ("offers", "right")):
        t.add_column(c, justify=j, no_wrap=c != "dish", ratio=4 if c == "dish" else None)
    for d in ranked:
        m = d["macros"]
        t.add_row(f"£{d['per_portion']:.2f}", d["name"] + (f"  [dim](no price: {', '.join(d['missing'])})[/]" if d["missing"] else ""), d["cuisine"],
                  f"{m['kcal']:.0f}", f"{m['protein']:.0f}g", f"{m['carbs']:.0f}g", f"{m['fat']:.0f}g", f"{d['protein_per_pound']:.0f}g", f"{d['on_offer']}/{d['n_ingredients']}")
    con.print(t)


dishes_app = typer.Typer(help="Dish bank: list / import (same schema as data/dishes.json).", no_args_is_help=True)
app.add_typer(dishes_app, name="dishes")


@dishes_app.command("list")
def dishes_list():
    from . import dishes
    for d in dishes.load()["dishes"]:
        con.print(f"[bold]{d['id']}[/] {d['name']} · {d['cuisine']} · {d['portions']} pt · {', '.join(r for r, _ in d['ingredients'])}")


@dishes_app.command("import")
def dishes_import(path: str):
    """Merge dishes (by id) and ingredients (by name) from a JSON file into data/dishes.json."""
    from . import dishes
    bank, new = dishes.load(), json.loads(open(path).read())
    bank["ingredients"].update(new.get("ingredients", {}))
    by_id = {d["id"]: d for d in bank["dishes"]}
    for d in new.get("dishes", []):
        missing = [r for r, _ in d["ingredients"] if r not in bank["ingredients"]]
        if missing:
            raise typer.BadParameter(f"{d['id']}: unknown ingredients {missing}")
        by_id[d["id"]] = d
    bank["dishes"] = list(by_id.values())
    dishes.BANK.write_text(json.dumps(bank, indent=1, ensure_ascii=False))
    con.print(f"bank now {len(bank['dishes'])} dishes / {len(bank['ingredients'])} ingredients")


@app.command(name="cache-clear")
def cache_clear():
    """Drop cached API responses."""
    con.print(f"removed {api.clear_cache()} files")
