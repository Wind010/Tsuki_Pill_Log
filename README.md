# Dog Pill Log (URL-Only)

Static HTML/CSS/JS tracker for a dog pill schedule (morning and evening).

The entire log is stored in the URL hash (`#d=...`). No database, cookies, or local storage are used.

## How It Works

- Each day has 2 bits of state:
  - Morning not given / given
  - Evening not given / given
- The app stores a rolling 365-day window.
- Data is bit-packed into bytes and encoded as [Base64url](https://en.wikipedia.org/wiki/Base64#URL_applications).
- A small [checksum](https://en.wikipedia.org/wiki/Checksum) is included for corruption detection.

```
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                                   RAW BYTE STREAM                                      │
 └────────────────────────────────────────────────────────────────────────────────────────┘
   │ Byte 0   │ Bytes 1 - 4       │ Bytes 5 - 6  │ Bytes 7 - 98         │ Bytes 99 - 100  │
   ├──────────┼───────────────────┼──────────────┼──────────────────────┼─────────────────┤
   │ Version  │ Start Epoch Day   │ Day Count    │ 2-Bit Packed Body    │ 16-Bit Checksum │
   │ (1 byte) │ (4 bytes, UInt32) │ (2 bytes)    │ (92 bytes, 365 days) │ (2 bytes)       │
   └──────────┴───────────────────┴──────────────┴──────────────────────┴─────────────────┘
   │ 0x01     │ 0x00 0x00 0x4F 0x2E  │ 0x01 0x6D    │ 0x0000...401D...00   │ 0x01 0x49    │
```

Bit-Packing Details (2 bits per day)
```
                      ONE BYTE (8 BITS)
 ┌─────────────────────────────────────────────────────────┐
 │  Day 1     │  Day 2     │  Day 3     │  Day 4     │
 ├────────────┼────────────┼────────────┼────────────┤
 │  M  │  E   │  M  │  E   │  M  │  E   │  M  │  E   │
 └─▲───┴──▲───┴─▲────┴──▲───┴─▲────┴──▲───┴─▲────┴──▲───┘
   │      │     │      │     │      │     │      │
 Bit 7   Bit 6 Bit 5  Bit 4 Bit 3  Bit 2 Bit 1  Bit 0

 (M = Morning given / E = Evening given)
```

The checksum logic is just `CRC16`:
```
[ Read Base64url String ] ──► [ Decode to Uint8Array ]
                                      │
                                      ├──► Extract bytes 0 to 98 ──► [ Compute checksum16 ]
                                      │                                      │
                                      └──► Extract bytes 99, 100 ────────────┼──► [ Do they match? ]
                                                                             │
                                              ┌──────────────────────────────┴──────────────┐
                                              ▼                                             ▼
                                          [ MATCH ]                                    [ MISMATCH ]
                                      Data is pristine                              Data is corrupted
```

## Run Locally

Open `index.html` in a browser.

Optional: use any simple static file server for local testing, but the app itself is pure client-side JavaScript.

## Deploy To GitHub Pages

1. Push this repo to GitHub.
2. In repository settings, open Pages.
3. Set source to deploy from the branch (usually `main`) and root (`/`).
4. Save.
5. Open the provided Pages URL.

GitHub Pages only serves static assets, which is exactly what this project uses (`index.html`, `styles.css`, `index.js`).

## Usage

1. Check morning/evening boxes for each day.
2. The URL updates automatically.
3. Share or bookmark the URL to keep the log state.

## Notes

- This is strict URL-only persistence.
- If URL data is invalid, the app starts a fresh log.
- A warning appears if URL length approaches conservative browser limits.