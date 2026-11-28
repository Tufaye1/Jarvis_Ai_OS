# iPhone USB Inspector

Plug a pre-owned iPhone 17 Pro / Pro Max into your Mac, press Enter, and get an automatic
readout. Then run guided hands-on checks and compare every phone you look at across shops.

## Setup (once, at home, with internet)

```bash
cd tools/iphone-inspector/usb
./run.sh --demo   # try the page with fake data first
./run.sh          # real use; opens http://127.0.0.1:8017
```

Needs macOS with Python 3.9+ (`python3 --version`). Nothing is sent to the internet; the
server only listens on 127.0.0.1.

## What the Mac reads automatically (over USB, via Apple's lockdownd protocol)

| Check | Rules the phone out when |
|---|---|
| Answers Apple's USB protocol at all | it doesn't (Android clone) |
| Model identifier (ProductType) | not the model you expected |
| Serial, IMEI, IMEI2 (checksum) | IMEI fails the checksum |
| Part number prefix (M / F / N / P) and region (LL/A = US) | flagged, not ruled out |
| Activation state | not "Activated" |
| Find My | still on |
| MDM / supervision / profiles | company-managed |
| Battery: full-charge vs design capacity, cycle count, temperature | flagged |
| Storage size | flagged if it doesn't match the listing |
| Kernel panic logs | flagged, 3+ is a fail |
| Cellular modem firmware present | missing |

Any read the phone refuses shows **Unknown**. Do that check by hand.

## What it cannot do

- Detect non-genuine screens, batteries or cameras. Use Settings › General › About › Parts and Service History.
- Prove Activation Lock is off. "Find My off" plus a fresh erase and setup does.
- Check carrier blacklists or carrier lock. Use Settings › General › About › Carrier Lock and your carrier.
- Test cameras, speakers, buttons or the body. The page has a hands-on checklist for those.
- Measure drain while plugged in, because the phone charges. The drain test reads the level, you unplug for a timed run, then plug back in.

Not yet tested against a physical iPhone 17 Pro. Library: pymobiledevice3 11.x.
