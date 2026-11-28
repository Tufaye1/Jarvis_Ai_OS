#!/usr/bin/env python3
"""
iPhone USB Inspector - local server.

Runs on your Mac. Reads what Apple's own USB protocol (lockdownd) exposes from a
connected iPhone and serves a web page at http://127.0.0.1:8017.

Nothing leaves your computer: the server listens only on 127.0.0.1 and makes no
internet requests.

Usage:
    python3 inspect_server.py           # real device over USB
    python3 inspect_server.py --demo    # fake data, to try the page without a phone

Built against pymobiledevice3 11.x (async API). Older 4.x-era versions use a
different, synchronous API and will not work.
"""
from __future__ import annotations

import argparse
import asyncio
import dataclasses
import json
import sys
import time
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = 8017
DEMO = False

# ProductType identifiers. [likely] values from public device lists; the page shows
# the raw value so you can confirm it yourself.
PRODUCT_TYPES = {
    "iPhone18,1": "iPhone 17 Pro",
    "iPhone18,2": "iPhone 17 Pro Max",
    "iPhone18,3": "iPhone 17",
    "iPhone18,4": "iPhone Air",
}

PART_PREFIX = {
    "M": ("ok", "New retail unit"),
    "P": ("ok", "Personalised (engraved) retail unit"),
    "F": ("warn", "Apple Certified Refurbished"),
    "N": ("warn", "Replacement unit issued by Apple service"),
}


def luhn_ok(imei: str) -> bool:
    if not imei or len(imei) != 15 or not imei.isdigit():
        return False
    total = 0
    for i, ch in enumerate(reversed(imei)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def check(cid, label, status, value, detail="", source="auto"):
    """status: ok | warn | bad | info | unknown"""
    return {"id": cid, "label": label, "status": status, "value": value, "detail": detail, "source": source}


# --------------------------------------------------------------------------- device reads
async def read_device() -> dict:
    """Collect raw data from the phone. Every optional read is wrapped so one refusal
    does not kill the scan."""
    from pymobiledevice3.lockdown import create_using_usbmux
    from pymobiledevice3.services.diagnostics import DiagnosticsService

    raw: dict = {"errors": {}}
    lockdown = await create_using_usbmux(autopair=True, pair_timeout=90)
    try:
        raw["values"] = dict(lockdown.all_values)

        async def opt(name, coro_factory):
            try:
                raw[name] = await coro_factory()
            except Exception as e:  # noqa: BLE001 - we want every failure recorded, not raised
                raw["errors"][name] = f"{type(e).__name__}: {e}"

        await opt("fmip", lambda: lockdown.get_value(domain="com.apple.fmip", key="IsAssociated"))
        await opt("disk", lambda: lockdown.get_value(domain="com.apple.disk_usage"))
        await opt("battery_domain", lambda: lockdown.get_value(domain="com.apple.mobile.battery"))

        async def battery():
            async with DiagnosticsService(lockdown) as d:
                info = await d.get_battery_info()
                return None if info is None else dataclasses.asdict(info)
        await opt("battery", battery)

        async def mdm():
            from pymobiledevice3.services.mobile_config import MobileConfigService
            async with MobileConfigService(lockdown) as m:
                cloud = await m.get_cloud_configuration()
                profiles = await m.get_profile_list()
            return {"cloud": cloud, "profiles": list((profiles or {}).get("ProfileMetadata", {}).keys())}
        await opt("mdm", mdm)

        async def panics():
            from pymobiledevice3.services.crash_reports import CrashReportsManager
            async with CrashReportsManager(lockdown) as c:
                files = await c.ls("/", depth=-1)
            return [f for f in files if "panic" in f.lower()]
        await opt("panics", panics)
    finally:
        try:
            await lockdown.close()
        except Exception:  # noqa: BLE001
            pass
    return raw


async def read_battery_only() -> dict:
    from pymobiledevice3.lockdown import create_using_usbmux
    from pymobiledevice3.services.diagnostics import DiagnosticsService
    lockdown = await create_using_usbmux(autopair=True, pair_timeout=90)
    try:
        async with DiagnosticsService(lockdown) as d:
            info = await d.get_battery_info()
        return {"t": time.time(), **(dataclasses.asdict(info) if info else {})}
    finally:
        try:
            await lockdown.close()
        except Exception:  # noqa: BLE001
            pass


def demo_raw() -> dict:
    import random
    fc = random.choice([4148, 4071, 3950])
    return {
        "errors": {},
        "values": {
            "DeviceName": "Demo iPhone", "DeviceClass": "iPhone", "ProductType": "iPhone18,1",
            "ProductVersion": "26.1", "BuildVersion": "23B85", "SerialNumber": "F2LXK9QW7P",
            "InternationalMobileEquipmentIdentity": "490154203237518",
            "InternationalMobileEquipmentIdentity2": "356938035643809",
            "ModelNumber": "MG8H4", "RegionInfo": "LL/A", "ActivationState": "Activated",
            "BasebandVersion": "1.10.03", "PasswordProtected": True, "HardwareModel": "D93AP",
            "WiFiAddress": "aa:bb:cc:dd:ee:ff", "BluetoothAddress": "aa:bb:cc:dd:ee:00",
        },
        "fmip": random.random() < 0.25,
        "disk": {"TotalDiskCapacity": 256_000_000_000},
        "battery": {"temperature": 29.4, "voltage": 4012, "instant_amperage": 820, "level": 64,
                    "is_charging": True, "external_connected": True, "fully_charged": False,
                    "cycle_count": random.randint(20, 260), "design_capacity": 4252, "full_charge_capacity": fc},
        "mdm": {"cloud": {}, "profiles": []},
        "panics": random.choice([[], [], ["panic-full-2026-10-02-101233.000.ips"]]),
    }


_demo_level = [64.0]


def demo_battery() -> dict:
    _demo_level[0] -= 0.15
    return {"t": time.time(), "level": int(_demo_level[0]), "is_charging": False, "external_connected": False,
            "instant_amperage": -610, "cycle_count": 87, "design_capacity": 4252, "full_charge_capacity": 4148,
            "temperature": 30.1}


# --------------------------------------------------------------------------- analysis
def analyse(raw: dict, expected: str) -> dict:
    v = raw.get("values", {})
    out = []
    ptype = v.get("ProductType", "")
    model = PRODUCT_TYPES.get(ptype)

    out.append(check("protocol", "Speaks Apple's USB protocol (lockdownd)", "ok", "Yes",
                     "An Android clone cannot answer this protocol. This is the strongest automatic anti-clone signal."))
    out.append(check("class", "Device class", "ok" if v.get("DeviceClass") == "iPhone" else "bad", v.get("DeviceClass")))

    if model is None:
        out.append(check("model", "Model (from ProductType)", "warn", ptype or "missing",
                         "Identifier not in this tool's list. Confirm the model on Apple's Check Coverage page."))
    else:
        want = {"pro": "iPhone 17 Pro", "max": "iPhone 17 Pro Max"}.get(expected)
        st = "ok" if (want is None and model in ("iPhone 17 Pro", "iPhone 17 Pro Max")) or model == want else "bad"
        out.append(check("model", "Model (from ProductType)", st, f"{model}  ({ptype})",
                         "" if st == "ok" else f"You said you are inspecting {want or 'a 17 Pro / Pro Max'}."))

    out.append(check("ios", "iOS version", "info", f"{v.get('ProductVersion')} ({v.get('BuildVersion')})",
                     "Compare with Settings › General › Software Update. It should be current or one step behind."))
    out.append(check("serial", "Serial number", "ok" if len(v.get("SerialNumber", "")) == 10 else "warn",
                     v.get("SerialNumber"), "Paste this into checkcoverage.apple.com. It must show the same model."))

    for key, label in (("InternationalMobileEquipmentIdentity", "IMEI"), ("InternationalMobileEquipmentIdentity2", "IMEI2")):
        val = v.get(key)
        if not val:
            out.append(check(label.lower(), label, "warn", "not reported", "Read it from *#06# instead."))
        else:
            out.append(check(label.lower(), label, "ok" if luhn_ok(val) else "bad", val,
                             "Checksum valid. Compare with *#06#, Settings and the box." if luhn_ok(val)
                             else "Fails the IMEI checksum. Real iPhones never report an invalid IMEI."))

    part = (v.get("ModelNumber") or "") + (v.get("RegionInfo") or "")
    pre = PART_PREFIX.get(part[:1])
    out.append(check("part", "Part number", pre[0] if pre else "warn", part or "missing",
                     pre[1] if pre else "Unexpected first letter."))
    region = v.get("RegionInfo", "")
    out.append(check("region", "Sales region", "ok" if region == "LL/A" else "warn", region or "missing",
                     "LL/A is the US model (eSIM only, no SIM tray)." if region == "LL/A"
                     else "Not LL/A, so this is not a US-market unit. You said you are buying a US variant."))

    act = v.get("ActivationState")
    out.append(check("activation", "Activation state", "ok" if act == "Activated" else "bad", act,
                     "Activated means it passed Apple activation at some point. It does NOT prove Activation Lock is off. "
                     "You still must erase and set it up in front of the seller."))

    fm = raw.get("fmip")
    if "fmip" in raw["errors"] or fm is None:
        out.append(check("findmy", "Find My (Activation Lock)", "unknown", "could not read",
                         "Check manually: Settings › [name] › Find My must be off before you pay."))
    else:
        out.append(check("findmy", "Find My (Activation Lock)", "bad" if fm else "ok", "ON" if fm else "off",
                         "Seller must sign out of their Apple Account before you pay." if fm
                         else "Find My reports not associated."))

    mdm = raw.get("mdm")
    if mdm is None:
        out.append(check("mdm", "Device management (MDM)", "unknown", "could not read",
                         "Check Settings › General › VPN & Device Management manually."))
    else:
        cloud = mdm.get("cloud") or {}
        managed = bool(cloud.get("IsSupervised") or cloud.get("ConfigurationURL") or cloud.get("IsMDMUnremovable"))
        profs = mdm.get("profiles") or []
        st = "bad" if managed else ("warn" if profs else "ok")
        val = "Company-managed" if managed else (f"{len(profs)} profile(s)" if profs else "None")
        out.append(check("mdm", "Device management (MDM)", st, val,
                         "Supervised or enrolled devices belong to an organisation. Walk away." if managed
                         else ("Profiles installed: " + ", ".join(profs)) if profs else "No management profiles."))

    b = raw.get("battery") or {}
    design, full = b.get("design_capacity"), b.get("full_charge_capacity")
    if design and full:
        pct = round(full / design * 100, 1)
        st = "ok" if pct >= 90 else "warn" if pct >= 85 else "bad"
        out.append(check("bhealth", "Battery capacity vs design", st, f"{pct}%  ({full} / {design} mAh)",
                         "Raw reading from the battery chip. Settings › Battery may round differently. "
                         "For a 2025 phone, below 90% is unusual."))
    else:
        out.append(check("bhealth", "Battery capacity vs design", "unknown", "not reported",
                         "Use Settings › Battery › Battery Health instead."))
    cc = b.get("cycle_count")
    if cc is not None:
        out.append(check("cycles", "Battery cycle count", "ok" if cc <= 300 else "warn" if cc <= 500 else "bad", str(cc),
                         "Under ~300 is normal for a phone released Sept 2025. Compare with Settings › Battery."))
    t = b.get("temperature")
    if t is not None:
        out.append(check("btemp", "Battery temperature", "ok" if t < 38 else "warn", f"{t:.1f} °C",
                         "High at rest can mean heavy background load or a battery problem."))

    disk = raw.get("disk") or {}
    tot = disk.get("TotalDiskCapacity")
    if tot:
        gb = tot / 1e9
        size = next((name for cap, name in ((256, "256 GB"), (512, "512 GB"), (1024, "1 TB"), (2048, "2 TB"))
                     if gb <= cap * 1.05), f"{gb:.0f} GB")
        out.append(check("storage", "Storage", "info", f"{size}  ({gb:.0f} GB raw)",
                         "Must match what the seller advertised."))

    panics = raw.get("panics")
    if panics is None:
        out.append(check("panics", "Kernel panic logs", "unknown", "could not read",
                         "Check Settings › Privacy & Security › Analytics & Improvements › Analytics Data for 'panic-full'."))
    else:
        n = len(panics)
        out.append(check("panics", "Kernel panic logs", "ok" if n == 0 else "warn" if n <= 2 else "bad",
                         f"{n} found", "Repeated panics often point to a faulty or non-genuine part. "
                         + ("Files: " + ", ".join(panics[:5]) if n else "")))

    out.append(check("baseband", "Cellular modem firmware", "ok" if v.get("BasebandVersion") else "bad",
                     v.get("BasebandVersion") or "missing",
                     "Missing modem firmware means no cellular service (board fault)."))

    return {"device_name": v.get("DeviceName"), "model": model, "checks": out,
            "battery": b, "errors": raw.get("errors", {}), "demo": DEMO}


# --------------------------------------------------------------------------- http
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("  " + fmt % args + "\n")

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path, _, query = self.path.partition("?")
        params = dict(p.split("=", 1) for p in query.split("&") if "=" in p)
        try:
            if path in ("/", "/index.html"):
                return self._send(200, (HERE / "app.html").read_bytes(), "text/html; charset=utf-8")
            if path == "/api/scan":
                raw = demo_raw() if DEMO else asyncio.run(read_device())
                return self._send(200, analyse(raw, params.get("expect", "")))
            if path == "/api/battery":
                return self._send(200, demo_battery() if DEMO else asyncio.run(read_battery_only()))
            return self._send(404, {"error": "not found"})
        except Exception as e:  # noqa: BLE001
            msg = f"{type(e).__name__}: {e}"
            hint = ("No iPhone found. Plug it in with a data cable, unlock it, and tap Trust."
                    if "NoDevice" in msg or "ConnectionFailed" in msg or "not found" in msg.lower()
                    else "Unlock the phone and tap Trust if asked, then try again.")
            traceback.print_exc()
            return self._send(500, {"error": msg, "hint": hint})


def main():
    global DEMO
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--demo", action="store_true", help="serve fake data, no phone needed")
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()
    DEMO = args.demo
    if not DEMO:
        try:
            import pymobiledevice3  # noqa: F401
        except ImportError:
            sys.exit("pymobiledevice3 is not installed. Run ./run.sh, or: pip install pymobiledevice3")
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}/"
    print(f"\n  iPhone USB Inspector running at {url}{'  (DEMO DATA)' if DEMO else ''}\n  Ctrl+C to stop.\n")
    if not args.no_browser:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
