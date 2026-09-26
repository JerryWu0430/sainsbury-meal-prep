import time

from sains import auth


def test_verify(monkeypatch):
    monkeypatch.setenv("AUTH_SECRET", "s3cret")
    exp = str(int(time.time()) + 60)
    good = f"{exp}.{auth._sig(exp, 's3cret')}"
    assert auth.verify(good)
    assert not auth.verify(f"{exp}.{auth._sig(exp, 'other')}")          # wrong secret
    assert not auth.verify(good, now=int(exp) + 1)                        # expired
    assert not auth.verify(f"{int(exp) + 999}.{good.split('.')[1]}")      # tampered exp
    assert not auth.verify(None) and not auth.verify("junk")


def test_no_secret_rejects(monkeypatch):
    monkeypatch.delenv("AUTH_SECRET", raising=False)
    assert not auth.verify("9999999999.abc")


def test_matches_ts_signer(monkeypatch):
    # vector from lib/auth.ts: createHmac("sha256", "s3cret").update("4102444800").digest("base64url")
    monkeypatch.setenv("AUTH_SECRET", "s3cret")
    assert auth._sig("4102444800", "s3cret") == TS_SIG


TS_SIG = "rbzGsxOc9FCc4icAAuHoba_pSdj7qMwPvIJjjSDrbGs"
