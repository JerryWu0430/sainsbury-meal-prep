import json

import typer
from rich import box
from rich.console import Console
from rich.table import Table

from . import api, mealprep, products, store

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


@app.command(name="store")
def store_cmd():
    """Elephant & Castle store: hours, facilities, status."""
    s = store.summary(store.info())
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


@app.command(name="cache-clear")
def cache_clear():
    """Drop cached API responses."""
    con.print(f"removed {api.clear_cache()} files")
